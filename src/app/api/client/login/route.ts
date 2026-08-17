import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateClientLogin, clientCookieOptions, getClientToken } from '@/lib/clientAuth';
import { generateCSRFToken, validateCSRFToken } from '@/lib/security';
import {
  CLIENT_TOKEN_COOKIE,
  CSRF_TOKEN_COOKIE,
  CSRF_TOKEN_HEADER,
  CSRF_TOKEN_MAX_AGE,
} from '@/lib/security/constants';
import { enforceRequestRateLimit } from '@/lib/security/request';
import { logOperationalEvent, summarizeError } from '@/lib/observability/operationalLog';

export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  siteSlug: z.string().trim().min(2),
  email: z.string().trim().email(),
  password: z.string().min(8),
});

export async function GET() {
  const csrfToken = generateCSRFToken();
  const response = NextResponse.json({ csrfToken });
  response.cookies.set(CSRF_TOKEN_COOKIE, csrfToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: CSRF_TOKEN_MAX_AGE,
    path: '/',
  });
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

export async function POST(request: NextRequest) {
  try {
    const csrfToken = request.headers.get(CSRF_TOKEN_HEADER);
    const sessionCsrfToken = request.cookies.get(CSRF_TOKEN_COOKIE)?.value;
    if (!csrfToken || !sessionCsrfToken || !validateCSRFToken(csrfToken, sessionCsrfToken)) {
      logOperationalEvent({
        event: 'client.login',
        level: 'warn',
        status: 'blocked',
        request,
        message: 'Client login rejected: invalid CSRF',
      });
      return NextResponse.json({ error: 'Invalid or missing CSRF token' }, { status: 403 });
    }

    const rawBody = await request.json().catch(() => ({}));
    const parsed = loginSchema.safeParse(rawBody);
    if (!parsed.success) {
      logOperationalEvent({
        event: 'client.login',
        level: 'warn',
        status: 'failure',
        request,
        message: 'Client login payload invalid',
      });
      return NextResponse.json(
        { error: 'Invalid login payload', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // SECURITY FIX: Rate limit client login before password verification.
    // 5 attempts per 5-minute window, 15-minute block on exceed.
    const rateLimit = await enforceRequestRateLimit(
      request,
      'client_login',
      5,
      5 * 60 * 1000,
      15 * 60 * 1000
    );
    if (!rateLimit.allowed) {
      logOperationalEvent({
        event: 'client.login',
        level: 'warn',
        status: 'blocked',
        request,
        siteSlug: parsed.data.siteSlug,
        message: 'Client login blocked by rate limit',
        metadata: { retryAfter: rateLimit.retryAfter },
      });
      return NextResponse.json(
        {
          error: 'Too many login attempts. Please try again later.',
          retryAfter: rateLimit.retryAfter,
        },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      );
    }

    const session = await authenticateClientLogin(parsed.data);
    if (!session) {
      logOperationalEvent({
        event: 'client.login',
        level: 'warn',
        status: 'failure',
        request,
        siteSlug: parsed.data.siteSlug,
        message: 'Client login failed',
        metadata: { reason: 'invalid-client-access' },
      });
      return NextResponse.json({ error: 'Invalid client access' }, { status: 401 });
    }

    logOperationalEvent({
      event: 'client.login',
      status: 'success',
      request,
      siteId: session.siteId,
      siteSlug: session.siteSlug,
      entityType: 'client_access',
      entityId: session.accessId,
      message: 'Client login success',
    });

    const response = NextResponse.json({
      success: true,
      site: {
        id: session.siteId,
        slug: session.siteSlug,
        name: session.siteName,
        plan: session.plan,
      },
      email: session.email,
    });
    response.cookies.set(CLIENT_TOKEN_COOKIE, getClientToken(session), clientCookieOptions());
    return response;
  } catch (error) {
    console.error('[Client Login] Failed:', error);
    logOperationalEvent({
      event: 'client.login',
      level: 'error',
      status: 'failure',
      request,
      message: 'Client login handler failed',
      metadata: { error: summarizeError(error) },
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Client login failed' },
      { status: 500 }
    );
  }
}
