import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { validateAdminRequestMock, isConfiguredMock, missingKeysMock, createPresignedMock } =
  vi.hoisted(() => ({
    validateAdminRequestMock: vi.fn(),
    isConfiguredMock: vi.fn(),
    missingKeysMock: vi.fn(),
    createPresignedMock: vi.fn(),
  }));

vi.mock('@/lib/admin/siteMutationAuth', () => ({
  validateSiteMutationRequest: validateAdminRequestMock,
}));

vi.mock('@/lib/admin/siteRequestContext', () => ({
  assertKnownSite: vi.fn().mockResolvedValue({ id: 'default-site', slug: null }),
  resolveRequestSiteId: vi.fn().mockResolvedValue('default-site'),
  stripSiteContext: (body: unknown) => body,
  SiteContextError: class SiteContextError extends Error {
    constructor(message: string, public readonly status = 400) {
      super(message);
    }
  },
}));

vi.mock('@/lib/r2Storage', () => ({
  createR2PresignedPutUrl: createPresignedMock,
  getMissingR2EnvKeys: missingKeysMock,
  isR2StorageConfigured: isConfiguredMock,
}));

import { POST } from './route';

function buildRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/upload/presign', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/upload/presign', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    isConfiguredMock.mockReturnValue(true);
    missingKeysMock.mockReturnValue([]);
  });

  it('blocks unauthenticated requests', async () => {
    validateAdminRequestMock.mockResolvedValue(false);

    const response = await POST(buildRequest({}) as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 500 when R2 is not configured', async () => {
    validateAdminRequestMock.mockResolvedValue(true);
    isConfiguredMock.mockReturnValue(false);
    missingKeysMock.mockReturnValue(['R2_BUCKET']);

    const response = await POST(buildRequest({ folder: 'wallpapers' }) as never);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain('R2_BUCKET');
  });

  it('rejects when folder is not allowed', async () => {
    validateAdminRequestMock.mockResolvedValue(true);
    isConfiguredMock.mockReturnValue(true);

    const response = await POST(
      buildRequest({ folder: 'malicious', filename: 'test.mp4' }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('tidak diizinkan');
  });

  it('rejects non-video content types', async () => {
    validateAdminRequestMock.mockResolvedValue(true);
    isConfiguredMock.mockReturnValue(true);

    const response = await POST(
      buildRequest({
        folder: 'wallpapers',
        filename: 'test.jpg',
        contentType: 'image/jpeg',
        size: 1024,
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('hanya untuk video');
  });

  it('rejects oversized files', async () => {
    validateAdminRequestMock.mockResolvedValue(true);
    isConfiguredMock.mockReturnValue(true);

    const response = await POST(
      buildRequest({
        folder: 'wallpapers',
        filename: 'test.mp4',
        contentType: 'video/mp4',
        size: 100 * 1024 * 1024,
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('max');
  });

  it('rejects invalid JSON body', async () => {
    validateAdminRequestMock.mockResolvedValue(true);
    isConfiguredMock.mockReturnValue(true);

    const request = new NextRequest('http://localhost/api/upload/presign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    });

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid JSON body');
  });

  it('returns presigned URL for valid video upload', async () => {
    validateAdminRequestMock.mockResolvedValue(true);
    isConfiguredMock.mockReturnValue(true);
    createPresignedMock.mockResolvedValue({
      uploadUrl: 'https://r2.example.com/upload?signed=abc123',
      publicUrl: 'https://public.example.com/file.mp4',
      key: 'assets/wallpapers/123-test.mp4',
      cacheControl: 'public, max-age=31536000, immutable',
      expiresInSeconds: 600,
    });

    const response = await POST(
      buildRequest({
        folder: 'wallpapers',
        filename: 'my-video.mp4',
        contentType: 'video/mp4',
        size: 10485760,
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.uploadUrl).toContain('signed');
    expect(body.publicUrl).toBeDefined();
    expect(body.key).toContain('assets/wallpapers/');
  });
});
