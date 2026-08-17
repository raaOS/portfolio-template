import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { aboutService } from '@/lib/services/aboutService';
import { invalidateAboutCache } from '@/lib/about';
import { validationError } from '@/lib/api-response';
import type { Wallpaper, WallpaperConfig } from '@/types/about';
import { validateSiteMutationRequest } from '@/lib/admin/siteMutationAuth';
import {
  assertKnownSite,
  revalidateSiteContentPaths,
  resolveRequestSiteId,
  SiteContextError,
  stripSiteContext,
} from '@/lib/admin/siteRequestContext';

/**
 * Atomic collection operations for `wallpaperConfig`.
 *
 * Why this exists:
 *   The original flow was a client-side read-modify-write against
 *   `/api/about` (read GET, append to collection, PUT back). Two
 *   concurrent uploads — same admin in two tabs, or two admins on
 *   different machines — could overlap and last-write-wins,
 *   silently dropping one wallpaper from the collection.
 *
 *   `BackgroundUploadContext` already serializes within a single tab
 *   via `finalizeChainRef`, but that mutex is in-memory and per
 *   component instance, so it doesn't protect across tabs/clients.
 *
 *   Moving the read-modify-write to a single Node function instance
 *   collapses the racing window from "client RTT + server RTT" to
 *   "server-side D1 round trip" — small enough that for a portfolio
 *   admin (1-2 users, rarely truly simultaneous) it is effectively
 *   serial.
 *
 * What this does NOT solve:
 *   - Two runtime instances handling concurrent requests
 *     can still interleave between read and write. The window is
 *     milliseconds, not seconds, but it is non-zero. A proper fix
 *     needs a SQL-level lock or lease on the D1 row, which we don't
 *     have access to via the HTTP API.
 *   - This endpoint operates on `wallpaperConfig` only. Other
 *     fields in `AboutData` still go through `/api/about` PUT.
 */

const wallpaperBodySchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    url: z.string().trim().min(1).max(1000),
    name: z.string().trim().max(200).optional(),
    type: z.enum(['image', 'video']).optional(),
    posterUrl: z.string().trim().max(1000).optional(),
    startTime: z.number().min(0).max(250).optional(),
  })
  .strict();

const requestSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('add'),
      wallpaper: wallpaperBodySchema,
      makeActive: z.boolean().optional().default(true),
    })
    .strict(),
  z
    .object({
      action: z.literal('remove'),
      id: z.string().trim().min(1).max(120),
    })
    .strict(),
  z
    .object({
      action: z.literal('setActive'),
      id: z.string().trim().min(1).max(120),
    })
    .strict(),
]);

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => null);
    if (!rawBody) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const siteId = await resolveRequestSiteId(request, rawBody);
    if (!(await validateSiteMutationRequest(request, siteId))) {
      return NextResponse.json({ error: 'Unauthorized or invalid CSRF token' }, { status: 401 });
    }
    await assertKnownSite(siteId);

    const parsed = requestSchema.safeParse(stripSiteContext(rawBody));
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    // Read freshest snapshot. `getAboutData(true)` skips the
    // CacheManager TTL so we don't merge against a stale collection.
    const current = await aboutService.getAboutData(true, true, siteId);
    const config: WallpaperConfig = current.wallpaperConfig || {
      activeWallpaperId: '',
      collection: [],
    };
    const collection: Wallpaper[] = config.collection || [];

    let nextCollection: Wallpaper[];
    let nextActiveId: string;

    // Extract to a local const so the discriminated-union narrowing
    // sticks across the switch arms. Reading `parsed.data.id` directly
    // inside each case can fail to narrow because TS treats every
    // member access on `parsed.data` as a fresh widening point.
    const action = parsed.data;

    switch (action.action) {
      case 'add': {
        const incoming = action.wallpaper;
        // Reject duplicate id — caller should generate a fresh id per
        // upload (BackgroundUploadContext does, with timestamp +
        // random suffix). A duplicate id means a retry collided with
        // the original; we surface an error rather than silently
        // overwriting metadata.
        if (collection.some((w) => w.id === incoming.id)) {
          return NextResponse.json(
            {
              error: `Wallpaper id "${incoming.id}" already exists`,
              code: 'duplicate_id',
            },
            { status: 409 }
          );
        }
        nextCollection = [...collection, incoming];
        nextActiveId = action.makeActive ? incoming.id : config.activeWallpaperId;
        break;
      }

      case 'remove': {
        if (!collection.some((w) => w.id === action.id)) {
          return NextResponse.json(
            { error: `Wallpaper id "${action.id}" not found`, code: 'not_found' },
            { status: 404 }
          );
        }
        nextCollection = collection.filter((w) => w.id !== action.id);
        // If the active wallpaper is the one being removed, fall back
        // to the first remaining entry, or empty string when nothing
        // is left (visitor side resolves that to DEFAULT_WALLPAPER_URL).
        nextActiveId =
          config.activeWallpaperId === action.id
            ? nextCollection[0]?.id || ''
            : config.activeWallpaperId;
        break;
      }

      case 'setActive': {
        if (!collection.some((w) => w.id === action.id)) {
          return NextResponse.json(
            { error: `Wallpaper id "${action.id}" not found`, code: 'not_found' },
            { status: 404 }
          );
        }
        nextCollection = collection;
        nextActiveId = action.id;
        break;
      }
    }

    const updated = await aboutService.updateAboutData({
      wallpaperConfig: {
        ...config,
        activeWallpaperId: nextActiveId,
        collection: nextCollection,
      },
    }, siteId);

    invalidateAboutCache();
    await revalidateSiteContentPaths(siteId, ['/', '/about']);

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    if (error instanceof SiteContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[API/About/WallpaperCollection] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to update wallpaper collection',
        details: message,
      },
      { status: 500 }
    );
  }
}
