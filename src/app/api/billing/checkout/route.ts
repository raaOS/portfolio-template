import { NextRequest, NextResponse } from 'next/server';
import { createOrder } from '@/lib/services/orderService';
import { isSlugAvailable, validateSlugFormat } from '@/lib/services/slugService';
import { enforceRequestRateLimit } from '@/lib/security/request';
import { checkDataRateLimit } from '@/lib/dataRateLimit';

/**
 * GET /api/billing/checkout?slug=xxx
 * Cek ketersediaan slug (masih diperlukan untuk admin/setup flow).
 */
export async function GET(request: NextRequest) {
  try {
    // SECURITY FIX (audit 2026-09-29): cek slug juga membaca D1 — beri limit
    // IP-only agar tidak bisa dijadikan pembanjiran query.
    const rateLimit = await enforceRequestRateLimit(request, 'billing_slug_check', 30, 60_000, 300_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Terlalu banyak permintaan. Silakan coba lagi beberapa saat.', retryAfter: rateLimit.retryAfter },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json({ error: 'Parameter slug wajib diisi' }, { status: 400 });
    }

    const formatResult = validateSlugFormat(slug);
    if (!formatResult.valid) {
      return NextResponse.json({ available: false, reason: formatResult.reason });
    }

    const available = await isSlugAvailable(slug);

    return NextResponse.json({
      available,
      slug: formatResult.normalizedSlug,
      reason: available ? 'Slug tersedia' : 'Slug tidak tersedia atau sudah digunakan'
    });
  } catch (error: unknown) {
    console.error('Checkout check-slug API error:', error);
    return NextResponse.json({ error: 'Gagal memeriksa ketersediaan slug' }, { status: 500 });
  }
}

/**
 * POST /api/billing/checkout
 * Buat order baru. Slug opsional — auto-generate dari nama buyer.
 */
export async function POST(request: NextRequest) {
  try {
    // Same-Origin guard untuk endpoint publik tanpa cookie CSRF (lihat checkCSRF
    // di src/middleware/csrf.ts). Diulang di handler sebagai defense-in-depth:
    // kalau middleware dilewati (mis. route di luar pipeline), request cross-origin
    // tetap ditolak sebelum createOrder jalan.
    const host = request.headers.get('host');
    const origin = request.headers.get('origin');
    if (origin && host) {
      let sameOrigin = false;
      try {
        sameOrigin = new URL(origin).host === host;
      } catch {
        sameOrigin = false;
      }
      if (!sameOrigin) {
        console.warn('[Security] Cross-origin billing checkout POST blocked.');
        return NextResponse.json({ error: 'Cross-origin request not allowed' }, { status: 403 });
      }
    }

    // SECURITY FIX (audit 2026-09-29): pool nominal unik hanya 999 slot yang
    // dikunci 24 jam per order — limit diperketat (5/menit, block 10 menit)
    // dan key-nya sudah IP-only sejak perbaikan rate limiter.
    const rateLimit = await enforceRequestRateLimit(request, 'billing_checkout', 5, 60_000, 600_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Terlalu banyak permintaan. Silakan coba lagi beberapa saat.', retryAfter: rateLimit.retryAfter },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { buyerName, buyerEmail, buyerWhatsapp, desiredSlug, templateId } = body;

    if (!buyerName || !buyerEmail || !buyerWhatsapp) {
      return NextResponse.json({ error: 'Data form checkout tidak lengkap' }, { status: 400 });
    }

    // Rate-limit per email — cegah spam order pakai identitas berbeda tapi inbox sama.
    const emailNormalized = String(buyerEmail).trim().toLowerCase();
    const emailLimit = await checkDataRateLimit(`billing_checkout_email:${emailNormalized}`, 5, 3_600_000, 86_400_000);
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { error: 'Terlalu banyak pesanan dari email ini. Tunggu sebelum membuat pesanan baru.', retryAfter: emailLimit.retryAfter },
        { status: 429 }
      );
    }

    // Auto-generate slug dari nama buyer jika tidak disediakan
    const slug = desiredSlug
      ? desiredSlug.trim().toLowerCase()
      : buyerName
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 30) || 'portfolio';

    const result = await createOrder(
      {
        buyerName,
        buyerEmail,
        buyerWhatsapp,
        desiredSlug: slug,
        templateId: typeof templateId === 'string' && templateId.trim() ? templateId.trim() : undefined,
      },
      {
        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
        TELEGRAM_ADMIN_CHAT_ID: process.env.TELEGRAM_ADMIN_CHAT_ID,
        APP_BASE_URL: process.env.NEXT_PUBLIC_APP_URL,
      }
    );

    if (!result.success || !result.order) {
      return NextResponse.json({ error: result.error || 'Gagal membuat order' }, { status: 400 });
    }

    const tokenParam = result.accessToken ? `?token=${result.accessToken}` : '';

    return NextResponse.json({
      success: true,
      order: result.order,
      accessToken: result.accessToken,
      redirectUrl: `/orders/${result.order.id}${tokenParam}`
    });
  } catch (error: unknown) {
    console.error('Checkout API error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan sistem saat submit order' }, { status: 500 });
  }
}
