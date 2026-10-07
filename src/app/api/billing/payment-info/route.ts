import { NextResponse } from 'next/server';
import { getPublicPaymentInfo } from '@/lib/services/paymentConfigService';
import { getBasePrice } from '@/lib/services/pricingConfigService';

/**
 * GET /api/billing/payment-info
 * Endpoint publik untuk membaca info pembayaran (QRIS, bank, jam operasional)
 * plus harga dasar template (PK4) — dipakai halaman checkout sebagai satu
 * fetch saja (hemat request Worker).
 */
export async function GET() {
  try {
    const [info, basePrice] = await Promise.all([getPublicPaymentInfo(), getBasePrice()]);
    return NextResponse.json({ success: true, basePrice, ...info });
  } catch (error: unknown) {
    console.error('GET /api/billing/payment-info error:', error);
    return NextResponse.json(
      { error: 'Gagal memuat info pembayaran' },
      { status: 500 }
    );
  }
}
