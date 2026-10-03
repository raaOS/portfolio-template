import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateAdminRequest } from '@/lib/auth';
import { queryD1 } from '@/lib/cloudflareD1';
import {
  countProjectMediaRefs,
  getEffectiveSiteQuota,
  loadSiteQuotaOverrideMap,
  normalizeSiteQuotaOverride,
  upsertSiteQuotaOverride,
  type SiteQuota,
  type SiteQuotaOverride,
} from '@/lib/product/siteQuota';
import {
  getStorageQuotaBytes,
  getSiteStoragePrefix,
  getSiteStorageUsageSafe,
} from '@/lib/product/siteStorageUsage';
import {
  deleteFromR2,
  isR2StorageConfigured,
  listR2ObjectKeys,
} from '@/lib/r2Storage';
import { customDomainService } from '@/lib/services/customDomainService';
import { logOperationalEvent, summarizeError } from '@/lib/observability/operationalLog';

type SiteSummaryRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
  project_count: number;
};

type ProjectMediaUsageRow = {
  id: string;
  title: string;
  metadata_json: string | null;
  media_count: number;
};

const siteStatusSchema = z.enum(['active', 'suspended']);
const quotaOverrideSchema = z
  .object({
    projectLimit: z.number().int().positive().nullable().optional(),
    storageMb: z.number().int().positive().nullable().optional(),
    mediaPerProject: z.number().int().positive().nullable().optional(),
  })
  .strict();

const createSiteSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().max(80).optional(),
  status: siteStatusSchema.default('active'),
  quotaOverride: quotaOverrideSchema.optional(),
});

const updateSiteSchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(2).max(80).optional(),
    slug: z.string().trim().max(80).optional(),
    status: siteStatusSchema.optional(),
    quotaOverride: quotaOverrideSchema.optional(),
    customDomain: z.string().trim().max(120).nullable().optional(),
  })
  .refine(
    (data) =>
      data.name ||
      data.slug ||
      data.status ||
      data.quotaOverride !== undefined ||
      data.customDomain !== undefined,
    {
      message: 'At least one field must be provided',
    }
  );

const deleteSiteSchema = z.object({
  id: z.string().trim().min(1),
  confirmSlug: z.string().trim().min(1),
  deleteMedia: z.boolean().default(true),
});

export const dynamic = 'force-dynamic';

function normalizeSiteSlug(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function siteSlugError(slug: string) {
  if (!slug) return 'Site slug is required';
  if (slug.length < 2) return 'Site slug must contain at least 2 characters';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return 'Site slug may only contain lowercase letters, numbers, and hyphens';
  }
  return null;
}

function validationResponse(error: z.ZodError) {
  return NextResponse.json(
    { error: 'Invalid site payload', details: error.flatten() },
    { status: 400 }
  );
}

function databaseMutationErrorResponse(error: unknown) {
  if (error instanceof Error && /UNIQUE|constraint/i.test(error.message)) {
    return NextResponse.json({ error: 'Site slug is already used' }, { status: 409 });
  }
  return null;
}

function hasQuotaReduction(currentQuota: SiteQuota, nextQuota: SiteQuota) {
  return (
    nextQuota.projectLimit < currentQuota.projectLimit ||
    nextQuota.storageMb < currentQuota.storageMb ||
    nextQuota.mediaPerProject < currentQuota.mediaPerProject
  );
}

async function getMaxProjectMediaUsage(siteId: string) {
  const rows = await queryD1<ProjectMediaUsageRow>(
    `SELECT
        p.id,
        p.title,
        p.metadata_json,
        COUNT(ma.id) as media_count
      FROM projects p
      LEFT JOIN media_assets ma ON ma.site_id = p.site_id AND ma.project_id = p.id
      WHERE p.site_id = ?
      GROUP BY p.id, p.title, p.metadata_json`,
    [siteId]
  );

  return rows.reduce(
    (max, row) => {
      let metadataMediaCount = 0;
      if (row.metadata_json) {
        try {
          metadataMediaCount = countProjectMediaRefs(JSON.parse(row.metadata_json));
        } catch {
          metadataMediaCount = 0;
        }
      }

      const mediaCount = Math.max(Number(row.media_count || 0), metadataMediaCount);
      return mediaCount > max.mediaCount
        ? { mediaCount, projectId: row.id, projectTitle: row.title }
        : max;
    },
    { mediaCount: 0, projectId: null as string | null, projectTitle: null as string | null }
  );
}

async function loadSiteSummaries(
  whereSql = '',
  params: Array<string | number | boolean | null> = []
) {
  const rows = await queryD1<SiteSummaryRow>(
    `SELECT
        s.id,
        s.slug,
        s.name,
        s.status,
        s.created_at,
        s.updated_at,
        COUNT(p.id) as project_count
      FROM sites s
      LEFT JOIN projects p ON p.site_id = s.id
      ${whereSql}
      GROUP BY s.id, s.slug, s.name, s.status, s.created_at, s.updated_at
      ORDER BY s.created_at ASC`,
    params
  );

  const siteIds = rows.map((row) => row.id);
  const storageUsages = await Promise.all(siteIds.map((siteId) => getSiteStorageUsageSafe(siteId)));
  const [quotaOverrides, customDomainStatuses] =
    siteIds.length > 0
      ? await Promise.all([
          loadSiteQuotaOverrideMap(siteIds),
          customDomainService.getStatuses(siteIds),
        ])
      : [
          new Map<string, SiteQuotaOverride>(),
          new Map<string, Awaited<ReturnType<typeof customDomainService.getStatus>>>(),
        ];

  return rows.map((row, index) => {
    const quotaOverride = quotaOverrides.get(row.id) ?? normalizeSiteQuotaOverride(null);
    const domainRecord = customDomainStatuses.get(row.id);

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      quota: getEffectiveSiteQuota(quotaOverride),
      quotaOverride,
      usage: {
        projects: Number(row.project_count || 0),
        storage: storageUsages[index],
      },
      customDomain: domainRecord
        ? {
            customDomain: domainRecord.customDomain,
            status: domainRecord.status,
            sslStatus: domainRecord.sslStatus,
          }
        : null,
    };
  });
}

async function loadSiteSummaryById(siteId: string) {
  const sites = await loadSiteSummaries('WHERE s.id = ?', [siteId]);
  return sites[0] ?? null;
}

async function quotaChangeViolationResponse({
  siteId,
  nextOverride,
}: {
  siteId: string;
  nextOverride?: SiteQuotaOverride;
}) {
  const site = await loadSiteSummaryById(siteId);
  if (!site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  const sanitizedOverride =
    nextOverride === undefined ? site.quotaOverride : normalizeSiteQuotaOverride(nextOverride);
  const nextQuota = getEffectiveSiteQuota(sanitizedOverride);

  if (!hasQuotaReduction(site.quota, nextQuota)) return null;

  const violations: string[] = [];

  if (site.usage.projects > nextQuota.projectLimit) {
    violations.push(
      `Project usage ${site.usage.projects} exceeds next limit ${nextQuota.projectLimit}`
    );
  }

  if (site.usage.storage.available) {
    const limitBytes = getStorageQuotaBytes(nextQuota);
    if (site.usage.storage.bytes > limitBytes) {
      violations.push(
        `Storage usage ${site.usage.storage.mb} MB exceeds next limit ${nextQuota.storageMb} MB`
      );
    }
  }

  const mediaUsage = await getMaxProjectMediaUsage(siteId);
  if (mediaUsage.mediaCount > nextQuota.mediaPerProject) {
    violations.push(
      `Project media usage ${mediaUsage.mediaCount} exceeds next limit ${nextQuota.mediaPerProject}`
    );
  }

  if (violations.length === 0) return null;

  return NextResponse.json(
    {
      error: 'Quota change blocked by usage',
      errorCode: 'QUOTA_VIOLATION',
      details: {
        siteId,
        quota: nextQuota,
        quotaOverride: sanitizedOverride,
        usage: site.usage,
        mediaUsage,
        violations,
      },
    },
    { status: 409 }
  );
}

export async function GET(request: NextRequest) {
  try {
    if (!(await validateAdminRequest(request, { checkCsrf: false }))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sites = await loadSiteSummaries();

    return NextResponse.json({
      sites,
      defaultSiteId: sites[0]?.id ?? null,
    });
  } catch (error) {
    console.error('[API Admin Sites GET] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load sites' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await validateAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await request.json().catch(() => ({}));
    const parsed = createSiteSchema.safeParse(rawBody);
    if (!parsed.success) return validationResponse(parsed.error);

    const slug = normalizeSiteSlug(parsed.data.slug || parsed.data.name);
    const slugError = siteSlugError(slug);
    if (slugError) return NextResponse.json({ error: slugError }, { status: 400 });

    const now = new Date().toISOString();
    const siteId = `site-${crypto.randomUUID()}`;

    await queryD1(
      `INSERT INTO sites (id, slug, name, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [siteId, slug, parsed.data.name, parsed.data.status, now, now]
    );

    if (parsed.data.quotaOverride !== undefined) {
      await upsertSiteQuotaOverride({
        siteId,
        override: parsed.data.quotaOverride,
      });
    }

    const site = await loadSiteSummaryById(siteId);
    logOperationalEvent({
      event: 'site.create',
      status: 'success',
      request,
      siteId,
      siteSlug: slug,
      entityType: 'site',
      entityId: siteId,
      message: 'Site created',
      metadata: { status: parsed.data.status },
    });
    return NextResponse.json({ site }, { status: 201 });
  } catch (error) {
    console.error('[API Admin Sites POST] Error:', error);
    logOperationalEvent({
      event: 'site.create',
      level: 'error',
      status: 'failure',
      request,
      message: 'Site create failed',
      metadata: { error: summarizeError(error) },
    });
    const mutationResponse = databaseMutationErrorResponse(error);
    if (mutationResponse) return mutationResponse;

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create site' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!(await validateAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await request.json().catch(() => ({}));
    const parsed = updateSiteSchema.safeParse(rawBody);
    if (!parsed.success) return validationResponse(parsed.error);

    const nextOverride =
      parsed.data.quotaOverride !== undefined
        ? normalizeSiteQuotaOverride(parsed.data.quotaOverride)
        : undefined;

    if (nextOverride !== undefined) {
      const quotaResponse = await quotaChangeViolationResponse({
        siteId: parsed.data.id,
        nextOverride,
      });
      if (quotaResponse) return quotaResponse;
    }

    const updates: string[] = [];
    const params: Array<string | number | boolean | null> = [];

    if (parsed.data.name !== undefined) {
      updates.push('name = ?');
      params.push(parsed.data.name);
    }

    if (parsed.data.slug !== undefined) {
      const slug = normalizeSiteSlug(parsed.data.slug);
      const slugError = siteSlugError(slug);
      if (slugError) return NextResponse.json({ error: slugError }, { status: 400 });
      updates.push('slug = ?');
      params.push(slug);
    }

    if (parsed.data.status !== undefined) {
      updates.push('status = ?');
      params.push(parsed.data.status);
    }

    updates.push('updated_at = ?');
    params.push(new Date().toISOString(), parsed.data.id);

    const updated = await queryD1<{ id: string }>(
      `UPDATE sites
       SET ${updates.join(', ')}
       WHERE id = ?
       RETURNING id`,
      params
    );

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    if (nextOverride !== undefined) {
      await upsertSiteQuotaOverride({
        siteId: parsed.data.id,
        override: nextOverride,
      });
    }

    if (parsed.data.customDomain !== undefined) {
      await customDomainService.registerDomain(parsed.data.id, parsed.data.customDomain || '');
    }

    const site = await loadSiteSummaryById(parsed.data.id);
    logOperationalEvent({
      event: 'site.update',
      status: 'success',
      request,
      siteId: parsed.data.id,
      siteSlug: site?.slug,
      entityType: 'site',
      entityId: parsed.data.id,
      message: 'Site updated',
      metadata: {
        changed: {
          name: parsed.data.name !== undefined,
          slug: parsed.data.slug !== undefined,
          status: parsed.data.status !== undefined,
          quotaOverride: parsed.data.quotaOverride !== undefined,
        },
      },
    });
    return NextResponse.json({ site });
  } catch (error) {
    console.error('[API Admin Sites PUT] Error:', error);
    logOperationalEvent({
      event: 'site.update',
      level: 'error',
      status: 'failure',
      request,
      message: 'Site update failed',
      metadata: { error: summarizeError(error) },
    });
    const mutationResponse = databaseMutationErrorResponse(error);
    if (mutationResponse) return mutationResponse;

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update site' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!(await validateAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await request.json().catch(() => ({}));
    const parsed = deleteSiteSchema.safeParse(rawBody);
    if (!parsed.success) return validationResponse(parsed.error);

    const siteRows = await queryD1<{ id: string; slug: string }>(
      `SELECT id, slug FROM sites WHERE id = ? LIMIT 1`,
      [parsed.data.id]
    );
    const site = siteRows[0];
    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    if (parsed.data.confirmSlug !== site.slug) {
      return NextResponse.json(
        { error: 'Confirmation slug does not match site slug' },
        { status: 400 }
      );
    }

    const deletedMediaKeys: string[] = [];
    if (parsed.data.deleteMedia) {
      if (!isR2StorageConfigured()) {
        return NextResponse.json(
          { error: 'R2 is not configured, refusing to delete site media blindly' },
          { status: 409 }
        );
      }

      const prefix = getSiteStoragePrefix(site.id);
      const keys = await listR2ObjectKeys({ prefix });
      for (const key of keys) {
        if (!key.startsWith(prefix)) {
          return NextResponse.json(
            { error: 'Unsafe R2 key detected during delete' },
            { status: 500 }
          );
        }
        await deleteFromR2(key);
        deletedMediaKeys.push(key);
      }
    }

    const deleteTables = [
      'site_quota_overrides',
      'media_assets',
      'project_narratives',
      'submissions',
      'ai_generations',
      'audit_logs',
      'projects',
    ];
    for (const tableName of deleteTables) {
      await queryD1(`DELETE FROM ${tableName} WHERE site_id = ?`, [site.id]);
    }
    await queryD1(`DELETE FROM sites WHERE id = ?`, [site.id]);

    logOperationalEvent({
      event: 'site.delete',
      status: 'success',
      request,
      siteId: site.id,
      siteSlug: site.slug,
      entityType: 'site',
      entityId: site.id,
      message: 'Site deleted',
      metadata: {
        deleteMedia: parsed.data.deleteMedia,
        mediaObjects: deletedMediaKeys.length,
      },
    });

    return NextResponse.json({
      success: true,
      deleted: {
        siteId: site.id,
        slug: site.slug,
        mediaObjects: deletedMediaKeys.length,
      },
    });
  } catch (error) {
    console.error('[API Admin Sites DELETE] Error:', error);
    logOperationalEvent({
      event: 'site.delete',
      level: 'error',
      status: 'failure',
      request,
      message: 'Site delete failed',
      metadata: { error: summarizeError(error) },
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete site' },
      { status: 500 }
    );
  }
}
