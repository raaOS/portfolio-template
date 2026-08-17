import type { NextRequest } from 'next/server';
import type { CreateProjectData, UpdateProjectData } from '@/types/projects';
import { queryD1 } from '@/lib/cloudflareD1';
import {
  countProjectMediaRefs,
  normalizeProductPlan,
  type PlanQuota,
} from '@/lib/product/sitePlan';
import { getEffectiveSiteQuotaById } from '@/lib/product/siteQuota';

type SiteRow = {
  id: string;
  slug: string;
  plan: string;
  status: string;
};

type CountRow = {
  count: number;
};

export type AdminSiteContext = {
  siteId: string;
  slug: string | null;
  plan: 'lite' | 'pro';
  status: string;
  quota: PlanQuota;
};

export class ProjectQuotaError extends Error {
  constructor(
    message: string,
    public readonly errorCode:
      | 'SITE_NOT_FOUND'
      | 'SITE_INACTIVE'
      | 'PROJECT_LIMIT_EXCEEDED'
      | 'MEDIA_PER_PROJECT_EXCEEDED'
      | 'STORAGE_LIMIT_EXCEEDED',
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ProjectQuotaError';
  }
}

export function resolveProjectSiteId(request: NextRequest, body?: Record<string, unknown>) {
  const { searchParams } = new URL(request.url);
  const rawSiteId =
    (typeof body?.siteId === 'string' && body.siteId) ||
    request.headers.get('x-site-id') ||
    searchParams.get('siteId') ||
    'default-site';

  const siteId = rawSiteId.trim();
  return siteId || 'default-site';
}

export async function getAdminSiteContext(siteId: string): Promise<AdminSiteContext> {
  const rows = await queryD1<SiteRow>(
    `SELECT id, slug, plan, status FROM sites WHERE id = ? LIMIT 1`,
    [siteId]
  );
  const site = rows[0];

  if (!site) {
    throw new ProjectQuotaError('Site not found', 'SITE_NOT_FOUND', { siteId });
  }

  const plan = normalizeProductPlan(site.plan);

  return {
    siteId: site.id,
    slug: site.slug || null,
    plan,
    status: site.status,
    quota: await getEffectiveSiteQuotaById({ siteId: site.id, plan }),
  };
}

export async function enforceProjectCreateQuota(
  siteId: string,
  data: CreateProjectData
): Promise<AdminSiteContext> {
  const context = await getAdminSiteContext(siteId);

  if (context.status !== 'active') {
    throw new ProjectQuotaError('Site is not active', 'SITE_INACTIVE', {
      siteId,
      status: context.status,
    });
  }

  const mediaCount = countProjectMediaRefs(data);
  if (mediaCount > context.quota.mediaPerProject) {
    throw new ProjectQuotaError(
      `Media per project quota exceeded. Limit: ${context.quota.mediaPerProject}`,
      'MEDIA_PER_PROJECT_EXCEEDED',
      {
        mediaCount,
        limit: context.quota.mediaPerProject,
        plan: context.plan,
      }
    );
  }

  const countRows = await queryD1<CountRow>(
    `SELECT COUNT(*) as count FROM projects WHERE site_id = ?`,
    [siteId]
  );
  const currentProjects = Number(countRows[0]?.count || 0);

  if (currentProjects >= context.quota.projectLimit) {
    throw new ProjectQuotaError(
      `Project quota exceeded. Limit: ${context.quota.projectLimit}`,
      'PROJECT_LIMIT_EXCEEDED',
      {
        currentProjects,
        limit: context.quota.projectLimit,
        plan: context.plan,
      }
    );
  }

  return context;
}

export async function enforceProjectUpdateQuota(
  siteId: string,
  data: UpdateProjectData
): Promise<AdminSiteContext> {
  const context = await getAdminSiteContext(siteId);

  if (context.status !== 'active') {
    throw new ProjectQuotaError('Site is not active', 'SITE_INACTIVE', {
      siteId,
      status: context.status,
    });
  }

  if (
    data.cover !== undefined ||
    data.gallery !== undefined ||
    data.galleryItems !== undefined ||
    data.galleryGroups !== undefined ||
    data.comparison !== undefined
  ) {
    const mediaCount = countProjectMediaRefs(data);
    if (mediaCount > context.quota.mediaPerProject) {
      throw new ProjectQuotaError(
        `Media per project quota exceeded. Limit: ${context.quota.mediaPerProject}`,
        'MEDIA_PER_PROJECT_EXCEEDED',
        {
          mediaCount,
          limit: context.quota.mediaPerProject,
          plan: context.plan,
        }
      );
    }
  }

  return context;
}
