/**
 * Shared Core — Auth Guard
 * Protects routes by verifying JWT session.
 *
 * @module
 */
import { verifySiteUserJWT, type SiteUserSession } from './session';
import { AUTH_COOKIE_NAME } from './session';
import { getSessionNotBefore } from '@/lib/services/passwordResetService';
import { NextResponse } from 'next/server';

// Toleransi pembulatan: `iat` JWT dalam detik sedangkan tanda keamanan dalam
// milidetik — sesi yang terbit maksimal 5 detik sebelum password diganti tidak
// ditolak (login tepat setelah reset tidak boleh ikut terkena).
const SESSION_CLOCK_SKEW_MS = 5_000;

/**
 * True bila sesi ini terbit SEBELUM pencabutan terakhir (password diganti
 * lewat reset lupa-password maupun ganti-password mandiri).
 */
export async function isSessionRevoked(session: SiteUserSession): Promise<boolean> {
  const notBefore = await getSessionNotBefore(session.userId);
  if (!notBefore || session.issuedAt === undefined) return false;
  return session.issuedAt * 1000 < notBefore - SESSION_CLOCK_SKEW_MS;
}

/**
 * Extract and verify the site user session from a request.
 * Returns null if not authenticated.
 */
export async function getSiteUserSession(request: Request): Promise<SiteUserSession | null> {
  const cookieHeader = request.headers.get('cookie') || '';
  const tokenMatch = cookieHeader.match(new RegExp(`${AUTH_COOKIE_NAME}=([^;]+)`));

  if (!tokenMatch) {
    return null;
  }

  const token = tokenMatch[1];
  const session = await verifySiteUserJWT(token);
  if (!session) return null;

  // Cookie JWT stateless tidak bisa dihapus dari sisi server, jadi sesi yang
  // terbit sebelum password terakhir diganti ditolak DI SINI (lapisan
  // pengaman setelah tanda `securityNotBefore` ditulis oleh reset/ganti password).
  if (await isSessionRevoked(session)) return null;

  return session;
}

/**
 * Guard: require authentication. Returns session or 401 response.
 */
export async function requireAuth(
  request: Request
): Promise<{ session: SiteUserSession; response?: never } | { session?: never; response: NextResponse }> {
  const session = await getSiteUserSession(request);

  if (!session) {
    return {
      response: NextResponse.json(
        { error: 'Tidak terotentikasi' },
        { status: 401 }
      ),
    };
  }

  return { session };
}

/**
 * Guard: require admin role. Returns session or 403 response.
 */
export async function requireAdmin(
  request: Request
): Promise<{ session: SiteUserSession; response?: never } | { session?: never; response: NextResponse }> {
  const authResult = await requireAuth(request);
  if (authResult.response) return authResult;

  if (authResult.session.role !== 'admin') {
    return {
      response: NextResponse.json(
        { error: 'Akses ditolak' },
        { status: 403 }
      ),
    };
  }

  return { session: authResult.session };
}
