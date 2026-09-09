import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  validateAdminRequestMock,
  resolveRequestSiteIdMock,
  getSiteSettingMock,
  setSiteSettingMock,
  deleteSiteSettingMock,
} = vi.hoisted(() => ({
  validateAdminRequestMock: vi.fn(),
  resolveRequestSiteIdMock: vi.fn(),
  getSiteSettingMock: vi.fn(),
  setSiteSettingMock: vi.fn(),
  deleteSiteSettingMock: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  validateAdminRequest: validateAdminRequestMock,
}));

vi.mock('@/lib/admin/siteRequestContext', () => ({
  resolveRequestSiteId: resolveRequestSiteIdMock,
}));

vi.mock('@/crud/shared/settings/site', () => ({
  getSiteSetting: getSiteSettingMock,
  setSiteSetting: setSiteSettingMock,
  deleteSiteSetting: deleteSiteSettingMock,
}));

import { GET as settingsGET, POST as settingsPOST, DELETE as settingsDELETE } from '../settings/route';
import { POST as testPOST } from '../test/route';

describe('Admin AI Routes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
    validateAdminRequestMock.mockResolvedValue(true);
    resolveRequestSiteIdMock.mockResolvedValue('test-site');
  });

  describe('/api/admin/ai/settings', () => {
    it('GET returns 401 when unauthorized', async () => {
      validateAdminRequestMock.mockResolvedValue(false);
      const req = new NextRequest('http://localhost/api/admin/ai/settings');
      const res = await settingsGET(req);
      expect(res.status).toBe(401);
    });

    it('GET returns custom config when present in D1', async () => {
      getSiteSettingMock.mockResolvedValue({
        enabled: true,
        provider: 'custom',
        apiKey: '9router-secret-token',
        baseUrl: 'https://api.9router.com/v1',
        model: 'deepseek-chat',
      });

      const req = new NextRequest('http://localhost/api/admin/ai/settings');
      const res = await settingsGET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.isCustom).toBe(true);
      expect(body.config.provider).toBe('custom');
      expect(body.config.apiKeyMasked).toBe('9rou...oken');
    });

    it('POST saves custom AI settings to D1', async () => {
      const payload = {
        enabled: true,
        provider: 'custom',
        apiKey: 'sk-9router-newkey-12345',
        baseUrl: 'https://api.9router.com/v1',
        model: 'deepseek-chat',
      };

      const req = new NextRequest('http://localhost/api/admin/ai/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await settingsPOST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(setSiteSettingMock).toHaveBeenCalledWith('test-site', 'ai_config', expect.objectContaining({
        provider: 'custom',
        apiKey: 'sk-9router-newkey-12345',
      }));
    });

    it('DELETE resets custom AI settings from D1', async () => {
      const req = new NextRequest('http://localhost/api/admin/ai/settings', {
        method: 'DELETE',
      });

      const res = await settingsDELETE(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(deleteSiteSettingMock).toHaveBeenCalledWith('test-site', 'ai_config');
    });
  });

  describe('/api/admin/ai/test', () => {
    it('POST tests connection successfully with custom provider', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'OK' } }],
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const payload = {
        provider: 'custom',
        apiKey: 'test-key',
        baseUrl: 'https://api.9router.com/v1',
        model: 'deepseek-chat',
      };

      const req = new NextRequest('http://localhost/api/admin/ai/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await testPOST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.message).toContain('Koneksi berhasil');
    });
  });
});
