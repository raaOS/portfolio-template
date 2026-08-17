import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  validateAdminRequestMock,
  queryD1Mock,
  hashClientPasswordMock,
} = vi.hoisted(() => ({
  validateAdminRequestMock: vi.fn(),
  queryD1Mock: vi.fn(),
  hashClientPasswordMock: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  validateAdminRequest: validateAdminRequestMock,
}));

vi.mock('@/lib/cloudflareD1', () => ({
  queryD1: queryD1Mock,
}));

vi.mock('@/lib/clientAuth', () => ({
  hashClientPassword: hashClientPasswordMock,
  normalizeClientEmail: (email: string) => email.trim().toLowerCase(),
}));

import { GET, POST } from './route';

function buildRequest(method = 'GET', body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/sites/site-1/client-access', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const props = { params: Promise.resolve({ siteId: 'site-1' }) };

describe('api/admin/sites/[siteId]/client-access', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    validateAdminRequestMock.mockResolvedValue(true);
    hashClientPasswordMock.mockReturnValue('hashed-password');
  });

  it('rejects unauthenticated requests', async () => {
    validateAdminRequestMock.mockResolvedValue(false);

    const response = await GET(buildRequest(), props);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(queryD1Mock).not.toHaveBeenCalled();
  });

  it('creates client access for a site', async () => {
    queryD1Mock
      .mockResolvedValueOnce([{ id: 'site-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'client-new' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'client-1',
          site_id: 'site-1',
          email: 'client@example.com',
          status: 'active',
          created_at: '2026-07-01T00:00:00Z',
          updated_at: '2026-07-01T00:00:00Z',
          last_login_at: null,
        },
      ]);

    const response = await POST(
      buildRequest('POST', {
        email: 'CLIENT@example.com',
        password: 'secret-123',
        status: 'active',
      }),
      props
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.clientAccess).toMatchObject({
      siteId: 'site-1',
      email: 'client@example.com',
      status: 'active',
    });
    expect(hashClientPasswordMock).toHaveBeenCalledWith('secret-123');
    expect(queryD1Mock).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO client_access'), [
      expect.stringMatching(/^client-/),
      'site-1',
      'client@example.com',
      'hashed-password',
      'active',
      expect.any(String),
      expect.any(String),
    ]);
  });

  it('requires password for new access', async () => {
    queryD1Mock.mockResolvedValueOnce([{ id: 'site-1' }]).mockResolvedValueOnce([]);

    const response = await POST(
      buildRequest('POST', {
        email: 'client@example.com',
        status: 'active',
      }),
      props
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Password is required for new client access');
  });
});
