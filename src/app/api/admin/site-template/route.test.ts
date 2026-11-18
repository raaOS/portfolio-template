import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * GET /api/admin/site-template — sumber filter templateScope desktop admin.
 * Kontrak penting: FAIL-OPEN (D1 gagal → 200 dengan null, bukan 500/403),
 * karena error sesaat tidak boleh menyembunyikan CRUD dari admin.
 */
const validateAdminRequestMock = vi.hoisted(() => vi.fn());
const queryD1Mock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({
  validateAdminRequest: validateAdminRequestMock,
}));

vi.mock('@/lib/cloudflareD1', () => ({
  queryD1: queryD1Mock,
}));

vi.mock('@/crud/shared/config', () => ({
  SITE_ID: 'test-site',
}));

import { GET } from './route';

function buildRequest() {
  return new NextRequest('http://localhost/api/admin/site-template');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/admin/site-template', () => {
  it('menolak tanpa sesi admin (401)', async () => {
    validateAdminRequestMock.mockResolvedValue(false);

    const res = await GET(buildRequest());
    expect(res.status).toBe(401);
    expect(queryD1Mock).not.toHaveBeenCalled();
  });

  it('mengembalikan active_template_key dari D1', async () => {
    validateAdminRequestMock.mockResolvedValue(true);
    queryD1Mock.mockResolvedValue([{ active_template_key: 'infinite-canvas' }]);

    const res = await GET(buildRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.activeTemplateKey).toBe('infinite-canvas');
    expect(queryD1Mock).toHaveBeenCalledWith(
      'SELECT active_template_key FROM sites WHERE id = ? LIMIT 1',
      ['test-site']
    );
  });

  it('nilai asing dari D1 dinetralkan ke null (bukan crash)', async () => {
    validateAdminRequestMock.mockResolvedValue(true);
    queryD1Mock.mockResolvedValue([{ active_template_key: 'template-racun' }]);

    const res = await GET(buildRequest());
    const json = await res.json();
    expect(json.activeTemplateKey).toBeNull();
  });

  it('FAIL-OPEN: D1 gagal → 200 dengan activeTemplateKey null', async () => {
    validateAdminRequestMock.mockResolvedValue(true);
    queryD1Mock.mockRejectedValue(new Error('D1 sesaat down'));

    const res = await GET(buildRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.activeTemplateKey).toBeNull();
  });
});
