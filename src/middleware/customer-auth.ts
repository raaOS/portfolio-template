/**
 * Customer Auth Middleware
 * Verifies site_user_token JWT on protected routes for customer deployments.
 *
 * @module middleware/customer-auth
 */
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';
import { deriveSiteSecret } from '@/crud/shared/auth/session';
import { SITE_ID } from '@/crud/shared/config';
import { protectedRoutes, publicRoutes } from './constants';

const SITE_USER_COOKIE = 'site_user_token';
const TOKEN_TTL_SECONDS = 2 * 60 * 60;
const REFRESH_THRESHOLD_SECONDS = 30 * 60;

function getJwtSecret(): Uint8Array | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

async function maybeRefreshToken(
  payload: { exp?: number; siteId?: string; email?: string; role?: string; sub?: string },
  response: NextResponse
): Promise<void> {
  const baseSecret = getJwtSecret();
  // A token without a role claim must not be refreshed into an admin
  // token — refuse to refresh instead of defaulting the role.
  if (!baseSecret || !payload.exp || !payload.siteId || !payload.role) return;

  const nowSec = Math.floor(Date.now() / 1000);
  const remaining = payload.exp - nowSec;
  if (remaining > REFRESH_THRESHOLD_SECONDS) return;

  try {
    const derivedSecret = await deriveSiteSecret(payload.siteId, baseSecret);

    const fresh = await new SignJWT({
      siteId: payload.siteId,
      email: payload.email || '',
      role: payload.role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(payload.sub || '')
      .setIssuer('portfolio-site-user')
      .setAudience('site-dashboard')
      .setIssuedAt(nowSec)
      .setExpirationTime(nowSec + TOKEN_TTL_SECONDS)
      .sign(derivedSecret);

    response.cookies.set(SITE_USER_COOKIE, fresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: TOKEN_TTL_SECONDS,
    });
  } catch {
    // Non-fatal
  }
}

export async function checkCustomerAuth(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));
  const isPublic = publicRoutes.some((route) => pathname === route);

  if (isProtected && !isPublic) {
    const token = request.cookies.get(SITE_USER_COOKIE)?.value;

    let isValid = false;
    let verifiedPayload: { exp?: number; siteId?: string; email?: string; role?: string; sub?: string } | null = null;

    if (token) {
      try {
        const baseSecret = getJwtSecret();
        if (baseSecret) {
          const payload = JSON.parse(
            Buffer.from(token.split('.')[1], 'base64url').toString()
          ) as { siteId?: string };

          if (payload.siteId) {
            const derivedSecret = await deriveSiteSecret(payload.siteId, baseSecret);

            const { payload: verified } = await jwtVerify(token, derivedSecret, {
              issuer: 'portfolio-site-user',
              audience: 'site-dashboard',
            });

            // SECURITY FIX (audit 2026-09-29): token wajib milik deployment ini.
            // Derive secret memang pakai siteId dari payload, tapi bila
            // JWT_SECRET dipakai bersama antar deployment, token site lain
            // tetap terverifikasi — tolak di sini (guard handler juga
            // memeriksa, ini lapisan pertama).
            // `SITE_ID` di-capture saat module load; baca env per-request agar
            // selalu segar (nilai akhir sama: env || 'default-site').
            const expectedSiteId = process.env.CUSTOMER_SITE_ID || SITE_ID;
            if (verified && verified.sub && verified.siteId === expectedSiteId) {
              isValid = true;
              verifiedPayload = verified as { exp?: number; siteId?: string; email?: string; role?: string; sub?: string };
            }
          }
        }
      } catch {
        // Invalid token
      }
    }

    if (!isValid) {
      if (pathname.startsWith('/api/')) {
        return {
          authenticated: false,
          response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        };
      }

      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return { authenticated: false, response: NextResponse.redirect(loginUrl) };
    }

    if (verifiedPayload) {
      const refreshResponse = NextResponse.next();
      await maybeRefreshToken(verifiedPayload, refreshResponse);
      const refreshedCookie = refreshResponse.cookies.get(SITE_USER_COOKIE);
      if (refreshedCookie) {
        return { authenticated: true, refreshResponse };
      }
    }
  }

  return { authenticated: true };
}
