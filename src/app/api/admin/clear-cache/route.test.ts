import { beforeEach, describe, expect, it, vi } from 'vitest';

const { validateAdminRequestMock, clearApplicationCacheMock, logAdminActivityMock, revalidatePathMock } =
  vi.hoisted(() => ({
    validateAdminRequestMock: vi.fn(),
    clearApplicationCacheMock: vi.fn(),
    logAdminActivityMock: vi.fn(),
    revalidatePathMock: vi.fn(),
  }));

vi.mock('@/lib/auth', () => ({
  validateAdminRequest: validateAdminRequestMock,
}));

vi.mock('@/lib/cache/clearApplicationCache', () => ({
  clearApplicationCache: clearApplicationCacheMock,
}));

vi.mock('@/lib/services/auditLogger', () => ({
  logAdminActivity: logAdminActivityMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

import { POST } from './route';
import { NextRequest } from 'next/server';

describe('POST /api/admin/clear-cache', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    logAdminActivityMock.mockResolvedValue(undefined);
  });

  it('returns 401 when not authenticated', async () => {
    validateAdminRequestMock.mockResolvedValue(false);
    const req = new NextRequest('http://localhost/api/admin/clear-cache', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toBe('Unauthorized');
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('returns 200 success and clears cache when authenticated', async () => {
    validateAdminRequestMock.mockResolvedValue(true);
    clearApplicationCacheMock.mockResolvedValue({
      serverMemory: [],
      nextFilesystem: [],
      cloudflareCdn: { name: 'cdn', status: 'skipped', detail: 'no env' },
    });

    const req = new NextRequest('http://localhost/api/admin/clear-cache', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('Cache server');
    expect(body.client.clearSiteData).toBe(true);
    expect(body.client.clearCacheStorage).toBe(true);

    expect(revalidatePathMock).toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith('/', 'layout');
    expect(clearApplicationCacheMock).toHaveBeenCalledTimes(1);
    expect(logAdminActivityMock).toHaveBeenCalledTimes(1);
  });

  it('sets correct response headers', async () => {
    validateAdminRequestMock.mockResolvedValue(true);
    clearApplicationCacheMock.mockResolvedValue({
      serverMemory: [],
      nextFilesystem: [],
      cloudflareCdn: { name: 'cdn', status: 'skipped', detail: 'no env' },
    });

    const req = new NextRequest('http://localhost/api/admin/clear-cache', { method: 'POST' });
    const res = await POST(req);
    expect(res.headers.get('Cache-Control')).toBe('no-store, max-age=0, must-revalidate');
    expect(res.headers.get('Pragma')).toBe('no-cache');
    expect(res.headers.get('Clear-Site-Data')).toBe('"cache"');
  });

  it('returns 500 on internal error', async () => {
    validateAdminRequestMock.mockResolvedValue(true);
    clearApplicationCacheMock.mockRejectedValue(new Error('FS crash'));

    const req = new NextRequest('http://localhost/api/admin/clear-cache', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.message).toBe('Terjadi kesalahan internal');
  });
});
