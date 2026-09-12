import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { requireAuthMock, changeSiteUserPasswordMock, checkDataRateLimitMock, validateCSRFTokenMock } =
  vi.hoisted(() => ({
    requireAuthMock: vi.fn(),
    changeSiteUserPasswordMock: vi.fn(),
    checkDataRateLimitMock: vi.fn(),
    validateCSRFTokenMock: vi.fn(),
  }));

vi.mock('@/crud/shared/auth/guard', () => ({
  requireAuth: requireAuthMock,
}));

vi.mock('@/crud/shared/auth/changePassword', () => ({
  changeSiteUserPassword: changeSiteUserPasswordMock,
}));

vi.mock('@/lib/dataRateLimit', () => ({
  checkDataRateLimit: checkDataRateLimitMock,
}));

vi.mock('@/lib/security/request', () => ({
  getClientIP: vi.fn(),
}));

vi.mock('@/lib/security/token', () => ({
  validateCSRFToken: validateCSRFTokenMock,
}));

import { getClientIP } from '@/lib/security/request';
import { POST } from './route';

const SESSION = {
  userId: 'user-1',
  siteId: 'site-1',
  email: 'admin@site.test',
  role: 'admin',
  iat: 0,
  exp: 0,
};

function buildRequest(body: unknown, { withCsrf = true } = {}) {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (withCsrf) headers.set('x-csrf-token', 'a'.repeat(64));
  return new NextRequest('http://localhost/api/auth/change-password', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function stubCookie(req: NextRequest, value: string) {
  vi.spyOn(req.cookies, 'get').mockReturnValue({ name: 'csrf_token', value } as never);
}

describe('POST /api/auth/change-password', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getClientIP).mockReturnValue('203.0.113.10');
    validateCSRFTokenMock.mockReturnValue(true);
    checkDataRateLimitMock.mockResolvedValue({ allowed: true });
    requireAuthMock.mockResolvedValue({ session: SESSION });
    changeSiteUserPasswordMock.mockResolvedValue({ success: true });
  });

  it('rejects missing CSRF token with 403', async () => {
    validateCSRFTokenMock.mockReturnValue(false);
    const req = buildRequest({ currentPassword: 'a', newPassword: 'b' });
    stubCookie(req, 'b'.repeat(64));

    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(changeSiteUserPasswordMock).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated session with 401', async () => {
    requireAuthMock.mockResolvedValue({
      response: new Response(JSON.stringify({ error: 'unauth' }), { status: 401 }),
    });
    const req = buildRequest({ currentPassword: 'a', newPassword: 'b' });
    stubCookie(req, 'a'.repeat(64));

    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(changeSiteUserPasswordMock).not.toHaveBeenCalled();
  });

  it('blocks when rate limit is exhausted (429)', async () => {
    checkDataRateLimitMock.mockResolvedValue({ allowed: false, retryAfter: 300 });
    const req = buildRequest({ currentPassword: 'a', newPassword: 'b' });
    stubCookie(req, 'a'.repeat(64));

    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('300');
    expect(changeSiteUserPasswordMock).not.toHaveBeenCalled();
  });

  it('rejects invalid body with 400', async () => {
    const req = buildRequest({});
    stubCookie(req, 'a'.repeat(64));

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(changeSiteUserPasswordMock).not.toHaveBeenCalled();
  });

  it('passes session site + user to the service on success', async () => {
    const req = buildRequest({ currentPassword: 'Lama12345', newPassword: 'Baru12345' });
    stubCookie(req, 'a'.repeat(64));

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(changeSiteUserPasswordMock).toHaveBeenCalledWith('site-1', 'user-1', {
      currentPassword: 'Lama12345',
      newPassword: 'Baru12345',
    });
    expect(checkDataRateLimitMock).toHaveBeenCalledWith(
      'chpwd_203.0.113.10_user-1',
      5,
      5 * 60 * 1000,
      15 * 60 * 1000
    );
  });

  it('forwards service errors with the mapped status', async () => {
    changeSiteUserPasswordMock.mockResolvedValue({
      success: false,
      error: 'Password saat ini salah',
      status: 401,
    });
    const req = buildRequest({ currentPassword: 'Salah12345', newPassword: 'Baru12345' });
    stubCookie(req, 'a'.repeat(64));

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Password saat ini salah');
  });
});
