import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateSlugFormat, isSlugAvailable, RESERVED_SYSTEM_SLUGS } from './slugService';
import * as cloudflareD1 from '@/lib/cloudflareD1';

vi.mock('@/lib/cloudflareD1', async () => {
  const actual = await vi.importActual<typeof import('@/lib/cloudflareD1')>('@/lib/cloudflareD1');
  return {
    ...actual,
    queryD1: vi.fn()
  };
});

describe('slugService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateSlugFormat', () => {
    it('blocks empty or non-string inputs', () => {
      expect(validateSlugFormat('').valid).toBe(false);
      expect(validateSlugFormat('  ').valid).toBe(false);
    });

    it('blocks slugs shorter than 3 chars or longer than 30 chars', () => {
      expect(validateSlugFormat('ab').valid).toBe(false);
      expect(validateSlugFormat('a'.repeat(31)).valid).toBe(false);
      expect(validateSlugFormat('abc').valid).toBe(true);
    });

    it('blocks uppercase or invalid special characters', () => {
      expect(validateSlugFormat('Nanda_Design').valid).toBe(false);
      expect(validateSlugFormat('nanda@design').valid).toBe(false);
      expect(validateSlugFormat('nanda design').valid).toBe(false);
    });

    it('allows valid lowercase alphanumeric with hyphens', () => {
      const res = validateSlugFormat('nanda-design-2026');
      expect(res.valid).toBe(true);
      expect(res.normalizedSlug).toBe('nanda-design-2026');
    });

    it('blocks reserved system slugs', () => {
      for (const reserved of Array.from(RESERVED_SYSTEM_SLUGS)) {
        expect(validateSlugFormat(reserved).valid).toBe(false);
      }
    });
  });

  describe('isSlugAvailable', () => {
    it('returns false for invalid format', async () => {
      const res = await isSlugAvailable('admin');
      expect(res).toBe(false);
    });

    it('returns false if slug exists in sites table', async () => {
      vi.mocked(cloudflareD1.queryD1).mockResolvedValueOnce([{ id: 'site_123' }]);

      const res = await isSlugAvailable('nanda-design');
      expect(res).toBe(false);
    });

    it('returns false if slug exists in active orders table', async () => {
      // 1st query (sites) returns empty
      vi.mocked(cloudflareD1.queryD1).mockResolvedValueOnce([]);
      // 2nd query (orders) returns existing order
      vi.mocked(cloudflareD1.queryD1).mockResolvedValueOnce([{ id: 'ORD-123' }]);

      const res = await isSlugAvailable('nanda-design');
      expect(res).toBe(false);
    });

    it('returns true if slug is free in both sites and orders', async () => {
      vi.mocked(cloudflareD1.queryD1).mockResolvedValueOnce([]);
      vi.mocked(cloudflareD1.queryD1).mockResolvedValueOnce([]);

      const res = await isSlugAvailable('nanda-design');
      expect(res).toBe(true);
    });
  });
});
