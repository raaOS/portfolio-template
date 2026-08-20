import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  getClientSessionFromRequestMock,
  validateClientRequestMock,
  queryD1Mock,
  getSettingsMock,
  getBentoSettingsMock,
  saveBentoSettingsMock,
  revalidateSiteContentPathsMock,
} = vi.hoisted(() => ({
  getClientSessionFromRequestMock: vi.fn(),
  validateClientRequestMock: vi.fn(),
  queryD1Mock: vi.fn(),
  getSettingsMock: vi.fn(),
  getBentoSettingsMock: vi.fn(),
  saveBentoSettingsMock: vi.fn(),
  revalidateSiteContentPathsMock: vi.fn(),
}));

vi.mock('@/lib/clientAuth', () => ({
  getClientSessionFromRequest: getClientSessionFromRequestMock,
  validateClientRequest: validateClientRequestMock,
}));

vi.mock('@/lib/cloudflareD1', () => ({
  queryD1: queryD1Mock,
}));

vi.mock('@/lib/services/templateSettingsService', () => ({
  templateSettingsService: { getSettings: getSettingsMock },
  getBentoSettings: getBentoSettingsMock,
  saveBentoSettings: saveBentoSettingsMock,
}));

vi.mock('@/lib/admin/siteRequestContext', () => ({
  revalidateSiteContentPaths: revalidateSiteContentPathsMock,
}));

import { GET, PUT } from './route';
import { DEFAULT_BENTO_SETTINGS } from '@/lib/templates/bento/settings';

const proSession = {
  accessId: 'access-1',
  siteId: 'site-pro',
  siteSlug: 'pro-client',
  siteName: 'Pro Client',
  email: 'client@example.com',
  plan: 'pro' as const,
  siteStatus: 'active',
};

const liteSession = { ...proSession, siteId: 'site-lite', plan: 'lite' as const };

function buildRequest(method = 'GET', body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/client/template-settings', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('/api/client/template-settings', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getClientSessionFromRequestMock.mockResolvedValue(proSession);
    validateClientRequestMock.mockResolvedValue(proSession);
    queryD1Mock.mockResolvedValue([{ active_template_key: 'landing-bento' }]);
    getSettingsMock.mockResolvedValue(null);
    getBentoSettingsMock.mockResolvedValue(DEFAULT_BENTO_SETTINGS);
    saveBentoSettingsMock.mockResolvedValue(true);
    revalidateSiteContentPathsMock.mockResolvedValue(undefined);
  });

  describe('GET', () => {
    it('returns 401 if unauthenticated', async () => {
      getClientSessionFromRequestMock.mockResolvedValue(null);
      const res = await GET(buildRequest());
      expect(res.status).toBe(401);
    });

    it('returns active template settings with canCustomize flag for pro', async () => {
      const res = await GET(buildRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.templateId).toBe('landing-bento');
      expect(body.canCustomize).toBe(true);
      expect(getSettingsMock).toHaveBeenCalledWith('site-pro', 'landing-bento');
    });

    it('marks lite plan as not customizable', async () => {
      getClientSessionFromRequestMock.mockResolvedValue(liteSession);
      const res = await GET(buildRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.canCustomize).toBe(false);
    });
  });

  describe('PUT', () => {
    it('returns 401 if unauthenticated or CSRF invalid', async () => {
      validateClientRequestMock.mockResolvedValue(null);
      const res = await PUT(buildRequest('PUT', { settings: {} }));
      expect(res.status).toBe(401);
      expect(saveBentoSettingsMock).not.toHaveBeenCalled();
    });

    it('returns 403 for lite plan', async () => {
      validateClientRequestMock.mockResolvedValue(liteSession);
      const res = await PUT(buildRequest('PUT', { settings: { theme: { accent: 'rose' } } }));
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.error).toContain('Pro');
      expect(saveBentoSettingsMock).not.toHaveBeenCalled();
    });

    it('returns 400 for invalid settings payload', async () => {
      const res = await PUT(
        buildRequest('PUT', { settings: { theme: { accent: 'INVALID TOKEN!!' } } })
      );

      expect(res.status).toBe(400);
      expect(saveBentoSettingsMock).not.toHaveBeenCalled();
    });

    it('saves normalized settings for pro and revalidates tenant path', async () => {
      const res = await PUT(
        buildRequest('PUT', {
          settings: {
            theme: { accent: 'rose' },
            sections: [
              { id: 'hero', type: 'hero', order: 1, visible: false, variant: 'compact', animation: 'none' },
              { id: 'projects', type: 'projects', order: 0, visible: true, variant: 'list', animation: 'stagger' },
            ],
          },
        })
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.settings.theme.accent).toBe('rose');
      // Section hilang (sequence/experience/contact) di-append kembali oleh normalizer
      expect(body.settings.sections.map((s: { id: string }) => s.id)).toEqual(
        expect.arrayContaining(['hero', 'sequence', 'projects', 'experience', 'contact'])
      );
      expect(saveBentoSettingsMock).toHaveBeenCalledWith('site-pro', body.settings);
      expect(revalidateSiteContentPathsMock).toHaveBeenCalledWith('site-pro', ['/']);
    });
  });
});
