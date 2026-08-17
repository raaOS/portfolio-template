/**
 * Auth Middleware — Verifikasi JWT admin token pada protected routes.
 *
 * Digunakan oleh `middleware.ts` untuk memfilter request ke endpoint admin.
 * Mendukung sliding-window token refresh.
 *
 * @module middleware/auth
 */
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';
import { protectedRoutes, publicRoutes } from './constants';
import {
  ADMIN_TOKEN_COOKIE,
  ADMIN_TOKEN_COOKIE_LEGACY,
  BEARER_PREFIX,
} from '@/lib/security/constants';

// Sliding window refresh: kalau sisa umur token < threshold, set ulang cookie
// dengan TTL fresh. Tujuannya supaya admin yang aktif (mis. lagi upload
// wallpaper besar yang compress 5-15 menit) tidak ke-logout di tengah jalan.
// Idle 2 jam tetap expire — sesuai durability sebelumnya.
const TOKEN_TTL_SECONDS = 2 * 60 * 60; // 2 jam, match getAdminToken
const REFRESH_THRESHOLD_SECONDS = 30 * 60; // refresh kalau sisa < 30 menit

async function maybeRefreshAdminToken(
  payload: { exp?: number },
  response: NextResponse
): Promise<void> {
  const secret = process.env.JWT_SECRET;
  if (!secret || !payload.exp) return;

  const nowSec = Math.floor(Date.now() / 1000);
  const remaining = payload.exp - nowSec;
  if (remaining > REFRESH_THRESHOLD_SECONDS) return;

  // Token mau habis — issue ulang dengan klaim & TTL identik dengan
  // getAdminToken di lib/auth.ts. Pakai jose karena proxy/middleware
  // jalan di Edge runtime; jsonwebtoken (Node-only) tidak bisa dipakai
  // di sini.
  try {
    const secretKey = new TextEncoder().encode(secret);
    const fresh = await new SignJWT({ sub: 'admin', role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(nowSec)
      .setIssuer('portfolio-admin')
      .setAudience('admin-panel')
      .setExpirationTime(nowSec + TOKEN_TTL_SECONDS)
      .sign(secretKey);

    response.cookies.set(ADMIN_TOKEN_COOKIE, fresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: TOKEN_TTL_SECONDS,
    });
  } catch (error) {
    // Refresh failure non-fatal — token lama masih valid sampai exp.
    if (process.env.NODE_ENV === 'development') {
      console.warn('[AUTH-DEBUG] Token refresh failed (non-fatal):', error);
    }
  }
}

export async function checkAdminAuth(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));
  const isPublic = publicRoutes.some((route) => pathname === route);

  if (isProtected && !isPublic) {
    // STANDARD: `admin_token` — `admin-token` dibaca untuk backward-compat
    // dengan session yang di-set oleh versi sebelumnya. Semua write path
    // (login/logout) hanya menyentuh `admin_token` sekarang.
    const token =
      request.cookies.get(ADMIN_TOKEN_COOKIE)?.value ||
      request.cookies.get(ADMIN_TOKEN_COOKIE_LEGACY)?.value ||
      request.headers.get('authorization')?.replace(BEARER_PREFIX, '');

    // NOTE: debug log hanya saat development. Di production kita hindari
    // mencetak daftar cookie dan token state ke log production (noise + info leak).
    if (process.env.NODE_ENV === 'development') {
      const allCookies = request.cookies
        .getAll()
        .map((c) => c.name)
        .join(', ');
      console.log(
        `[AUTH-DEBUG] Path: ${pathname} | Cookies keys seen: ${allCookies} | Token found: ${!!token}`
      );
    }

    let isValid = false;
    let verifiedPayload: { exp?: number } | null = null;
    if (token) {
      try {
        const secret = process.env.JWT_SECRET;
        if (secret) {
          const secretKey = new TextEncoder().encode(secret);
          const { payload } = await jwtVerify(token, secretKey, {
            issuer: 'portfolio-admin',
            audience: 'admin-panel',
          });
          if (payload && payload.sub === 'admin') {
            isValid = true;
            verifiedPayload = payload as { exp?: number };
          }
        } else {
          console.error('[AUTH-DEBUG] JWT_SECRET is not configured in environment variables');
        }
      } catch {
        console.error(`[AUTH-DEBUG] JWT Verification failed`);
      }
    }

    if (!isValid) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[AUTH-DEBUG] Token invalid or missing! Redirecting to login.`);
      }

      if (pathname.startsWith('/api/')) {
        return {
          authenticated: false,
          response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        };
      }

      // Sembunyikan rute /admin dari publik (mengembalikan 404 Not Found jika diakses langsung tanpa token)
      if (pathname.startsWith('/admin')) {
        return {
          authenticated: false,
          response: NextResponse.rewrite(new URL('/404', request.url)),
        };
      }

      const loginUrl = new URL('/portal/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return { authenticated: false, response: NextResponse.redirect(loginUrl) };
    }

    // Token valid — sliding refresh kalau mau habis. Caller akan menerima
    // response dengan cookie baru kalau di-refresh; kalau tidak, returnkan
    // null supaya proxy lanjut dengan NextResponse.next() biasa.
    if (verifiedPayload) {
      const refreshResponse = NextResponse.next();
      await maybeRefreshAdminToken(verifiedPayload, refreshResponse);
      const refreshedCookie = refreshResponse.cookies.get(ADMIN_TOKEN_COOKIE);
      if (refreshedCookie) {
        return { authenticated: true, refreshResponse };
      }
    }
  }

  return { authenticated: true };
}
