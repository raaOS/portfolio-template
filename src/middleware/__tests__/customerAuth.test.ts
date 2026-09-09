// @vitest-environment node
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { signSiteUserJWT, verifySiteUserJWT, deriveSiteSecret } from '@/crud/shared/auth/session';
import { checkCustomerAuth } from '../customer-auth';

const TEST_SECRET = 'test-jwt-secret-at-least-32-characters-long!';

describe('Customer Auth & Session Key Derivation', () => {
  beforeEach(() => {
    vi.stubEnv('JWT_SECRET', TEST_SECRET);
    vi.stubEnv('CUSTOMER_SITE_ID', 'test-site');
  });

  it('deriveSiteSecret produces consistent and identical keys for the same site', async () => {
    const key1 = await deriveSiteSecret('test-site');
    const key2 = await deriveSiteSecret('test-site');
    expect(key1).toEqual(key2);

    const otherSiteKey = await deriveSiteSecret('other-site');
    expect(key1).not.toEqual(otherSiteKey);
  });

  it('signs a token with session.ts that checkCustomerAuth can verify in middleware', async () => {
    const token = await signSiteUserJWT({
      userId: 'usr-123',
      siteId: 'test-site',
      email: 'admin@test.com',
      role: 'admin',
    });

    const session = await verifySiteUserJWT(token);
    expect(session).not.toBeNull();
    expect(session?.userId).toBe('usr-123');
    expect(session?.siteId).toBe('test-site');

    // Build protected request to /admin
    const req = new NextRequest('http://localhost/admin/desktop');
    req.cookies.set('site_user_token', token);

    const result = await checkCustomerAuth(req);
    expect(result.authenticated).toBe(true);
  });

  it('redirects unauthenticated requests to /admin to /admin/login', async () => {
    const req = new NextRequest('http://localhost/admin/settings');
    const result = await checkCustomerAuth(req);

    expect(result.authenticated).toBe(false);
    expect(result.response?.status).toBe(307);
    expect(result.response?.headers.get('location')).toContain('/admin/login?redirect=%2Fadmin%2Fsettings');
  });

  it('rejects unauthenticated requests to protected /api/admin by returning 401', async () => {
    const req = new NextRequest('http://localhost/api/admin/settings');
    const result = await checkCustomerAuth(req);

    expect(result.authenticated).toBe(false);
    expect(result.response?.status).toBe(401);
  });

  it('allows public routes like /admin/login without authentication', async () => {
    const req = new NextRequest('http://localhost/admin/login');
    const result = await checkCustomerAuth(req);

    expect(result.authenticated).toBe(true);
  });

  it('allows public auth API routes like /api/auth/login and /api/auth/check-auth', async () => {
    const loginReq = new NextRequest('http://localhost/api/auth/login', { method: 'POST' });
    const checkReq = new NextRequest('http://localhost/api/auth/check-auth', { method: 'GET' });

    expect((await checkCustomerAuth(loginReq)).authenticated).toBe(true);
    expect((await checkCustomerAuth(checkReq)).authenticated).toBe(true);
  });
});
