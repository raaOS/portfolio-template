import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  validateAdminRequestMock,
  queryD1Mock,
  getSiteStorageUsageSafeMock,
  isR2StorageConfiguredMock,
  listR2ObjectKeysMock,
  deleteFromR2Mock,
} = vi.hoisted(() => ({
  validateAdminRequestMock: vi.fn(),
  queryD1Mock: vi.fn(),
  getSiteStorageUsageSafeMock: vi.fn(),
  isR2StorageConfiguredMock: vi.fn(),
  listR2ObjectKeysMock: vi.fn(),
  deleteFromR2Mock: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  validateAdminRequest: validateAdminRequestMock,
}));

vi.mock('@/lib/cloudflareD1', () => ({
  queryD1: queryD1Mock,
  isD1Configured: () => true,
  bootstrapD1Schema: () => Promise.resolve(),
}));

vi.mock('@/lib/product/siteStorageUsage', () => ({
  getSiteStorageUsageSafe: getSiteStorageUsageSafeMock,
  getStorageQuotaBytes: (quota: { storageMb: number }) => quota.storageMb * 1024 * 1024,
  getSiteStoragePrefix: (siteId: string) => `sites/${siteId}/`,
}));

vi.mock('@/lib/r2Storage', () => ({
  isR2StorageConfigured: isR2StorageConfiguredMock,
  listR2ObjectKeys: listR2ObjectKeysMock,
  deleteFromR2: deleteFromR2Mock,
}));

vi.mock('@/lib/product/siteQuota', () => ({
  loadSiteQuotaOverrideMap: vi.fn().mockResolvedValue(new Map()),
  upsertSiteQuotaOverride: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/services/customDomainService', () => ({
  customDomainService: {
    getStatuses: vi.fn().mockResolvedValue(new Map()),
    getStatus: vi.fn().mockResolvedValue(null),
    registerDomain: vi.fn().mockResolvedValue({}),
    removeDomain: vi.fn().mockResolvedValue(undefined),
  },
}));

import { DELETE, GET, POST, PUT } from './route';
import { loadSiteQuotaOverrideMap } from '@/lib/product/siteQuota';
import { customDomainService } from '@/lib/services/customDomainService';

function buildRequest(method = 'GET', body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/sites', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const SITE_ROW = {
  id: 'default-site',
  slug: 'demo-designer',
  name: 'Demo Designer',
  status: 'active',
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-02T00:00:00Z',
  project_count: 2,
};

const SUSPENDED_SITE_ROW = {
  ...SITE_ROW,
  status: 'suspended',
  updated_at: '2026-07-01T00:00:00Z',
};

describe('GET /api/admin/sites', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    validateAdminRequestMock.mockResolvedValue(true);
    queryD1Mock.mockResolvedValue([]);
    getSiteStorageUsageSafeMock.mockResolvedValue({
      prefix: 'sites/default-site/',
      bytes: 2 * 1024 * 1024,
      mb: 2,
      objectCount: 3,
      available: true,
    });
    isR2StorageConfiguredMock.mockReturnValue(true);
    listR2ObjectKeysMock.mockResolvedValue([]);
    deleteFromR2Mock.mockResolvedValue(undefined);
    vi.mocked(loadSiteQuotaOverrideMap).mockResolvedValue(new Map());
    vi.mocked(customDomainService.getStatuses).mockResolvedValue(new Map());
  });

  it('rejects unauthenticated requests', async () => {
    validateAdminRequestMock.mockResolvedValue(false);

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(queryD1Mock).not.toHaveBeenCalled();
  });

  it('returns site summaries with quota and project usage', async () => {
    queryD1Mock
      .mockResolvedValueOnce([SITE_ROW])
      .mockResolvedValueOnce([]);

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.defaultSiteId).toBe('default-site');
    expect(body.sites).toHaveLength(1);
    expect(body.sites[0]).toMatchObject({
      id: 'default-site',
      slug: 'demo-designer',
      name: 'Demo Designer',
      status: 'active',
      quota: {
        projectLimit: 50,
        storageMb: 5000,
        mediaPerProject: 50,
      },
      quotaDefault: {
        projectLimit: 50,
        storageMb: 5000,
        mediaPerProject: 50,
      },
      quotaOverride: {
        projectLimit: null,
        storageMb: null,
        mediaPerProject: null,
      },
      usage: {
        projects: 2,
        storage: {
          prefix: 'sites/default-site/',
          bytes: 2 * 1024 * 1024,
          mb: 2,
          objectCount: 3,
          available: true,
        },
      },
    });
    expect(getSiteStorageUsageSafeMock).toHaveBeenCalledWith('default-site');
  });

  it('returns site with default quota when plan field is absent', async () => {
    queryD1Mock
      .mockResolvedValueOnce([
        {
          id: 'site-1',
          slug: 'site-one',
          name: 'Site One',
          status: 'active',
          created_at: '2026-06-01T00:00:00Z',
          updated_at: '2026-06-02T00:00:00Z',
          project_count: 0,
        },
      ])
      .mockResolvedValueOnce([]);

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sites[0]).toMatchObject({
      id: 'site-1',
      quota: {
        projectLimit: 50,
        storageMb: 5000,
        mediaPerProject: 50,
      },
    });
  });

  it('returns 500 on database error', async () => {
    queryD1Mock.mockRejectedValue(new Error('D1 down'));

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('D1 down');
  });

  it('creates a new site with normalized slug and default quota', async () => {
    queryD1Mock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'site-created',
          slug: 'acme-studio',
          name: 'Acme Studio',
          status: 'active',
          created_at: '2026-07-01T00:00:00Z',
          updated_at: '2026-07-01T00:00:00Z',
          project_count: 0,
        },
      ])
      .mockResolvedValueOnce([]);

    const response = await POST(
      buildRequest('POST', {
        name: 'Acme Studio',
        slug: 'Acme Studio',
        status: 'active',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.site).toMatchObject({
      id: 'site-created',
      slug: 'acme-studio',
      name: 'Acme Studio',
      status: 'active',
      quota: {
        projectLimit: 50,
        storageMb: 5000,
        mediaPerProject: 50,
      },
      usage: {
        projects: 0,
      },
    });
    expect(queryD1Mock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO sites'),
      [
        expect.stringMatching(/^site-/),
        'acme-studio',
        'Acme Studio',
        'lite',
        'active',
        expect.any(String),
        expect.any(String),
      ]
    );
  });

  it('creates a new site with custom quota overrides', async () => {
    queryD1Mock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'site-created',
          slug: 'custom-studio',
          name: 'Custom Studio',
          status: 'active',
          created_at: '2026-07-01T00:00:00Z',
          updated_at: '2026-07-01T00:00:00Z',
          project_count: 0,
        },
      ])
      .mockResolvedValueOnce([]);

    const response = await POST(
      buildRequest('POST', {
        name: 'Custom Studio',
        slug: 'Custom Studio',
        status: 'active',
        quotaOverride: {
          projectLimit: 12,
          storageMb: 1000,
          mediaPerProject: 20,
        },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.site).toMatchObject({
      id: 'site-created',
      slug: 'custom-studio',
    });
  });

  it('rejects invalid site slug on create', async () => {
    const response = await POST(
      buildRequest('POST', {
        name: '!!',
        slug: '!!',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Site slug is required');
    expect(queryD1Mock).not.toHaveBeenCalled();
  });

  it('updates site status', async () => {
    queryD1Mock
      .mockResolvedValueOnce([{ id: 'default-site' }])
      .mockResolvedValueOnce([SUSPENDED_SITE_ROW])
      .mockResolvedValueOnce([]);

    const response = await PUT(
      buildRequest('PUT', {
        id: 'default-site',
        status: 'suspended',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.site).toMatchObject({
      id: 'default-site',
      status: 'suspended',
    });
  });

  it('blocks custom project quota updates below current usage', async () => {
    vi.mocked(loadSiteQuotaOverrideMap).mockResolvedValue(
      new Map([
        [
          'site-custom',
          {
            projectLimit: 100,
            storageMb: null,
            mediaPerProject: null,
          },
        ],
      ])
    );

    queryD1Mock
      .mockResolvedValueOnce([
        {
          id: 'site-custom',
          slug: 'custom-client',
          name: 'Custom Client',
          status: 'active',
          created_at: '2026-06-01T00:00:00Z',
          updated_at: '2026-07-01T00:00:00Z',
          project_count: 60,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const response = await PUT(
      buildRequest('PUT', {
        id: 'site-custom',
        quotaOverride: {
          projectLimit: 6,
          storageMb: null,
          mediaPerProject: null,
        },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.errorCode).toBe('PLAN_QUOTA_VIOLATION');
    expect(body.details.violations[0]).toContain('Project usage 60 exceeds next limit 50');
  });

  it('returns 404 when updating missing site', async () => {
    queryD1Mock.mockResolvedValueOnce([]);

    const response = await PUT(
      buildRequest('PUT', {
        id: 'missing-site',
        status: 'suspended',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Site not found');
  });

  it('deletes a site and its R2 prefix after slug confirmation', async () => {
    queryD1Mock.mockResolvedValueOnce([{ id: 'site-delete', slug: 'delete-me' }]);
    listR2ObjectKeysMock.mockResolvedValueOnce([
      'sites/site-delete/projects/covers/a.webp',
      'sites/site-delete/projects/gallery/b.webp',
    ]);
    for (let i = 0; i < 6; i++) {
      queryD1Mock.mockResolvedValueOnce([]);
    }

    const response = await DELETE(
      buildRequest('DELETE', {
        id: 'site-delete',
        confirmSlug: 'delete-me',
        deleteMedia: true,
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.deleted).toMatchObject({
      siteId: 'site-delete',
      slug: 'delete-me',
      mediaObjects: 2,
    });
    expect(deleteFromR2Mock).toHaveBeenCalledTimes(2);
    expect(queryD1Mock).toHaveBeenCalledWith('DELETE FROM media_assets WHERE site_id = ?', [
      'site-delete',
    ]);
    expect(queryD1Mock).toHaveBeenCalledWith('DELETE FROM projects WHERE site_id = ?', [
      'site-delete',
    ]);
    expect(queryD1Mock).toHaveBeenCalledWith('DELETE FROM sites WHERE id = ?', ['site-delete']);
  });
});
