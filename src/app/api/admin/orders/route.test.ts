import { afterEach, describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ────────────────────────────────────────────────────────────
//
// Route bergantung pada:
//   - validateAdminRequest (auth + CSRF)
//   - orderService (baca/tulis order pembelian site)
//
// Semua di-mock supaya test hanya menguji branching tanpa menyentuh D1.

vi.mock('@/lib/auth', () => ({
  validateAdminRequest: vi.fn().mockResolvedValue(true),
  checkAdminAuth: vi.fn(() => false),
}));

const getAdminOrders = vi.fn();
const sweepExpiredOrders = vi.fn();
const activateOrder = vi.fn();
const cancelOrder = vi.fn();
const reopenOrder = vi.fn();

vi.mock('@/lib/services/orderService', () => ({
  getAdminOrders: (...args: unknown[]) => getAdminOrders(...args),
  sweepExpiredOrders: (...args: unknown[]) => sweepExpiredOrders(...args),
  activateOrder: (...args: unknown[]) => activateOrder(...args),
  cancelOrder: (...args: unknown[]) => cancelOrder(...args),
  reopenOrder: (...args: unknown[]) => reopenOrder(...args),
}));

import { GET, POST } from './route';
import { validateAdminRequest } from '@/lib/auth';

function buildRequest(url: string, method: 'GET' | 'POST', body?: unknown): NextRequest {
  return new NextRequest(
    url,
    method === 'POST' ? { method, body: JSON.stringify(body ?? {}) } : { method }
  );
}

function authMock() {
  return validateAdminRequest as ReturnType<typeof vi.fn>;
}

describe('GET /api/admin/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('OWNER_MODE', 'true');
    authMock().mockResolvedValue(true);
    getAdminOrders.mockResolvedValue({ orders: [], total: 0 });
    sweepExpiredOrders.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects unauthenticated requests', async () => {
    authMock().mockResolvedValue(false);
    const res = await GET(buildRequest('http://localhost/api/admin/orders', 'GET'));
    expect(res.status).toBe(401);
    expect(getAdminOrders).not.toHaveBeenCalled();
  });

  it('returns the orders list', async () => {
    const res = await GET(buildRequest('http://localhost/api/admin/orders', 'GET'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

describe('POST /api/admin/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('OWNER_MODE', 'true');
    authMock().mockResolvedValue(true);
    cancelOrder.mockResolvedValue({ success: true, message: 'ok', order: {} });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects unauthenticated requests', async () => {
    authMock().mockResolvedValue(false);
    const res = await POST(
      buildRequest('http://localhost/api/admin/orders', 'POST', {
        orderId: 'ORD-1',
        action: 'cancel',
        cancelReason: 'tes',
      })
    );
    expect(res.status).toBe(401);
    expect(cancelOrder).not.toHaveBeenCalled();
  });

  it('requires orderId dan action', async () => {
    const res = await POST(buildRequest('http://localhost/api/admin/orders', 'POST', {}));
    expect(res.status).toBe(400);
  });
});

describe('Owner Mode guard /api/admin/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock().mockResolvedValue(true);
    getAdminOrders.mockResolvedValue({ orders: [], total: 0 });
    sweepExpiredOrders.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Order adalah data bisnis owner (pembelian site). Deployment klien harus
  // mendapat 404 — route seolah tidak ada — tanpa auth maupun service disentuh.
  it('GET balas 404 di deployment klien tanpa memanggil auth/service', async () => {
    vi.stubEnv('OWNER_MODE', 'false');
    const res = await GET(buildRequest('http://localhost/api/admin/orders', 'GET'));
    expect(res.status).toBe(404);
    expect(authMock()).not.toHaveBeenCalled();
    expect(getAdminOrders).not.toHaveBeenCalled();
    expect(sweepExpiredOrders).not.toHaveBeenCalled();
  });

  it('POST balas 404 di deployment klien tanpa memanggil auth/service', async () => {
    vi.stubEnv('OWNER_MODE', 'false');
    const res = await POST(
      buildRequest('http://localhost/api/admin/orders', 'POST', {
        orderId: 'ORD-1',
        action: 'activate',
      })
    );
    expect(res.status).toBe(404);
    expect(authMock()).not.toHaveBeenCalled();
    expect(activateOrder).not.toHaveBeenCalled();
  });

  it('OWNER_MODE tidak diset pun tetap 404 (fail-closed)', async () => {
    delete (process.env as Record<string, string | undefined>).OWNER_MODE;
    const res = await GET(buildRequest('http://localhost/api/admin/orders', 'GET'));
    expect(res.status).toBe(404);
  });
});
