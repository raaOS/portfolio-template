import { NextRequest } from 'next/server';
import { db } from '@/lib/database';
import { feedbackSubmissionSchema, type FeedbackStatus } from '@/lib/validations';
import {
  success,
  badRequest,
  rateLimit,
  serverError,
  unauthorized,
  validationError,
} from '@/lib/api-response';
import { enforceRequestRateLimit, getClientIP } from '@/lib/security/request';
import { sanitizeInput } from '@/lib/security/sanitization';
import { validateAdminRequest } from '@/lib/auth';
import { getBannedWords, containsBannedWord } from '@/lib/services/bannedWordsService';

// Rate limit: max 3 submissions per 10 menit per IP.
// Cukup untuk iterasi pengiriman yang valid, cukup ketat untuk blokir spam.
const RATE_LIMIT_SCOPE = 'feedback';
const MAX_ATTEMPTS = 3;
const WINDOW_MS = 10 * 60 * 1000;
const BLOCK_MS = 30 * 60 * 1000;

// Minimum time (ms) antara modal dibuka dan submit — form diisi secepat kilat
// hampir pasti bot. Nilai disengaja pendek (1.5s) supaya user yang niat ninggalin
// rating doang (tanpa nulis pesan) tidak ke-block.
const MIN_FILL_TIME_MS = 1500;

// Rough age limit untuk duplicate check (per clientId) — 1 jam.
// Visitor dengan clientId yang sama tidak bisa kirim >1 feedback dalam rentang ini.
const DEDUP_WINDOW_MS = 60 * 60 * 1000;

async function hasRecentSubmissionFromClient(clientId: string): Promise<boolean> {
  try {
    const cutoff = Date.now() - DEDUP_WINDOW_MS;
    const snap = await db
      .ref('feedback')
      .orderByChild('clientId')
      .equalTo(clientId)
      .limitToLast(5)
      .once('value');
    const val = snap.val();
    if (!val) return false;
    return Object.values(val).some((entry) => {
      const e = entry as { createdAtMs?: number };
      return typeof e.createdAtMs === 'number' && e.createdAtMs > cutoff;
    });
  } catch {
    // On error, don't block submit — rate-limit layer masih aktif.
    return false;
  }
}

/**
 * POST /api/feedback
 *
 * Visitor-facing endpoint untuk exit-intent feedback.
 * - Tidak butuh auth / CSRF (di-allowlist di proxy/csrf)
 * - Rate-limited per IP + dedup per clientId
 * - Honeypot + minimum-fill-time untuk filter bot
 * - Banned words check (kata kasar otomatis direject)
 * - Default status: 'pending' — admin moderate sebelum dipajang publik
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const rl = await enforceRequestRateLimit(
      request,
      RATE_LIMIT_SCOPE,
      MAX_ATTEMPTS,
      WINDOW_MS,
      BLOCK_MS
    );
    if (!rl.allowed) {
      const retryAfter = rl.retryAfter ?? 60;
      return rateLimit(retryAfter, 'Terlalu banyak submission, coba lagi nanti');
    }

    const rawBody = await request.json().catch(() => null);
    if (!rawBody) return badRequest('Invalid JSON body');

    const parsed = feedbackSubmissionSchema.safeParse(rawBody);
    if (!parsed.success) return validationError(parsed.error);

    const { rating, message, name, fromPath, clientId, device, formOpenedAt, source, website_url } =
      parsed.data;

    // Honeypot — bot isi field hidden
    if (website_url && website_url.length > 0) {
      // Silent 200 — jangan kasih sinyal ke bot
      return success({ received: true }, 'Terima kasih');
    }

    // Minimum fill time — bot biasanya submit dalam milidetik
    if (typeof formOpenedAt === 'number' && Date.now() - formOpenedAt < MIN_FILL_TIME_MS) {
      return success({ received: true }, 'Terima kasih');
    }

    // Dedup per-client (opsional — kalau clientId dikirim)
    if (clientId && (await hasRecentSubmissionFromClient(clientId))) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Feedback] Duplicate submission blocked (clientId within dedup window)', {
          clientId: clientId.slice(0, 8) + '...',
        });
      }
      return success(
        { received: true, duplicate: true },
        'Kamu sudah kirim feedback belum lama ini'
      );
    }

    // Sanitize free-text
    const safeMessage = message ? sanitizeInput(message) : '';
    const safeName = name ? sanitizeInput(name) : '';
    const safePath = fromPath ? sanitizeInput(fromPath).slice(0, 200) : '/';

    // Banned words check — cek nama + pesan
    const banned = await getBannedWords();
    if (
      (safeMessage && containsBannedWord(safeMessage, banned)) ||
      (safeName && containsBannedWord(safeName, banned))
    ) {
      // Silent 200 — jangan kasih tahu attacker kata apa yang di-block
      return success({ received: true }, 'Terima kasih');
    }

    // Persist ke CLOUDFLARE_D1
    const now = new Date();
    const payload = {
      rating,
      message: safeMessage,
      name: safeName || 'Anonymous',
      fromPath: safePath,
      clientId: clientId ?? null,
      device: device ?? null,
      source: source ?? 'exit-intent',
      status: 'pending' as FeedbackStatus,
      isPublic: false,
      createdAt: now.toISOString(),
      createdAtMs: now.getTime(),
      ip: getClientIP(request),
      userAgent: request.headers.get('user-agent')?.slice(0, 200) || 'unknown',
    };

    const ref = await db.ref('feedback').push(payload);

    return success({ id: ref.key, received: true }, 'Terima kasih atas feedback-nya');
  } catch (error) {
    console.error('[API /feedback POST] Error:', error instanceof Error ? error.message : error);
    return serverError('Failed to submit feedback');
  }
}

/**
 * GET /api/feedback
 *
 * Admin-only — list semua feedback untuk moderation panel.
 * Query params:
 *   - status: filter 'pending' | 'approved' | 'hidden' | 'deleted' | 'all' (default: 'all')
 *   - limit: max items (default 100)
 */
export async function GET(request: NextRequest) {
  try {
    if (!(await validateAdminRequest(request, { checkCsrf: false }))) {
      return unauthorized('Admin authentication required');
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? 'all';
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') ?? '100', 10) || 100, 1),
      500
    );

    const snap = await db
      .ref('feedback')
      .orderByChild('createdAtMs')
      .limitToLast(limit)
      .once('value');
    const raw = snap.val() as Record<string, Record<string, unknown>> | null;

    const items: Array<Record<string, unknown>> = [];
    if (raw) {
      for (const [id, doc] of Object.entries(raw)) {
        if (status !== 'all' && doc.status !== status) continue;
        items.push({ id, ...doc });
      }
    }
    items.sort((a, b) => (String(b.createdAt) > String(a.createdAt) ? 1 : -1));

    return success({ feedback: items, total: items.length });
  } catch (error) {
    console.error('[API /feedback GET] Error:', error instanceof Error ? error.message : error);
    return serverError('Failed to load feedback');
  }
}
