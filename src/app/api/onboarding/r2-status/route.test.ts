import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

const { getSiteSettingMock, queryD1Mock, getOwnerWhatsappMock, rateLimitMock } = vi.hoisted(() => ({
  getSiteSettingMock: vi.fn(),
  queryD1Mock: vi.fn(),
  getOwnerWhatsappMock: vi.fn(),
  rateLimitMock: vi.fn(),
}));

vi.mock('@/crud/shared/settings/site', () => ({
  getSiteSetting: getSiteSettingMock,
}));

vi.mock('@/crud/shared/db/connection', () => ({
  queryD1: queryD1Mock,
}));

vi.mock('@/lib/services/pricingConfigService', () => ({
  getOwnerWhatsapp: getOwnerWhatsappMock,
}));

vi.mock('@/lib/security/request', () => ({
  enforceRequestRateLimit: rateLimitMock,
}));

import { GET } from './route';

function buildRequest(token?: string) {
  const url = token
    ? `http://localhost/api/onboarding/r2-status?token=${encodeURIComponent(token)}`
    : 'http://localhost/api/onboarding/r2-status';
  return new NextRequest(url);
}

describe('GET /api/onboarding/r2-status (deferred R2 wizard)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    rateLimitMock.mockResolvedValue({ allowed: true });
    getOwnerWhatsappMock.mockResolvedValue('628123456789');
    queryD1Mock.mockResolvedValue([{ name: 'Portfolio Andi' }]);
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'acc123');
  });

  it('menjawab selesai tanpa validasi token saat wizard_completed=true', async () => {
    getSiteSettingMock.mockImplementation((_siteId: string, key: string) =>
      key === 'wizard_completed' ? Promise.resolve(true) : Promise.resolve(null)
    );

    const res = await GET(buildRequest('token-apapun'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('selesai');
  });

  it('menjawab menunggu-aktivasi untuk token valid + memuat deep-link & WA', async () => {
    const validToken = 'a'.repeat(64);
    const hash = crypto.createHash('sha256').update(validToken).digest('hex');
    getSiteSettingMock.mockImplementation((_siteId: string, key: string) => {
      if (key === 'wizard_completed') return Promise.resolve(null);
      if (key === 'media_pending') return Promise.resolve(true);
      if (key === 'wizard_token_hash') return Promise.resolve(hash);
      if (key === 'wizard_token_created_at') return Promise.resolve(new Date().toISOString());
      return Promise.resolve(null);
    });

    const res = await GET(buildRequest(validToken));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('menunggu-aktivasi');
    expect(body.siteName).toBe('Portfolio Andi');
    expect(body.dashboardUrl).toContain('dash.cloudflare.com/acc123/r2/overview');
    expect(body.whatsappUrl).toContain('wa.me/628123456789');
  });

  it('menolak token salah (404, overlay tidak tampil)', async () => {
    const hash = crypto.createHash('sha256').update('token-benar').digest('hex');
    getSiteSettingMock.mockImplementation((_siteId: string, key: string) => {
      if (key === 'wizard_completed') return Promise.resolve(null);
      if (key === 'media_pending') return Promise.resolve(true);
      if (key === 'wizard_token_hash') return Promise.resolve(hash);
      if (key === 'wizard_token_created_at') return Promise.resolve(new Date().toISOString());
      return Promise.resolve(null);
    });

    const res = await GET(buildRequest('token-salah'));

    expect(res.status).toBe(404);
  });

  it('menolak token kedaluwarsa (>30 hari)', async () => {
    const validToken = 'b'.repeat(64);
    const hash = crypto.createHash('sha256').update(validToken).digest('hex');
    const stale = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    getSiteSettingMock.mockImplementation((_siteId: string, key: string) => {
      if (key === 'wizard_completed') return Promise.resolve(null);
      if (key === 'media_pending') return Promise.resolve(true);
      if (key === 'wizard_token_hash') return Promise.resolve(hash);
      if (key === 'wizard_token_created_at') return Promise.resolve(stale);
      return Promise.resolve(null);
    });

    const res = await GET(buildRequest(validToken));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.status).toBe('expired');
  });

  it('fail-closed saat media_pending tidak ada (klien non-pending)', async () => {
    getSiteSettingMock.mockResolvedValue(null);

    const res = await GET(buildRequest('token-apapun'));

    expect(res.status).toBe(404);
  });

  it('rate limit 429', async () => {
    rateLimitMock.mockResolvedValue({ allowed: false, retryAfter: 60 });

    const res = await GET(buildRequest('token-apapun'));

    expect(res.status).toBe(429);
  });
});
