import { beforeEach, describe, expect, it, vi } from 'vitest';

const { checkAdminAuthMock, logAdminActivityMock } = vi.hoisted(() => ({
    checkAdminAuthMock: vi.fn(),
    logAdminActivityMock: vi.fn(),
  }));

vi.mock('@/lib/auth', () => ({
  checkAdminAuth: checkAdminAuthMock,
}));

vi.mock('@/lib/services/auditLogger', () => ({
  logAdminActivity: logAdminActivityMock,
}));

import { POST } from './route';
import { NextRequest } from 'next/server';

describe('POST /api/admin/logout', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    logAdminActivityMock.mockResolvedValue(undefined);
  });

  it('clears cookies and returns success when authenticated', async () => {
    checkAdminAuthMock.mockReturnValue(true);
    const req = new NextRequest('http://localhost/api/admin/logout', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe('Logged out successfully');

    expect(logAdminActivityMock).toHaveBeenCalledTimes(1);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
  });

  it('returns success without audit log when not authenticated', async () => {
    checkAdminAuthMock.mockReturnValue(false);
    const req = new NextRequest('http://localhost/api/admin/logout', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe('Logged out successfully');
    expect(logAdminActivityMock).not.toHaveBeenCalled();
  });

  it('returns 500 on catch error', async () => {
    checkAdminAuthMock.mockImplementation(() => {
      throw new Error('Cookie read crash');
    });
    const req = new NextRequest('http://localhost/api/admin/logout', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.message).toBe('Logout failed');
  });

  it('clears cookies aggressively via Set-Cookie headers', async () => {
    checkAdminAuthMock.mockReturnValue(true);
    const req = new NextRequest('http://localhost/api/admin/logout', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const setCookieHeader = res.headers.get('Set-Cookie') ?? '';
    expect(setCookieHeader).toContain('admin_token=;');
    expect(setCookieHeader).toContain('admin-token=;');
    expect(setCookieHeader).toContain('csrf_token=;');
    expect(setCookieHeader.match(/Expires=Thu, 01 Jan 1970 00:00:00 GMT/g)).toHaveLength(3);
    expect(setCookieHeader.match(/Path=\//g)).toHaveLength(3);
    expect(res.headers.get('Cache-Control')).toBe('no-store, max-age=0, must-revalidate');
    expect(res.headers.get('Pragma')).toBe('no-cache');
  });
});
