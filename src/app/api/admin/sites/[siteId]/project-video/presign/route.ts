import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getAdminSiteContext,
  ProjectQuotaError,
} from '@/lib/admin/projectSiteContext';
import { validateSiteMutationRequest } from '@/lib/admin/siteMutationAuth';
import {
  buildR2PublicUrl,
  createR2PresignedPutUrl,
  getMissingR2EnvKeys,
  isR2StorageConfigured,
} from '@/lib/r2Storage';
import { enforceSiteStorageQuota } from '@/lib/product/siteStorageUsage';
import { logOperationalEvent, summarizeError } from '@/lib/observability/operationalLog';

export const dynamic = 'force-dynamic';

const MAX_PROJECT_VIDEO_SIZE_BYTES = 200 * 1024 * 1024;
const VIDEO_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const ALLOWED_VIDEO_TYPES = new Map([
  ['video/mp4', 'mp4'],
  ['video/webm', 'webm'],
  ['video/quicktime', 'mov'],
]);

const presignVideoSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  contentType: z.string().trim().min(1),
  size: z.number().int().positive().max(MAX_PROJECT_VIDEO_SIZE_BYTES),
});

function sanitizeFilename(input: string) {
  return (
    input
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'project-video'
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

    const rawBody = await request.json().catch(() => ({}));
    const parsed = presignVideoSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid project video payload', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const extension = ALLOWED_VIDEO_TYPES.get(parsed.data.contentType);
    if (!extension) {
      return NextResponse.json(
        { error: 'Project video must be MP4, WebM, or QuickTime' },
        { status: 415 }
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

    await enforceSiteStorageQuota(site.siteId, parsed.data.size, site.quota);

    const baseName = sanitizeFilename(parsed.data.fileName);
    const randomPart = crypto.randomUUID().slice(0, 8);
    const namePrefix = `${Date.now()}-${randomPart}-${baseName}`;
    const key = `sites/${site.siteId}/projects/videos/${namePrefix}.${extension}`;
    const posterKey = `sites/${site.siteId}/projects/video-posters/${namePrefix}.jpg`;
    const previewKey = `sites/${site.siteId}/projects/video-previews/${namePrefix}.mp4`;

    const presigned = await createR2PresignedPutUrl({
      key,
      contentType: parsed.data.contentType,
      cacheControl: VIDEO_CACHE_CONTROL,
      maxSize: parsed.data.size,
    });

    logOperationalEvent({
      event: 'r2.upload',
      status: 'success',
      request,
      siteId: site.siteId,
      entityType: 'project_video_presign',
      message: 'Project video presign created',
      metadata: {
        key: presigned.key,
        contentType: parsed.data.contentType,
        size: parsed.data.size,
      },
    });

    return NextResponse.json({
      success: true,
      kind: 'video',
      key: presigned.key,
      uploadUrl: presigned.uploadUrl,
      publicUrl: presigned.publicUrl,
      url: presigned.publicUrl,
      contentType: parsed.data.contentType,
      cacheControl: presigned.cacheControl,
      expiresInSeconds: presigned.expiresInSeconds,
      size: parsed.data.size,
      posterKey,
      posterUrl: buildR2PublicUrl(posterKey),
      previewKey,
      previewUrl: buildR2PublicUrl(previewKey),
    });
  } catch (error) {
    console.error('[API Admin Site Project Video Presign POST] Error:', error);
    logOperationalEvent({
      event: 'r2.upload',
      level: 'error',
      status: 'failure',
      request,
      entityType: 'project_video_presign',
      message: 'Project video presign failed',
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
      { error: error instanceof Error ? error.message : 'Failed to create project video upload' },
      { status: 500 }
    );
  }
}
