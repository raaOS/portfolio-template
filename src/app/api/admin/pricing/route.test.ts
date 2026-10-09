import { afterEach, describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ────────────────────────────────────────────────────────────
//
// Route bergantung pada:
//   - validateAdminRequest (auth + CSRF)
//   - pricingConfigService (baca/tulis harga dasar)
//
// Semua di-mock supaya test hanya menguji branching tanpa menyentuh D1.

vi.mock('@/lib/auth', () => ({
  validateAdminRequest: vi.fn().mockResolvedValue(true),
  checkAdminAuth: vi.fn(() => false),
}));

const getBasePrice = vi.fn();
const updateBasePrice = vi.fn();

vi.mock('@/lib/services/pricingConfigService', () => ({
  getBasePrice: (...args: unknown[]) => getBasePrice(...args),
  updateBasePrice: (...args: unknown[]) => updateBasePrice(...args),
}));

import { GET, PUT } from './route';
import { validateAdminRequest } from '@/lib/auth';

function buildRequest(url: string, method: 'GET' | 'PUT', body?: unknown): NextRequest {
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

describe('GET /api/admin/pricing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Owner Mode guard: harga adalah data bisnis owner — route hanya hidup
    // di deployment OWNER_MODE=true (klien dibalas 404, diuji terpisah di
    // bawah). Test jalur normal dijalankan seolah ini site owner.
    vi.stubEnv('OWNER_MODE', 'true');
    authMock().mockResolvedValue(true);
    getBasePrice.mockResolvedValue(199000);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects unauthenticated requests', async () => {
    authMock().mockResolvedValue(false);
    const res = await GET(buildRequest('http://localhost/api/admin/pricing', 'GET'));
    expect(res.status).toBe(401);
    expect(getBasePrice).not.toHaveBeenCalled();
  });

  // Guard regresi 2026-10-08: wajib validateAdminRequest (mengenali sesi
  // customer site_user_token), BUKAN checkAdminAuth polos yang 401.
  it('authenticates via validateAdminRequest without CSRF (customer session friendly)', async () => {
    await GET(buildRequest('http://localhost/api/admin/pricing', 'GET'));
    expect(authMock()).toHaveBeenCalledWith(expect.anything(), { checkCsrf: false });
  });

  it('returns the base price', async () => {
    const res = await GET(buildRequest('http://localhost/api/admin/pricing', 'GET'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.basePrice).toBe(199000);
  });

  it('returns 500 when the service blows up', async () => {
    getBasePrice.mockRejectedValueOnce(new Error('d1 down'));
    const res = await GET(buildRequest('http://localhost/api/admin/pricing', 'GET'));
    expect(res.status).toBe(500);
  });
});

describe('PUT /api/admin/pricing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('OWNER_MODE', 'true');
    authMock().mockResolvedValue(true);
    updateBasePrice.mockResolvedValue({ success: true, basePrice: 250000 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects unauthenticated requests', async () => {
    authMock().mockResolvedValue(false);
    const res = await PUT(
      buildRequest('http://localhost/api/admin/pricing', 'PUT', { basePrice: 250000 })
    );
    expect(res.status).toBe(401);
    expect(updateBasePrice).not.toHaveBeenCalled();
  });

  it('updates the base price', async () => {
    const res = await PUT(
      buildRequest('http://localhost/api/admin/pricing', 'PUT', { basePrice: 250000 })
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.basePrice).toBe(250000);
    expect(updateBasePrice).toHaveBeenCalledWith(250000);
  });

  it('returns 400 when the guardrail rejects the price', async () => {
    updateBasePrice.mockResolvedValueOnce({
      success: false,
      error: 'Harga di luar guardrail',
    });
    const res = await PUT(
      buildRequest('http://localhost/api/admin/pricing', 'PUT', { basePrice: 1000 })
    );
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Harga di luar guardrail');
  });
});

describe('Owner Mode guard /api/admin/pricing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock().mockResolvedValue(true);
    getBasePrice.mockResolvedValue(199000);
    updateBasePrice.mockResolvedValue({ success: true, basePrice: 250000 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Deployment klien selalu OWNER_MODE!=true → route harus seolah tidak
  // ada (404, BUKAN 403/401) dan tidak menyentuh auth maupun service.
  it('GET balas 404 di deployment klien tanpa memanggil auth/service', async () => {
    vi.stubEnv('OWNER_MODE', 'false');
    const res = await GET(buildRequest('http://localhost/api/admin/pricing', 'GET'));
    expect(res.status).toBe(404);
    expect(authMock()).not.toHaveBeenCalled();
    expect(getBasePrice).not.toHaveBeenCalled();
  });

  it('PUT balas 404 di deployment klien tanpa memanggil auth/service', async () => {
    vi.stubEnv('OWNER_MODE', 'false');
    const res = await PUT(
      buildRequest('http://localhost/api/admin/pricing', 'PUT', { basePrice: 250000 })
    );
    expect(res.status).toBe(404);
    expect(authMock()).not.toHaveBeenCalled();
    expect(updateBasePrice).not.toHaveBeenCalled();
  });

  it('OWNER_MODE tidak diset pun tetap 404 (fail-closed)', async () => {
    delete (process.env as Record<string, string | undefined>).OWNER_MODE;
    const res = await GET(buildRequest('http://localhost/api/admin/pricing', 'GET'));
    expect(res.status).toBe(404);
  });
});
