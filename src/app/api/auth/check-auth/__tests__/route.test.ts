import { describe, expect, it, vi } from 'vitest';
import { GET } from '../route';

vi.mock('@/crud/shared/auth/guard', () => ({
  getSiteUserSession: vi.fn(),
}));

import { getSiteUserSession } from '@/crud/shared/auth/guard';

describe('GET /api/auth/check-auth', () => {
  it('returns valid csrfToken and sets cookie even when unauthenticated', async () => {
    vi.mocked(getSiteUserSession).mockResolvedValue(null);

    const req = new Request('http://localhost/api/auth/check-auth');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.authenticated).toBe(false);
    expect(typeof data.csrfToken).toBe('string');
    expect(data.csrfToken.length).toBe(64);

    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('csrf_token=');
    expect(setCookie).toContain(data.csrfToken);
  });

  it('returns authenticated true with user info when session is valid', async () => {
    vi.mocked(getSiteUserSession).mockResolvedValue({
      userId: 'usr-1',
      siteId: 'default-site',
      email: 'admin@portfolio.test',
      role: 'admin',
    });

    const req = new Request('http://localhost/api/auth/check-auth');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.authenticated).toBe(true);
    expect(data.user?.email).toBe('admin@portfolio.test');
    expect(data.user?.role).toBe('admin');
    expect(data.csrfToken.length).toBe(64);
  });
});
