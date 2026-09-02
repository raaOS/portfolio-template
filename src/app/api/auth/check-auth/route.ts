/**
 * Customer Auth — Check Auth API
 * GET /api/auth/check-auth
 * Returns current auth status + CSRF token.
 */
import { NextResponse } from 'next/server';
import { getSiteUserSession } from '@/crud/shared/auth/guard';
import { generateCSRFToken, CSRF_COOKIE_NAME } from '@/crud/shared/auth/csrf';

export async function GET(request: Request) {
  const session = await getSiteUserSession(request);

  if (!session) {
    return NextResponse.json({ authenticated: false, csrfToken: '' });
  }

  const csrfToken = generateCSRFToken();

  const response = NextResponse.json({
    authenticated: true,
    csrfToken,
    user: {
      email: session.email,
      role: session.role,
    },
  });

  response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 2 * 60 * 60,
  });

  return response;
}
