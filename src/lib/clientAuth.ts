import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { sign, verify } from 'jsonwebtoken';
import { queryD1 } from '@/lib/cloudflareD1';
import { cleanEnvVar } from '@/lib/utils/env';
import { validateCSRFToken } from '@/lib/security';
import { CLIENT_TOKEN_COOKIE, CSRF_TOKEN_COOKIE, CSRF_TOKEN_HEADER } from '@/lib/security/constants';

const PASSWORD_SALT = cleanEnvVar('PASSWORD_SALT');
const JWT_SECRET = cleanEnvVar('JWT_SECRET');
const CLIENT_TOKEN_TTL_SECONDS = 2 * 60 * 60;

export type ClientAccessStatus = 'active' | 'suspended';

export type ClientSession = {
  accessId: string;
  siteId: string;
  siteSlug: string;
  siteName: string;
  email: string;
  plan: 'lite' | 'pro';
  siteStatus: string;
};

type ClientAccessRow = {
  id: string;
  site_id: string;
  email: string;
  password_hash: string;
  status: string;
  site_slug: string;
  site_name: string;
  site_plan: string;
  site_status: string;
};

type ClientJwtPayload = {
  sub?: string;
  role?: string;
  accessId?: string;
  siteId?: string;
  siteSlug?: string;
  email?: string;
};

function requireClientSecurityEnv() {
  if (!PASSWORD_SALT) throw new Error('PASSWORD_SALT is not configured');
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return {
    passwordSalt: PASSWORD_SALT,
    jwtSecret: JWT_SECRET,
  };
}

function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function normalizeClientEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashClientPassword(password: string) {
  const { passwordSalt } = requireClientSecurityEnv();
  return crypto.scryptSync(password, passwordSalt, 64).toString('hex');
}

export function verifyClientPassword(password: string, passwordHash: string) {
  if (!password || password.length < 8 || !passwordHash) return false;
  return timingSafeEqualString(hashClientPassword(password), passwordHash);
}

export function getClientToken(session: ClientSession) {
  const { jwtSecret } = requireClientSecurityEnv();
  return sign(
    {
      sub: session.accessId,
      role: 'client',
      accessId: session.accessId,
      siteId: session.siteId,
      siteSlug: session.siteSlug,
      email: session.email,
      iat: Math.floor(Date.now() / 1000),
    },
    jwtSecret,
    {
      expiresIn: CLIENT_TOKEN_TTL_SECONDS,
      issuer: 'portfolio-client',
      audience: 'client-dashboard',
    }
  );
}

export function verifyClientToken(token: string): ClientJwtPayload | null {
  if (!JWT_SECRET) return null;

  try {
    const payload = verify(token, JWT_SECRET, {
      issuer: 'portfolio-client',
      audience: 'client-dashboard',
    });

    if (typeof payload !== 'object' || payload === null) return null;
    const typed = payload as ClientJwtPayload;
    return typed.role === 'client' && typed.accessId && typed.siteId ? typed : null;
  } catch {
    return null;
  }
}

function mapClientAccessRow(row: ClientAccessRow): ClientSession {
  return {
    accessId: row.id,
    siteId: row.site_id,
    siteSlug: row.site_slug,
    siteName: row.site_name,
    email: row.email,
    plan: row.site_plan === 'pro' ? 'pro' : 'lite',
    siteStatus: row.site_status,
  };
}

async function getClientAccessByLogin(siteSlug: string, email: string) {
  const rows = await queryD1<ClientAccessRow>(
    `SELECT
       ca.id,
       ca.site_id,
       ca.email,
       ca.password_hash,
       ca.status,
       s.slug as site_slug,
       s.name as site_name,
       s.plan as site_plan,
       s.status as site_status
     FROM client_access ca
     INNER JOIN sites s ON s.id = ca.site_id
     WHERE s.slug = ? AND ca.email = ?
     LIMIT 1`,
    [siteSlug.trim(), normalizeClientEmail(email)]
  );
  return rows[0] ?? null;
}

async function getClientAccessById(accessId: string, siteId: string) {
  const rows = await queryD1<ClientAccessRow>(
    `SELECT
       ca.id,
       ca.site_id,
       ca.email,
       ca.password_hash,
       ca.status,
       s.slug as site_slug,
       s.name as site_name,
       s.plan as site_plan,
       s.status as site_status
     FROM client_access ca
     INNER JOIN sites s ON s.id = ca.site_id
     WHERE ca.id = ? AND ca.site_id = ?
     LIMIT 1`,
    [accessId, siteId]
  );
  return rows[0] ?? null;
}

export async function authenticateClientLogin({
  siteSlug,
  email,
  password,
}: {
  siteSlug: string;
  email: string;
  password: string;
}) {
  const access = await getClientAccessByLogin(siteSlug, email);
  if (!access) return null;
  if (access.status !== 'active' || access.site_status !== 'active') return null;
  if (!verifyClientPassword(password, access.password_hash)) return null;

  await queryD1(`UPDATE client_access SET last_login_at = ?, updated_at = ? WHERE id = ?`, [
    new Date().toISOString(),
    new Date().toISOString(),
    access.id,
  ]);

  return mapClientAccessRow(access);
}

export async function getClientSessionFromRequest(request: NextRequest): Promise<ClientSession | null> {
  const token = request.cookies?.get(CLIENT_TOKEN_COOKIE)?.value;
  if (!token) return null;

  const payload = verifyClientToken(token);
  if (!payload?.accessId || !payload.siteId) return null;

  const access = await getClientAccessById(payload.accessId, payload.siteId);
  if (!access || access.status !== 'active' || access.site_status !== 'active') return null;

  return mapClientAccessRow(access);
}

export async function validateClientRequest(
  request: NextRequest,
  options: { checkCsrf?: boolean; siteId?: string } = {}
) {
  const session = await getClientSessionFromRequest(request);
  if (!session) return null;
  if (options.siteId && session.siteId !== options.siteId) return null;

  const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method);
  const shouldCheckCsrf = options.checkCsrf ?? isMutation;
  if (shouldCheckCsrf) {
    const csrfHeader = request.headers.get(CSRF_TOKEN_HEADER);
    const csrfCookie = request.cookies?.get(CSRF_TOKEN_COOKIE)?.value;
    if (!csrfHeader || !csrfCookie || !validateCSRFToken(csrfHeader, csrfCookie)) {
      return null;
    }
  }

  return session;
}

export function clientCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: CLIENT_TOKEN_TTL_SECONDS,
    path: '/',
  };
}
