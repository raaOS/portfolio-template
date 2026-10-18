/**
 * Customer Auth — Reset Password API
 * POST /api/auth/reset-password
 * Menukar token reset (dari email) dengan password baru. Token sekali pakai,
 * kadaluarsa 30 menit; semua sesi login lama dicabut setelah berhasil.
 */
import { NextRequest, NextResponse } from 'next/server';
import { SITE_ID } from '@/crud/shared/config';
import { checkDataRateLimit } from '@/lib/dataRateLimit';
import { getClientIP } from '@/lib/security/request';
import { resetPasswordWithToken } from '@/lib/services/passwordResetService';

export const dynamic = 'force-dynamic';

// Pelindung penebakan token: 5 percobaan / 10 menit per IP, blokir 30 menit.
const MAX_ATTEMPTS_PER_WINDOW = 5;
const RATE_LIMIT_WINDOW = 10 * 60 * 1000;
const BLOCK_DURATION = 30 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const rateLimitIp = getClientIP(request);
    const rateLimit = await checkDataRateLimit(
      `resetpwd_try_${rateLimitIp}`,
      MAX_ATTEMPTS_PER_WINDOW,
      RATE_LIMIT_WINDOW,
      BLOCK_DURATION
    );

    if (!rateLimit.allowed) {
      const retryAfterSeconds = rateLimit.retryAfter ?? 60;
      const retryMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
      return NextResponse.json(
        {
          error: `Terlalu banyak percobaan. Coba lagi dalam ±${retryMinutes} menit.`,
          retryAfter: retryAfterSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfterSeconds) },
        }
      );
    }

    const body = await request.json().catch(() => null);
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

    const result = await resetPasswordWithToken(SITE_ID, token, newPassword);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      ok: true,
      message: 'Password baru sudah tersimpan. Silakan login dengan password baru Anda.',
    });
  } catch (error) {
    console.error('[Auth] /api/auth/reset-password gagal:', error);
    return NextResponse.json(
      { error: 'Layanan sedang bermasalah. Coba lagi beberapa saat.' },
      { status: 500 }
    );
  }
}
