/**
 * About Service — CRUD data halaman About (profil, filosofi desain, desktop prefs).
 *
 * Menggunakan ContentService sebagai backend D1 dengan fallback JSON statis.
 * Cache React `cache()` untuk deduplikasi dalam satu server render cycle.
 *
 * @module aboutService
 */
import { cache } from 'react';
import { ContentService } from './contentService';
import {
  AboutData,
  UpdateAboutData,
  DesignPhilosophy,
  DesktopPreferences,
  WallpaperConfig,
  DockPreferences,
  WindowPreferences,
  SoundConfig,
} from '@/types/about';
import aboutDataFallback from '@/data/about.json';
import { deleteStorageAssets } from '@/lib/services/storageCleanup';

const service = new ContentService<AboutData>(
  'about.json',
  aboutDataFallback as unknown as AboutData
);

function mergeDesktopPreferences(
  current?: DesktopPreferences,
  updates?: Partial<DesktopPreferences>
): DesktopPreferences | undefined {
  if (!current && !updates) {
    return undefined;
  }

  return {
    ...(current || {}),
    ...(updates || {}),
    iconPositions: {
      ...(current?.iconPositions || {}),
      ...(updates?.iconPositions || {}),
    },
  } as DesktopPreferences;
}

function mergeWindowPreferences(
  current?: WindowPreferences,
  updates?: WindowPreferences
): WindowPreferences | undefined {
  if (!current && !updates) {
    return undefined;
  }

  const merged: WindowPreferences = {
    ...(current || {}),
  };

  Object.entries(updates || {}).forEach(([id, preference]) => {
    merged[id] = {
      ...(current?.[id] || {}),
      ...preference,
    };
  });

  return merged;
}

/**
 * Extract all media URLs from AboutData for storage cleanup.
 */
function extractAboutAssets(data: AboutData): string[] {
  const assets: string[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((data.hero as any)?.avatarUrl) assets.push((data.hero as any).avatarUrl);

  if (data.wallpaperConfig?.collection) {
    data.wallpaperConfig.collection.forEach((w) => {
      if (w.url) assets.push(w.url);
      if (w.posterUrl) assets.push(w.posterUrl);
    });
  }

  if (data.soundConfig) {
    for (const setting of Object.values(data.soundConfig)) {
      if (setting?.path) assets.push(setting.path);
    }
  }

  if (data.spatialGalleryConfig?.centerModelUrl) {
    assets.push(data.spatialGalleryConfig.centerModelUrl);
  }

  return assets;
}

/**
 * Cached version untuk Server Components.
 * Menghindari redundant fetch ke CLOUDFLARE_D1 dalam satu request.
 */
export const getCachedAboutData = cache(async (siteId = 'default-site') => {
  return aboutService.getAboutData(false, false, siteId);
});

export const aboutService = {
  /**
   * Retrieves the current "About" page data.
   * Uses ContentService for persistence and fallback logic.
   *
   * @returns A promise that resolves to the AboutData.
   */
  async getAboutData(noCache: boolean | string = false, throwOnError = false, siteId = 'default-site') {
    const actualNoCache = typeof noCache === 'boolean' ? noCache : false;
    const actualSiteId = typeof noCache === 'string' ? noCache : siteId;
    return await service.getData(actualNoCache, throwOnError, actualSiteId);
  },

  /**
   * Updates the "About" page data with partial updates.
   * Performs an explicit deep merge for nested configuration objects.
   *
   * @param updates - The partial data to update.
   * @returns A promise that resolves to the updated merged data.
   */
  async updateAboutData(updates: UpdateAboutData, siteId = 'default-site') {
    try {
      const current = await this.getAboutData(true, true, siteId);

      // Explicit merging since updates contains Partials
      const mergedData: AboutData = {
        ...current, // Preserve all base fields (notifications, etc)
        hero: { ...current.hero, ...(updates.hero || {}) },
        professional: { ...current.professional, ...(updates.professional || {}) },
        softSkills: { ...current.softSkills, ...(updates.softSkills || {}) },
        designPhilosophy: {
          ...(current.designPhilosophy || {}),
          ...(updates.designPhilosophy || {}),
        } as DesignPhilosophy,

        // OS Configuration
        desktopPreferences: mergeDesktopPreferences(
          current.desktopPreferences,
          updates.desktopPreferences
        ),
        wallpaperConfig: {
          ...current.wallpaperConfig,
          ...(updates.wallpaperConfig || {}),
        } as WallpaperConfig,
        dockConfig: { ...current.dockConfig, ...(updates.dockConfig || {}) } as DockPreferences,

        windowPreferences: mergeWindowPreferences(
          current.windowPreferences,
          updates.windowPreferences
        ),
        soundConfig: { ...current.soundConfig, ...(updates.soundConfig || {}) } as SoundConfig,
        labels: { ...(current.labels || {}), ...(updates.labels || {}) } as AboutData['labels'],
        spatialGalleryConfig:
          updates.spatialGalleryConfig !== undefined
            ? updates.spatialGalleryConfig
            : current.spatialGalleryConfig,
        loaderConfig:
          updates.loaderConfig !== undefined
            ? updates.loaderConfig
            : current.loaderConfig,

        lastUpdated: new Date().toISOString(),
      };

      const oldAssets = extractAboutAssets(current);
      const newAssets = extractAboutAssets(mergedData);
      const orphanedAssets = oldAssets.filter((url) => !newAssets.includes(url));

      const success = await service.saveData(mergedData, 'Update about page content', siteId);
      if (!success) {
        throw new Error('ContentService failed to save data');
      }

      // Cleanup storage asynchronously (fire and forget to not block UI response)
      if (orphanedAssets.length > 0) {
        deleteStorageAssets(orphanedAssets, 'AboutService').catch((e) =>
          console.warn('[AboutService] Failed to clean up orphaned assets:', e)
        );
      }

      return mergedData;
    } catch (error) {
      console.error('[AboutService] Update failed:', error);
      throw error;
    }
  },
};
