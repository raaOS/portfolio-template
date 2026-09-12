/**
 * Customer Auth — Change Password API
 * POST /api/auth/change-password
 * Self-service password change for the authenticated site user.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/crud/shared/auth/guard';
import { changeSiteUserPassword } from '@/crud/shared/auth/changePassword';
import { checkDataRateLimit } from '@/lib/dataRateLimit';
import { getClientIP } from '@/lib/security/request';
import { validateCSRFToken } from '@/lib/security/token';
import { CSRF_TOKEN_COOKIE, CSRF_TOKEN_HEADER } from '@/lib/security/constants';

export const dynamic = 'force-dynamic';

// Guard brute-force terhadap password saat ini: 5 percobaan / 5 menit, blokir 15 menit.
const MAX_ATTEMPTS_PER_WINDOW = 5;
const RATE_LIMIT_WINDOW = 5 * 60 * 1000;
const BLOCK_DURATION = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    // CSRF: user terautentikasi selalu punya cookie csrf_token (diset saat login).
    const csrfToken = request.headers.get(CSRF_TOKEN_HEADER);
    const cookieToken = request.cookies.get(CSRF_TOKEN_COOKIE)?.value;
    if (!csrfToken || !cookieToken || !validateCSRFToken(csrfToken, cookieToken)) {
      return NextResponse.json({ error: 'Invalid or missing CSRF token' }, { status: 403 });
    }

    const auth = await requireAuth(request);
    if (auth.response) {
      return auth.response;
    }

    // Rate limit per IP + user agar verifikasi password saat ini tidak bisa di-brute force.
    const rateLimitIp = getClientIP(request);
    const rateLimit = await checkDataRateLimit(
      `chpwd_${rateLimitIp}_${auth.session.userId}`,
      MAX_ATTEMPTS_PER_WINDOW,
      RATE_LIMIT_WINDOW,
      BLOCK_DURATION
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Terlalu banyak percobaan. Coba lagi nanti.',
          retryAfter: rateLimit.retryAfter,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) },
        }
      );
    }

    const body = (await request.json().catch(() => null)) as {
      currentPassword?: string;
      newPassword?: string;
    } | null;

    if (!body || !body.currentPassword || !body.newPassword) {
      return NextResponse.json(
        { error: 'Password saat ini dan password baru wajib diisi' },
        { status: 400 }
      );
    }

    const result = await changeSiteUserPassword(auth.session.siteId, auth.session.userId, {
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, message: 'Password berhasil diganti' });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses permintaan' }, { status: 500 });
  }
}
