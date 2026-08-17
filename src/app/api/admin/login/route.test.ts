import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  verifyAdminPasswordMock,
  getAdminTokenMock,
  checkDataRateLimitMock,
  cookiesMock,
} = vi.hoisted(() => ({
  verifyAdminPasswordMock: vi.fn(),
  getAdminTokenMock: vi.fn(),
  checkDataRateLimitMock: vi.fn(),
  cookiesMock: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  verifyAdminPassword: verifyAdminPasswordMock,
  getAdminToken: getAdminTokenMock,
}));

vi.mock('@/lib/dataRateLimit', () => ({
  checkDataRateLimit: checkDataRateLimitMock,
}));

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}));

import { POST } from './route';

const originalNodeEnv = process.env.NODE_ENV;

describe('POST /api/admin/login', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: 'a'.repeat(64) }),
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          status: 'success',
          country: 'Indonesia',
          city: 'Jakarta',
          isp: 'Test ISP',
        }),
      })
    );
  });

  afterAll(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
    vi.unstubAllGlobals();
  });

  it('enforces rate limits in production even with test-bypass headers', async () => {
    checkDataRateLimitMock.mockResolvedValue({ allowed: false, retryAfter: 120 });

    const response = await POST(
      new Request('http://localhost/api/admin/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': 'a'.repeat(64),
          'x-test-bypass': 'true',
          'x-forwarded-for': '203.0.113.1',
          'user-agent': 'Mozilla/5.0 Chrome',
        },
        body: JSON.stringify({ password: 'IgnoredBecauseRateLimited123!' }),
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.retryAfter).toBe(120);
    expect(checkDataRateLimitMock).toHaveBeenCalledTimes(1);
  });

  it('returns sanitized 500 responses without leaking internal error details', async () => {
    checkDataRateLimitMock.mockResolvedValue({ allowed: true, retryAfter: 0 });
    verifyAdminPasswordMock.mockRejectedValue(new Error('scrypt config missing'));

    const response = await POST(
      new Request('http://localhost/api/admin/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': 'a'.repeat(64),
          'x-forwarded-for': '203.0.113.1',
          'user-agent': 'Mozilla/5.0 Chrome',
        },
        body: JSON.stringify({ password: 'ValidLength123!' }),
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Authentication service error' });
    expect(body).not.toHaveProperty('details');
  });

  it('does not accept the 4-digit PIN as an admin password', async () => {
    checkDataRateLimitMock.mockResolvedValue({ allowed: true, retryAfter: 0 });

    const response = await POST(
      new Request('http://localhost/api/admin/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': 'a'.repeat(64),
          'x-forwarded-for': '203.0.113.1',
          'user-agent': 'Mozilla/5.0 Chrome',
        },
        body: JSON.stringify({ password: '2101' }),
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Invalid password' });
    expect(verifyAdminPasswordMock).not.toHaveBeenCalled();
    expect(getAdminTokenMock).not.toHaveBeenCalled();
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
