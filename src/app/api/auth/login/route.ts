/**
 * Customer Auth — Login API
 * POST /api/auth/login
 * Authenticates admin with email + password, sets JWT cookie.
 */
import { NextRequest, NextResponse } from 'next/server';
import { SITE_ID } from '@/crud/shared/config';
import { authenticateUser, createLoginResponse } from '@/crud/shared/auth/login';
import { checkDataRateLimit } from '@/lib/dataRateLimit';
import { getClientIP } from '@/lib/security/request';

export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS_PER_WINDOW = 3;
const RATE_LIMIT_WINDOW = 5 * 60 * 1000;
const BLOCK_DURATION = 30 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    // Rate-limit berbasis IP: sama kuatnya dengan guard brute-force
    // di /api/admin/login. Key tidak memakai User-Agent agar rotasi
    // UA tidak bisa me-reset counter.
    const rateLimitIp = getClientIP(request);
    const rateLimit = await checkDataRateLimit(
      `login_${rateLimitIp}`,
      MAX_ATTEMPTS_PER_WINDOW,
      RATE_LIMIT_WINDOW,
      BLOCK_DURATION
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Terlalu banyak percobaan login. Coba lagi nanti.',
          retryAfter: rateLimit.retryAfter,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) },
        }
      );
    }

    const body = await request.json();
    const { email, password } = body;

    const result = await authenticateUser(SITE_ID, { email, password });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    return createLoginResponse(result.token!);
  } catch (error) {
    // Tanpa baris ini, kegagalan login tidak meninggalkan jejak apa pun di
    // log worker — penyebabnya harus dilacak manual lewat reproduksi.
    console.error('[Auth] /api/auth/login gagal:', error);
    return NextResponse.json({ error: 'Gagal memproses login' }, { status: 500 });
  }
}
