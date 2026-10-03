import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { queryD1Mock, verifyTokenMock, checkAdminMock, rateLimitMock, isConfiguredMock, getObjectMock } =
  vi.hoisted(() => ({
    queryD1Mock: vi.fn(),
    verifyTokenMock: vi.fn(),
    checkAdminMock: vi.fn(),
    rateLimitMock: vi.fn(),
    isConfiguredMock: vi.fn(),
    getObjectMock: vi.fn(),
  }));

vi.mock('@/lib/cloudflareD1', () => ({ queryD1: queryD1Mock }));
vi.mock('@/lib/services/orderService', () => ({ verifyOrderAccessToken: verifyTokenMock }));
vi.mock('@/lib/auth', () => ({ checkAdminAuth: checkAdminMock }));
vi.mock('@/lib/security/request', () => ({ enforceRequestRateLimit: rateLimitMock }));
vi.mock('@/lib/r2Storage', () => ({
  getR2Object: getObjectMock,
  isR2StorageConfigured: isConfiguredMock,
}));

import { GET } from './route';

const ORDER_ID = 'ORD-20260101-ABCDEF';
const routeCtx = { params: Promise.resolve({ orderId: ORDER_ID }) };

// Default: pembeli sudah membawa access token yang valid.
function makeRequest(query = '?token=valid') {
  return new NextRequest(`http://localhost/api/billing/orders/${ORDER_ID}/proof${query}`);
}

function orderWithProof(url: string) {
  queryD1Mock.mockResolvedValue([{ payment_proof_url: url }]);
}

function allowAll() {
  rateLimitMock.mockResolvedValue({ allowed: true, retryAfter: 0 });
  checkAdminMock.mockReturnValue(false);
  verifyTokenMock.mockResolvedValue(true);
  isConfiguredMock.mockReturnValue(true);
}

describe('/api/billing/orders/[orderId]/proof', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    allowAll();
  });

  describe('gerbang otorisasi', () => {
    it('menolak caller tanpa token dan tanpa sesi admin', async () => {
      const response = await GET(makeRequest(''), routeCtx);

      expect(response.status).toBe(401);
      // Tanpa token sama sekali, verifikasi tidak dijalankan sama sekali.
      expect(verifyTokenMock).not.toHaveBeenCalled();
      expect(getObjectMock).not.toHaveBeenCalled();
    });

    it('menolak ketika token tidak cocok dengan order', async () => {
      verifyTokenMock.mockResolvedValue(false);
      orderWithProof('/r2/orders/other-order/proof.jpg');

      const response = await GET(makeRequest('?token=salah'), routeCtx);

      expect(response.status).toBe(401);
      expect(verifyTokenMock).toHaveBeenCalledWith(ORDER_ID, 'salah');
      expect(queryD1Mock).not.toHaveBeenCalled();
    });

    it('mengizinkan admin tanpa token order', async () => {
      checkAdminMock.mockReturnValue(true);
      orderWithProof(`/r2/orders/${ORDER_ID}/proof-1.jpg`);
      getObjectMock.mockResolvedValue({ ContentType: 'image/jpeg', ContentLength: 10, Body: null });

      const response = await GET(makeRequest(), routeCtx);

      expect(response.status).toBe(200);
      expect(verifyTokenMock).not.toHaveBeenCalled();
    });

    it('mengembalikan 429 saat rate limit aktif', async () => {
      rateLimitMock.mockResolvedValue({ allowed: false, retryAfter: 30 });

      const response = await GET(makeRequest(), routeCtx);
      const body = await response.json();

      expect(response.status).toBe(429);
      expect(body.retryAfter).toBe(30);
      expect(queryD1Mock).not.toHaveBeenCalled();
    });
  });

  describe('menyajikan bukti', () => {
    it('mengembalikan 404 bila order belum punya bukti', async () => {
      queryD1Mock.mockResolvedValue([{ payment_proof_url: null }]);

      const response = await GET(makeRequest(), routeCtx);

      expect(response.status).toBe(404);
      expect(getObjectMock).not.toHaveBeenCalled();
    });

    it('men-stream objek R2 internal dengan cache private', async () => {
      const body = new ReadableStream({ start: (c) => c.close() });
      orderWithProof(`/r2/orders/${ORDER_ID}/proof-1700000000-abcd1234.jpg`);
      getObjectMock.mockResolvedValue({
        ContentType: 'image/jpeg',
        ContentLength: 4096,
        ETag: '"abc"',
        Body: body,
      });

      const response = await GET(makeRequest(), routeCtx);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('image/jpeg');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      // Private: tidak boleh masuk shared cache/CDN karena berisi PII.
      expect(response.headers.get('cache-control')).toBe('private, max-age=3600');
      expect(getObjectMock).toHaveBeenCalledWith(`orders/${ORDER_ID}/proof-1700000000-abcd1234.jpg`);
    });

    it('menebak content-type dari ekstensi bila R2 tidak memberinya', async () => {
      orderWithProof(`/r2/orders/${ORDER_ID}/proof-1.png`);
      getObjectMock.mockResolvedValue({ ContentType: undefined, ContentLength: 1, Body: null });

      const response = await GET(makeRequest(), routeCtx);

      expect(response.headers.get('content-type')).toBe('image/png');
    });

    it('mengembalikan 404 ketika file sudah hilang dari bucket', async () => {
      orderWithProof(`/r2/orders/${ORDER_ID}/proof-1.jpg`);
      getObjectMock.mockRejectedValue({ name: 'NoSuchKey' });

      const response = await GET(makeRequest(), routeCtx);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toContain('tidak ditemukan');
    });

    it('mengembalikan 503 bila R2 belum dikonfigurasi', async () => {
      isConfiguredMock.mockReturnValue(false);
      orderWithProof(`/r2/orders/${ORDER_ID}/proof-1.jpg`);

      const response = await GET(makeRequest(), routeCtx);

      expect(response.status).toBe(503);
      expect(getObjectMock).not.toHaveBeenCalled();
    });
  });

  describe('membatasi akses lintas order', () => {
    it('tidak pernah membaca objek milik order lain', async () => {
      // URL mengarah ke order lain: harus jatuh ke jalur redirect, bukan stream.
      orderWithProof('/r2/orders/ORD-LAIN-999/proof-1.jpg');

      const response = await GET(makeRequest(), routeCtx);

      expect(getObjectMock).not.toHaveBeenCalled();
      expect(response.status).toBe(302);
    });

    it('menolak key dengan path traversal', async () => {
      orderWithProof(`/r2/orders/${ORDER_ID}/../../secret.jpg`);

      const response = await GET(makeRequest(), routeCtx);

      expect(getObjectMock).not.toHaveBeenCalled();
      expect([302, 400]).toContain(response.status);
    });

    it('tidak ikut mem-proxy URL eksternal yang ditempel pembeli', async () => {
      orderWithProof('https://example.com/bukti-transfer.jpg');

      const response = await GET(makeRequest(), routeCtx);

      expect(getObjectMock).not.toHaveBeenCalled();
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('https://example.com/bukti-transfer.jpg');
    });

    it('menolak skema berbahaya seperti javascript:', async () => {
      orderWithProof('javascript:alert(1)');

      const response = await GET(makeRequest(), routeCtx);

      expect(response.status).toBe(400);
      expect(getObjectMock).not.toHaveBeenCalled();
    });
  });
});
