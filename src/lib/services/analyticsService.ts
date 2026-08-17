/**
 * Service Analitik Ringan Site-Scoped (D1 Persistent)
 * @module analyticsService
 */

import { queryD1, isD1Configured } from '@/lib/cloudflareD1';

export interface SiteAnalyticsSummary {
  siteId: string;
  totalViews: number;
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
  lastActive: string;
}

const VALID_EVENT_TYPES = new Set(['page_view', 'project_view', 'app_view']);

export class AnalyticsService {
  /**
   * Mencatat ping event analitik dari pengunjung publik.
   * Writes to D1 site_analytics (aggregated) and audit_logs (raw).
   */
  async recordHit(
    siteId: string,
    eventType: string,
    targetSlug?: string
  ): Promise<boolean> {
    if (!siteId || !eventType) return false;
    if (!VALID_EVENT_TYPES.has(eventType)) return false;

    const slug = targetSlug || 'main';
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

      // Also write raw event to audit_logs for detailed analysis
      const id = `hit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await queryD1(
        `INSERT INTO audit_logs (id, site_id, action, entity_type, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, siteId, `ANALYTICS_${eventType.toUpperCase()}_${slug}`, 'analytics', now]
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
      const projectViews: Array<{ slug: string; views: number }> = [];
      const appClicks: Array<{ name: string; clicks: number }> = [];
      let lastActive = '';

      for (const row of rows) {
        if (row.last_active > lastActive) lastActive = row.last_active;

        if (row.event_type === 'page_view') {
          totalViews += row.hit_count;
        } else if (row.event_type === 'project_view') {
          projectViews.push({ slug: row.target_slug, views: row.hit_count });
        } else if (row.event_type === 'app_view') {
          appClicks.push({ name: row.target_slug, clicks: row.hit_count });
        }
      }

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
        uniqueProjectsCount: topProjects.length,
        topProjects,
        popularApps,
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
      uniqueProjectsCount: 0,
      topProjects: [],
      popularApps: [],
      lastActive: new Date().toISOString(),
    };
  }
}

export const analyticsService = new AnalyticsService();
