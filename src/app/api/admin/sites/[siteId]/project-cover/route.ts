import { NextRequest, NextResponse } from 'next/server';
import {
  getAdminSiteContext,
  ProjectQuotaError,
} from '@/lib/admin/projectSiteContext';
import { validateSiteMutationRequest } from '@/lib/admin/siteMutationAuth';
import {
  getMissingR2EnvKeys,
  isR2StorageConfigured,
  uploadToR2,
} from '@/lib/r2Storage';
import {
  withSiteQuotaLock,
  enforceSiteStorageQuotaUnlocked,
} from '@/lib/product/siteStorageUsage';
import { logOperationalEvent, summarizeError } from '@/lib/observability/operationalLog';

export const dynamic = 'force-dynamic';

const MAX_COVER_SIZE_BYTES = 10 * 1024 * 1024;
const COVER_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const ALLOWED_IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/avif', 'avif'],
]);

function sanitizeFilename(input: string) {
  return (
    input
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'cover'
  );
}

function isSafeSiteKeySegment(siteId: string) {
  return /^[a-zA-Z0-9_-]+$/.test(siteId);
}

function quotaStatus(error: ProjectQuotaError) {
  if (error.errorCode === 'SITE_NOT_FOUND') return 404;
  return 403;
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId: rawSiteId } = await props.params;
    const siteId = rawSiteId.trim();
    if (!siteId) {
      return NextResponse.json({ error: 'Site id is required' }, { status: 400 });
    }

    if (!(await validateSiteMutationRequest(request, siteId))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isR2StorageConfigured()) {
      return NextResponse.json(
        {
          error: `Cloudflare R2 env is incomplete. Missing: ${getMissingR2EnvKeys().join(', ')}`,
        },
        { status: 500 }
      );
    }

    const site = await getAdminSiteContext(siteId);
    if (site.status !== 'active') {
      throw new ProjectQuotaError('Site is not active', 'SITE_INACTIVE', {
        siteId: site.siteId,
        status: site.status,
      });
    }

    if (!isSafeSiteKeySegment(site.siteId)) {
      return NextResponse.json({ error: 'Site id is not safe for storage key' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const extension = ALLOWED_IMAGE_TYPES.get(file.type);
    if (!extension) {
      return NextResponse.json({ error: 'Cover must be JPG, PNG, WebP, or AVIF' }, { status: 415 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: 'Cover file is empty' }, { status: 400 });
    }

    if (file.size > MAX_COVER_SIZE_BYTES) {
      return NextResponse.json(
        { error: `Cover melewati batas ${MAX_COVER_SIZE_BYTES / 1024 / 1024} MB` },
        { status: 413 }
      );
    }

    const baseName = sanitizeFilename(file.name);
    const randomPart = crypto.randomUUID().slice(0, 8);
    const key = `sites/${site.siteId}/projects/covers/${Date.now()}-${randomPart}-${baseName}.${extension}`;
    const body = await file.arrayBuffer();

    // Cek kuota + upload dalam SATU lock agar dua upload konkuren tidak
    // sama-sama lolos pengecekan (TOCTOU) dan melampaui kuota storage.
    const uploaded = await withSiteQuotaLock(site.siteId, async () => {
      await enforceSiteStorageQuotaUnlocked(site.siteId, file.size, site.quota);
      return uploadToR2({
        key,
        body,
        contentType: file.type,
        cacheControl: COVER_CACHE_CONTROL,
      });
    });

    logOperationalEvent({
      event: 'r2.upload',
      status: 'success',
      request,
      siteId: site.siteId,
      entityType: 'project_cover',
      message: 'Project cover uploaded',
      metadata: {
        key: uploaded.key,
        contentType: file.type,
        size: file.size,
      },
    });

    return NextResponse.json({
      success: true,
      key: uploaded.key,
      url: uploaded.url,
      publicUrl: uploaded.url,
      contentType: file.type,
      size: file.size,
    });
  } catch (error) {
    console.error('[API Admin Site Project Cover POST] Error:', error);
    logOperationalEvent({
      event: 'r2.upload',
      level: 'error',
      status: 'failure',
      request,
      entityType: 'project_cover',
      message: 'Project cover upload failed',
      metadata: { error: summarizeError(error) },
    });
    if (error instanceof ProjectQuotaError) {
      return NextResponse.json(
        {
          error: error.message,
          errorCode: error.errorCode,
          details: error.details,
        },
        { status: quotaStatus(error) }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload project cover' },
      { status: 500 }
    );
  }
}
