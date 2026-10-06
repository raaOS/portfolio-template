import { NextRequest, NextResponse } from 'next/server';
import { queryD1 } from '@/lib/cloudflareD1';
import { expireOrderIfStale, uploadPaymentProof, verifyOrderAccessToken } from '@/lib/services/orderService';
import { checkAdminAuth } from '@/lib/auth';
import { enforceRequestRateLimit } from '@/lib/security/request';
import { logActivity } from '@/lib/services/auditLogger';

/**
 * Masks PII fields for public display.
 * Email: first char + *** + @domain  |  Phone: first 4 chars + ****
 */
function maskPII(order: Record<string, unknown>) {
  const email = typeof order.buyer_email === 'string' ? order.buyer_email : '';
  const whatsapp = typeof order.buyer_whatsapp === 'string' ? order.buyer_whatsapp : '';

  const atIdx = email.indexOf('@');
  const maskedEmail = atIdx > 0 ? email[0] + '***' + email.substring(atIdx) : '***';
  const maskedWhatsapp = whatsapp.length > 4 ? whatsapp.substring(0, 4) + '****' : '****';

  return {
    ...order,
    buyer_email: maskedEmail,
    buyer_whatsapp: maskedWhatsapp,
    // Never expose access_token_hash or payment_proof_url to unauthenticated callers
    access_token_hash: undefined,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    // L3: batasi polling/screping kunci independen dari token (brute-force mitigasi).
    const rateLimit = await enforceRequestRateLimit(request, 'billing_order_get', 30, 60_000, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Terlalu banyak permintaan. Silakan coba lagi beberapa saat.', retryAfter: rateLimit.retryAfter },
        { status: 429 }
      );
    }

    // Require access token (query param) or admin auth (JWT cookie)
    const token = request.nextUrl.searchParams.get('token');
    const isAdmin = checkAdminAuth(request);

    if (!isAdmin && !(token && await verifyOrderAccessToken(orderId, token))) {
      return NextResponse.json({ error: 'Token akses tidak valid' }, { status: 401 });
    }

    // H2: pastikan status sudah akurat sebelum dikirim ke pembeli (murah, by-id).
    await expireOrderIfStale(orderId);

    const rows = await queryD1(
      'SELECT id, desired_slug, buyer_name, buyer_email, buyer_whatsapp, amount, payment_method, payment_proof_url, status, expires_at, updated_at, created_at FROM orders WHERE id = ?',
      [orderId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });
    }

    // Admin gets full data; buyer gets masked PII
    const order = isAdmin ? rows[0] : maskPII(rows[0] as Record<string, unknown>);

    return NextResponse.json({ success: true, order });
  } catch (error: unknown) {
    console.error('Fetch order API error:', error);
    return NextResponse.json({ error: 'Gagal mengambil data order' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    const rateLimit = await enforceRequestRateLimit(request, 'billing_proof_upload', 5, 60_000, 300_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Terlalu banyak permintaan. Silakan coba lagi beberapa saat.', retryAfter: rateLimit.retryAfter },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { proofUrl, token } = body;

    // Require access token in body or admin auth
    const isAdmin = checkAdminAuth(request);
    if (!isAdmin && !(token && await verifyOrderAccessToken(orderId, token))) {
      return NextResponse.json({ error: 'Token akses tidak valid' }, { status: 401 });
    }

    if (!proofUrl || typeof proofUrl !== 'string') {
      return NextResponse.json({ error: 'URL bukti transfer wajib diisi' }, { status: 400 });
    }

    const result = await uploadPaymentProof(
      orderId,
      proofUrl,
      {
        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
        TELEGRAM_ADMIN_CHAT_ID: process.env.TELEGRAM_ADMIN_CHAT_ID
      }
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Gagal memproses bukti bayar' }, { status: 400 });
    }

    await logActivity('billing.proof_upload', {
      category: 'billing',
      orderId,
      actor: isAdmin ? 'admin' : 'buyer',
    });

    return NextResponse.json({
      success: true,
      message: 'Bukti pembayaran berhasil diunggah dan sedang dalam verifikasi admin.'
    });
  } catch (error: unknown) {
    console.error('Upload proof API error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengunggah bukti bayar' }, { status: 500 });
  }
}
