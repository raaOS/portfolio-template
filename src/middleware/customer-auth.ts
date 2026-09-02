/**
 * Customer Auth Middleware
 * Verifies site_user_token JWT on protected routes for customer deployments.
 *
 * @module middleware/customer-auth
 */
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';
import { protectedRoutes, publicRoutes } from './constants';

const SITE_USER_COOKIE = 'site_user_token';
const TOKEN_TTL_SECONDS = 2 * 60 * 60;
const REFRESH_THRESHOLD_SECONDS = 30 * 60;

function getJwtSecret(): Uint8Array | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

async function deriveSiteSecret(baseSecret: Uint8Array, siteId: string): Promise<CryptoKey> {
  const siteKey = new TextEncoder().encode(siteId);
  return crypto.subtle.importKey('raw', siteKey.buffer as ArrayBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

async function maybeRefreshToken(
  payload: { exp?: number; siteId?: string; email?: string; role?: string; sub?: string },
  response: NextResponse
): Promise<void> {
  const baseSecret = getJwtSecret();
  if (!baseSecret || !payload.exp || !payload.siteId) return;

  const nowSec = Math.floor(Date.now() / 1000);
  const remaining = payload.exp - nowSec;
  if (remaining > REFRESH_THRESHOLD_SECONDS) return;

  try {
    const siteKey = await deriveSiteSecret(baseSecret, payload.siteId);
    const signature = await crypto.subtle.sign('HMAC', siteKey, new TextEncoder().encode(payload.siteId));
    const derivedSecret = new Uint8Array(64);
    new Uint8Array(signature).forEach((byte, i) => { derivedSecret[i] = byte; });

    const fresh = await new SignJWT({
      siteId: payload.siteId,
      email: payload.email || '',
      role: payload.role || 'admin',
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
            const siteKey = await deriveSiteSecret(baseSecret, payload.siteId);
            const signature = await crypto.subtle.sign('HMAC', siteKey, new TextEncoder().encode(payload.siteId));
            const derivedSecret = new Uint8Array(64);
            new Uint8Array(signature).forEach((byte, i) => { derivedSecret[i] = byte; });

            const { payload: verified } = await jwtVerify(token, derivedSecret, {
              issuer: 'portfolio-site-user',
              audience: 'site-dashboard',
            });

            if (verified && verified.sub) {
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

      if (pathname.startsWith('/admin')) {
        return {
          authenticated: false,
          response: NextResponse.rewrite(new URL('/404', request.url)),
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
