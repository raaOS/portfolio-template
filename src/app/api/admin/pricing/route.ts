import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest, checkAdminAuth } from '@/lib/auth';
import { getBasePrice, updateBasePrice } from '@/lib/services/pricingConfigService';

/**
 * GET /api/admin/pricing
 * Membaca harga dasar template (admin-only).
 */
export async function GET(request: NextRequest) {
  try {
    if (!checkAdminAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const basePrice = await getBasePrice();
    return NextResponse.json({ success: true, basePrice });
  } catch (error: unknown) {
    console.error('GET /api/admin/pricing error:', error);
    return NextResponse.json({ error: 'Gagal memuat harga' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/pricing
 * Mengubah harga dasar template (admin-only + CSRF).
 * Body: { basePrice: number }
 */
export async function PUT(request: NextRequest) {
  try {
    const isValid = await validateAdminRequest(request);
    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const result = await updateBasePrice(body?.basePrice);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Gagal menyimpan harga' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      basePrice: result.basePrice,
      message: 'Harga berhasil disimpan',
    });
  } catch (error: unknown) {
    console.error('PUT /api/admin/pricing error:', error);
    return NextResponse.json({ error: 'Gagal menyimpan harga' }, { status: 500 });
  }
}
