import { ProjectQuotaError } from '@/lib/admin/projectSiteContext';
import { isR2StorageConfigured, listR2Objects } from '@/lib/r2Storage';
import type { SiteQuota } from './siteQuota';

const BYTES_PER_MB = 1024 * 1024;

export type SiteStorageUsage = {
  prefix: string;
  bytes: number;
  mb: number;
  objectCount: number;
  available: boolean;
  warning?: string;
};

export function getSiteStoragePrefix(siteId: string) {
  return `sites/${siteId}/`;
}

export function bytesToMb(bytes: number) {
  return Number((bytes / BYTES_PER_MB).toFixed(2));
}

export function getStorageQuotaBytes(quota: Pick<SiteQuota, 'storageMb'>) {
  return quota.storageMb * BYTES_PER_MB;
}

export function emptySiteStorageUsage(siteId: string, warning?: string): SiteStorageUsage {
  return {
    prefix: getSiteStoragePrefix(siteId),
    bytes: 0,
    mb: 0,
    objectCount: 0,
    available: false,
    ...(warning ? { warning } : {}),
  };
}

export async function getSiteStorageUsage(siteId: string): Promise<SiteStorageUsage> {
  const prefix = getSiteStoragePrefix(siteId);
  const objects = await listR2Objects({ prefix });
  const bytes = objects.reduce((total, object) => total + Math.max(0, object.size || 0), 0);

  return {
    prefix,
    bytes,
    mb: bytesToMb(bytes),
    objectCount: objects.length,
    available: true,
  };
}

export async function getSiteStorageUsageSafe(siteId: string): Promise<SiteStorageUsage> {
  if (!isR2StorageConfigured()) {
    return emptySiteStorageUsage(siteId, 'R2 env is not configured');
  }

  try {
    return await getSiteStorageUsage(siteId);
  } catch (error) {
    return emptySiteStorageUsage(
      siteId,
      error instanceof Error ? error.message : 'Failed to read R2 usage'
    );
  }
}

// SECURITY FIX: Per-site async mutex to prevent concurrent uploads from
// racing past the storage quota check (TOCTOU race condition).
const quotaLocks = new Map<string, Promise<void>>();

export async function withSiteQuotaLock<T>(siteId: string, fn: () => Promise<T>): Promise<T> {
  // Wait for any existing lock on this siteId to release
  while (quotaLocks.has(siteId)) {
    await quotaLocks.get(siteId);
  }

  let releaseLock: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  quotaLocks.set(siteId, lockPromise);

  try {
    return await fn();
  } finally {
    quotaLocks.delete(siteId);
    releaseLock!();
  }
}

export async function enforceSiteStorageQuota(
  siteId: string,
  incomingBytes: number,
  quota: Pick<SiteQuota, 'storageMb'>
) {
  return withSiteQuotaLock(siteId, () => enforceSiteStorageQuotaUnlocked(siteId, incomingBytes, quota));
}

/**
 * Pengecekan kuota tanpa lock. Caller WAJIB membungkus seluruh alur
 * (cek + upload R2) dalam `withSiteQuotaLock` agar tidak ada race
 * TOCTOU antara pengecekan dan pengunggahan.
 */
export async function enforceSiteStorageQuotaUnlocked(
  siteId: string,
  incomingBytes: number,
  quota: Pick<SiteQuota, 'storageMb'>
) {
  const usage = await getSiteStorageUsage(siteId);
  const limitBytes = getStorageQuotaBytes(quota);
  const projectedBytes = usage.bytes + incomingBytes;

  if (projectedBytes > limitBytes) {
    throw new ProjectQuotaError(
      `Storage quota exceeded. Limit: ${quota.storageMb} MB`,
      'STORAGE_LIMIT_EXCEEDED',
      {
        siteId,
        usageBytes: usage.bytes,
        incomingBytes,
        projectedBytes,
        limitBytes,
        usageMb: bytesToMb(usage.bytes),
        incomingMb: bytesToMb(incomingBytes),
        projectedMb: bytesToMb(projectedBytes),
        limitMb: quota.storageMb,
      }
    );
  }

  return usage;
}

