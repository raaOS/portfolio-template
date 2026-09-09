import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getResolvedAiConfig,
  saveSiteAiConfig,
  resetSiteAiConfig,
  maskApiKey,
  callUniversalAiCompletion,
  testAiConnection,
  type SiteAiConfig,
} from '../aiGatewayService';

// Mock getSiteSetting, setSiteSetting, deleteSiteSetting
const { getSiteSettingMock, setSiteSettingMock, deleteSiteSettingMock } = vi.hoisted(() => ({
  getSiteSettingMock: vi.fn(),
  setSiteSettingMock: vi.fn(),
  deleteSiteSettingMock: vi.fn(),
}));

vi.mock('@/crud/shared/settings/site', () => ({
  getSiteSetting: getSiteSettingMock,
  setSiteSetting: setSiteSettingMock,
  deleteSiteSetting: deleteSiteSettingMock,
}));

describe('aiGatewayService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
  });

  describe('maskApiKey', () => {
    it('masks api keys properly', () => {
      expect(maskApiKey('AIzaSyD1234567890abcdef')).toBe('AIza...cdef');
      expect(maskApiKey('short')).toBe('********');
      expect(maskApiKey('')).toBe('');
    });
  });

  describe('getResolvedAiConfig', () => {
    it('returns custom config from D1 if available and enabled', async () => {
      const customConfig: SiteAiConfig = {
        enabled: true,
        provider: 'custom',
        apiKey: '9router-key-12345',
        baseUrl: 'https://api.9router.com/v1',
        model: 'deepseek-chat',
      };
      getSiteSettingMock.mockResolvedValue(customConfig);

      const config = await getResolvedAiConfig('site-123');
      expect(config).not.toBeNull();
      expect(config?.provider).toBe('custom');
      expect(config?.apiKey).toBe('9router-key-12345');
      expect(config?.baseUrl).toBe('https://api.9router.com/v1');
      expect(config?.model).toBe('deepseek-chat');
    });

    it('falls back to environment variables when D1 has no custom config', async () => {
      getSiteSettingMock.mockResolvedValue(null);
      vi.stubEnv('AI_PROVIDER', 'openrouter');
      vi.stubEnv('AI_API_KEY', 'sk-or-test-key');

      const config = await getResolvedAiConfig('site-123');
      expect(config).not.toBeNull();
      expect(config?.provider).toBe('openrouter');
      expect(config?.apiKey).toBe('sk-or-test-key');
    });

    it('returns null if neither D1 nor env has an API key', async () => {
      getSiteSettingMock.mockResolvedValue(null);
      vi.stubEnv('AI_API_KEY', '');

      const config = await getResolvedAiConfig('site-123');
      expect(config).toBeNull();
    });
  });

  describe('saveSiteAiConfig and resetSiteAiConfig', () => {
    it('saves config to D1 via setSiteSetting', async () => {
      const newConfig: SiteAiConfig = {
        enabled: true,
        provider: 'openai',
        apiKey: 'sk-proj-test',
      };
      await saveSiteAiConfig('site-1', newConfig);
      expect(setSiteSettingMock).toHaveBeenCalledWith('site-1', 'ai_config', newConfig);
    });

    it('deletes config from D1 via deleteSiteSetting', async () => {
      await resetSiteAiConfig('site-1');
      expect(deleteSiteSettingMock).toHaveBeenCalledWith('site-1', 'ai_config');
    });
  });

  describe('callUniversalAiCompletion', () => {
    it('calls Google Gemini endpoint when provider is gemini', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Halo dari Gemini' }] } }],
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await callUniversalAiCompletion({
        configOverride: {
          enabled: true,
          provider: 'gemini',
          apiKey: 'gemini-key',
          model: 'gemini-2.0-flash',
        },
        messages: [{ role: 'user', content: 'Halo' }],
      });

      expect(result.content).toBe('Halo dari Gemini');
      expect(result.provider).toBe('gemini');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.objectContaining({
          headers: expect.objectContaining({ 'x-goog-api-key': 'gemini-key' }),
        })
      );
    });

    it('calls OpenAI-compatible endpoint (9router / Custom) with bearer auth and model', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Respon dari 9router' } }],
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await callUniversalAiCompletion({
        configOverride: {
          enabled: true,
          provider: 'custom',
          apiKey: '9router-secret-token',
          baseUrl: 'https://api.9router.com/v1',
          model: 'deepseek-chat',
        },
        messages: [{ role: 'user', content: 'Tuliskan bio' }],
      });

      expect(result.content).toBe('Respon dari 9router');
      expect(result.provider).toBe('custom');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.9router.com/v1/chat/completions',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer 9router-secret-token',
          }),
          body: expect.stringContaining('"model":"deepseek-chat"'),
        })
      );
    });
  });

  describe('testAiConnection', () => {
    it('returns success when ping completes successfully', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'OK' } }],
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await testAiConnection({
        enabled: true,
        provider: 'openrouter',
        apiKey: 'sk-or-valid',
        model: 'openai/gpt-4o-mini',
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('Koneksi berhasil');
      expect(res.latencyMs).toBeTypeOf('number');
    });

    it('returns error when API call fails', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Invalid API key provided',
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await testAiConnection({
        enabled: true,
        provider: 'openai',
        apiKey: 'sk-invalid',
      });

      expect(res.success).toBe(false);
      expect(res.message).toContain('401');
    });
  });
});
