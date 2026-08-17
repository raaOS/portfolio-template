import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  validateSiteMutationRequestMock,
  getAdminSiteContextMock,
  createPresignedMock,
  isR2StorageConfiguredMock,
  missingKeysMock,
  buildR2PublicUrlMock,
  enforceSiteStorageQuotaMock,
  MockProjectQuotaError,
} = vi.hoisted(() => ({
  validateSiteMutationRequestMock: vi.fn(),
  getAdminSiteContextMock: vi.fn(),
  createPresignedMock: vi.fn(),
  isR2StorageConfiguredMock: vi.fn(),
  missingKeysMock: vi.fn(),
  buildR2PublicUrlMock: vi.fn(),
  enforceSiteStorageQuotaMock: vi.fn(),
  MockProjectQuotaError: class MockProjectQuotaError extends Error {
    public readonly errorCode: string;
    public readonly details?: Record<string, unknown>;

    constructor(message: string, errorCode: string, details?: Record<string, unknown>) {
      super(message);
      this.name = 'ProjectQuotaError';
      this.errorCode = errorCode;
      this.details = details;
    }
  }
}));

vi.mock('@/lib/admin/siteMutationAuth', () => ({
  validateSiteMutationRequest: validateSiteMutationRequestMock,
}));

vi.mock('@/lib/admin/projectSiteContext', () => ({
  getAdminSiteContext: getAdminSiteContextMock,
  ProjectQuotaError: MockProjectQuotaError,
}));

vi.mock('@/lib/r2Storage', () => ({
  createR2PresignedPutUrl: createPresignedMock,
  isR2StorageConfigured: isR2StorageConfiguredMock,
  getMissingR2EnvKeys: missingKeysMock,
  buildR2PublicUrl: buildR2PublicUrlMock,
}));

vi.mock('@/lib/product/siteStorageUsage', () => ({
  enforceSiteStorageQuota: enforceSiteStorageQuotaMock,
}));

import { POST } from './route';

function buildRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/sites/site-1/project-video/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const props = { params: Promise.resolve({ siteId: 'site-1' }) };

describe('POST /api/admin/sites/[siteId]/project-video/presign', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    validateSiteMutationRequestMock.mockResolvedValue({ role: 'admin' });
    isR2StorageConfiguredMock.mockReturnValue(true);
    missingKeysMock.mockReturnValue([]);
    getAdminSiteContextMock.mockResolvedValue({
      siteId: 'site-1',
      status: 'active',
      plan: 'pro',
      quota: {
        projectLimit: 50,
        storageMb: 5000,
        mediaPerProject: 50,
      },
    });
    enforceSiteStorageQuotaMock.mockResolvedValue({ available: true });
    createPresignedMock.mockResolvedValue({
      uploadUrl: '/api/admin/upload/direct?token=signed',
      publicUrl: 'https://cdn.example.com/sites/site-1/projects/videos/demo.mp4',
      key: 'sites/site-1/projects/videos/demo.mp4',
      cacheControl: 'public, max-age=31536000, immutable',
      expiresInSeconds: 600,
    });
    buildR2PublicUrlMock.mockImplementation((key: string) => `https://cdn.example.com/${key}`);
  });

  it('rejects unauthorized requests', async () => {
    validateSiteMutationRequestMock.mockResolvedValue(null);

    const response = await POST(
      buildRequest({
        fileName: 'demo.mp4',
        contentType: 'video/mp4',
        size: 1024,
      }),
      props
    );

    expect(response.status).toBe(401);
    expect(getAdminSiteContextMock).not.toHaveBeenCalled();
  });

  it('returns a site-scoped direct upload URL for a valid video', async () => {
    const response = await POST(
      buildRequest({
        fileName: 'Brand Film.mp4',
        contentType: 'video/mp4',
        size: 1024 * 1024,
      }),
      props
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      kind: 'video',
      uploadUrl: '/api/admin/upload/direct?token=signed',
      publicUrl: 'https://cdn.example.com/sites/site-1/projects/videos/demo.mp4',
      posterUrl: expect.stringContaining('/sites/site-1/projects/video-posters/'),
      previewUrl: expect.stringContaining('/sites/site-1/projects/video-previews/'),
    });
    expect(enforceSiteStorageQuotaMock).toHaveBeenCalledWith(
      'site-1',
      1024 * 1024,
      expect.objectContaining({ storageMb: 5000 })
    );
    expect(createPresignedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.stringMatching(/^sites\/site-1\/projects\/videos\/.+\.mp4$/),
        contentType: 'video/mp4',
        maxSize: 1024 * 1024,
      })
    );
  });

  it('rejects unsupported video content types', async () => {
    const response = await POST(
      buildRequest({
        fileName: 'demo.avi',
        contentType: 'video/avi',
        size: 1024,
      }),
      props
    );
    const body = await response.json();

    expect(response.status).toBe(415);
    expect(body.error).toBe('Project video must be MP4, WebM, or QuickTime');
  });
});
