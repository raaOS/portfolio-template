import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  createClientPasswordResetRequestMock,
  isClientPasswordResetEnabledMock,
  validateCSRFTokenMock,
  enforceRequestRateLimitMock,
} = vi.hoisted(() => ({
  createClientPasswordResetRequestMock: vi.fn(),
  isClientPasswordResetEnabledMock: vi.fn(),
  validateCSRFTokenMock: vi.fn(),
  enforceRequestRateLimitMock: vi.fn(),
}));

vi.mock('@/lib/clientPasswordReset', () => ({
  createClientPasswordResetRequest: createClientPasswordResetRequestMock,
  isClientPasswordResetEnabled: isClientPasswordResetEnabledMock,
}));

vi.mock('@/lib/security', () => ({
  validateCSRFToken: validateCSRFTokenMock,
}));

vi.mock('@/lib/security/request', () => ({
  enforceRequestRateLimit: enforceRequestRateLimitMock,
}));

import { POST } from './route';

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/client/password-reset/request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: 'csrf_token=csrf',
      'x-csrf-token': 'csrf',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/client/password-reset/request', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    isClientPasswordResetEnabledMock.mockReturnValue(true);
    validateCSRFTokenMock.mockReturnValue(true);
    enforceRequestRateLimitMock.mockResolvedValue({ allowed: true });
    createClientPasswordResetRequestMock.mockResolvedValue({
      accepted: true,
      delivery: { delivered: true },
    });
  });

  it('rejects when reset is disabled', async () => {
    isClientPasswordResetEnabledMock.mockReturnValue(false);

    const response = await POST(makeRequest({ siteSlug: 'urgent', email: 'client@example.com' }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe('Client password reset is disabled');
  });

  it('requires csrf token', async () => {
    const response = await POST(
      makeRequest({ siteSlug: 'urgent', email: 'client@example.com' }, { 'x-csrf-token': '' })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Invalid or missing CSRF token');
  });

  it('returns generic success for valid request', async () => {
    const response = await POST(makeRequest({ siteSlug: 'urgent', email: 'client@example.com' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(createClientPasswordResetRequestMock).toHaveBeenCalledWith({
      siteSlug: 'urgent',
      email: 'client@example.com',
      requestOrigin: 'http://localhost',
    });
  });

  it('returns 503 when delivery provider is not configured', async () => {
    createClientPasswordResetRequestMock.mockResolvedValue({
      accepted: true,
      delivery: { delivered: false, reason: 'notification-provider-not-configured' },
    });

    const response = await POST(makeRequest({ siteSlug: 'urgent', email: 'client@example.com' }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe('Password reset email is not configured. Contact the platform admin.');
  });

  it('rate limits reset requests', async () => {
    enforceRequestRateLimitMock.mockResolvedValue({ allowed: false, retryAfter: 120 });

    const response = await POST(makeRequest({ siteSlug: 'urgent', email: 'client@example.com' }));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.retryAfter).toBe(120);
  });
});
