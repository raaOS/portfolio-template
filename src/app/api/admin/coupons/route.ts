import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import { requireOwnerMode } from '@/lib/ownerMode';
import { bootstrapD1Schema } from '@/lib/cloudflareD1';
import { logActivity } from '@/lib/services/auditLogger';
import {
  archiveCoupon,
  createCoupon,
  listCoupons,
  updateCoupon,
} from '@/lib/services/couponService';
import { generateCouponCode } from '@/lib/services/checkoutPricing';

/**
 * /api/admin/coupons — CRUD kupon diskon (OWNER MODE ONLY).
 *
 * Kupon adalah alat penjualan owner, bukan konten klien: deployment klien
 * membalas 404 lewat `requireOwnerMode()` sebelum auth dievaluasi.
 *
 * Aksi:
 * - GET  → daftar kupon + jumlah pemakaian & total potongan.
 * - POST { action: 'generate', prefix? } → usulkan kode acak (belum disimpan).
 * - POST { action: 'create', ...field } → simpan kupon baru.
 * - POST { action: 'update', id, ...field } → ubah kupon.
 * - POST { action: 'archive', id } → arsipkan (soft delete; riwayat tetap).
 *
 * Tidak ada aksi hapus permanen: kupon yang sudah dipakai adalah bukti
 * pendapatan, dan redemption-nya ikut hilang bila baris dihapus.
 */
export async function GET(request: NextRequest) {
  try {
    const ownerDenied = requireOwnerMode();
    if (ownerDenied) return ownerDenied;

    // Tabel `coupons`/`coupon_redemptions` baru ada sejak v1.3.93 dan deploy
    // TIDAK menjalankan `cf:bootstrap`. Bootstrap di sini (idempoten, sekali per
    // isolate) memastikan panel kupon tidak error di deployment yang belum
    // pernah menulis konten sejak upgrade.
    await bootstrapD1Schema();

    if (!(await validateAdminRequest(request, { checkCsrf: false }))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const coupons = await listCoupons();
    return NextResponse.json({ success: true, coupons });
  } catch (error: unknown) {
    console.error('GET /api/admin/coupons error:', error);
    return NextResponse.json({ error: 'Gagal memuat daftar kupon' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ownerDenied = requireOwnerMode();
    if (ownerDenied) return ownerDenied;

    // Lihat catatan di GET — bootstrap sebelum menyentuh tabel kupon.
    await bootstrapD1Schema();

    if (!(await validateAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const action = typeof body?.action === 'string' ? body.action : '';

    if (action === 'generate') {
      const prefix =
        typeof body?.prefix === 'string' && body.prefix.trim()
          ? body.prefix.trim()
          : 'HEMAT';
      return NextResponse.json({ success: true, code: generateCouponCode(prefix) });
    }

    if (action === 'create') {
      const result = await createCoupon(body);
      if (!result.success || !result.coupon) {
        return NextResponse.json({ error: result.error || 'Gagal membuat kupon' }, { status: 400 });
      }
      await logActivity('admin.coupon.created', {
        category: 'billing',
        actor: 'owner',
        couponId: result.coupon.id,
        code: result.coupon.code,
      });
      return NextResponse.json({
        success: true,
        message: `Kupon ${result.coupon.code} dibuat.`,
        coupon: result.coupon,
      });
    }

    if (action === 'update') {
      const id = typeof body?.id === 'string' ? body.id : '';
      if (!id) return NextResponse.json({ error: 'ID kupon wajib diisi.' }, { status: 400 });

      const result = await updateCoupon(id, body);
      if (!result.success || !result.coupon) {
        return NextResponse.json({ error: result.error || 'Gagal mengubah kupon' }, { status: 400 });
      }
      await logActivity('admin.coupon.updated', {
        category: 'billing',
        actor: 'owner',
        couponId: id,
        code: result.coupon.code,
      });
      return NextResponse.json({
        success: true,
        message: `Kupon ${result.coupon.code} diperbarui.`,
        coupon: result.coupon,
      });
    }

    if (action === 'archive') {
      const id = typeof body?.id === 'string' ? body.id : '';
      if (!id) return NextResponse.json({ error: 'ID kupon wajib diisi.' }, { status: 400 });

      const result = await archiveCoupon(id);
      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Gagal mengarsipkan kupon' }, { status: 400 });
      }
      await logActivity('admin.coupon.archived', {
        category: 'billing',
        actor: 'owner',
        couponId: id,
      });
      return NextResponse.json({ success: true, message: 'Kupon diarsipkan.' });
    }

    return NextResponse.json({ error: 'Action tidak valid.' }, { status: 400 });
  } catch (error: unknown) {
    console.error('POST /api/admin/coupons error:', error);
    return NextResponse.json({ error: 'Gagal memproses kupon' }, { status: 500 });
  }
}
