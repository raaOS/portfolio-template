import { NextRequest, NextResponse } from 'next/server';
import { queryD1 } from '@/lib/cloudflareD1';
import { expireOrderIfStale, verifyOrderAccessToken } from '@/lib/services/orderService';
import { checkAdminAuth } from '@/lib/auth';
import { getPaymentConfig } from '@/lib/services/paymentConfigService';
import { convertStaticQRISToDynamic, validateStaticMerchantQRIS } from '@/lib/billing/qris';
import { enforceRequestRateLimit } from '@/lib/security/request';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    // L3: batasi polling/scraping (brute-force mitigasi token).
    const rateLimit = await enforceRequestRateLimit(request, 'billing_qris_get', 30, 60_000, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Terlalu banyak permintaan. Silakan coba lagi beberapa saat.', retryAfter: rateLimit.retryAfter },
        { status: 429 }
      );
    }

    // Require access token (query param) or admin auth (JWT cookie)
    const token = request.nextUrl.searchParams.get('token');
    const accountIdQuery = request.nextUrl.searchParams.get('accountId');
    const isAdmin = checkAdminAuth(request);

    if (!isAdmin && !(token && (await verifyOrderAccessToken(orderId, token)))) {
      return NextResponse.json({ error: 'Token akses tidak valid' }, { status: 401 });
    }

    // H2: status akurat sebelum menampilkan QRIS (murah, by-id).
    await expireOrderIfStale(orderId);

    const rows = await queryD1<{ id: string; amount: number; status: string }>(
      'SELECT id, amount, status FROM orders WHERE id = ?',
      [orderId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });
    }

    const order = rows[0];
    if (!['pending_payment', 'waiting_verification', 'expired'].includes(order.status)) {
      return NextResponse.json({
        success: true,
        enabled: false,
        reason: 'Order ini tidak dalam status pembayaran',
      });
    }

    const config = await getPaymentConfig();

    if (!config.isActive || !config.qrisDynamicEnabled) {
      return NextResponse.json({
        success: true,
        enabled: false,
        reason: 'QRIS dinamis tidak diaktifkan oleh admin',
      });
    }

    const validActiveAccounts = config.qrisAccounts.filter((acc) => {
      if (!acc.isActive || !acc.staticPayload) return false;
      return validateStaticMerchantQRIS(acc.staticPayload).valid;
    });

    if (validActiveAccounts.length === 0) {
      return NextResponse.json({
        success: true,
        enabled: false,
        reason: 'Tidak ada akun QRIS statis yang valid',
      });
    }

    const generatedAccounts = validActiveAccounts.map((acc) => ({
      id: acc.id,
      label: acc.label,
      imageUrl: acc.imageUrl,
      qrisPayload: convertStaticQRISToDynamic(acc.staticPayload, order.amount),
    }));

    const selectedAccount =
      generatedAccounts.find((acc) => acc.id === accountIdQuery) || generatedAccounts[0];

    return NextResponse.json({
      success: true,
      enabled: true,
      selectedAccountId: selectedAccount.id,
      qrisPayload: selectedAccount.qrisPayload,
      amount: order.amount,
      accounts: generatedAccounts,
    });
  } catch (error: unknown) {
    console.error('Fetch order QRIS API error:', error);
    return NextResponse.json({ error: 'Gagal memuat QRIS dinamis pesanan' }, { status: 500 });
  }
}
