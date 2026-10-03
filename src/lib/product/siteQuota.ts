import type { CreateProjectData, UpdateProjectData, GalleryItem } from '@/types/projects';
import { queryD1 } from '@/lib/cloudflareD1';
import {
  SITE_QUOTA_OVERRIDES_INDEX_SQL,
  SITE_QUOTA_OVERRIDES_TABLE_SQL,
} from '@/lib/d1-schema';

export type SiteQuota = {
  projectLimit: number;
  storageMb: number;
  mediaPerProject: number;
};

export type SiteQuotaOverride = {
  projectLimit: number | null;
  storageMb: number | null;
  mediaPerProject: number | null;
};

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Kuota default — berlaku sama rata untuk semua site.
 */
export function getDefaultQuota(): SiteQuota {
  return {
    projectLimit: parsePositiveInt(process.env.PROJECT_LIMIT, 50),
    storageMb: parsePositiveInt(process.env.STORAGE_MB, 5000),
    mediaPerProject: parsePositiveInt(process.env.MEDIA_PER_PROJECT, 50),
  };
}

function normalizeOverrideValue(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
}

export function normalizeSiteQuotaOverride(
  input: Partial<SiteQuotaOverride> | null | undefined
): SiteQuotaOverride {
  return {
    projectLimit: normalizeOverrideValue(input?.projectLimit),
    storageMb: normalizeOverrideValue(input?.storageMb),
    mediaPerProject: normalizeOverrideValue(input?.mediaPerProject),
  };
}

export function hasSiteQuotaOverride(input: Partial<SiteQuotaOverride> | null | undefined) {
  const override = normalizeSiteQuotaOverride(input);
  return (
    override.projectLimit !== null ||
    override.storageMb !== null ||
    override.mediaPerProject !== null
  );
}

export function getEffectiveSiteQuota(
  input?: Partial<SiteQuotaOverride> | null | undefined
): SiteQuota {
  const defaults = getDefaultQuota();
  const override = normalizeSiteQuotaOverride(input);

  return {
    projectLimit: Math.max(defaults.projectLimit, override.projectLimit ?? defaults.projectLimit),
    storageMb: Math.max(defaults.storageMb, override.storageMb ?? defaults.storageMb),
    mediaPerProject: Math.max(
      defaults.mediaPerProject,
      override.mediaPerProject ?? defaults.mediaPerProject
    ),
  };
}

function addMediaRef(refs: Set<string>, value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    refs.add(value.trim());
  }
}

function addGalleryItemRefs(refs: Set<string>, item: GalleryItem) {
  addMediaRef(refs, item.src);
  addMediaRef(refs, item.poster);
}

export function countProjectMediaRefs(data: Partial<CreateProjectData | UpdateProjectData>) {
  const refs = new Set<string>();

  addMediaRef(refs, data.cover);
  data.gallery?.forEach((item) => addMediaRef(refs, item));
  data.galleryItems?.forEach((item) => addGalleryItemRefs(refs, item));
  data.galleryGroups?.forEach((group) =>
    group.items?.forEach((item) => addGalleryItemRefs(refs, item))
  );

  addMediaRef(refs, data.comparison?.beforeImage);
  addMediaRef(refs, data.comparison?.afterImage);

  return refs.size;
}

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
  override,
}: {
  siteId: string;
  override: Partial<SiteQuotaOverride> | null | undefined;
}) {
  await ensureSiteQuotaOverrideSchema();

  const nextOverride = normalizeSiteQuotaOverride(override);
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

export async function getEffectiveSiteQuotaById({ siteId }: { siteId: string }) {
  const override = await getSiteQuotaOverride(siteId);
  return getEffectiveSiteQuota(override);
}
