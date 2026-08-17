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

import { DELETE, GET, POST, PUT } from './route';

function buildRequest(method = 'GET', body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/sites', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('GET /api/admin/sites', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    validateAdminRequestMock.mockResolvedValue(true);
    queryD1Mock.mockResolvedValue([
      {
        id: 'default-site',
        slug: 'demo-designer',
        name: 'Demo Designer',
        plan: 'lite',
        status: 'active',
        created_at: '2026-06-01T00:00:00Z',
        updated_at: '2026-06-02T00:00:00Z',
        project_count: 2,
      },
    ]);
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
      .mockResolvedValueOnce([
        {
          id: 'default-site',
          slug: 'demo-designer',
          name: 'Demo Designer',
          plan: 'lite',
          status: 'active',
          created_at: '2026-06-01T00:00:00Z',
          updated_at: '2026-06-02T00:00:00Z',
          project_count: 2,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'access-1',
          site_id: 'default-site',
          email: 'client@example.com',
          status: 'active',
          updated_at: '2026-06-03T00:00:00Z',
          last_login_at: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          site_id: 'default-site',
          plan: 'lite',
          status: 'trialing',
          current_period_end: null,
          external_customer_id: null,
          external_subscription_id: null,
          updated_at: '2026-06-03T00:00:00Z',
        },
      ])
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
      plan: 'lite',
      status: 'active',
      quota: {
        projectLimit: 5,
        storageMb: 250,
        mediaPerProject: 8,
      },
      quotaDefault: {
        projectLimit: 5,
        storageMb: 250,
        mediaPerProject: 8,
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
      clientAccess: {
        email: 'client@example.com',
        status: 'active',
      },
      billing: {
        status: 'trialing',
      },
    });
    expect(getSiteStorageUsageSafeMock).toHaveBeenCalledWith('default-site');
  });

  it('normalizes unknown plans to lite', async () => {
    queryD1Mock
      .mockResolvedValueOnce([
        {
          id: 'site-1',
          slug: 'site-one',
          name: 'Site One',
          plan: 'enterprise',
          status: 'active',
          created_at: '2026-06-01T00:00:00Z',
          updated_at: '2026-06-02T00:00:00Z',
          project_count: 0,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sites[0].plan).toBe('lite');
  });

  it('returns effective quota when a site has custom quota overrides', async () => {
    queryD1Mock
      .mockResolvedValueOnce([
        {
          id: 'site-custom',
          slug: 'custom-client',
          name: 'Custom Client',
          plan: 'lite',
          status: 'active',
          created_at: '2026-06-01T00:00:00Z',
          updated_at: '2026-06-02T00:00:00Z',
          project_count: 4,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          site_id: 'site-custom',
          project_limit: 12,
          storage_mb: 1000,
          media_per_project: 20,
        },
      ]);

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sites[0]).toMatchObject({
      quota: {
        projectLimit: 12,
        storageMb: 1000,
        mediaPerProject: 20,
      },
      quotaDefault: {
        projectLimit: 5,
        storageMb: 250,
        mediaPerProject: 8,
      },
      quotaOverride: {
        projectLimit: 12,
        storageMb: 1000,
        mediaPerProject: 20,
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

  it('creates a new site with normalized slug and plan quota', async () => {
    queryD1Mock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'site-created',
          slug: 'acme-studio',
          name: 'Acme Studio',
          plan: 'pro',
          status: 'active',
          created_at: '2026-07-01T00:00:00Z',
          updated_at: '2026-07-01T00:00:00Z',
          project_count: 0,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const response = await POST(
      buildRequest('POST', {
        name: 'Acme Studio',
        slug: 'Acme Studio',
        plan: 'pro',
        status: 'active',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.site).toMatchObject({
      id: 'site-created',
      slug: 'acme-studio',
      name: 'Acme Studio',
      plan: 'pro',
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
        'pro',
        'active',
        expect.any(String),
        expect.any(String),
      ]
    );
  });

  it('creates a new site with custom quota overrides', async () => {
    queryD1Mock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'site-created',
          slug: 'custom-studio',
          name: 'Custom Studio',
          plan: 'lite',
          status: 'active',
          created_at: '2026-07-01T00:00:00Z',
          updated_at: '2026-07-01T00:00:00Z',
          project_count: 0,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          site_id: 'site-created',
          project_limit: 12,
          storage_mb: 1000,
          media_per_project: 20,
        },
      ]);

    const response = await POST(
      buildRequest('POST', {
        name: 'Custom Studio',
        slug: 'Custom Studio',
        plan: 'lite',
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
      plan: 'lite',
      quota: {
        projectLimit: 12,
        storageMb: 1000,
        mediaPerProject: 20,
      },
      quotaOverride: {
        projectLimit: 12,
        storageMb: 1000,
        mediaPerProject: 20,
      },
    });
    expect(queryD1Mock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO site_quota_overrides'),
      expect.arrayContaining([12, 1000, 20])
    );
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

  it('updates site plan and status', async () => {
    queryD1Mock
      .mockResolvedValueOnce([
        {
          id: 'default-site',
          slug: 'demo-designer',
          name: 'Demo Designer',
          plan: 'lite',
          status: 'active',
          created_at: '2026-06-01T00:00:00Z',
          updated_at: '2026-06-02T00:00:00Z',
          project_count: 2,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'default-site' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'default-site',
          slug: 'demo-designer',
          name: 'Demo Designer',
          plan: 'pro',
          status: 'suspended',
          created_at: '2026-06-01T00:00:00Z',
          updated_at: '2026-07-01T00:00:00Z',
          project_count: 2,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const response = await PUT(
      buildRequest('PUT', {
        id: 'default-site',
        plan: 'pro',
        status: 'suspended',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.site).toMatchObject({
      id: 'default-site',
      plan: 'pro',
      status: 'suspended',
    });
    expect(queryD1Mock).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE sites'),
      ['pro', 'suspended', expect.any(String), 'default-site']
    );
  });

  it('blocks downgrade when lite quota would be exceeded', async () => {
    queryD1Mock
      .mockResolvedValueOnce([
        {
          id: 'default-site',
          slug: 'demo-designer',
          name: 'Demo Designer',
          plan: 'pro',
          status: 'active',
          created_at: '2026-06-01T00:00:00Z',
          updated_at: '2026-07-01T00:00:00Z',
          project_count: 8,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const response = await PUT(
      buildRequest('PUT', {
        id: 'default-site',
        plan: 'lite',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.errorCode).toBe('PLAN_QUOTA_VIOLATION');
  });

  it('blocks custom project quota updates below current usage', async () => {
    queryD1Mock
      .mockResolvedValueOnce([
        {
          id: 'site-custom',
          slug: 'custom-client',
          name: 'Custom Client',
          plan: 'lite',
          status: 'active',
          created_at: '2026-06-01T00:00:00Z',
          updated_at: '2026-07-01T00:00:00Z',
          project_count: 8,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          site_id: 'site-custom',
          project_limit: 12,
          storage_mb: null,
          media_per_project: null,
        },
      ])
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
    expect(body.details.violations[0]).toContain('Project usage 8 exceeds next limit 6');
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
    expect(queryD1Mock).toHaveBeenCalledWith('DELETE FROM client_password_resets WHERE site_id = ?', [
      'site-delete',
    ]);
    expect(queryD1Mock).toHaveBeenCalledWith('DELETE FROM sites WHERE id = ?', ['site-delete']);
  });
});
