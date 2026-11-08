import { NextRequest, NextResponse } from 'next/server';
import { SITE_ID } from '@/crud/shared/config';
import { getSiteSetting } from '@/crud/shared/settings/site';
import { queryD1 } from '@/crud/shared/db/connection';
import { getOwnerWhatsapp } from '@/lib/services/pricingConfigService';
import { enforceRequestRateLimit } from '@/lib/security/request';

/**
 * GET /api/onboarding/r2-status?token=<wizard-token>
 *
 * Deferred R2 (v1.3.78): status aktivasi media untuk wizard handover.
 * Endpoint publik READ-ONLY — tidak ada mutasi dari browser. Token diverifikasi
 * terhadap hash di `site_settings` (sha256 hex; pembanding timing-safe pola
 * `r2Storage.ts:444-451`). Rate limit posture sama dengan token order
 * (billing orders route: 30/menit).
 *
 * Status:
 *  - `selesai`            → wizard_completed=true dicek PERTAMA (tanpa validasi
 *                           token; completion bukan rahasia). Link lama tetap
 *                           menampilkan konfirmasi, bukan error.
 *  - `menunggu-aktivasi`  → token valid & ≤30 hari; respons menyertakan
 *                           deep-link dashboard + link WA (account id & nomor
 *                           owner dikirim hanya ke pemegang token valid).
 *  - 404 `none`/`expired` → token salah/kadaluarsa → overlay tidak tampil.
 *
 * DILARANG membaca `?onboard=` di server component/ISR (home revalidate 60s —
 * token bisa ter-bake ke cache HTML); overlay membacanya via
 * window.location.search di client.
 */

const WIZARD_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 hari

type WizardPendingPayload = {
  status: 'menunggu-aktivasi';
  siteName: string;
  dashboardUrl: string;
  whatsappUrl: string;
};

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function GET(request: NextRequest) {
  const rateLimit = await enforceRequestRateLimit(
    request,
    'onboarding_r2_status',
    30,
    60_000,
    60_000
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { status: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } }
    );
  }

  const token = (request.nextUrl.searchParams.get('token') || '').trim();
  if (!token) {
    return NextResponse.json({ status: 'none' }, { status: 404 });
  }

  try {
    // 1. Selesai → jawab tanpa validasi token (link lama tetap menampilkan
    //    konfirmasi; tidak membocorkan apa pun).
    const completed = await getSiteSetting<boolean>(SITE_ID, 'wizard_completed');
    if (completed === true) {
      return NextResponse.json({ status: 'selesai' });
    }

    // 2. Pending: validasi hash + umur token.
    const [pending, hash, createdAt] = await Promise.all([
      getSiteSetting<boolean>(SITE_ID, 'media_pending'),
      getSiteSetting<string>(SITE_ID, 'wizard_token_hash'),
      getSiteSetting<string>(SITE_ID, 'wizard_token_created_at'),
    ]);
    if (pending !== true || typeof hash !== 'string' || !hash || typeof createdAt !== 'string') {
      return NextResponse.json({ status: 'none' }, { status: 404 });
    }

    const tokenHash = await sha256Hex(token);
    if (!timingSafeEqual(tokenHash, hash)) {
      return NextResponse.json({ status: 'none' }, { status: 404 });
    }

    const ageMs = Date.now() - Date.parse(createdAt);
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > WIZARD_TOKEN_MAX_AGE_MS) {
      return NextResponse.json({ status: 'expired' }, { status: 404 });
    }

    // 3. Susun payload panduan (nama situs, deep-link dashboard, link WA).
    let siteName = '';
    try {
      const rows = await queryD1<{ name: string }>(
        `SELECT name FROM sites WHERE id = ? LIMIT 1`,
        [SITE_ID]
      );
      siteName = rows[0]?.name || '';
    } catch {
      siteName = '';
    }

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
    const dashboardUrl = accountId
      ? `https://dash.cloudflare.com/${accountId}/r2/overview`
      : 'https://dash.cloudflare.com/';

    const ownerWa = await getOwnerWhatsapp();
    const waText =
      `Halo, saya sudah mengaktifkan R2 untuk situs ${siteName || SITE_ID}. ` +
      `Mohon diselesaikan aktivasi medianya. Terima kasih!`;
    const whatsappUrl = ownerWa
      ? `https://wa.me/${ownerWa}?text=${encodeURIComponent(waText)}`
      : '';

    const payload: WizardPendingPayload = {
      status: 'menunggu-aktivasi',
      siteName: siteName || SITE_ID,
      dashboardUrl,
      whatsappUrl,
    };
    return NextResponse.json(payload);
  } catch (error) {
    console.error('[API/Onboarding/R2Status] error:', error);
    // Fail-closed: kegagalan infrastruktur = overlay tidak tampil.
    return NextResponse.json({ status: 'none' }, { status: 404 });
  }
}
