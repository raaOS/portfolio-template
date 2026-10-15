/**
 * Shared Core — Login Handler
 * Handles login for site users (admin/crud).
 *
 * @module
 */
import { queryD1, bootstrapD1Schema } from '@/crud/shared/db/connection';
import { verifyStoredPassword, type StoredPasswordConfig } from './password';
import { signSiteUserJWT, AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS } from './session';
import { generateCSRFToken, CSRF_COOKIE_NAME } from './csrf';
import { NextResponse } from 'next/server';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResult {
  success: boolean;
  error?: string;
  token?: string;
}

/**
 * Authenticate a site user with email + password.
 */
export async function authenticateUser(
  siteId: string,
  request: LoginRequest
): Promise<LoginResult> {
  if (!request.email || !request.password) {
    return { success: false, error: 'Email dan password wajib diisi' };
  }

  await bootstrapD1Schema();

  // Find user by email + siteId
  const rows = await queryD1<{
    id: string;
    site_id: string;
    email: string;
    password_hash: string;
    password_salt: string | null;
    password_algorithm: string | null;
    role: string;
  }>(
    `SELECT id, site_id, email, password_hash, password_salt, password_algorithm, role
     FROM site_users
     WHERE site_id = ? AND email = ? AND role = 'admin'
     LIMIT 1`,
    [siteId, request.email.toLowerCase().trim()]
  );

  const user = rows[0];
  if (!user) {
    return { success: false, error: 'Email atau password salah' };
  }

  // Verify password
  const config: StoredPasswordConfig = {
    passwordHash: user.password_hash,
    passwordSalt: user.password_salt ?? undefined,
    passwordAlgorithm: (user.password_algorithm as 'scrypt' | 'sha256') ?? undefined,
  };

  const { valid, needsUpgrade, upgradedRecord } = verifyStoredPassword(request.password, config);

  if (!valid) {
    return { success: false, error: 'Email atau password salah' };
  }

  // Upgrade password if needed (sha256 → scrypt). Best-effort: kegagalan
  // tulis TIDAK boleh menggagalkan login yang passwordnya sudah benar —
  // upgrade akan dicoba lagi pada login berikutnya.
  if (needsUpgrade && upgradedRecord) {
    try {
      await queryD1(
        `UPDATE site_users SET password_hash = ?, password_salt = ?, password_algorithm = 'scrypt' WHERE id = ?`,
        [upgradedRecord.passwordHash, upgradedRecord.passwordSalt || '', user.id]
      );
    } catch (error) {
      console.error('[Auth] Upgrade hash password dilewati (diabaikan):', error);
    }
  }

  // Update last_login_at — jejak audit, best-effort dengan alasan yang sama:
  // sekali lagi, login yang sah tidak boleh digagalkan oleh kegagalan tulis
  // catatan sampingan (insiden 2026-10-16: "password benar tapi dapat
  // kesalahan database").
  try {
    await queryD1(
      `UPDATE site_users SET last_login_at = datetime('now') WHERE id = ?`,
      [user.id]
    );
  } catch (error) {
    console.error('[Auth] last_login_at gagal dicatat (diabaikan):', error);
  }

  // Sign JWT
  const token = await signSiteUserJWT({
    userId: user.id,
    siteId: user.site_id,
    email: user.email,
    role: user.role,
  });

  return { success: true, token };
}

/**
 * Create a login response with JWT cookie and CSRF cookie.
 */
export function createLoginResponse(token: string): NextResponse {
  const csrfToken = generateCSRFToken();

  const response = NextResponse.json({ success: true });

  // Set auth cookie
  response.cookies.set(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);

  // Set CSRF cookie (accessible to JavaScript)
  response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 2 * 60 * 60, // 2 hours
  });

  return response;
}

/**
 * Create a logout response (clear all auth cookies).
 */
export function createLogoutResponse(): NextResponse {
  const response = NextResponse.json({ success: true });

  response.cookies.delete(AUTH_COOKIE_NAME);
  response.cookies.delete(CSRF_COOKIE_NAME);

  return response;
}
