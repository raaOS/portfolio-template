import { NextResponse } from 'next/server';
import { getPublicPaymentInfo } from '@/lib/services/paymentConfigService';

/**
 * GET /api/billing/payment-info
 * Endpoint publik untuk membaca info pembayaran (QRIS, bank, jam operasional).
 * Dipakai oleh halaman checkout dan order detail.
 */
export async function GET() {
  try {
    const info = await getPublicPaymentInfo();
    return NextResponse.json({ success: true, ...info });
  } catch (error: unknown) {
    console.error('GET /api/billing/payment-info error:', error);
    return NextResponse.json(
      { error: 'Gagal memuat info pembayaran' },
      { status: 500 }
    );
  }
}
