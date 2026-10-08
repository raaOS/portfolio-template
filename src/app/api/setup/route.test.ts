import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { verifyDeploymentMock, seedDeploymentMock, rateLimitMock } = vi.hoisted(() => ({
  verifyDeploymentMock: vi.fn(),
  seedDeploymentMock: vi.fn(),
  rateLimitMock: vi.fn(),
}));

vi.mock('@/crud/shared/db/seed', () => ({
  verifyDeployment: verifyDeploymentMock,
  seedDeployment: seedDeploymentMock,
}));

vi.mock('@/lib/dataRateLimit', () => ({
  checkDataRateLimit: rateLimitMock,
}));

vi.mock('@/lib/security/request', () => ({
  getClientIP: () => '127.0.0.1',
}));

import { GET, POST } from './route';

function buildRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/setup', {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('/api/setup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitMock.mockResolvedValue({ allowed: true });
    verifyDeploymentMock.mockResolvedValue({ hasSite: false, hasAdmin: false });
    seedDeploymentMock.mockResolvedValue({ siteCreated: true, adminCreated: true });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('deployment managed (CUSTOMER_SITE_ID terisi)', () => {
    beforeEach(() => {
      vi.stubEnv('CUSTOMER_SITE_ID', 'klien-satu');
    });

    it('POST membalas 404 tanpa memanggil rate limit maupun seeding', async () => {
      const res = await POST(
        buildRequest('POST', { adminEmail: 'a@b.com', adminPassword: 'password123' })
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('Endpoint setup dinonaktifkan pada deployment ini.');
      expect(rateLimitMock).not.toHaveBeenCalled();
      expect(verifyDeploymentMock).not.toHaveBeenCalled();
      expect(seedDeploymentMock).not.toHaveBeenCalled();
    });

    it('GET balas status setup selesai tanpa memanggil verifyDeployment', async () => {
      const res = await GET(buildRequest('GET'));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        isSetupComplete: true,
        hasSite: true,
        hasAdmin: true,
      });
      expect(verifyDeploymentMock).not.toHaveBeenCalled();
    });
  });

  describe('deployment tanpa CUSTOMER_SITE_ID', () => {
    beforeEach(() => {
      vi.stubEnv('CUSTOMER_SITE_ID', '   ');
    });

    it('GET tetap memakai verifyDeployment', async () => {
      verifyDeploymentMock.mockResolvedValue({ hasSite: true, hasAdmin: true });

      const res = await GET(buildRequest('GET'));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        isSetupComplete: true,
        hasSite: true,
        hasAdmin: true,
      });
      expect(verifyDeploymentMock).toHaveBeenCalledTimes(1);
    });

    it('POST ditolak 400 saat admin sudah ada', async () => {
      verifyDeploymentMock.mockResolvedValue({ hasSite: true, hasAdmin: true });

      const res = await POST(
        buildRequest('POST', { adminEmail: 'a@b.com', adminPassword: 'password123' })
      );

      expect(res.status).toBe(400);
      expect(seedDeploymentMock).not.toHaveBeenCalled();
    });

    it('POST ditolak 429 saat rate limit tercapai', async () => {
      rateLimitMock.mockResolvedValue({ allowed: false, retryAfter: 60 });

      const res = await POST(
        buildRequest('POST', { adminEmail: 'a@b.com', adminPassword: 'password123' })
      );

      expect(res.status).toBe(429);
      expect(verifyDeploymentMock).not.toHaveBeenCalled();
    });
  });
});
