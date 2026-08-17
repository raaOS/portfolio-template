import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import { enforceRequestRateLimit } from '@/lib/security/request';

const MAX_AI_REQUESTS = 10;
const RATE_LIMIT_WINDOW = 60 * 1000;
const BLOCK_DURATION = 5 * 60 * 1000;

export function getGoogleAiApiKey() {
  const provider = (process.env.AI_PROVIDER || '').toLowerCase();
  return (
    provider === 'gemini' || provider === 'google' ? process.env.AI_API_KEY || '' : ''
  ).trim();
}

export function getOpenRouterApiKey() {
  const provider = (process.env.AI_PROVIDER || '').toLowerCase();
  return provider === 'openrouter' ? process.env.AI_API_KEY || '' : '';
}

export async function guardAdminAiRequest(req: NextRequest, scope: string) {
  if (!(await validateAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimit = await enforceRequestRateLimit(
    req,
    scope,
    MAX_AI_REQUESTS,
    RATE_LIMIT_WINDOW,
    BLOCK_DURATION
  );

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.', retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
    );
  }

  return null;
}
