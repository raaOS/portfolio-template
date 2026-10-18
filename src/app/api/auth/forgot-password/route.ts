/**
 * Customer Auth — Forgot Password API
 * POST /api/auth/forgot-password
 * Membuat link reset (sekali pakai, kadaluarsa 30 menit) dan mengirimkannya
 * ke email admin. Respons SELALU sama untuk email terdaftar maupun tidak
 * (anti email-enumeration).
 */
import { NextRequest, NextResponse } from 'next/server';
import { SITE_ID } from '@/crud/shared/config';
import { checkDataRateLimit } from '@/lib/dataRateLimit';
import { getClientIP } from '@/lib/security/request';
import { isEmailProviderConfigured, requestPasswordReset } from '@/lib/services/passwordResetService';

export const dynamic = 'force-dynamic';

// Pelindung email-bombing & pemborosan kuota kirim: 3 permintaan / 10 menit
// per IP, blokir 60 menit.
const MAX_ATTEMPTS_PER_WINDOW = 3;
const RATE_LIMIT_WINDOW = 10 * 60 * 1000;
const BLOCK_DURATION = 60 * 60 * 1000;

// Pesan sukses yang SAMA untuk semua kasus. Kalau sistem membedakan jawaban,
// orang asing bisa memeriksa mana email yang punya akses admin.
const GENERIC_MESSAGE =
  'Jika email terdaftar, tautan atur ulang password sudah dikirim. Periksa kotak masuk (dan folder spam) Anda. Tautan berlaku 30 menit.';

export async function POST(request: NextRequest) {
  try {
    const rateLimitIp = getClientIP(request);
    const rateLimit = await checkDataRateLimit(
      `resetpwd_${rateLimitIp}`,
      MAX_ATTEMPTS_PER_WINDOW,
      RATE_LIMIT_WINDOW,
      BLOCK_DURATION
    );

    if (!rateLimit.allowed) {
      const retryAfterSeconds = rateLimit.retryAfter ?? 60;
      const retryMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
      return NextResponse.json(
        {
          error: `Terlalu banyak permintaan atur ulang password. Coba lagi dalam ±${retryMinutes} menit.`,
          retryAfter: retryAfterSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfterSeconds) },
        }
      );
    }

    // Provider email dicek SEBELUM menyentuh data: kalau belum dikonfigurasi,
    // beri tahu jujur ke semua orang (global → tidak membocorkan apa pun).
    if (!isEmailProviderConfigured()) {
      return NextResponse.json(
        { error: 'Fitur atur ulang password lewat email belum aktif di situs ini. Hubungi owner Anda.' },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => null);
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    if (!email) {
      return NextResponse.json({ error: 'Email wajib diisi.' }, { status: 400 });
    }

    // Hasil internal (email tanpa akun / email gagal dikirim) sengaja TIDAK
    // dikirim ke layar — hanya dicatat di log worker.
    try {
      const result = await requestPasswordReset(SITE_ID, email);
      if (!result.emailSent) {
        console.warn('[PasswordReset] Reset diminta untuk email tanpa akun, atau email gagal dikirim.');
      }
    } catch (error) {
      // Kegagalan internal jangan pernah bocor ke layar (bisa membedakan
      // kasus) — tetap jawab sukses generik.
      console.error('[PasswordReset] requestPasswordReset gagal:', error);
    }

    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  } catch (error) {
    console.error('[Auth] /api/auth/forgot-password gagal:', error);
    return NextResponse.json(
      { error: 'Layanan sedang bermasalah. Coba lagi beberapa saat.' },
      { status: 500 }
    );
  }
}
