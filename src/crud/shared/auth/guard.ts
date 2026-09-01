/**
 * Shared Core — Auth Guard
 * Protects routes by verifying JWT session.
 *
 * @module
 */
import { verifySiteUserJWT, type SiteUserSession } from './session';
import { AUTH_COOKIE_NAME } from './session';
import { NextResponse } from 'next/server';

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
  return verifySiteUserJWT(token);
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
