import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth';
import { logAdminActivity } from '@/lib/services/auditLogger';
import {
  ADMIN_TOKEN_COOKIE,
  ADMIN_TOKEN_COOKIE_LEGACY,
  CSRF_TOKEN_COOKIE,
} from '@/lib/security/constants';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const wasAuthenticated = checkAdminAuth(request);

    if (wasAuthenticated) {
      await logAdminActivity(request, 'Admin logout').catch((error) => {
        console.error('[Audit] Failed to log admin logout:', error);
      });
    }

    const response = NextResponse.json({ message: 'Logged out successfully' });

    // Expire every cookie used by the admin session on the same root path
    // used when login creates them.
    const cookieOptions = {
      path: '/',
      maxAge: 0,
      expires: new Date(0),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
    };

    response.cookies.set(ADMIN_TOKEN_COOKIE, '', cookieOptions);
    response.cookies.set(ADMIN_TOKEN_COOKIE_LEGACY, '', cookieOptions);
    response.cookies.set(CSRF_TOKEN_COOKIE, '', {
      ...cookieOptions,
      httpOnly: false,
      sameSite: 'lax' as const,
    });

    // Prevent any caching of the logout response
    response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ message: 'Logout failed' }, { status: 500 });
  }
}
