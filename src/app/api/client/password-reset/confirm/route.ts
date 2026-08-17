import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resetClientPasswordWithToken } from '@/lib/clientPasswordReset';
import { enforceRequestRateLimit } from '@/lib/security/request';
import { logOperationalEvent, summarizeError } from '@/lib/observability/operationalLog';

export const dynamic = 'force-dynamic';

const confirmSchema = z.object({
  token: z.string().trim().min(32),
  newPassword: z.string().min(8),
});

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parsed = confirmSchema.safeParse(rawBody);
    if (!parsed.success) {
      logOperationalEvent({
        event: 'client.password_reset.confirm',
        level: 'warn',
        status: 'failure',
        request,
        message: 'Client password reset confirm payload invalid',
      });
      return NextResponse.json(
        { error: 'Invalid password reset payload', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const rateLimit = await enforceRequestRateLimit(
      request,
      'client_password_reset_confirm',
      5,
      15 * 60 * 1000,
      30 * 60 * 1000
    );
    if (!rateLimit.allowed) {
      logOperationalEvent({
        event: 'client.password_reset.confirm',
        level: 'warn',
        status: 'blocked',
        request,
        message: 'Client password reset confirm blocked by rate limit',
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

    const success = await resetClientPasswordWithToken(parsed.data);
    if (!success) {
      logOperationalEvent({
        event: 'client.password_reset.confirm',
        level: 'warn',
        status: 'failure',
        request,
        message: 'Client password reset confirm failed',
        metadata: { reason: 'invalid-or-expired-token' },
      });
      return NextResponse.json(
        { error: 'Reset token is invalid or expired' },
        { status: 400 }
      );
    }

    logOperationalEvent({
      event: 'client.password_reset.confirm',
      status: 'success',
      request,
      message: 'Client password reset confirm success',
    });

    return NextResponse.json({
      success: true,
      message: 'Password client berhasil diganti. Silakan login kembali.',
    });
  } catch (error) {
    console.error('[ClientPasswordReset] Confirm failed:', error);
    logOperationalEvent({
      event: 'client.password_reset.confirm',
      level: 'error',
      status: 'failure',
      request,
      message: 'Client password reset confirm handler failed',
      metadata: { error: summarizeError(error) },
    });
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
