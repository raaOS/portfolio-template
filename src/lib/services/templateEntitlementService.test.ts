import { describe, expect, it, vi, beforeEach } from 'vitest';
import { templateEntitlementService } from './templateEntitlementService';
import * as cloudflareD1 from '@/lib/cloudflareD1';

describe('templateEntitlementService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('grants entitlement successfully to D1', async () => {
    vi.spyOn(cloudflareD1, 'isD1Configured').mockReturnValue(true);
    const querySpy = vi.spyOn(cloudflareD1, 'queryD1').mockResolvedValue([]);

    const result = await templateEntitlementService.grantEntitlement('site-100', 'custom-pro-landing', 'purchase');
    expect(result).toBe(true);
    expect(querySpy).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR IGNORE INTO site_template_entitlements'),
      expect.arrayContaining(['ent_site-100_custom-pro-landing', 'site-100', 'custom-pro-landing', 'purchase'])
    );
  });

  it('revokes entitlement successfully from D1', async () => {
    vi.spyOn(cloudflareD1, 'isD1Configured').mockReturnValue(true);
    const querySpy = vi.spyOn(cloudflareD1, 'queryD1').mockResolvedValue([]);

    const result = await templateEntitlementService.revokeEntitlement('site-100', 'custom-pro-landing');
    expect(result).toBe(true);
    expect(querySpy).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM site_template_entitlements'),
      ['site-100', 'custom-pro-landing']
    );
  });

  it('returns list of template IDs for site', async () => {
    vi.spyOn(cloudflareD1, 'isD1Configured').mockReturnValue(true);
    vi.spyOn(cloudflareD1, 'queryD1').mockResolvedValue([
      { template_id: 'custom-editorial' },
      { template_id: 'custom-pro-landing' },
    ]);

    const entitlements = await templateEntitlementService.getSiteEntitlements('site-100');
    expect(entitlements).toEqual(['custom-editorial', 'custom-pro-landing']);
  });
});
