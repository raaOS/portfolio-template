import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { resetClientPasswordWithTokenMock, enforceRequestRateLimitMock } = vi.hoisted(() => ({
  resetClientPasswordWithTokenMock: vi.fn(),
  enforceRequestRateLimitMock: vi.fn(),
}));

vi.mock('@/lib/clientPasswordReset', () => ({
  resetClientPasswordWithToken: resetClientPasswordWithTokenMock,
}));

vi.mock('@/lib/security/request', () => ({
  enforceRequestRateLimit: enforceRequestRateLimitMock,
}));

import { POST } from './route';

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/client/password-reset/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const token = 'a'.repeat(43);

describe('POST /api/client/password-reset/confirm', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    enforceRequestRateLimitMock.mockResolvedValue({ allowed: true });
    resetClientPasswordWithTokenMock.mockResolvedValue(true);
  });

  it('rejects invalid payload', async () => {
    const response = await POST(makeRequest({ token: 'short', newPassword: 'secret-123' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid password reset payload');
    expect(resetClientPasswordWithTokenMock).not.toHaveBeenCalled();
  });

  it('resets client password with valid token', async () => {
    const response = await POST(makeRequest({ token, newPassword: 'secret-123' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(resetClientPasswordWithTokenMock).toHaveBeenCalledWith({
      token,
      newPassword: 'secret-123',
    });
  });

  it('rejects invalid or expired token', async () => {
    resetClientPasswordWithTokenMock.mockResolvedValue(false);

    const response = await POST(makeRequest({ token, newPassword: 'secret-123' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Reset token is invalid or expired');
  });

  it('rate limits reset confirmations', async () => {
    enforceRequestRateLimitMock.mockResolvedValue({ allowed: false, retryAfter: 120 });

    const response = await POST(makeRequest({ token, newPassword: 'secret-123' }));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.retryAfter).toBe(120);
  });
});
