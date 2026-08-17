/**
 * About — Helper loader untuk data halaman About.
 *
 * Thin wrapper di atas `aboutService` yang menyediakan fungsi
 * `loadAboutData(siteId)` untuk server component rendering.
 *
 * @module about
 */
import { getCachedAboutData } from '@/lib/services/aboutService';
import type {
  AboutData,
  AboutHero,
  AboutProfessional,
  AboutSoftSkills,
  DesignPhilosophy,
  WallpaperConfig,
  DockPreferences,
  SoundConfig,
  WindowPreferences,
  AboutIslandNotification,
} from '@/types/about';

// Use cached data by default for performance.
// `getCachedAboutData` dibungkus React cache() untuk per-request dedup.
// Cache is invalidated explicitly when admin updates data.
export async function loadAboutData(siteId = 'default-site'): Promise<AboutData | null> {
  try {
    return await getCachedAboutData(siteId);
  } catch (error) {
    console.error('Error loading about data:', error);
    return null;
  }
}

// Invalidate cache when admin updates about data.
// Catatan: React cache() di getCachedAboutData hanya hidup selama satu request,
// jadi panggilan dari request berikutnya otomatis baca dari ContentService cache
// (atau D1 kalau cache 5s sudah expire). invalidateAboutCache di bawah memaksa
// bypass ContentService cache supaya admin update langsung kelihatan.
export function invalidateAboutCache(): void {
  // DEPRECATED: do nothing.
  // ContentService.saveData already updates the memory cache with the new data.
  // Calling getAboutData(true) immediately after save hits D1 read replicas
  // before they sync, caching stale data and causing UI state reversion.
}

// ===== SECTION-SPECIFIC LOADERS =====

export async function loadHeroData(siteId = 'default-site'): Promise<AboutHero | null> {
  const data = await loadAboutData(siteId);
  return data?.hero || null;
}

export async function loadProfessionalData(siteId = 'default-site'): Promise<AboutProfessional | null> {
  const data = await loadAboutData(siteId);
  return data?.professional || null;
}

export async function loadSoftSkillsData(siteId = 'default-site'): Promise<AboutSoftSkills | null> {
  const data = await loadAboutData(siteId);
  return data?.softSkills || null;
}

export async function loadDesignPhilosophy(siteId = 'default-site'): Promise<DesignPhilosophy | null> {
  const data = await loadAboutData(siteId);
  return data?.designPhilosophy || null;
}

export async function loadOSConfig(siteId = 'default-site'): Promise<{
  wallpaperConfig?: WallpaperConfig;
  dockConfig?: DockPreferences;
  soundConfig?: SoundConfig;
  windowPreferences?: WindowPreferences;
  notifications?: AboutIslandNotification[];
} | null> {
  const data = await loadAboutData(siteId);
  if (!data) return null;

  return {
    wallpaperConfig: data.wallpaperConfig,
    dockConfig: data.dockConfig,
    soundConfig: data.soundConfig,
    windowPreferences: data.windowPreferences,
    notifications: data.islandNotifications,
  };
}
