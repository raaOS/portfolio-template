import { NextRequest, NextResponse } from 'next/server';

import { validateAdminRequest } from '@/lib/auth';
import {
  assertKnownSite,
  revalidateSiteContentPaths,
  resolveRequestSiteId,
  SiteContextError,
} from '@/lib/admin/siteRequestContext';
import { aboutService } from '@/lib/services/aboutService';
import {
  buildR2PublicUrl,
  headR2Object,
  isR2StorageConfigured,
  getMissingR2EnvKeys,
} from '@/lib/r2Storage';
import type { Wallpaper } from '@/types/about';

/**
 * Self-healing endpoint that fills in missing `posterUrl` fields on
 * wallpaper entries in D1.
 *
 * Why this exists:
 *   The current upload pipeline always persists `posterUrl`, but
 *   wallpaper entries from earlier eras (before that field was added,
 *   or restored from older backups) often have `posterUrl` undefined.
 *   At runtime, `DesktopBackground` works around this by deriving
 *   candidate URLs (`<base>.jpg`, then `<base>.webp`) and probing
 *   them. That works but pays one 404 round trip per cold load for
 *   the era where the actual poster is `.webp`.
 *
 *   This endpoint mirrors what
 *   `scripts/cloudflare/backfill-wallpaper-poster-urls.ts` does, but
 *   is callable from the admin UI so a non-CLI user can trigger it
 *   transparently. The `WallpaperManager` panel pings it once when
 *   it loads and the about data already shows entries that are
 *   missing `posterUrl` — most of the time it's a no-op.
 *
 * Behavior:
 *   - For each wallpaper entry without `posterUrl`:
 *       1. If `url` is not a video, skip.
 *       2. Probe R2 for `<base>.jpg`, then `<base>.webp`.
 *       3. If a poster file exists, queue an update to add the
 *          public URL of that file as the `posterUrl`.
 *   - Write the new collection back via `aboutService.updateAboutData`
 *     only if anything actually changed.
 *
 * What this does NOT do:
 *   - Does not generate poster files. If neither `.jpg` nor `.webp`
 *     side-car exists in R2, the entry is left as-is (the wallpaper
 *     will continue to render with no poster, same as before).
 *   - Does not touch entries that already have `posterUrl` (even if
 *     stale or pointing to a missing file — that's a different
 *     concern handled by `clear-dangling-wallpapers.ts`).
 *
 * Auth:
 *   - Admin only. CSRF enforced for the POST mutation; GET is a
 *     read-only probe used by the UI to decide whether to call the
 *     POST automatically.
 */

const VIDEO_PATTERN = /\.(mp4|webm|mov)([?#].*)?$/i;

interface BackfillCandidate {
  id: string;
  url: string;
}

interface BackfillResult {
  scanned: number;
  alreadyOk: number;
  notVideo: number;
  noPoster: number;
  backfilled: number;
  changes: Array<{ id: string; posterUrl: string }>;
}

function urlToR2Key(url: string): string | null {
  const clean = url.split(/[?#]/)[0];
  const assetIdx = clean.indexOf('assets/');
  if (assetIdx >= 0) return clean.slice(assetIdx);

  const siteIdx = clean.indexOf('sites/');
  if (siteIdx >= 0) return clean.slice(siteIdx);

  return null;
}

async function r2KeyExists(key: string): Promise<boolean> {
  try {
    await headR2Object(key);
    return true;
  } catch (e: unknown) {
    const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
    const code = err?.$metadata?.httpStatusCode;
    if (code === 404 || err?.name === 'NotFound' || err?.name === 'NoSuchKey') {
      return false;
    }
    throw e;
  }
}

async function findExistingPosterUrl(videoUrl: string): Promise<string | null> {
  const videoKey = urlToR2Key(videoUrl);
  if (!videoKey) return null;

  const baseKey = videoKey.replace(/\.(mp4|webm|mov)$/i, '');
  // Order matches current pipeline preference: .jpg first, .webp legacy.
  const candidates = [`${baseKey}.jpg`, `${baseKey}.webp`];

  for (const candidate of candidates) {
    if (await r2KeyExists(candidate)) {
      return buildR2PublicUrl(candidate);
    }
  }
  return null;
}

/**
 * GET — read-only probe so the UI can decide whether to actually
 * trigger the backfill POST. Returns the number of entries that
 * *could* benefit (no `posterUrl` set, video URL parseable).
 *
 * This intentionally does not hit R2 to keep the probe cheap for the
 * "is anything potentially out of sync" question. The full HEAD
 * verification happens only on POST.
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await validateAdminRequest(req, { checkCsrf: false }))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = await resolveRequestSiteId(req);
    await assertKnownSite(siteId);

    const about = await aboutService.getAboutData(true, false, siteId);
    const collection: Wallpaper[] = (about?.wallpaperConfig?.collection || []) as Wallpaper[];

    const candidates: BackfillCandidate[] = [];
    for (const entry of collection) {
      if (entry.posterUrl) continue;
      if (!entry.url || !VIDEO_PATTERN.test(entry.url)) continue;
      candidates.push({ id: entry.id, url: entry.url });
    }

    return NextResponse.json({
      success: true,
      candidatesCount: candidates.length,
      totalWallpapers: collection.length,
    });
  } catch (error) {
    if (error instanceof SiteContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[API/Admin/WallpaperPosterBackfill] GET error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to probe backfill candidates',
        details: message,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await validateAdminRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized or invalid CSRF token' }, { status: 401 });
    }

    const siteId = await resolveRequestSiteId(req);
    await assertKnownSite(siteId);

    if (!isR2StorageConfigured()) {
      return NextResponse.json(
        {
          error: `Cloudflare R2 env tidak lengkap. Missing: ${getMissingR2EnvKeys().join(', ')}`,
        },
        { status: 500 }
      );
    }

    const about = await aboutService.getAboutData(true, false, siteId);
    const cfg = about?.wallpaperConfig;
    const collection: Wallpaper[] = (cfg?.collection || []) as Wallpaper[];

    if (collection.length === 0) {
      // Empty collection → nothing to do, success no-op so the UI
      // doesn't show an error.
      return NextResponse.json({
        success: true,
        result: {
          scanned: 0,
          alreadyOk: 0,
          notVideo: 0,
          noPoster: 0,
          backfilled: 0,
          changes: [],
        } satisfies BackfillResult,
      });
    }

    const result: BackfillResult = {
      scanned: collection.length,
      alreadyOk: 0,
      notVideo: 0,
      noPoster: 0,
      backfilled: 0,
      changes: [],
    };
    const updated: Wallpaper[] = [];

    for (const entry of collection) {
      if (entry.posterUrl) {
        result.alreadyOk++;
        updated.push(entry);
        continue;
      }
      if (!entry.url || !VIDEO_PATTERN.test(entry.url)) {
        result.notVideo++;
        updated.push(entry);
        continue;
      }

      const found = await findExistingPosterUrl(entry.url);
      if (!found) {
        result.noPoster++;
        updated.push(entry);
        continue;
      }

      result.backfilled++;
      result.changes.push({ id: entry.id, posterUrl: found });
      updated.push({ ...entry, posterUrl: found });
    }

    if (result.backfilled === 0) {
      // Nothing changed — skip the D1 write and the cache invalidation
      // round trip. UI gets "success: true" with empty changes.
      return NextResponse.json({ success: true, result });
    }

    await aboutService.updateAboutData(
      {
        wallpaperConfig: {
          ...(cfg || {}),
          collection: updated,
        },
      } as Parameters<typeof aboutService.updateAboutData>[0],
      siteId
    );

    await revalidateSiteContentPaths(siteId, ['/']);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    if (error instanceof SiteContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[API/Admin/WallpaperPosterBackfill] POST error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to backfill wallpaper posters',
        details: message,
      },
      { status: 500 }
    );
  }
}
