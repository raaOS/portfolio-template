import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth';
import { generateCSRFToken } from '@/lib/security';
import { CSRF_TOKEN_MAX_AGE } from '@/lib/security/constants';

export async function GET(request: NextRequest) {
  const isAuthenticated = checkAdminAuth(request);

  // Use existing CSRF token if present, otherwise generate new one
  let csrfToken = request.cookies.get('csrf_token')?.value;

  if (!csrfToken || csrfToken.length !== 64) {
    csrfToken = generateCSRFToken();
  }

  const response = NextResponse.json({
    authenticated: isAuthenticated,
    csrfToken: csrfToken,
  });

  // Aggressively set/refresh the CSRF cookie to ensure persistence sync
  // We use a manual header as a fallback to ensure Next.js App Router doesn't strip it
  response.cookies.set('csrf_token', csrfToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: CSRF_TOKEN_MAX_AGE,
    path: '/',
  });

  // Prevent browser caching of the auth status
  response.headers.set('Cache-Control', 'no-store, max-age=0');

  return response;
}
