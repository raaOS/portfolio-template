import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createClientPasswordResetRequest,
  isClientPasswordResetEnabled,
} from '@/lib/clientPasswordReset';
import { validateCSRFToken } from '@/lib/security';
import { CSRF_TOKEN_COOKIE, CSRF_TOKEN_HEADER } from '@/lib/security/constants';
import { enforceRequestRateLimit } from '@/lib/security/request';
import { logOperationalEvent, summarizeError } from '@/lib/observability/operationalLog';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  siteSlug: z.string().trim().min(2),
  email: z.string().trim().email(),
});

function genericSuccess() {
  return NextResponse.json({
    success: true,
    message: 'Jika akses client cocok, link reset password akan dikirim ke email terdaftar.',
  });
}

export async function POST(request: NextRequest) {
  try {
    if (!isClientPasswordResetEnabled()) {
      logOperationalEvent({
        event: 'client.password_reset.request',
        level: 'warn',
        status: 'blocked',
        request,
        message: 'Client password reset request blocked: feature disabled',
      });
      return NextResponse.json({ error: 'Client password reset is disabled' }, { status: 503 });
    }

    const csrfToken = request.headers.get(CSRF_TOKEN_HEADER);
    const sessionCsrfToken = request.cookies.get(CSRF_TOKEN_COOKIE)?.value;
    if (!csrfToken || !sessionCsrfToken || !validateCSRFToken(csrfToken, sessionCsrfToken)) {
      logOperationalEvent({
        event: 'client.password_reset.request',
        level: 'warn',
        status: 'blocked',
        request,
        message: 'Client password reset request rejected: invalid CSRF',
      });
      return NextResponse.json({ error: 'Invalid or missing CSRF token' }, { status: 403 });
    }

    const rawBody = await request.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(rawBody);
    if (!parsed.success) {
      logOperationalEvent({
        event: 'client.password_reset.request',
        level: 'warn',
        status: 'failure',
        request,
        message: 'Client password reset request payload invalid',
      });
      return NextResponse.json(
        { error: 'Invalid password reset payload', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const rateLimit = await enforceRequestRateLimit(
      request,
      'client_password_reset_request',
      3,
      15 * 60 * 1000,
      30 * 60 * 1000
    );
    if (!rateLimit.allowed) {
      logOperationalEvent({
        event: 'client.password_reset.request',
        level: 'warn',
        status: 'blocked',
        request,
        siteSlug: parsed.data.siteSlug,
        message: 'Client password reset request blocked by rate limit',
        metadata: { retryAfter: rateLimit.retryAfter },
      });
      return NextResponse.json(
        {
          error: 'Too many reset attempts. Please try again later.',
          retryAfter: rateLimit.retryAfter,
        },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      );
    }

    const result = await createClientPasswordResetRequest({
      ...parsed.data,
      requestOrigin: request.nextUrl.origin,
    });

    if (!result.accepted) {
      logOperationalEvent({
        event: 'client.password_reset.request',
        level: 'warn',
        status: 'blocked',
        request,
        siteSlug: parsed.data.siteSlug,
        message: 'Client password reset request not accepted',
      });
      return NextResponse.json({ error: 'Client password reset is disabled' }, { status: 503 });
    }

    if (!result.delivery.delivered && result.delivery.reason !== 'generic-no-account-leak') {
      console.warn('[ClientPasswordReset] Delivery failed:', result.delivery.reason);
      logOperationalEvent({
        event: 'client.password_reset.request',
        level: 'error',
        status: 'failure',
        request,
        siteSlug: parsed.data.siteSlug,
        message: 'Client password reset delivery failed',
        metadata: { reason: result.delivery.reason },
      });
      return NextResponse.json(
        { error: 'Password reset email is not configured. Contact the platform admin.' },
        { status: 503 }
      );
    }

    logOperationalEvent({
      event: 'client.password_reset.request',
      status: 'success',
      request,
      siteSlug: parsed.data.siteSlug,
      message: 'Client password reset request accepted',
      metadata: { delivered: result.delivery.delivered },
    });

    return genericSuccess();
  } catch (error) {
    console.error('[ClientPasswordReset] Request failed:', error);
    logOperationalEvent({
      event: 'client.password_reset.request',
      level: 'error',
      status: 'failure',
      request,
      message: 'Client password reset request handler failed',
      metadata: { error: summarizeError(error) },
    });
    return NextResponse.json({ error: 'Failed to request password reset' }, { status: 500 });
  }
}
