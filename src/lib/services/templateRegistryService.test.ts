import { describe, expect, it, beforeEach, vi } from 'vitest';
import { templateRegistryService } from './templateRegistryService';
import * as cloudflareD1 from '@/lib/cloudflareD1';

describe('templateRegistryService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('allows default os-desktop template for any site', async () => {
    const isAllowed = await templateRegistryService.canSiteUseTemplate('site-1', 'lite', 'os-desktop');
    expect(isAllowed).toBe(true);
  });

  it('blocks pro landing-bento template for lite site without entitlement', async () => {
    vi.spyOn(cloudflareD1, 'isD1Configured').mockReturnValue(false);
    const isAllowed = await templateRegistryService.canSiteUseTemplate('site-1', 'lite', 'landing-bento');
    expect(isAllowed).toBe(false);
  });

  it('allows pro landing-bento template for pro site', async () => {
    const isAllowed = await templateRegistryService.canSiteUseTemplate('site-1', 'pro', 'landing-bento');
    expect(isAllowed).toBe(true);
  });

  it('fallbacks to os-desktop if requestedKey is unauthorized for lite site', async () => {
    vi.spyOn(cloudflareD1, 'isD1Configured').mockReturnValue(false);
    const resolved = await templateRegistryService.resolveActiveTemplate('site-1', 'lite', 'landing-bento');
    expect(resolved).toBe('os-desktop');
  });

  it('allows custom paid template if site_template_entitlements exists in D1', async () => {
    vi.spyOn(cloudflareD1, 'isD1Configured').mockReturnValue(true);
    vi.spyOn(cloudflareD1, 'queryD1').mockImplementation(async (sql: string) => {
      if (sql.includes('portfolio_templates')) {
        return [
          {
            id: 'custom-editorial',
            name: 'Custom Editorial',
            description: 'Custom',
            category: 'landing',
            tier_required: 'pro',
            price_idr: 250000,
            is_active: 1,
            preview_image_url: '',
          },
        ];
      }
      if (sql.includes('site_template_entitlements')) {
        return [{ site_id: 'site-1', template_id: 'custom-editorial' }];
      }
      return [];
    });

    const isAllowed = await templateRegistryService.canSiteUseTemplate('site-1', 'lite', 'custom-editorial');
    expect(isAllowed).toBe(true);

    const resolved = await templateRegistryService.resolveActiveTemplate('site-1', 'lite', 'custom-editorial');
    expect(resolved).toBe('custom-editorial');
  });
});
