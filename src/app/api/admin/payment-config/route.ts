import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import {
  getAdminPaymentConfig,
  updatePaymentConfig,
} from '@/lib/services/paymentConfigService';

/**
 * GET /api/admin/payment-config
 * Membaca konfigurasi pembayaran (admin-only).
 */
export async function GET(request: NextRequest) {
  try {
    // validateAdminRequest (bukan checkAdminAuth polos) — mengenali sesi
    // customer site_user_token; checkAdminAuth hanya tahu cookie legacy
    // admin_token → 401. GET tanpa CSRF, pola route admin lain (2026-10-08).
    if (!(await validateAdminRequest(request, { checkCsrf: false }))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await getAdminPaymentConfig();
    return NextResponse.json({ success: true, config });
  } catch (error: unknown) {
    console.error('GET /api/admin/payment-config error:', error);
    return NextResponse.json(
      { error: 'Gagal memuat konfigurasi pembayaran' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/payment-config
 * Memperbarui konfigurasi pembayaran (admin-only + CSRF).
 */
export async function PUT(request: NextRequest) {
  try {
    const isValid = await validateAdminRequest(request);
    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const result = await updatePaymentConfig(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Gagal menyimpan konfigurasi' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Konfigurasi pembayaran berhasil disimpan',
    });
  } catch (error: unknown) {
    console.error('PUT /api/admin/payment-config error:', error);
    return NextResponse.json(
      { error: 'Gagal menyimpan konfigurasi pembayaran' },
      { status: 500 }
    );
  }
}
