/**
 * Auth — Utilitas otentikasi admin (JWT, password hashing, CSRF).
 *
 * Menyediakan:
 * - `createAdminToken()` / `verifyAdminToken()` — JWT signing & verification.
 * - `hashPassword()` / `verifyPassword()` — scrypt hashing dengan timing-safe comparison.
 * - `validateAdminRequest()` — Validasi cookie auth + CSRF pada API routes.
 *
 * @module auth
 */
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { sign, verify } from 'jsonwebtoken';
import { validateCSRFToken } from '@/lib/security';
import { cookies } from 'next/headers';
import { cleanEnvVar } from '@/lib/utils/env';
import { db } from '@/lib/database';
import { logAdminActivity } from '@/lib/services/auditLogger';
import {
  ADMIN_TOKEN_COOKIE,
  ADMIN_TOKEN_COOKIE_LEGACY,
  BEARER_PREFIX,
  CSRF_TOKEN_COOKIE,
  CSRF_TOKEN_HEADER,
} from '@/lib/security/constants';

// Clean auth system - scrypt only (most secure)
const ADMIN_PASSWORD_SCRYPT = cleanEnvVar('ADMIN_PASSWORD_SCRYPT');
const PASSWORD_SALT = cleanEnvVar('PASSWORD_SALT');
const JWT_SECRET = cleanEnvVar('JWT_SECRET');

export function hashPasswordScrypt(password: string, salt: string): string {
  const key = crypto.scryptSync(password, salt, 64);
  return key.toString('hex');
}

function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export const verifyAdminPassword = async (password: string): Promise<boolean> => {
  if (!password || password.length < 8) {
    return false;
  }

  if (!PASSWORD_SALT) {
    throw new Error('PASSWORD_SALT is not configured in your environment variables');
  }

  // 1. Check Database First
  try {
    const dbHashSnap = await db.ref('settings/adminPassword').once('value');
    const dbHash = dbHashSnap.val();

    if (dbHash && typeof dbHash === 'string') {
      const hashedInput = hashPasswordScrypt(password, PASSWORD_SALT);
      return timingSafeEqualString(hashedInput, dbHash);
    }
  } catch (error) {
    console.error('[Auth] Failed to check DB for password, falling back to ENV:', error);
  }

  // 2. Fallback to Environment Variables
  if (!ADMIN_PASSWORD_SCRYPT) {
    throw new Error(
      'Admin password security not configured - please set ADMIN_PASSWORD_SCRYPT in your environment variables or Database'
    );
  }

  const hashedInput = hashPasswordScrypt(password, PASSWORD_SALT);
  return timingSafeEqualString(hashedInput, ADMIN_PASSWORD_SCRYPT);
};

export const getAdminToken = (): string => {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }

  return sign({ sub: 'admin', role: 'admin', iat: Math.floor(Date.now() / 1000) }, JWT_SECRET, {
    expiresIn: '2h',
    issuer: 'portfolio-admin',
    audience: 'admin-panel',
  });
};

export const verifyAdminToken = (token: string): boolean => {
  if (!JWT_SECRET) {
    return false;
  }

  try {
    const payload = verify(token, JWT_SECRET, {
      issuer: 'portfolio-admin',
      audience: 'admin-panel',
    });

    if (typeof payload === 'object' && payload !== null && 'sub' in payload) {
      return (payload as { sub?: string }).sub === 'admin';
    }
    return false;
  } catch {
    return false;
  }
};

/**
 * Validates both Admin Auth (JWT/Cookie) and CSRF Token.
 * Recommended for all POST/PUT/DELETE admin routes.
 *
 * @param request The incoming NextRequest
 * @param options Configuration for validation
 * @returns boolean indicating if the request is valid
 */
export const validateAdminRequest = async (
  request: NextRequest,
  options: { checkCsrf?: boolean } = {}
): Promise<boolean> => {
  // 1. Check Admin Auth (legacy admin_token or customer site_user_token)
  let isAuthenticated = checkAdminAuth(request);
  if (!isAuthenticated) {
    const [{ getSiteUserSession }, { SITE_ID }] = await Promise.all([
      import('@/crud/shared/auth/guard'),
      import('@/crud/shared/config'),
    ]);
    const session = await getSiteUserSession(request);
    // Mirror siteMutationAuth: a customer token is only valid for its
    // own deployment. Without the siteId check, a token signed with the
    // same base JWT_SECRET (e.g. re-used across template deployments)
    // would be accepted on every other deployment.
    if (session && session.siteId === SITE_ID && session.role === 'admin') {
      isAuthenticated = true;
    }
  }

  if (!isAuthenticated) {
    return false;
  }

  // 2. Check CSRF (Default: true for mutations)
  const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method);
  const shouldCheckCsrf = options.checkCsrf ?? isMutation;

  if (shouldCheckCsrf) {
    const csrfHeader = request.headers.get(CSRF_TOKEN_HEADER);
    const cookieStore = await cookies();
    const csrfCookie = cookieStore.get(CSRF_TOKEN_COOKIE)?.value;

    if (!csrfHeader || !csrfCookie || !validateCSRFToken(csrfHeader, csrfCookie)) {
      return false;
    }
  }

  if (isMutation) {
    await logAdminActivity(request, `Admin ${request.method} ${request.nextUrl.pathname}`, {
      stage: 'accepted',
    }).catch((error) => {
      console.error('[Audit] Failed to log admin request:', error);
    });
  }

  return true;
};

export const checkAdminAuth = (request: NextRequest): boolean => {
  try {
    const authHeader = request.headers.get('authorization');
    const cookieToken =
      request.cookies.get(ADMIN_TOKEN_COOKIE)?.value ||
      request.cookies.get(ADMIN_TOKEN_COOKIE_LEGACY)?.value;

    if (authHeader?.startsWith(BEARER_PREFIX)) {
      const token = authHeader.substring(BEARER_PREFIX.length);
      return verifyAdminToken(token);
    }

    if (cookieToken) {
      return verifyAdminToken(cookieToken);
    }

    return false;
  } catch {
    return false;
  }
};
