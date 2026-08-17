import 'server-only';

import { CacheManager } from '@/lib/cache/CacheManager';

// Import known cache owners so their CacheManager instances are registered
// before a global clear runs in a fresh serverless runtime.
import '@/lib/contact';
import '@/lib/services/contentService';
import '@/lib/services/project/projectCache';

export interface CacheClearStep {
  name: string;
  status: 'cleared' | 'skipped' | 'error';
  detail: string;
  entriesCleared?: number;
}

export interface CacheClearResult {
  serverMemory: CacheClearStep[];
  nextFilesystem: CacheClearStep[];
  cloudflareCdn: CacheClearStep;
}

function clearNextFilesystemCache(): CacheClearStep[] {
  return [
    {
      name: '.next/cache',
      status: 'skipped',
      detail: 'Cloudflare Workers runtime has no writable Next.js filesystem cache.',
    },
    {
      name: 'node_modules/.cache',
      status: 'skipped',
      detail: 'Local tooling cache is not cleared from the deployed Worker runtime.',
    },
  ];
}

async function purgeCloudflareCdn(): Promise<CacheClearStep> {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID || process.env.CLOUDFLARE_CACHE_ZONE_ID;
  const token = process.env.CLOUDFLARE_CACHE_PURGE_TOKEN || process.env.CLOUDFLARE_API_TOKEN;

  if (!zoneId || !token) {
    return {
      name: 'Cloudflare CDN/R2 edge',
      status: 'skipped',
      detail: 'Set CLOUDFLARE_ZONE_ID + CLOUDFLARE_CACHE_PURGE_TOKEN to purge CDN cache.',
    };
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ purge_everything: true }),
        cache: 'no-store',
      }
    );
    const data = (await response.json().catch(() => null)) as {
      success?: boolean;
      errors?: Array<{ message?: string }>;
    } | null;

    if (!response.ok || data?.success === false) {
      const message =
        data?.errors
          ?.map((item) => item.message)
          .filter(Boolean)
          .join('; ') || `Cloudflare API returned ${response.status}`;
      return {
        name: 'Cloudflare CDN/R2 edge',
        status: 'error',
        detail: message,
      };
    }

    return {
      name: 'Cloudflare CDN/R2 edge',
      status: 'cleared',
      detail: 'purge_everything accepted by Cloudflare',
    };
  } catch (error) {
    return {
      name: 'Cloudflare CDN/R2 edge',
      status: 'error',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function clearApplicationCache(): Promise<CacheClearResult> {
  const serverMemory = CacheManager.clearAll().map((item) => ({
    name: item.label,
    status: 'cleared' as const,
    detail: `${item.entriesCleared} entries removed`,
    entriesCleared: item.entriesCleared,
  }));

  const [nextFilesystem, cloudflareCdn] = await Promise.all([
    Promise.resolve(clearNextFilesystemCache()),
    purgeCloudflareCdn(),
  ]);

  return {
    serverMemory,
    nextFilesystem,
    cloudflareCdn,
  };
}
