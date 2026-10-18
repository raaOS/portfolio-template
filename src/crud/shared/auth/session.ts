/**
 * Shared Core — JWT Session
 * Per-site JWT signing/verification.
 *
 * @module
 */
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export interface SiteUserSession {
  userId: string;
  siteId: string;
  email: string;
  role: string;
  /** Waktu terbit JWT (epoch detik) — dipakai guard untuk pencabutan sesi lama. */
  issuedAt?: number;
}

export interface SiteUserJWTPayload extends JWTPayload {
  sub: string;
  siteId: string;
  email: string;
  role: string;
}

const ISSUER = 'portfolio-site-user';
const AUDIENCE = 'site-dashboard';
const ALGORITHM = 'HS256';

function getJwtSecret(): ArrayBuffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return new TextEncoder().encode(secret).buffer;
}

/**
 * Derive per-site secret using HMAC-SHA256 from the base JWT_SECRET.
 */
export async function deriveSiteSecret(
  siteId: string,
  baseSecret?: ArrayBuffer | Uint8Array
): Promise<Uint8Array> {
  const secretBuffer = baseSecret
    ? (baseSecret instanceof Uint8Array ? baseSecret.buffer : baseSecret)
    : getJwtSecret();
  const siteKey = new TextEncoder().encode(siteId);
  const hmac = await crypto.subtle.importKey(
    'raw',
    secretBuffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', hmac, siteKey);
  const derivedSecret = new Uint8Array(64);
  new Uint8Array(signature).forEach((byte, i) => {
    derivedSecret[i] = byte;
  });
  return derivedSecret;
}

/**
 * Sign a JWT for a site user.
 * The secret is derived per-site using HMAC to prevent cross-site token reuse.
 */
export async function signSiteUserJWT(session: SiteUserSession): Promise<string> {
  const derivedSecret = await deriveSiteSecret(session.siteId);

  const token = await new SignJWT({
    siteId: session.siteId,
    email: session.email,
    role: session.role,
  })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(session.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(derivedSecret);

  return token;
}

/**
 * Verify a JWT and return the session.
 */
export async function verifySiteUserJWT(token: string): Promise<SiteUserSession | null> {
  try {
    // We need to decode the token first to get siteId for key derivation
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString()
    ) as SiteUserJWTPayload;

    if (!payload.siteId) return null;

    const derivedSecret = await deriveSiteSecret(payload.siteId);

    const { payload: verified } = await jwtVerify(token, derivedSecret, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    const typed = verified as SiteUserJWTPayload;
    return {
      userId: typed.sub,
      siteId: typed.siteId,
      email: typed.email,
      role: typed.role,
      issuedAt: typed.iat,
    };
  } catch {
    return null;
  }
}

export const AUTH_COOKIE_NAME = 'site_user_token';
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 2 * 60 * 60, // 2 hours
};
