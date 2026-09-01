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

import { templateSettingsService } from './templateSettingsService';

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
      const result = await templateSettingsService.getSettings('site-1', 'os-desktop');
      expect(result).toBeNull();
      expect(queryD1Mock).not.toHaveBeenCalled();
    });

    it('returns null when no row exists', async () => {
      const result = await templateSettingsService.getSettings('site-1', 'os-desktop');
      expect(result).toBeNull();
    });

    it('parses stored settings_json', async () => {
      queryD1Mock.mockResolvedValueOnce([
        { settings_json: JSON.stringify({ options: { theme: { accent: 'rose' } } }) },
      ]);

      const result = await templateSettingsService.getSettings('site-1', 'os-desktop');
      expect(result?.templateId).toBe('os-desktop');
      expect(result?.options).toEqual({ theme: { accent: 'rose' } });
    });

    it('returns null on corrupted JSON', async () => {
      queryD1Mock.mockResolvedValueOnce([{ settings_json: '{broken json' }]);
      const result = await templateSettingsService.getSettings('site-1', 'os-desktop');
      expect(result).toBeNull();
    });
  });

  describe('saveSettings', () => {
    it('returns false when D1 is not configured', async () => {
      isD1ConfiguredMock.mockReturnValue(false);
      const result = await templateSettingsService.saveSettings('site-1', 'os-desktop', {});
      expect(result).toBe(false);
    });

    it('upserts settings_json scoped to (site_id, template_id)', async () => {
      const result = await templateSettingsService.saveSettings('site-1', 'os-desktop', {
        options: { theme: { accent: 'rose' } },
      });

      expect(result).toBe(true);
      expect(queryD1Mock).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT(site_id, template_id)'),
        expect.arrayContaining([
          expect.stringMatching(/^ts_/),
          'site-1',
          'os-desktop',
          JSON.stringify({ options: { theme: { accent: 'rose' } } }),
        ])
      );
    });
  });
});
