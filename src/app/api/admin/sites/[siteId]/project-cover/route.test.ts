import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  validateAdminRequestMock,
  validateSiteMutationRequestMock,
  getAdminSiteContextMock,
  ProjectQuotaErrorMock,
  isConfiguredMock,
  missingKeysMock,
  uploadToR2Mock,
  enforceSiteStorageQuotaMock,
} = vi.hoisted(() => {
  class MockProjectQuotaError extends Error {
    constructor(
      message: string,
      public readonly errorCode:
        | 'SITE_NOT_FOUND'
        | 'SITE_INACTIVE'
        | 'PROJECT_LIMIT_EXCEEDED'
        | 'MEDIA_PER_PROJECT_EXCEEDED'
        | 'STORAGE_LIMIT_EXCEEDED',
      public readonly details?: Record<string, unknown>
    ) {
      super(message);
      this.name = 'ProjectQuotaError';
    }
  }

  return {
    validateAdminRequestMock: vi.fn(),
    validateSiteMutationRequestMock: vi.fn(),
    getAdminSiteContextMock: vi.fn(),
    ProjectQuotaErrorMock: MockProjectQuotaError,
    isConfiguredMock: vi.fn(),
    missingKeysMock: vi.fn(),
    uploadToR2Mock: vi.fn(),
    enforceSiteStorageQuotaMock: vi.fn(),
  };
});

vi.mock('@/lib/auth', () => ({
  validateAdminRequest: validateAdminRequestMock,
}));

vi.mock('@/lib/admin/siteMutationAuth', () => ({
  validateSiteMutationRequest: validateSiteMutationRequestMock,
}));

vi.mock('@/lib/admin/projectSiteContext', () => ({
  getAdminSiteContext: getAdminSiteContextMock,
  ProjectQuotaError: ProjectQuotaErrorMock,
}));

vi.mock('@/lib/r2Storage', () => ({
  getMissingR2EnvKeys: missingKeysMock,
  isR2StorageConfigured: isConfiguredMock,
  uploadToR2: uploadToR2Mock,
}));

vi.mock('@/lib/product/siteStorageUsage', () => ({
  enforceSiteStorageQuotaUnlocked: enforceSiteStorageQuotaMock,
  withSiteQuotaLock: (_siteId: string, fn: () => Promise<unknown>) => fn(),
}));

import { POST } from './route';

function buildRequest(fileData: { name: string; type: string; data: BufferSource } | null) {
  const formData = new FormData();
  if (fileData) {
    formData.set('file', new File([fileData.data], fileData.name, { type: fileData.type }));
  }

  const request = new NextRequest(
    'http://localhost/api/admin/sites/default-site/project-cover',
    {
      method: 'POST',
      body: formData as unknown as BodyInit,
    }
  );
  vi.spyOn(request, 'formData').mockResolvedValue(formData);
  return request;
}

function params(siteId = 'default-site') {
  return {
    params: Promise.resolve({ siteId }),
  };
}

describe('POST /api/admin/sites/[siteId]/project-cover', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    validateSiteMutationRequestMock.mockResolvedValue({ role: 'admin' });
    isConfiguredMock.mockReturnValue(true);
    missingKeysMock.mockReturnValue([]);
    getAdminSiteContextMock.mockResolvedValue({
      siteId: 'default-site',
      slug: 'demo-designer',
      status: 'active',
      quota: {
        projectLimit: 5,
        storageMb: 250,
        mediaPerProject: 8,
      },
    });
    uploadToR2Mock.mockImplementation(async ({ key }: { key: string }) => ({
      key,
      url: `https://media.example.com/${key}`,
    }));
    enforceSiteStorageQuotaMock.mockResolvedValue({
      prefix: 'sites/default-site/',
      bytes: 0,
      mb: 0,
      objectCount: 0,
      available: true,
    });
  });

  it('blocks unauthenticated requests', async () => {
    validateSiteMutationRequestMock.mockResolvedValue(null);

    const response = await POST(
      buildRequest({ name: 'cover.png', type: 'image/png', data: new Uint8Array(10) }) as never,
      params()
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(uploadToR2Mock).not.toHaveBeenCalled();
  });

  it('returns 500 when R2 is not configured', async () => {
    isConfiguredMock.mockReturnValue(false);
    missingKeysMock.mockReturnValue(['CLOUDFLARE_R2_BUCKET']);

    const response = await POST(
      buildRequest({ name: 'cover.png', type: 'image/png', data: new Uint8Array(10) }) as never,
      params()
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain('CLOUDFLARE_R2_BUCKET');
    expect(uploadToR2Mock).not.toHaveBeenCalled();
  });

  it('returns 404 when the site does not exist', async () => {
    getAdminSiteContextMock.mockRejectedValue(
      new ProjectQuotaErrorMock('Site not found', 'SITE_NOT_FOUND', { siteId: 'missing-site' })
    );

    const response = await POST(
      buildRequest({ name: 'cover.png', type: 'image/png', data: new Uint8Array(10) }) as never,
      params('missing-site')
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.errorCode).toBe('SITE_NOT_FOUND');
    expect(uploadToR2Mock).not.toHaveBeenCalled();
  });

  it('rejects inactive sites', async () => {
    getAdminSiteContextMock.mockResolvedValue({
      siteId: 'default-site',
      slug: 'demo-designer',
      status: 'suspended',
      quota: {
        projectLimit: 5,
        storageMb: 250,
        mediaPerProject: 8,
      },
    });

    const response = await POST(
      buildRequest({ name: 'cover.png', type: 'image/png', data: new Uint8Array(10) }) as never,
      params()
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.errorCode).toBe('SITE_INACTIVE');
    expect(uploadToR2Mock).not.toHaveBeenCalled();
  });

  it('rejects non-image cover files', async () => {
    const response = await POST(
      buildRequest({ name: 'cover.txt', type: 'text/plain', data: new Uint8Array(10) }) as never,
      params()
    );
    const body = await response.json();

    expect(response.status).toBe(415);
    expect(body.error).toContain('Cover must be');
    expect(uploadToR2Mock).not.toHaveBeenCalled();
  });

  it('rejects oversized cover images', async () => {
    const response = await POST(
      buildRequest({
        name: 'cover.jpg',
        type: 'image/jpeg',
        data: new Uint8Array(11 * 1024 * 1024),
      }) as never,
      params()
    );
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.error).toContain('melewati batas');
    expect(uploadToR2Mock).not.toHaveBeenCalled();
  });

  it('rejects uploads that would exceed the site storage quota', async () => {
    enforceSiteStorageQuotaMock.mockRejectedValue(
      new ProjectQuotaErrorMock(
        'Storage quota exceeded. Limit: 250 MB',
        'STORAGE_LIMIT_EXCEEDED',
        {
          usageBytes: 249 * 1024 * 1024,
          incomingBytes: 2 * 1024 * 1024,
          limitBytes: 250 * 1024 * 1024,
        }
      )
    );

    const response = await POST(
      buildRequest({
        name: 'cover.jpg',
        type: 'image/jpeg',
        data: new Uint8Array(2 * 1024 * 1024),
      }) as never,
      params()
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.errorCode).toBe('STORAGE_LIMIT_EXCEEDED');
    expect(uploadToR2Mock).not.toHaveBeenCalled();
  });

  it('uploads valid covers into the site-scoped R2 folder', async () => {
    const response = await POST(
      buildRequest({
        name: 'Hero Cover.PNG',
        type: 'image/webp',
        data: new Uint8Array(1024),
      }) as never,
      params()
    );
    const body = await response.json();
    const uploadInput = uploadToR2Mock.mock.calls[0][0];

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(enforceSiteStorageQuotaMock).toHaveBeenCalledWith(
      'default-site',
      1024,
      expect.objectContaining({ storageMb: 250 })
    );
    expect(uploadInput.key).toContain('sites/default-site/projects/covers/');
    expect(uploadInput.key).toMatch(/-hero-cover\.webp$/);
    expect(uploadInput.contentType).toBe('image/webp');
    expect(uploadInput.cacheControl).toBe('public, max-age=31536000, immutable');
    expect(body.url).toBe(`https://media.example.com/${uploadInput.key}`);
  });
});
