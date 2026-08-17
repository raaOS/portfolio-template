import { beforeEach, describe, expect, it, vi } from 'vitest';

const { isR2StorageConfiguredMock, listR2ObjectsMock } = vi.hoisted(() => ({
  isR2StorageConfiguredMock: vi.fn(),
  listR2ObjectsMock: vi.fn(),
}));

vi.mock('@/lib/r2Storage', () => ({
  isR2StorageConfigured: isR2StorageConfiguredMock,
  listR2Objects: listR2ObjectsMock,
}));

import {
  bytesToMb,
  enforceSiteStorageQuota,
  getSiteStoragePrefix,
  getSiteStorageUsage,
  getSiteStorageUsageSafe,
} from './siteStorageUsage';

describe('siteStorageUsage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    isR2StorageConfiguredMock.mockReturnValue(true);
    listR2ObjectsMock.mockResolvedValue([]);
  });

  it('builds the R2 prefix for a site', () => {
    expect(getSiteStoragePrefix('default-site')).toBe('sites/default-site/');
  });

  it('converts bytes to rounded MB', () => {
    expect(bytesToMb(1536 * 1024)).toBe(1.5);
  });

  it('sums object sizes for the site prefix', async () => {
    listR2ObjectsMock.mockResolvedValue([
      { key: 'sites/default-site/a.png', size: 1024 },
      { key: 'sites/default-site/b.png', size: 2 * 1024 },
      { key: 'sites/default-site/c.png', size: undefined },
    ]);

    const usage = await getSiteStorageUsage('default-site');

    expect(listR2ObjectsMock).toHaveBeenCalledWith({ prefix: 'sites/default-site/' });
    expect(usage).toMatchObject({
      prefix: 'sites/default-site/',
      bytes: 3072,
      mb: 0,
      objectCount: 3,
      available: true,
    });
  });

  it('returns unavailable usage when R2 is not configured', async () => {
    isR2StorageConfiguredMock.mockReturnValue(false);

    const usage = await getSiteStorageUsageSafe('default-site');

    expect(usage).toMatchObject({
      prefix: 'sites/default-site/',
      bytes: 0,
      mb: 0,
      objectCount: 0,
      available: false,
    });
    expect(listR2ObjectsMock).not.toHaveBeenCalled();
  });

  it('throws a quota error when incoming bytes exceed the site storage limit', async () => {
    listR2ObjectsMock.mockResolvedValue([
      { key: 'sites/default-site/near-limit.png', size: 249 * 1024 * 1024 },
    ]);

    await expect(
      enforceSiteStorageQuota('default-site', 2 * 1024 * 1024, {
        storageMb: 250,
      })
    ).rejects.toMatchObject({
      errorCode: 'STORAGE_LIMIT_EXCEEDED',
      details: expect.objectContaining({
        projectedMb: 251,
        limitMb: 250,
      }),
    });
  });
});
