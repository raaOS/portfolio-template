import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryD1Mock, isD1ConfiguredMock, bootstrapD1SchemaMock } = vi.hoisted(() => ({
  queryD1Mock: vi.fn(),
  isD1ConfiguredMock: vi.fn(),
  bootstrapD1SchemaMock: vi.fn(),
}));

vi.mock('@/lib/cloudflareD1', () => ({
  queryD1: queryD1Mock,
  isD1Configured: isD1ConfiguredMock,
  bootstrapD1Schema: bootstrapD1SchemaMock,
}));

import {
  templateSettingsService,
  getBentoSettings,
  saveBentoSettings,
} from './templateSettingsService';
import { DEFAULT_BENTO_SETTINGS } from '@/lib/templates/bento/settings';

describe('templateSettingsService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    isD1ConfiguredMock.mockReturnValue(true);
    bootstrapD1SchemaMock.mockResolvedValue(undefined);
    queryD1Mock.mockResolvedValue([]);
  });

  describe('getSettings', () => {
    it('returns null when D1 is not configured', async () => {
      isD1ConfiguredMock.mockReturnValue(false);
      const result = await templateSettingsService.getSettings('site-1', 'landing-bento');
      expect(result).toBeNull();
      expect(queryD1Mock).not.toHaveBeenCalled();
    });

    it('returns null when no row exists', async () => {
      const result = await templateSettingsService.getSettings('site-1', 'landing-bento');
      expect(result).toBeNull();
    });

    it('parses stored settings_json', async () => {
      queryD1Mock.mockResolvedValueOnce([
        { settings_json: JSON.stringify({ options: { theme: { accent: 'rose' } } }) },
      ]);

      const result = await templateSettingsService.getSettings('site-1', 'landing-bento');
      expect(result?.templateId).toBe('landing-bento');
      expect(result?.options).toEqual({ theme: { accent: 'rose' } });
    });

    it('returns null on corrupted JSON', async () => {
      queryD1Mock.mockResolvedValueOnce([{ settings_json: '{broken json' }]);
      const result = await templateSettingsService.getSettings('site-1', 'landing-bento');
      expect(result).toBeNull();
    });
  });

  describe('saveSettings', () => {
    it('returns false when D1 is not configured', async () => {
      isD1ConfiguredMock.mockReturnValue(false);
      const result = await templateSettingsService.saveSettings('site-1', 'landing-bento', {});
      expect(result).toBe(false);
    });

    it('upserts settings_json scoped to (site_id, template_id)', async () => {
      const result = await templateSettingsService.saveSettings('site-1', 'landing-bento', {
        options: { theme: { accent: 'rose' } },
      });

      expect(result).toBe(true);
      expect(queryD1Mock).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT(site_id, template_id)'),
        expect.arrayContaining([
          expect.stringMatching(/^ts_/),
          'site-1',
          'landing-bento',
          JSON.stringify({ options: { theme: { accent: 'rose' } } }),
        ])
      );
    });
  });

  describe('bento helpers', () => {
    it('getBentoSettings returns defaults when nothing stored', async () => {
      const result = await getBentoSettings('site-1');
      expect(result).toEqual(DEFAULT_BENTO_SETTINGS);
    });

    it('getBentoSettings normalizes stored partial options', async () => {
      queryD1Mock.mockResolvedValueOnce([
        { settings_json: JSON.stringify({ options: { theme: { accent: 'cyan' } } }) },
      ]);

      const result = await getBentoSettings('site-1');
      expect(result.theme.accent).toBe('cyan');
      expect(result.theme.font).toBe(DEFAULT_BENTO_SETTINGS.theme.font);
      expect(result.sections).toHaveLength(DEFAULT_BENTO_SETTINGS.sections.length);
    });

    it('saveBentoSettings persists under options wrapper', async () => {
      const result = await saveBentoSettings('site-1', DEFAULT_BENTO_SETTINGS);
      expect(result).toBe(true);
      expect(queryD1Mock).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO site_template_settings'),
        expect.arrayContaining([
          expect.any(String),
          'site-1',
          'landing-bento',
          JSON.stringify({ options: DEFAULT_BENTO_SETTINGS }),
          expect.any(String),
        ])
      );
    });
  });
});
