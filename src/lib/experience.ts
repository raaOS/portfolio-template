import experienceFallback from '@/data/experience.json';
import { experienceService } from '@/lib/services/experienceService';
import type { ExperienceData } from '@/types/experience';

/**
 * Fallback statis untuk halaman CV. Data utama tetap berasal dari D1 melalui
 * `experienceService`; loader ini sengaja memakai import JSON supaya aman
 * di Cloudflare Workers tanpa akses filesystem runtime.
 */
const cacheBySite = new Map<string, { data: ExperienceData | null; cachedAt: number }>();

const CACHE_TTL_MS = 60_000;

export async function loadExperienceData(siteId = 'default-site'): Promise<ExperienceData | null> {
  const now = Date.now();
  const cached = cacheBySite.get(siteId);
  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const data = await experienceService.getExperienceData(false, false, siteId);
    cacheBySite.set(siteId, { data, cachedAt: now });
    return data;
  } catch (error) {
    console.error('Error loading experience data:', error);
    const fallback = experienceFallback as unknown as ExperienceData;
    cacheBySite.set(siteId, { data: fallback, cachedAt: now });
    return fallback;
  }
}

export function invalidateExperienceCache(siteId?: string): void {
  if (siteId) {
    cacheBySite.delete(siteId);
    return;
  }
  cacheBySite.clear();
}
