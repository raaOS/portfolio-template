import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { validateAdminRequest } from '../auth';

vi.mock('@/crud/shared/auth/guard', () => ({
  getSiteUserSession: vi.fn(),
}));

vi.mock('@/lib/services/auditLogger', () => ({
  logAdminActivity: vi.fn().mockResolvedValue(undefined),
}));

import { getSiteUserSession } from '@/crud/shared/auth/guard';

describe('validateAdminRequest', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('authenticates customer session via site_user_token when role is admin', async () => {
    vi.mocked(getSiteUserSession).mockResolvedValue({
      userId: 'usr-123',
      siteId: 'default-site',
      email: 'customer@test.com',
      role: 'admin',
    });

    const req = new NextRequest('http://localhost/api/settings', {
      method: 'GET',
    });

    const isValid = await validateAdminRequest(req, { checkCsrf: false });
    expect(isValid).toBe(true);
    expect(getSiteUserSession).toHaveBeenCalledWith(req);
  });

  it('rejects customer session when role is not admin', async () => {
    vi.mocked(getSiteUserSession).mockResolvedValue({
      userId: 'usr-123',
      siteId: 'default-site',
      email: 'viewer@test.com',
      role: 'viewer',
    });

    const req = new NextRequest('http://localhost/api/settings', {
      method: 'GET',
    });

    const isValid = await validateAdminRequest(req, { checkCsrf: false });
    expect(isValid).toBe(false);
  });

  it('rejects when no session and no admin_token exist', async () => {
    vi.mocked(getSiteUserSession).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/settings', {
      method: 'GET',
    });

    const isValid = await validateAdminRequest(req, { checkCsrf: false });
    expect(isValid).toBe(false);
  });
});
