import type { CreateProjectData, UpdateProjectData, GalleryItem } from '@/types/projects';

export type ProductPlan = 'lite' | 'pro';

export type PlanQuota = {
  projectLimit: number;
  storageMb: number;
  mediaPerProject: number;
};

export type PlanFeatures = {
  whatsappTestimonials: boolean;
  testimonialLimit: number;
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

export function normalizeProductPlan(plan: string | null | undefined): ProductPlan {
  return plan === 'pro' ? 'pro' : 'lite';
}

export function getPlanQuota(planInput: string | null | undefined): PlanQuota {
  const plan = normalizeProductPlan(planInput);

  if (plan === 'pro') {
    return {
      projectLimit: parsePositiveInt(process.env.PLAN_PRO_PROJECT_LIMIT, 50),
      storageMb: parsePositiveInt(process.env.PLAN_PRO_STORAGE_MB, 5000),
      mediaPerProject: parsePositiveInt(process.env.PLAN_PRO_MEDIA_PER_PROJECT, 50),
    };
  }

  return {
    projectLimit: parsePositiveInt(process.env.PLAN_LITE_PROJECT_LIMIT, 5),
    storageMb: parsePositiveInt(process.env.PLAN_LITE_STORAGE_MB, 250),
    mediaPerProject: parsePositiveInt(process.env.PLAN_LITE_MEDIA_PER_PROJECT, 8),
  };
}

export function getPlanFeatures(planInput: string | null | undefined): PlanFeatures {
  const plan = normalizeProductPlan(planInput);

  if (plan === 'pro') {
    return {
      whatsappTestimonials: true,
      testimonialLimit: 20,
    };
  }

  return {
    whatsappTestimonials: false,
    testimonialLimit: 0,
  };
}

export function canUseWhatsappTestimonials(planInput: string | null | undefined) {
  return getPlanFeatures(planInput).whatsappTestimonials;
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

export function sanitizeSiteQuotaOverrideForPlan(
  planInput: string | null | undefined,
  input: Partial<SiteQuotaOverride> | null | undefined
): SiteQuotaOverride {
  const defaults = getPlanQuota(planInput);
  const override = normalizeSiteQuotaOverride(input);

  return {
    projectLimit:
      override.projectLimit !== null && override.projectLimit > defaults.projectLimit
        ? override.projectLimit
        : null,
    storageMb:
      override.storageMb !== null && override.storageMb > defaults.storageMb
        ? override.storageMb
        : null,
    mediaPerProject:
      override.mediaPerProject !== null && override.mediaPerProject > defaults.mediaPerProject
        ? override.mediaPerProject
        : null,
  };
}

export function getEffectiveSiteQuota(
  planInput: string | null | undefined,
  input: Partial<SiteQuotaOverride> | null | undefined
): PlanQuota {
  const defaults = getPlanQuota(planInput);
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
