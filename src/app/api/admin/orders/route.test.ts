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
const createOrder = vi.fn();

vi.mock('@/lib/services/orderService', () => ({
  getAdminOrders: (...args: unknown[]) => getAdminOrders(...args),
  sweepExpiredOrders: (...args: unknown[]) => sweepExpiredOrders(...args),
  activateOrder: (...args: unknown[]) => activateOrder(...args),
  cancelOrder: (...args: unknown[]) => cancelOrder(...args),
  reopenOrder: (...args: unknown[]) => reopenOrder(...args),
  createOrder: (...args: unknown[]) => createOrder(...args),
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

  // Alur B (chat-first): owner membuat order dari panel lalu menyalin link
  // checkout. Aksi ini tidak butuh orderId (belum ada order saat dipanggil).
  describe('action create (Alur B)', () => {
    const createBody = {
      action: 'create',
      buyerName: 'Budi Santoso',
      buyerEmail: 'budi@mail.com',
      buyerWhatsapp: '081234567890',
    };

    beforeEach(() => {
      createOrder.mockReset();
    });

    it('membuat order dan mengembalikan checkoutUrl berisi token', async () => {
      createOrder.mockResolvedValue({
        success: true,
        order: { id: 'ORD-1', desired_slug: 'budi-santoso', status: 'pending_payment' },
        accessToken: 'token-mentah-abc',
      });

      const res = await POST(buildRequest('http://localhost/api/admin/orders', 'POST', createBody));
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.order.id).toBe('ORD-1');
      // Token checkout hanya tersedia di momen pembuatan (hash disimpan di D1).
      expect(body.checkoutUrl).toContain('/orders/ORD-1?token=token-mentah-abc');

      // Slug auto-generate dari nama bila tidak diisi (sama dengan checkout publik).
      expect(createOrder).toHaveBeenCalledWith(
        expect.objectContaining({ desiredSlug: 'budi-santoso' }),
        expect.objectContaining({ APP_BASE_URL: expect.any(String) })
      );
    });

    it('menolak data pembeli yang tidak lengkap tanpa memanggil createOrder', async () => {
      const res = await POST(
        buildRequest('http://localhost/api/admin/orders', 'POST', {
          ...createBody,
          buyerEmail: '',
        })
      );
      expect(res.status).toBe(400);
      expect(createOrder).not.toHaveBeenCalled();
    });

    it('meneruskan error createOrder (mis. slug duplikat) dengan 400', async () => {
      createOrder.mockResolvedValue({
        success: false,
        error: 'Slug tidak tersedia atau sudah digunakan. Silakan pilih slug lain.',
      });

      const res = await POST(
        buildRequest('http://localhost/api/admin/orders', 'POST', {
          ...createBody,
          desiredSlug: 'slug-terpakai',
        })
      );
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('Slug tidak tersedia');
    });
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
