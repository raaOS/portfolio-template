import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import { requireOwnerMode } from '@/lib/ownerMode';
import {
  getBasePrice,
  getOwnerWhatsapp,
  updateBasePrice,
  updateOwnerWhatsapp,
} from '@/lib/services/pricingConfigService';

/**
 * GET /api/admin/pricing
 * Membaca harga dasar template (owner-mode only + admin).
 *
 * Guard `requireOwnerMode` menahan route ini di deployment klien (404):
 * harga dasar adalah data bisnis owner — penjualan site, bukan konten klien
 * (lihat src/lib/ownerMode.ts).
 *
 * Auth memakai `validateAdminRequest` (bukan `checkAdminAuth` polos) karena
 * login admin saat ini hanya menerbitkan sesi customer `site_user_token`
 * (`/api/auth/login` → `createLoginResponse`); `checkAdminAuth` hanya
 * mengenali cookie legacy `admin_token` → 401 untuk sesi yang ada (bug
 * 2026-10-08: panel Harga Jual selalu "Gagal memuat harga"). Pola identik
 * dengan GET route admin lain (backup, storage-stats).
 */
export async function GET(request: NextRequest) {
  try {
    const ownerDenied = requireOwnerMode();
    if (ownerDenied) return ownerDenied;

    if (!(await validateAdminRequest(request, { checkCsrf: false }))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [basePrice, adminWhatsapp] = await Promise.all([
      getBasePrice(),
      getOwnerWhatsapp(),
    ]);
    return NextResponse.json({ success: true, basePrice, adminWhatsapp });
  } catch (error: unknown) {
    console.error('GET /api/admin/pricing error:', error);
    return NextResponse.json({ error: 'Gagal memuat harga' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/pricing
 * Mengubah harga dasar template dan/atau nomor WhatsApp owner (admin + CSRF).
 * Body: { basePrice?: number, adminWhatsapp?: string }
 * Kedua field opsional — minimal satu harus ada. Field yang tidak dikirim
 * tidak diubah (konsumen lama yang hanya mengirim `basePrice` tetap aman).
 */
export async function PUT(request: NextRequest) {
  try {
    const ownerDenied = requireOwnerMode();
    if (ownerDenied) return ownerDenied;

    const isValid = await validateAdminRequest(request);
    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const hasPrice = body?.basePrice !== undefined;
    const hasWhatsapp = body?.adminWhatsapp !== undefined;

    if (!hasPrice && !hasWhatsapp) {
      return NextResponse.json(
        { error: 'Tidak ada data yang disimpan (basePrice / adminWhatsapp).' },
        { status: 400 }
      );
    }

    let basePrice: number | undefined;
    let adminWhatsapp: string | undefined;
    const saved: string[] = [];

    if (hasPrice) {
      const priceResult = await updateBasePrice(body?.basePrice);
      if (!priceResult.success) {
        return NextResponse.json(
          { error: priceResult.error || 'Gagal menyimpan harga' },
          { status: 400 }
        );
      }
      basePrice = priceResult.basePrice;
      saved.push('Harga');
    }

    if (hasWhatsapp) {
      const waResult = await updateOwnerWhatsapp(body?.adminWhatsapp);
      if (!waResult.success) {
        return NextResponse.json(
          { error: waResult.error || 'Gagal menyimpan nomor WhatsApp' },
          { status: 400 }
        );
      }
      adminWhatsapp = waResult.adminWhatsapp;
      saved.push('Nomor WhatsApp');
    }

    return NextResponse.json({
      success: true,
      ...(basePrice !== undefined ? { basePrice } : {}),
      ...(adminWhatsapp !== undefined ? { adminWhatsapp } : {}),
      message: `${saved.join(' & ')} berhasil disimpan`,
    });
  } catch (error: unknown) {
    console.error('PUT /api/admin/pricing error:', error);
    return NextResponse.json({ error: 'Gagal menyimpan harga' }, { status: 500 });
  }
}
