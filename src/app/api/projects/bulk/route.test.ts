import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { validateAdminRequestMock, bulkUpdateProjectsSqlMock, resolveProjectSiteIdMock } = vi.hoisted(() => ({
  validateAdminRequestMock: vi.fn(),
  bulkUpdateProjectsSqlMock: vi.fn(),
  resolveProjectSiteIdMock: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  validateAdminRequest: validateAdminRequestMock,
}));

vi.mock('@/lib/services/project/projectSqlService', () => ({
  projectSqlService: {
    bulkUpdateProjectsSql: bulkUpdateProjectsSqlMock,
  },
}));

vi.mock('@/lib/admin/projectSiteContext', () => ({
  resolveProjectSiteId: resolveProjectSiteIdMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { POST } from './route';

function buildRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/projects/bulk', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/projects/bulk', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resolveProjectSiteIdMock.mockReturnValue('default-site');
  });

  it('blocks unauthenticated requests', async () => {
    validateAdminRequestMock.mockResolvedValue(false);

    const response = await POST(buildRequest({ action: 'delete', ids: ['1'] }) as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toContain('Unauthorized');
  });

  it('returns 400 when ids array is missing', async () => {
    validateAdminRequestMock.mockResolvedValue(true);

    const response = await POST(buildRequest({ action: 'delete' }) as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('No project IDs');
  });

  it('returns 400 when ids array is empty', async () => {
    validateAdminRequestMock.mockResolvedValue(true);

    const response = await POST(buildRequest({ action: 'delete', ids: [] }) as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('No project IDs');
  });

  it('returns 400 for invalid action', async () => {
    validateAdminRequestMock.mockResolvedValue(true);

    const response = await POST(buildRequest({ action: 'invalid', ids: ['1'] }) as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid action');
  });

  it('performs bulk delete successfully', async () => {
    validateAdminRequestMock.mockResolvedValue(true);
    bulkUpdateProjectsSqlMock.mockResolvedValue(true);

    const response = await POST(buildRequest({ action: 'delete', ids: ['1', '2', '3'] }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toContain('delete');
    expect(bulkUpdateProjectsSqlMock).toHaveBeenCalledWith('default-site', {
      ids: ['1', '2', '3'],
      delete: true,
    });
  });

  it('performs bulk publish successfully', async () => {
    validateAdminRequestMock.mockResolvedValue(true);
    bulkUpdateProjectsSqlMock.mockResolvedValue(true);

    const response = await POST(buildRequest({ action: 'publish', ids: ['1', '2'] }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toContain('publish');
    expect(bulkUpdateProjectsSqlMock).toHaveBeenCalledWith('default-site', {
      ids: ['1', '2'],
      status: 'published',
    });
  });

  it('performs bulk draft successfully', async () => {
    validateAdminRequestMock.mockResolvedValue(true);
    bulkUpdateProjectsSqlMock.mockResolvedValue(true);

    const response = await POST(buildRequest({ action: 'draft', ids: ['1'] }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toContain('draft');
    expect(bulkUpdateProjectsSqlMock).toHaveBeenCalledWith('default-site', {
      ids: ['1'],
      status: 'draft',
    });
  });

  it('performs bulk reorder successfully', async () => {
    validateAdminRequestMock.mockResolvedValue(true);
    bulkUpdateProjectsSqlMock.mockResolvedValue(true);

    const response = await POST(buildRequest({ action: 'reorder', ids: ['3', '1', '2'] }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(bulkUpdateProjectsSqlMock).toHaveBeenCalledWith('default-site', {
      ids: ['3', '1', '2'],
      reorder: true,
    });
  });

  it('returns 500 when service returns false', async () => {
    validateAdminRequestMock.mockResolvedValue(true);
    bulkUpdateProjectsSqlMock.mockResolvedValue(false);

    const response = await POST(buildRequest({ action: 'publish', ids: ['1'] }) as never);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain('Failed');
  });

  it('returns 500 on unexpected error', async () => {
    validateAdminRequestMock.mockResolvedValue(true);
    bulkUpdateProjectsSqlMock.mockRejectedValue(new Error('Database down'));

    const response = await POST(buildRequest({ action: 'delete', ids: ['1'] }) as never);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Database down');
  });
});
