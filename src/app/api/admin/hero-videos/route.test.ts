import { afterEach, describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ────────────────────────────────────────────────────────────
//
// Route bergantung pada:
//   - validateAdminRequest (auth + CSRF)
//   - heroVideoService (baca/tulis peta video hero)
//
// Semua di-mock supaya test hanya menguji branching tanpa menyentuh D1.

vi.mock('@/lib/auth', () => ({
  validateAdminRequest: vi.fn().mockResolvedValue(true),
  checkAdminAuth: vi.fn(() => false),
}));

const getHeroPreviewVideos = vi.fn();
const updateHeroPreviewVideo = vi.fn();

vi.mock('@/lib/services/heroVideoService', () => ({
  getHeroPreviewVideos: (...args: unknown[]) => getHeroPreviewVideos(...args),
  updateHeroPreviewVideo: (...args: unknown[]) => updateHeroPreviewVideo(...args),
}));

import { GET, PUT } from './route';
import { validateAdminRequest } from '@/lib/auth';

function buildRequest(
  url: string,
  method: 'GET' | 'PUT',
  body?: unknown
): NextRequest {
  return new NextRequest(
    url,
    method === 'PUT'
      ? { method, body: JSON.stringify(body ?? {}) }
      : { method }
  );
}

function authMock() {
  return validateAdminRequest as ReturnType<typeof vi.fn>;
}

describe('GET /api/admin/hero-videos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Owner Mode guard: video hero adalah konten halaman jualan owner —
    // route hanya hidup di deployment OWNER_MODE=true (klien dibalas 404,
    // diuji di bawah).
    vi.stubEnv('OWNER_MODE', 'true');
    authMock().mockResolvedValue(true);
    getHeroPreviewVideos.mockResolvedValue({
      'os-desktop': 'https://example.com/hero-os.mp4',
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects unauthenticated requests', async () => {
    authMock().mockResolvedValue(false);
    const res = await GET(
      buildRequest('http://localhost/api/admin/hero-videos', 'GET')
    );
    expect(res.status).toBe(401);
    expect(getHeroPreviewVideos).not.toHaveBeenCalled();
  });

  // Pola auth yang sama dengan route pricing (customer session friendly).
  it('authenticates via validateAdminRequest without CSRF', async () => {
    await GET(buildRequest('http://localhost/api/admin/hero-videos', 'GET'));
    expect(authMock()).toHaveBeenCalledWith(expect.anything(), {
      checkCsrf: false,
    });
  });

  it('returns the hero video map', async () => {
    const res = await GET(
      buildRequest('http://localhost/api/admin/hero-videos', 'GET')
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.videos).toEqual({
      'os-desktop': 'https://example.com/hero-os.mp4',
    });
  });

  it('returns 500 when the service blows up', async () => {
    getHeroPreviewVideos.mockRejectedValueOnce(new Error('d1 down'));
    const res = await GET(
      buildRequest('http://localhost/api/admin/hero-videos', 'GET')
    );
    expect(res.status).toBe(500);
  });
});

describe('PUT /api/admin/hero-videos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('OWNER_MODE', 'true');
    authMock().mockResolvedValue(true);
    updateHeroPreviewVideo.mockResolvedValue({ success: true });
    getHeroPreviewVideos.mockResolvedValue({
      'os-desktop': 'https://example.com/hero-os.mp4',
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects unauthenticated requests', async () => {
    authMock().mockResolvedValue(false);
    const res = await PUT(
      buildRequest('http://localhost/api/admin/hero-videos', 'PUT', {
        slug: 'os-desktop',
        url: 'https://example.com/new.mp4',
      })
    );
    expect(res.status).toBe(401);
    expect(updateHeroPreviewVideo).not.toHaveBeenCalled();
  });

  it('saves a video slot and returns the refreshed map', async () => {
    const res = await PUT(
      buildRequest('http://localhost/api/admin/hero-videos', 'PUT', {
        slug: 'os-desktop',
        url: 'https://example.com/new.mp4',
      })
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(updateHeroPreviewVideo).toHaveBeenCalledWith(
      'os-desktop',
      'https://example.com/new.mp4'
    );
    expect(body.videos['os-desktop']).toBe('https://example.com/hero-os.mp4');
  });

  it('deletes a slot when url is empty', async () => {
    getHeroPreviewVideos.mockResolvedValueOnce({});
    const res = await PUT(
      buildRequest('http://localhost/api/admin/hero-videos', 'PUT', {
        slug: 'os-desktop',
        url: '',
      })
    );
    expect(res.status).toBe(200);
    expect(updateHeroPreviewVideo).toHaveBeenCalledWith('os-desktop', '');
  });

  it('returns 400 when slug is missing', async () => {
    const res = await PUT(
      buildRequest('http://localhost/api/admin/hero-videos', 'PUT', {
        url: 'https://example.com/x.mp4',
      })
    );
    expect(res.status).toBe(400);
    expect(updateHeroPreviewVideo).not.toHaveBeenCalled();
  });

  it('returns 400 when the service rejects the slot/url', async () => {
    updateHeroPreviewVideo.mockResolvedValueOnce({
      success: false,
      error: 'Slot template tidak dikenal: bogus',
    });
    const res = await PUT(
      buildRequest('http://localhost/api/admin/hero-videos', 'PUT', {
        slug: 'bogus',
        url: 'https://example.com/x.mp4',
      })
    );
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Slot template tidak dikenal: bogus');
  });
});

describe('Owner Mode guard /api/admin/hero-videos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock().mockResolvedValue(true);
    getHeroPreviewVideos.mockResolvedValue({});
    updateHeroPreviewVideo.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Deployment klien selalu OWNER_MODE!=true → route harus seolah tidak
  // ada (404, BUKAN 403/401) dan tidak menyentuh auth maupun service.
  it('GET balas 404 di deployment klien tanpa memanggil auth/service', async () => {
    vi.stubEnv('OWNER_MODE', 'false');
    const res = await GET(
      buildRequest('http://localhost/api/admin/hero-videos', 'GET')
    );
    expect(res.status).toBe(404);
    expect(authMock()).not.toHaveBeenCalled();
    expect(getHeroPreviewVideos).not.toHaveBeenCalled();
  });

  it('PUT balas 404 di deployment klien tanpa memanggil auth/service', async () => {
    vi.stubEnv('OWNER_MODE', 'false');
    const res = await PUT(
      buildRequest('http://localhost/api/admin/hero-videos', 'PUT', {
        slug: 'os-desktop',
        url: 'https://example.com/x.mp4',
      })
    );
    expect(res.status).toBe(404);
    expect(authMock()).not.toHaveBeenCalled();
    expect(updateHeroPreviewVideo).not.toHaveBeenCalled();
  });

  it('OWNER_MODE tidak diset pun tetap 404 (fail-closed)', async () => {
    delete (process.env as Record<string, string | undefined>).OWNER_MODE;
    const res = await GET(
      buildRequest('http://localhost/api/admin/hero-videos', 'GET')
    );
    expect(res.status).toBe(404);
  });
});
