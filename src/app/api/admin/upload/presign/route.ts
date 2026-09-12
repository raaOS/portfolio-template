import { NextRequest, NextResponse } from 'next/server';
import {
  createR2PresignedPutUrl,
  getMissingR2EnvKeys,
  isR2StorageConfigured,
} from '@/lib/r2Storage';
import { validateSiteMutationRequest } from '@/lib/admin/siteMutationAuth';
import {
  assertKnownSite,
  resolveRequestSiteId,
  SiteContextError,
  stripSiteContext,
} from '@/lib/admin/siteRequestContext';


/**
 * Issues a short-lived signed PUT URL so the admin browser can upload
 * large videos (typically wallpapers > 4.5 MB) through the Cloudflare Worker
 * R2 binding without using FormData.
 *
 * Why bypass /api/upload?
 *   /api/upload reads the request as FormData via `req.formData()`. Runtime
 *   platforms cap Route Handler request bodies at a platform body size limit
 *   (4.5 MB on Hobby), so any FormData larger than that fails to parse and
 *   surfaces as "Failed to parse body as FormData" in the toast. Wallpaper
 *   videos at 1920x1080 routinely cross that threshold even after client
 *   compression, so we sidestep the function entirely for the upload bytes
 *   and keep the function only for the small JSON metadata exchange.
 *
 * Security:
 *   - Admin-only (validateAdminRequest + CSRF via the existing proxy).
 *   - Client cannot pick the storage key — server derives it from a
 *     restricted set of folders ("wallpapers" only, for now).
 *   - Content-Type is bound into the signature, so the browser PUT must
 *     match exactly. R2 rejects mismatches.
 *   - Signed URL is valid for 10 minutes only.
 *   - Upload byte ceiling is embedded in the signed token.
 */

const ALLOWED_FOLDERS = new Set(['wallpapers']);
const ALLOWED_EXTENSIONS = new Set(['mp4', 'webm', 'mov']);
// Match dengan `MAX_WALLPAPER_FILE_SIZE` di
// `WallpaperManager.tsx` dan `MAX_CLIENT_COMPRESS_SIZE` di
// `BackgroundUploadContext.tsx`. Ceiling 60 MB:
//   - Client validation reject upload > 60 MB sebelum hit network.
//   - Server-side enforcement di sini sebagai safety net kalau ada
//     bypass DevTools / direct API call.
//   - Live wallpaper 4K dari source internet tipikal 30-50 MB, jadi
//     ceiling 60 MB cukup longgar untuk pass-through Ultra profile.
//   - File > 60 MB akan merusak Lighthouse LCP visitor mobile dan
//     bikin bandwidth/cache cold-hit habis terlalu cepat.
const MAX_VIDEO_SIZE_BYTES = 60 * 1024 * 1024; // 60 MB hard ceiling.

interface PresignRequestBody {
  folder?: string;
  filename?: string;
  contentType?: string;
  size?: number;
}

function sanitizeBaseName(input: string): string {
  return (
    input
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'wallpaper'
  );
}

export async function POST(req: NextRequest) {
  try {
    if (!isR2StorageConfigured()) {
      return NextResponse.json(
        {
          error: `Cloudflare R2 env is incomplete. Missing: ${getMissingR2EnvKeys().join(', ')}`,
        },
        { status: 500 }
      );
    }

    const body = (await req.json().catch(() => null)) as PresignRequestBody | null;
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const siteId = await resolveRequestSiteId(req, body);
    if (!(await validateSiteMutationRequest(req, siteId))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await assertKnownSite(siteId);

    const payload = stripSiteContext(body) as PresignRequestBody;
    const folder = payload.folder ?? '';
    const filename = payload.filename ?? '';
    const contentType = payload.contentType ?? '';
    const size = Number(payload.size ?? 0);

    if (!ALLOWED_FOLDERS.has(folder)) {
      return NextResponse.json(
        {
          error: `Folder "${folder}" tidak diizinkan untuk direct upload`,
        },
        { status: 400 }
      );
    }

    if (!contentType.startsWith('video/')) {
      return NextResponse.json(
        {
          error: 'Direct upload hanya untuk video',
        },
        { status: 400 }
      );
    }

    if (!Number.isFinite(size) || size <= 0 || size > MAX_VIDEO_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `Ukuran video tidak valid (max ${MAX_VIDEO_SIZE_BYTES / 1024 / 1024} MB)`,
        },
        { status: 400 }
      );
    }

    const sourceExt = (filename.split('.').pop() || 'mp4').toLowerCase();
    const ext = ALLOWED_EXTENSIONS.has(sourceExt) ? sourceExt : 'mp4';
    const base = sanitizeBaseName(filename || 'wallpaper');
    const key =
      siteId === 'default-site'
        ? `assets/wallpapers/${Date.now()}-${base}.${ext}`
        : `sites/${siteId}/wallpapers/${Date.now()}-${base}.${ext}`;

    const presigned = await createR2PresignedPutUrl({
      key,
      contentType,
      maxSize: size,
      siteId,
    });

    return NextResponse.json({
      success: true,
      uploadUrl: presigned.uploadUrl,
      publicUrl: presigned.publicUrl,
      key: presigned.key,
      contentType,
      cacheControl: presigned.cacheControl,
      expiresInSeconds: presigned.expiresInSeconds,
    });
  } catch (e) {
    if (e instanceof SiteContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('Presign error:', e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : 'Failed to issue presigned URL',
      },
      { status: 500 }
    );
  }
}
