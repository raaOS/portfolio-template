/**
 * Content Service — Generic CRUD abstraction untuk Cloudflare D1.
 *
 * Menyediakan pattern `getData()`/`saveData()` dengan:
 * - In-memory cache (CacheManager) dengan LRU eviction.
 * - Fallback ke JSON statis jika D1 tidak tersedia.
 * - Audit logging otomatis pada setiap write operation.
 * - Timeout protection untuk mencegah hanging requests.
 *
 * Setiap domain (about, experience, testimonial, dll) menginstansiasi
 * ContentService dengan path dan fallback data masing-masing.
 *
 * @module contentService
 */
import { db } from '@/lib/database';
import { CacheManager } from '@/lib/cache/CacheManager';
import { logActivity } from '@/lib/services/auditLogger';

/**
 * Shared cache instance for content data.
 *
 * FIXED (BUG-007): Uses CacheManager with max size limit and LRU eviction
 * to prevent unbounded memory growth.
 */
const contentCache = new CacheManager({
  defaultTTL: 30_000, // 30 detik
  maxSize: 50,
  label: 'ContentService',
});

const ABOUT_CACHE_TTL = 5000; // 5 detik (positions berubah sering)

function getCacheKey(path: string): string {
  return `d1:${path}`;
}

/**
 * Get cache stats untuk monitoring (delegates to CacheManager).
 */
export function getCacheStats() {
  return contentCache.getDetailedStats();
}

export function clearContentCache() {
  const entriesCleared = contentCache.size;
  contentCache.clear();
  return entriesCleared;
}

function isBuildFallbackNoise(error: unknown) {
  return (
    process.env.CLOUDFLARE_OPENNEXT_BUILD === 'true' &&
    error instanceof Error &&
    error.message === 'Data backend timeout'
  );
}

/**
 * Generic service to handle content storage via Cloudflare D1.
 * Cache TTL: Default 30 detik, tapi bisa custom (about data pakai 5 detik).
 */
export class ContentService<T> {
  private dataPath: string;
  private fallbackData: T;
  private cacheTTL: number;
  private skipFallbackMerge: boolean;
  private nodeName: string;

  /**
   * @param filename - Nama file JSON (tanpa .json)
   * @param fallbackData - Data default kalau remote data kosong/error
   * @param cacheTTL - Cache duration dalam ms (default: 30 detik, about: 5 detik)
   * @param skipFallbackMerge - Jika true, remote data jadi source of truth (tidak merge dengan fallback).
   *   Ini mencegah field yang dihapus admin muncul lagi dari fallback JSON.
   */
  constructor(filename: string, fallbackData: T, cacheTTL?: number, skipFallbackMerge = false) {
    this.nodeName = filename.replace('.json', '');
    this.dataPath = `content/${this.nodeName}`;
    this.fallbackData = fallbackData;
    // About data pakai TTL lebih pendek karena positions sering berubah
    this.cacheTTL = cacheTTL || (this.nodeName === 'about' ? ABOUT_CACHE_TTL : 30_000);
    this.skipFallbackMerge = skipFallbackMerge;
  }

  async getData(noCache = false, throwOnError = false, siteId = 'default-site'): Promise<T> {
    const tenantPath = `content_${siteId}/${this.nodeName}`;
    const cacheKey = getCacheKey(tenantPath);

    // Cek memory cache dulu (kecuali noCache=true)
    if (!noCache) {
      const cached = contentCache.get<T>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const timeoutMs = process.env.NODE_ENV === 'development' ? 15000 : 5000;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<null>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Data backend timeout')), timeoutMs);
    });

    try {
      // 1. Try site-specific path: content_siteId/nodeName
      const snapshot = (await Promise.race([db.ref(tenantPath).once('value'), timeout])) as {
        val: () => unknown;
      } | null;

      let remoteData = typeof snapshot?.val === 'function' ? snapshot.val() : snapshot?.val;

      // 2. Fallback to legacy path content/nodeName if not found
      // SECURITY FIX: Only fall back to legacy content for default-site.
      // Other tenants must not see shared/demo data from the legacy path.
      if (!remoteData && siteId === 'default-site') {
        const legacySnapshot = (await Promise.race([db.ref(this.dataPath).once('value'), timeout])) as {
          val: () => unknown;
        } | null;
        remoteData = typeof legacySnapshot?.val === 'function' ? legacySnapshot.val() : legacySnapshot?.val;
      }

      if (!remoteData) {
        return this.fallbackData;
      }

      // Merge dengan fallback (kecuali skipFallbackMerge=true).
      const finalData = this.skipFallbackMerge
        ? (remoteData as T)
        : (this.deepMerge(this.fallbackData, remoteData) as T);

      // Simpan ke cache dengan TTL spesifik
      contentCache.set(cacheKey, finalData, this.cacheTTL);

      return finalData;
    } catch (error) {
      if (!isBuildFallbackNoise(error)) {
        console.error(`[ContentService] Error loading data from ${tenantPath}:`, error);
      }
      if (throwOnError) {
        throw error;
      }
      return this.fallbackData;
    } finally {
      // MEMORY-LEAK FIX: clear timer regardless of outcome
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  /**
   * Deep merge fallback (base) dengan remote data (override).
   */
  private deepMerge(base: unknown, override: unknown): unknown {
    if (override === null || override === undefined) {
      return base;
    }
    if (base === null || base === undefined) {
      return override;
    }

    // Jika array, pakai override
    if (Array.isArray(override)) {
      return override;
    }

    // Jika primitive, pakai override
    if (typeof override !== 'object' || typeof base !== 'object') {
      return override;
    }

    // Merge objects
    const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };

    for (const key of Object.keys(override as Record<string, unknown>)) {
      const baseVal = (base as Record<string, unknown>)[key];
      const overrideVal = (override as Record<string, unknown>)[key];

      result[key] = this.deepMerge(baseVal, overrideVal);
    }

    return result;
  }

  // Track ongoing saves untuk mencegah race condition
  private pendingSave: Promise<boolean> | null = null;

  async saveData(data: T, _message?: string, siteId?: string): Promise<boolean> {
    // Queue multiple saves to prevent race condition
    if (this.pendingSave) {
      try {
        await this.pendingSave;
      } catch (err) {
        console.warn('[ContentService] Previous save failed, proceeding with new save', err);
      }
    }

    const finalSiteId = siteId || 'default-site';
    this.pendingSave = this._doSave(data, _message, finalSiteId);
    try {
      const result = await this.pendingSave;
      return result;
    } finally {
      this.pendingSave = null;
    }
  }

  private async _doSave(data: T, _message: string | undefined, siteId: string): Promise<boolean> {
    const tenantPath = `content_${siteId}/${this.nodeName}`;
    try {
      // For arrays, we save them directly to avoid converting to object with numeric keys.
      // For objects, we merge with updatedAt.
      const payload = Array.isArray(data)
        ? data
        : { ...(data as Record<string, unknown>), updatedAt: new Date().toISOString() };

      // Clear cache SEBELUM save untuk mencegah stale data read
      contentCache.delete(getCacheKey(tenantPath));

      await db.ref(tenantPath).set(payload);

      // Cache `payload` (dengan updatedAt), bukan raw `data`.
      contentCache.set(getCacheKey(tenantPath), payload as unknown as object, this.cacheTTL);

      // Log the activity (await to prevent serverless function termination before write finishes)
      const actionMessage = _message
        ? `Update ${tenantPath}: ${_message}`
        : `Update ${tenantPath}`;
      await logActivity(actionMessage).catch((err) => console.error('[Audit] Failed to log:', err));

      return true;
    } catch (error) {
      console.error(`[ContentService] Error saving data to ${tenantPath}:`, error);
      return false;
    }
  }
}
