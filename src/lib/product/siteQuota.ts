import { queryD1 } from '@/lib/cloudflareD1';
import {
  SITE_QUOTA_OVERRIDES_INDEX_SQL,
  SITE_QUOTA_OVERRIDES_TABLE_SQL,
} from '@/lib/d1-schema';
import {
  getEffectiveSiteQuota,
  hasSiteQuotaOverride,
  normalizeSiteQuotaOverride,
  sanitizeSiteQuotaOverrideForPlan,
  type SiteQuotaOverride,
} from './sitePlan';

type SiteQuotaOverrideRow = {
  site_id: string;
  project_limit: number | null;
  storage_mb: number | null;
  media_per_project: number | null;
};

let ensureSchemaPromise: Promise<void> | null = null;

function isMissingQuotaTableError(error: unknown) {
  return error instanceof Error && /no such table:\s*site_quota_overrides/i.test(error.message);
}

function mapQuotaOverrideRow(row: SiteQuotaOverrideRow): SiteQuotaOverride {
  return normalizeSiteQuotaOverride({
    projectLimit: row.project_limit,
    storageMb: row.storage_mb,
    mediaPerProject: row.media_per_project,
  });
}

async function ensureSiteQuotaOverrideSchema() {
  if (!ensureSchemaPromise) {
    ensureSchemaPromise = (async () => {
      await queryD1(SITE_QUOTA_OVERRIDES_TABLE_SQL);
      await queryD1(SITE_QUOTA_OVERRIDES_INDEX_SQL);
    })();
  }
  try {
    return await ensureSchemaPromise;
  } catch (error) {
    ensureSchemaPromise = null;
    throw error;
  }
}

export async function loadSiteQuotaOverrideMap(siteIds: string[]) {
  const bySiteId = new Map<string, SiteQuotaOverride>();
  if (siteIds.length === 0) return bySiteId;

  const placeholders = siteIds.map(() => '?').join(', ');
  try {
    const rows = await queryD1<SiteQuotaOverrideRow>(
      `SELECT site_id, project_limit, storage_mb, media_per_project
       FROM site_quota_overrides
       WHERE site_id IN (${placeholders})`,
      siteIds
    );
    rows.forEach((row) => bySiteId.set(row.site_id, mapQuotaOverrideRow(row)));
  } catch (error) {
    if (!isMissingQuotaTableError(error)) throw error;
  }

  return bySiteId;
}

export async function getSiteQuotaOverride(siteId: string) {
  try {
    const rows = await queryD1<SiteQuotaOverrideRow>(
      `SELECT site_id, project_limit, storage_mb, media_per_project
       FROM site_quota_overrides
       WHERE site_id = ?
       LIMIT 1`,
      [siteId]
    );
    return rows[0] ? mapQuotaOverrideRow(rows[0]) : normalizeSiteQuotaOverride(null);
  } catch (error) {
    if (!isMissingQuotaTableError(error)) throw error;
    return normalizeSiteQuotaOverride(null);
  }
}

export async function upsertSiteQuotaOverride({
  siteId,
  plan,
  override,
}: {
  siteId: string;
  plan: string | null | undefined;
  override: Partial<SiteQuotaOverride> | null | undefined;
}) {
  await ensureSiteQuotaOverrideSchema();

  const nextOverride = sanitizeSiteQuotaOverrideForPlan(plan, override);
  if (!hasSiteQuotaOverride(nextOverride)) {
    await queryD1(`DELETE FROM site_quota_overrides WHERE site_id = ?`, [siteId]);
    return nextOverride;
  }

  const now = new Date().toISOString();
  await queryD1(
    `INSERT INTO site_quota_overrides
       (id, site_id, project_limit, storage_mb, media_per_project, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(site_id) DO UPDATE SET
       project_limit = excluded.project_limit,
       storage_mb = excluded.storage_mb,
       media_per_project = excluded.media_per_project,
       updated_at = excluded.updated_at`,
    [
      `quota-${crypto.randomUUID()}`,
      siteId,
      nextOverride.projectLimit,
      nextOverride.storageMb,
      nextOverride.mediaPerProject,
      now,
      now,
    ]
  );

  return nextOverride;
}

export async function getEffectiveSiteQuotaById({
  siteId,
  plan,
}: {
  siteId: string;
  plan: string | null | undefined;
}) {
  const override = await getSiteQuotaOverride(siteId);
  return getEffectiveSiteQuota(plan, override);
}
