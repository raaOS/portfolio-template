/**
 * CSRF Middleware — Validasi token CSRF pada setiap request mutasi data.
 *
 * Memeriksa header `X-CSRF-Token` terhadap cookie `csrf_token` untuk semua
 * endpoint API dengan method POST/PUT/DELETE/PATCH. Endpoint publik yang
 * diproteksi oleh rate-limit (bukan CSRF) didaftarkan di allowlist.
 *
 * @module middleware/csrf
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateCSRFToken } from '@/lib/security/token';
import { isAPIRoute } from './utils';
import { CSRF_TOKEN_COOKIE, CSRF_TOKEN_HEADER } from '@/lib/security/constants';

/**
 * Endpoint publik yang TIDAK punya sesi admin/cookie CSRF (visitor fresh),
 * tapi tetap perlu proteksi anti-CSRF lewat SAME-ORIGIN check (Origin/Referer).
 * Ini pengganti double-submit cookie untuk form checkout & order-status publik:
 * attacker page di domain lain tidak bisa submit fetch cross-origin ke sini
 * tanpa header Origin yang sah. Tetap loloskan kalau header hilang (mis.
 * curl/no-JS client) supaya tidak break integrasi lama — proteksi utama
 * endpoint ini adalah rate-limit + token akses per-order.
 */
const PUBLIC_SAME_ORIGIN_PATHS = ['/api/billing/checkout', '/api/billing/orders'];

function hasSameOriginHeader(request: NextRequest): boolean {
  const host = request.headers.get('host');
  if (!host) return true; // no host header — trust upstream routing
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }
  // Neither Origin nor Referer present — likely non-browser client; let
  // rate-limit + token checks handle it instead of hard-blocking.
  return true;
}

export function checkCSRF(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const mutationMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];

  if (isAPIRoute(pathname) && mutationMethods.includes(request.method)) {
    // Same-Origin fallback untuk endpoint billing publik (tanpa cookie CSRF).
    if (PUBLIC_SAME_ORIGIN_PATHS.some((p) => pathname.startsWith(p))) {
      if (!hasSameOriginHeader(request)) {
        console.warn(`[Security] Cross-origin billing POST blocked for ${pathname}.`);
        return {
          isValid: false,
          response: NextResponse.json(
            { error: 'Cross-origin request not allowed' },
            { status: 403 }
          ),
        };
      }
      return { isValid: true };
    }

    const allowlistPaths = [
      '/api/admin/login',
      '/api/admin/logout',
      '/api/auth/login',
      '/api/auth/logout',
      '/api/setup',
      '/api/chat/send',
      '/api/chat/voice',
      '/api/translate',
      '/api/admin/pin/verify',
      // Visitor-reachable mutation endpoints yang tidak memerlukan sesi admin.
      // Endpoint ini diproteksi oleh rate-limit dan Zod validation, bukan CSRF.
      // Tanpa allowlist ini, visitor fresh tanpa cookie csrf_token akan 403.
      '/api/metrics',
      '/api/comments',
      '/api/analytics',
      '/api/feedback',
      '/api/telegram/webhook',
      // Webhook eksternal (GitHub push) — diproteksi HMAC signature
      // `x-hub-signature-256` di handler, bukan cookie CSRF.
      '/api/revalidate',
    ];
    // SECURITY FIX (audit 2026-09-29): pencocokan per-segmen — `startsWith`
    // mentah mengizinkan path baru yang kebetulan berawalan sama (mis.
    // `/api/billing/orders-preview`) lolos CSRF tanpa disadari. Allowlist hanya
    // cocok untuk path persis atau anak path (`entry + '/'`).
    const isAllowlisted = allowlistPaths.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );
    if (!isAllowlisted) {
      const csrfToken = request.headers.get(CSRF_TOKEN_HEADER);
      const sessionCsrfToken = request.cookies.get(CSRF_TOKEN_COOKIE)?.value;

      if (!csrfToken || !sessionCsrfToken || !validateCSRFToken(csrfToken, sessionCsrfToken)) {
        console.warn(`[Security] CSRF Validation Failed for ${pathname}.`);

        if (process.env.NODE_ENV === 'development') {
          console.debug('CSRF Debug:', {
            headerToken: csrfToken,
            cookieToken: sessionCsrfToken,
            allCookies: request.cookies.getAll().map((c) => c.name),
          });
        }

        return {
          isValid: false,
          response: NextResponse.json(
            {
              error: 'Invalid or missing CSRF token',
              details:
                'CSRF (Cross-Site Request Forgery) validation failed. Ensure cookies are enabled.',
            },
            { status: 403 }
          ),
        };
      }
    }
  }

  return { isValid: true };
}
