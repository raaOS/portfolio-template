import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

import type { AboutData } from '@/types/about';

// ── Mocks ────────────────────────────────────────────────────────────
//
// The route depends on:
//   - validateAdminRequest        (auth + csrf)
//   - aboutService                (D1 read/write)
//   - r2Storage                   (HEAD probe + url builder + env check)
//
// We mock all of them so the test exercises the route's branching
// logic without touching the network or D1.

vi.mock('@/lib/auth', () => ({
  validateAdminRequest: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/admin/siteRequestContext', () => ({
  assertKnownSite: vi.fn().mockResolvedValue({ id: 'default-site', slug: null }),
  revalidateSiteContentPaths: vi.fn().mockResolvedValue(undefined),
  resolveRequestSiteId: vi.fn().mockResolvedValue('default-site'),
  SiteContextError: class SiteContextError extends Error {
    constructor(message: string, public readonly status = 400) {
      super(message);
    }
  },
}));

const getAboutData = vi.fn();
const updateAboutData = vi.fn();

vi.mock('@/lib/services/aboutService', () => ({
  aboutService: {
    getAboutData: (...args: unknown[]) => getAboutData(...args),
    updateAboutData: (...args: unknown[]) => updateAboutData(...args),
  },
}));

const headR2Object = vi.fn();
const buildR2PublicUrl = vi.fn((key: string) => `/r2/${key}`);
const isR2StorageConfigured = vi.fn(() => true);
const getMissingR2EnvKeys = vi.fn(() => [] as string[]);

vi.mock('@/lib/r2Storage', () => ({
  headR2Object: (...args: unknown[]) => headR2Object(...args),
  buildR2PublicUrl: (...args: unknown[]) => buildR2PublicUrl(...(args as [string])),
  isR2StorageConfigured: () => isR2StorageConfigured(),
  getMissingR2EnvKeys: () => getMissingR2EnvKeys(),
}));

import { GET, POST } from '../route';
import { validateAdminRequest } from '@/lib/auth';

function buildPostRequest(): NextRequest {
  return new NextRequest('http://localhost/api/admin/wallpaper-poster-backfill', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
}

function buildGetRequest(): NextRequest {
  return new NextRequest('http://localhost/api/admin/wallpaper-poster-backfill', {
    method: 'GET',
  });
}

function makeAboutData(
  collection: Array<{ id: string; url?: string; posterUrl?: string }> = []
): AboutData {
  return {
    wallpaperConfig: {
      activeWallpaperId: collection[0]?.id ?? '',
      collection,
    },
  } as unknown as AboutData;
}

/**
 * Build a fake S3 NotFound error matching the shape the AWS SDK
 * actually throws so the route's catch handler narrows correctly.
 */
function makeS3NotFoundError(): Error & {
  name: string;
  $metadata: { httpStatusCode: number };
} {
  const err = new Error('NotFound') as Error & {
    name: string;
    $metadata: { httpStatusCode: number };
  };
  err.name = 'NotFound';
  err.$metadata = { httpStatusCode: 404 };
  return err;
}

describe('GET /api/admin/wallpaper-poster-backfill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (validateAdminRequest as ReturnType<typeof vi.fn>).mockResolvedValue(true);
  });

  it('rejects unauthenticated requests', async () => {
    (validateAdminRequest as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const res = await GET(buildGetRequest());
    expect(res.status).toBe(401);
  });

  it('returns 0 candidates when collection is empty', async () => {
    getAboutData.mockResolvedValue(makeAboutData([]));
    const res = await GET(buildGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      success: true,
      candidatesCount: 0,
      totalWallpapers: 0,
    });
  });

  it('counts entries missing posterUrl for video URLs', async () => {
    getAboutData.mockResolvedValue(
      makeAboutData([
        { id: 'a', url: '/r2/assets/wallpapers/a.mp4', posterUrl: '/r2/a.jpg' }, // skip
        { id: 'b', url: '/r2/assets/wallpapers/b.mp4' }, // candidate
        { id: 'c', url: '/r2/assets/wallpapers/c.png' }, // not a video → skip
      ])
    );
    const res = await GET(buildGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.candidatesCount).toBe(1);
    expect(body.totalWallpapers).toBe(3);
  });
});

describe('POST /api/admin/wallpaper-poster-backfill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (validateAdminRequest as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    isR2StorageConfigured.mockReturnValue(true);
  });

  it('rejects unauthenticated requests', async () => {
    (validateAdminRequest as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const res = await POST(buildPostRequest());
    expect(res.status).toBe(401);
    expect(updateAboutData).not.toHaveBeenCalled();
  });

  it('returns 500 when R2 env is missing', async () => {
    isR2StorageConfigured.mockReturnValue(false);
    getMissingR2EnvKeys.mockReturnValueOnce(['CLOUDFLARE_R2_BUCKET']);
    const res = await POST(buildPostRequest());
    expect(res.status).toBe(500);
  });

  it('returns success no-op when collection is empty', async () => {
    getAboutData.mockResolvedValue(makeAboutData([]));
    const res = await POST(buildPostRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.result.backfilled).toBe(0);
    expect(updateAboutData).not.toHaveBeenCalled();
  });

  it('skips entries that already have posterUrl', async () => {
    getAboutData.mockResolvedValue(
      makeAboutData([{ id: 'a', url: '/r2/assets/wallpapers/a.mp4', posterUrl: '/r2/a.jpg' }])
    );
    const res = await POST(buildPostRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.alreadyOk).toBe(1);
    expect(body.result.backfilled).toBe(0);
    expect(updateAboutData).not.toHaveBeenCalled();
    // Should not even probe R2 for entries that already have posterUrl.
    expect(headR2Object).not.toHaveBeenCalled();
  });

  it('skips non-video entries', async () => {
    getAboutData.mockResolvedValue(
      makeAboutData([{ id: 'a', url: '/r2/assets/wallpapers/a.png' }])
    );
    const res = await POST(buildPostRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.notVideo).toBe(1);
    expect(updateAboutData).not.toHaveBeenCalled();
    expect(headR2Object).not.toHaveBeenCalled();
  });

  it('backfills posterUrl from .jpg side-car when found', async () => {
    getAboutData.mockResolvedValue(
      makeAboutData([{ id: 'a', url: '/r2/assets/wallpapers/a.mp4' }])
    );
    // .jpg HEAD succeeds → return immediately, never probe .webp.
    headR2Object.mockResolvedValueOnce({});

    const res = await POST(buildPostRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.backfilled).toBe(1);
    expect(body.result.changes).toEqual([{ id: 'a', posterUrl: '/r2/assets/wallpapers/a.jpg' }]);

    expect(headR2Object).toHaveBeenCalledTimes(1);
    expect(headR2Object).toHaveBeenCalledWith('assets/wallpapers/a.jpg');
    expect(updateAboutData).toHaveBeenCalledTimes(1);
  });

  it('falls back to .webp side-car when .jpg is missing', async () => {
    getAboutData.mockResolvedValue(
      makeAboutData([{ id: 'a', url: '/r2/assets/wallpapers/a.mp4' }])
    );
    // .jpg → 404, .webp → success
    headR2Object.mockRejectedValueOnce(makeS3NotFoundError());
    headR2Object.mockResolvedValueOnce({});

    const res = await POST(buildPostRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.backfilled).toBe(1);
    expect(body.result.changes).toEqual([{ id: 'a', posterUrl: '/r2/assets/wallpapers/a.webp' }]);

    expect(headR2Object).toHaveBeenCalledTimes(2);
    expect(headR2Object).toHaveBeenNthCalledWith(1, 'assets/wallpapers/a.jpg');
    expect(headR2Object).toHaveBeenNthCalledWith(2, 'assets/wallpapers/a.webp');
  });

  it('reports noPoster when neither .jpg nor .webp exists', async () => {
    getAboutData.mockResolvedValue(
      makeAboutData([{ id: 'a', url: '/r2/assets/wallpapers/a.mp4' }])
    );
    headR2Object.mockRejectedValue(makeS3NotFoundError());

    const res = await POST(buildPostRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.noPoster).toBe(1);
    expect(body.result.backfilled).toBe(0);
    expect(updateAboutData).not.toHaveBeenCalled();
  });

  it('persists merged collection only when something was backfilled', async () => {
    getAboutData.mockResolvedValue(
      makeAboutData([
        { id: 'a', url: '/r2/assets/wallpapers/a.mp4', posterUrl: '/r2/a.jpg' },
        { id: 'b', url: '/r2/assets/wallpapers/b.mp4' },
      ])
    );
    // For b: .jpg succeeds.
    headR2Object.mockResolvedValueOnce({});

    const res = await POST(buildPostRequest());
    expect(res.status).toBe(200);
    expect(updateAboutData).toHaveBeenCalledTimes(1);

    const payload = updateAboutData.mock.calls[0][0];
    expect(payload.wallpaperConfig.collection).toEqual([
      { id: 'a', url: '/r2/assets/wallpapers/a.mp4', posterUrl: '/r2/a.jpg' },
      {
        id: 'b',
        url: '/r2/assets/wallpapers/b.mp4',
        posterUrl: '/r2/assets/wallpapers/b.jpg',
      },
    ]);
  });

  it('rethrows non-NotFound R2 errors instead of silently treating them as missing', async () => {
    getAboutData.mockResolvedValue(
      makeAboutData([{ id: 'a', url: '/r2/assets/wallpapers/a.mp4' }])
    );
    // Simulate a transient R2 server error (5xx) — should not be
    // mistaken for a 404 "no poster" outcome.
    const transient = new Error('Internal Server Error') as Error & {
      $metadata: { httpStatusCode: number };
    };
    transient.$metadata = { httpStatusCode: 500 };
    headR2Object.mockRejectedValue(transient);

    const res = await POST(buildPostRequest());
    expect(res.status).toBe(500);
    expect(updateAboutData).not.toHaveBeenCalled();
  });
});
