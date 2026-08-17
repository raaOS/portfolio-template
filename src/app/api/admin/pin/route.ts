import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest, verifyAdminPassword, hashPasswordScrypt } from '@/lib/auth';
import { db } from '@/lib/database';
import { getClientIdentifier } from '@/lib/security/request';
import { logAdminActivity } from '@/lib/services/auditLogger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const isValid = await validateAdminRequest(request, { checkCsrf: true });
    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized or invalid CSRF token' }, { status: 401 });
    }

    const body = await request.json();
    const { oldPassword, newPin } = body;

    if (!oldPassword || typeof oldPassword !== 'string') {
      return NextResponse.json({ error: 'Sandi lama wajib diisi' }, { status: 400 });
    }

    if (!newPin || typeof newPin !== 'string' || !/^\d{4}$/.test(newPin)) {
      return NextResponse.json({ error: 'PIN baru wajib 4 digit angka' }, { status: 400 });
    }

    let isOldValid = false;
    try {
      isOldValid = await verifyAdminPassword(oldPassword);
    } catch {
      return NextResponse.json({ error: 'Kesalahan layanan autentikasi' }, { status: 500 });
    }

    if (!isOldValid) {
      return NextResponse.json({ error: 'Sandi lama tidak sesuai' }, { status: 401 });
    }

    const salt = process.env.PASSWORD_SALT;
    if (!salt) {
      return NextResponse.json(
        { error: 'Konfigurasi PASSWORD_SALT tidak ditemukan di environment' },
        { status: 500 }
      );
    }

    const hashedNewPin = hashPasswordScrypt(newPin, salt);
    await db.ref('settings/adminPin').set(hashedNewPin);
    await db.ref('settings/adminPinOtp').remove().catch(() => {});

    const clientId = getClientIdentifier(request);
    const pipeIdx = clientId.indexOf('|');
    const ip = pipeIdx > -1 ? clientId.substring(0, pipeIdx) : clientId;

    await logAdminActivity(request, 'Admin PIN changed', { ip }).catch((error) => {
      console.error('[Audit] Failed to log PIN change:', error);
    });

    return NextResponse.json({
      success: true,
      message: 'PIN admin berhasil diubah.',
    });
  } catch (error) {
    console.error('[API/Admin/Pin] Update failed:', error);
    return NextResponse.json({ error: 'Gagal mengubah PIN' }, { status: 500 });
  }
}
