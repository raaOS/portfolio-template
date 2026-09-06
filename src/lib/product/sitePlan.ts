import type { CreateProjectData, UpdateProjectData, GalleryItem } from '@/types/projects';

/** @deprecated Plan concept removed. All sites use default quota. */
export type ProductPlan = 'lite' | 'pro';

export type PlanQuota = {
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
 * Default quota — tidak ada lagi perbedaan plan.
 * Semua site mendapatkan quota yang sama.
 */
export function getDefaultQuota(): PlanQuota {
  return {
    projectLimit: parsePositiveInt(process.env.PROJECT_LIMIT, 50),
    storageMb: parsePositiveInt(process.env.STORAGE_MB, 5000),
    mediaPerProject: parsePositiveInt(process.env.MEDIA_PER_PROJECT, 50),
  };
}

/** @deprecated Use getDefaultQuota() instead */
export function getPlanQuota(_planInput?: string | null | undefined): PlanQuota {
  return getDefaultQuota();
}

/** @deprecated All features are enabled by default */
export function canUseWhatsappTestimonials(_planInput?: string | null | undefined) {
  return true;
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
  _planInput?: string | null | undefined,
  input?: Partial<SiteQuotaOverride> | null | undefined
): PlanQuota {
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

/** @deprecated Use getEffectiveSiteQuota instead */
export function getEffectiveSiteQuotaById(_args: {
  siteId?: string;
  plan?: string;
  quotaOverride?: Partial<SiteQuotaOverride> | null;
}): PlanQuota {
  return getDefaultQuota();
}

/** @deprecated Plan concept removed. Always returns 'lite'. */
export function normalizeProductPlan(_plan?: string | null | undefined): ProductPlan {
  return 'lite';
}

/** @deprecated Plan concept removed. Use getEffectiveSiteQuota instead. */
export function sanitizeSiteQuotaOverrideForPlan(
  _planInput?: string | null | undefined,
  input?: Partial<SiteQuotaOverride> | null | undefined
): SiteQuotaOverride {
  return normalizeSiteQuotaOverride(input);
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
