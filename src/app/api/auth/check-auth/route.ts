/**
 * Customer Auth — Check Auth API
 * GET /api/auth/check-auth
 * Returns current auth status + CSRF token.
 */
import { NextResponse } from 'next/server';
import { getSiteUserSession } from '@/crud/shared/auth/guard';
import { generateCSRFToken, CSRF_COOKIE_NAME } from '@/crud/shared/auth/csrf';

export async function GET(request: Request) {
  const session = await getSiteUserSession(request);
  // Pakai ulang token dari cookie bila sudah ada — JANGAN rotate tiap
  // polling. Cookie yang berganti membuat cache client (client-csrf.ts)
  // mengirim header basi → mutasi admin berikutnya ditolak "Invalid or
  // missing CSRF token" (ditemukan saat uji nyata upload Video Hero).
  // Pola sama dengan /api/admin/check-auth.
  const cookieHeader = request.headers.get('cookie') || '';
  const existingToken = /(?:^|;\s*)csrf_token=([^;]+)/.exec(cookieHeader)?.[1];
  const csrfToken = existingToken || generateCSRFToken();

  const response = NextResponse.json({
    authenticated: !!session,
    csrfToken,
    user: session
      ? {
          email: session.email,
          role: session.role,
        }
      : undefined,
  });

  response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 2 * 60 * 60,
  });

  response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  return response;
}
