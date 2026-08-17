import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { shouldRedirectToHttps } from '../utils';

function buildRequest(url: string, forwardedProto?: string): NextRequest {
  const headers = new Headers();
  if (forwardedProto) {
    headers.set('x-forwarded-proto', forwardedProto);
  }

  return new NextRequest(url, { headers });
}

describe('shouldRedirectToHttps', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('redirects production http requests for public domains', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(shouldRedirectToHttps(buildRequest('http://makeitbetter.my.id/'))).toBe(true);
  });

  it('uses x-forwarded-proto when Cloudflare forwards the original scheme', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(
      shouldRedirectToHttps(buildRequest('https://makeitbetter.my.id/', 'http'))
    ).toBe(true);
  });

  it('does not redirect https production requests', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(shouldRedirectToHttps(buildRequest('https://makeitbetter.my.id/'))).toBe(false);
  });

  it('does not redirect localhost development requests', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(shouldRedirectToHttps(buildRequest('http://localhost:3000/'))).toBe(false);
  });

  it('does not redirect outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');

    expect(shouldRedirectToHttps(buildRequest('http://makeitbetter.my.id/'))).toBe(false);
  });
});
