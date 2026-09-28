/**
 * Service Analitik Ringan Site-Scoped (D1 Persistent)
 * @module analyticsService
 */

import { queryD1, isD1Configured } from '@/lib/cloudflareD1';

export interface SiteAnalyticsSummary {
  siteId: string;
  totalViews: number;
  topPages: Array<{
    path: string;
    views: number;
  }>;
  uniqueProjectsCount: number;
  topProjects: Array<{
    title: string;
    slug: string;
    views: number;
  }>;
  popularApps: Array<{
    name: string;
    clicks: number;
  }>;
  otherEvents: Array<{
    event: string;
    count: number;
  }>;
  lastActive: string;
}

/**
 * Event yang boleh dicatat. Daftar ini ditutup dengan sengaja: endpoint
 * POST /api/analytics terbuka untuk pengunjung, jadi `event_type` yang bebas
 * membuat baris baru tanpa batas di tabel D1 (setiap baris baru = 1 write).
 * Saat menambah event baru, tambahkan namanya di sini.
 */
const VALID_EVENT_TYPES = new Set([
  'page_view',
  'header_search_click',
  'CV_PRINT',
  'CV_DOWNLOAD_PREMIUM',
]);

/**
 * Route publik yang dicatat sebagai page view. Bucket diambil dari segmen
 * pertama path (`/projects/abc` → `/projects`) supaya jumlah baris dibatasi
 * oleh daftar ini, bukan oleh path apa pun yang bisa dikirim pihak luar.
 * Path di luar daftar masuk ke bucket `/lain` — tambahkan route baru di sini.
 */
const PUBLIC_PAGE_SEGMENTS = new Set([
  '/',
  '/about',
  '/contact',
  '/cv',
  '/projects',
  '/preview',
  '/checkout',
  '/orders',
]);

/** Event yang menarik menyimpan slug per-item; sisanya selalu 'main'. */
const SLUGGED_EVENTS = new Set(['page_view', 'project_view', 'app_view']);

export function isSupportedAnalyticsEvent(event: string): boolean {
  return VALID_EVENT_TYPES.has(event);
}

function bucketPagePath(pathname?: string): string {
  const clean = (pathname || '').split('#')[0].split('?')[0];
  if (!clean || clean === '/') return '/';
  const first = clean.replace(/^\/+/, '').split('/')[0];
  const segment = `/${first}`;
  return PUBLIC_PAGE_SEGMENTS.has(segment) ? segment : '/lain';
}

export class AnalyticsService {
  /**
   * Mencatat ping event analitik dari pengunjung publik.
   * Menulis 1 baris UPSERT ke D1 `site_analytics` per hit — sengaja tanpa
   * tulisan ke `audit_logs` agar jejak keamanan tidak tercampur baris
   * analitik dan agar 1 kunjungan = 1 write D1.
   *
   * Return `false` hanya untuk input yang tidak valid; kegagalan D1 dicatat
   * ke log dan tidak dibalikkan sebagai error supaya tracking tak pernah
   * merusak UX.
   */
  async recordHit(
    siteId: string,
    eventType: string,
    targetSlug?: string
  ): Promise<boolean> {
    if (!siteId || !eventType) return false;
    if (!VALID_EVENT_TYPES.has(eventType)) return false;

    const slug = !SLUGGED_EVENTS.has(eventType)
      ? 'main'
      : eventType === 'page_view'
        ? bucketPagePath(targetSlug)
        : targetSlug || 'main';
    const now = new Date().toISOString();

    if (!isD1Configured()) return false;

    try {
      // UPSERT into site_analytics — persistent aggregation
      await queryD1(
        `INSERT INTO site_analytics (site_id, event_type, target_slug, hit_count, last_active)
         VALUES (?, ?, ?, 1, ?)
         ON CONFLICT(site_id, event_type, target_slug)
         DO UPDATE SET hit_count = hit_count + 1, last_active = excluded.last_active`,
        [siteId, eventType, slug, now]
      );
    } catch (err) {
      console.warn('[AnalyticsService] Failed to record hit:', err);
    }

    return true;
  }

  /**
   * Mengambil statistik ringkasan site dari D1 site_analytics.
   * Returns zeros when no data exists — never fake data.
   */
  async getSummary(siteId: string): Promise<SiteAnalyticsSummary> {
    if (!isD1Configured()) {
      return this.emptySummary(siteId);
    }

    try {
      const rows = await queryD1<{
        event_type: string;
        target_slug: string;
        hit_count: number;
        last_active: string;
      }>(
        'SELECT event_type, target_slug, hit_count, last_active FROM site_analytics WHERE site_id = ? ORDER BY hit_count DESC',
        [siteId]
      );

      if (rows.length === 0) {
        return this.emptySummary(siteId);
      }

      let totalViews = 0;
      const pagePaths: Array<{ path: string; views: number }> = [];
      const projectViews: Array<{ slug: string; views: number }> = [];
      const appClicks: Array<{ name: string; clicks: number }> = [];
      const otherEvents: Array<{ event: string; count: number }> = [];
      let lastActive = '';

      for (const row of rows) {
        if (row.last_active > lastActive) lastActive = row.last_active;

        if (row.event_type === 'page_view') {
          totalViews += row.hit_count;
          pagePaths.push({ path: row.target_slug, views: row.hit_count });
        } else if (row.event_type === 'project_view') {
          projectViews.push({ slug: row.target_slug, views: row.hit_count });
        } else if (row.event_type === 'app_view') {
          appClicks.push({ name: row.target_slug, clicks: row.hit_count });
        } else {
          otherEvents.push({ event: row.event_type, count: row.hit_count });
        }
      }

      const topPages = pagePaths.sort((a, b) => b.views - a.views);

      const topProjects = projectViews
        .sort((a, b) => b.views - a.views)
        .map(({ slug, views }) => ({
          slug,
          title: slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          views,
        }));

      const popularApps = appClicks.sort((a, b) => b.clicks - a.clicks);

      return {
        siteId,
        totalViews,
        topPages,
        uniqueProjectsCount: topProjects.length,
        topProjects,
        popularApps,
        otherEvents: otherEvents.sort((a, b) => b.count - a.count),
        lastActive: lastActive || new Date().toISOString(),
      };
    } catch (err) {
      console.warn('[AnalyticsService] Failed to read D1 analytics, returning empty:', err);
      return this.emptySummary(siteId);
    }
  }

  private emptySummary(siteId: string): SiteAnalyticsSummary {
    return {
      siteId,
      totalViews: 0,
      topPages: [],
      uniqueProjectsCount: 0,
      topProjects: [],
      popularApps: [],
      otherEvents: [],
      lastActive: new Date().toISOString(),
    };
  }
}

export const analyticsService = new AnalyticsService();
