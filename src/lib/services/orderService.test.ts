import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createOrder,
  uploadPaymentProof,
  activateOrder,
  cancelOrder,
  expireOrderIfStale,
  sweepExpiredOrders,
  getAdminOrders,
} from './orderService';
import * as cloudflareD1 from '@/lib/cloudflareD1';
import * as slugService from './slugService';

vi.mock('@/lib/cloudflareD1', () => ({
  queryD1: vi.fn()
}));

vi.mock('./slugService', () => ({
  isSlugAvailable: vi.fn()
}));

const activePaymentConfigRows = [
  {
    value: JSON.stringify({
      isActive: true,
      qrisUniqueAmountEnabled: true,
      qrisUniqueAmountMaxOffset: 999,
    }),
  },
];

describe('orderService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('createOrder', () => {
    it('fails if slug is not available', async () => {
      vi.mocked(slugService.isSlugAvailable).mockResolvedValueOnce(false);

      const res = await createOrder({
        buyerName: 'Nanda',
        buyerEmail: 'nanda@test.com',
        buyerWhatsapp: '628123456789',
        plan: 'pro',
        desiredSlug: 'nanda-design'
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Slug tidak tersedia');
    });

    it('creates order successfully when slug is available', async () => {
      vi.mocked(slugService.isSlugAvailable).mockResolvedValueOnce(true);
      vi.mocked(cloudflareD1.queryD1)
        .mockResolvedValueOnce([]) // expire stale: activating-recovery sweep
        .mockResolvedValueOnce([]) // expire stale: 7-day auto-cancel sweep
        .mockResolvedValueOnce([]) // expire stale pending orders
        .mockResolvedValueOnce(activePaymentConfigRows)
        .mockResolvedValueOnce([]) // M5: duplicate order check
        .mockResolvedValueOnce([]) // used unique offsets
        .mockResolvedValueOnce([]); // insert order

      const res = await createOrder({
        buyerName: 'Nanda',
        buyerEmail: 'nanda@test.com',
        buyerWhatsapp: '628123456789',
        plan: 'pro',
        desiredSlug: 'nanda-design'
      });

      expect(res.success).toBe(true);
      expect(res.order).toBeDefined();
      expect(res.order?.id).toMatch(/^ORD-\d{8}-[A-Z0-9]{6}$/);
      expect(res.order?.status).toBe('pending_payment');
      expect(res.order?.desired_slug).toBe('nanda-design');
    });

    it('expires stale pending orders before reserving slug and amount', async () => {
      vi.mocked(slugService.isSlugAvailable).mockResolvedValueOnce(true);
      vi.mocked(cloudflareD1.queryD1)
        .mockResolvedValueOnce([]) // expire stale: activating-recovery sweep
        .mockResolvedValueOnce([]) // expire stale: 7-day auto-cancel sweep
        .mockResolvedValueOnce([]) // expire stale pending orders
        .mockResolvedValueOnce(activePaymentConfigRows)
        .mockResolvedValueOnce([]) // M5: duplicate order check
        .mockResolvedValueOnce([{ amount: 199001 }]) // active amount already used
        .mockResolvedValueOnce([]); // insert order

      const res = await createOrder({
        buyerName: 'Nanda',
        buyerEmail: 'nanda@test.com',
        buyerWhatsapp: '628123456789',
        plan: 'pro',
        desiredSlug: 'nanda-design'
      });

      expect(res.success).toBe(true);
      // Probe acak: offset dipastikan BEBAS (bukan 199001 yang sudah terpakai),
      // dalam rentang kode unik valid 1..999, bukan nilai deterministik tertentu.
      const amount = res.order?.amount;
      expect(amount).toBeGreaterThan(199001);
      expect(amount).toBeLessThanOrEqual(199999);
      expect(Number(amount) - 199000).toBeGreaterThanOrEqual(1);
      expect(cloudflareD1.queryD1).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining("WHERE status = 'pending_payment'"),
        expect.any(Array)
      );
    });

    it('falls back to a unique offset if exact base amount collides', async () => {
      vi.mocked(slugService.isSlugAvailable).mockResolvedValueOnce(true);
      const configRows = [
        {
          value: JSON.stringify({
            isActive: true,
            qrisUniqueAmountEnabled: false,
            qrisUniqueAmountMaxOffset: 999
          })
        }
      ];

      vi.mocked(cloudflareD1.queryD1)
        .mockResolvedValueOnce([]) // expire stale: activating-recovery sweep
        .mockResolvedValueOnce([]) // expire stale: 7-day auto-cancel sweep
        .mockResolvedValueOnce([]) // expire stale pending orders
        .mockResolvedValueOnce(configRows) // payment config: exact nominal first
        .mockResolvedValueOnce([]) // M5: duplicate order check
        .mockRejectedValueOnce(new Error('UNIQUE constraint failed: orders.amount'))
        .mockResolvedValueOnce([]) // used unique offsets
        .mockResolvedValueOnce([]); // insert order

      const res = await createOrder({
        buyerName: 'Nanda',
        buyerEmail: 'nanda@test.com',
        buyerWhatsapp: '628123456789',
        plan: 'pro',
        desiredSlug: 'nanda-design'
      });

      expect(res.success).toBe(true);
      expect(res.order?.amount).toBeGreaterThanOrEqual(199001);
      expect(res.order?.amount).toBeLessThanOrEqual(199999);
    });

    it('fails cleanly when payment config is inactive', async () => {
      vi.mocked(slugService.isSlugAvailable).mockResolvedValueOnce(true);
      vi.mocked(cloudflareD1.queryD1)
        .mockResolvedValueOnce([]) // expire stale: activating-recovery sweep
        .mockResolvedValueOnce([]) // expire stale: 7-day auto-cancel sweep
        .mockResolvedValueOnce([]) // expire stale pending orders
        .mockResolvedValueOnce([
          {
            value: JSON.stringify({
              isActive: false,
              qrisUniqueAmountEnabled: true,
              qrisUniqueAmountMaxOffset: 999,
            }),
          },
        ]);

      const res = await createOrder({
        buyerName: 'Nanda',
        buyerEmail: 'nanda@test.com',
        buyerWhatsapp: '628123456789',
        plan: 'pro',
        desiredSlug: 'nanda-design'
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Pembayaran sedang tidak aktif');
    });

    it('still rejects a slug that is not available', async () => {
      vi.mocked(slugService.isSlugAvailable).mockResolvedValueOnce(false);

      const res = await createOrder({
        buyerName: 'Orang Lain',
        buyerEmail: 'other@test.com',
        buyerWhatsapp: '628123456789',
        plan: 'pro',
        desiredSlug: 'nanda-design'
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Slug tidak tersedia');
    });

    it('rejects a duplicate active order for the same email + slug (M5)', async () => {
      vi.mocked(slugService.isSlugAvailable).mockResolvedValueOnce(true);
      vi.mocked(cloudflareD1.queryD1)
        .mockResolvedValueOnce([]) // expire stale: activating-recovery sweep
        .mockResolvedValueOnce([]) // expire stale: 7-day auto-cancel sweep
        .mockResolvedValueOnce([]) // expire stale pending orders
        .mockResolvedValueOnce(activePaymentConfigRows)
        .mockResolvedValueOnce([{ id: 'ORD-OLD-001' }]); // M5: duplicate found

      const res = await createOrder({
        buyerName: 'Nanda',
        buyerEmail: 'dup@test.com',
        buyerWhatsapp: '628123456789',
        plan: 'lite',
        desiredSlug: 'dup-site'
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('ORD-OLD-001');
    });
  });

  describe('uploadPaymentProof', () => {
    it('rejects non-http proof URLs before touching the database', async () => {
      const res = await uploadPaymentProof('ORD-123', 'javascript:alert(1)');

      expect(res.success).toBe(false);
      expect(res.error).toContain('http/https');
      expect(cloudflareD1.queryD1).not.toHaveBeenCalled();
    });

    it('fails if order is not found', async () => {
      vi.mocked(cloudflareD1.queryD1).mockResolvedValueOnce([]);

      const res = await uploadPaymentProof('ORD-123', 'https://proof.png');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Pesanan tidak ditemukan');
    });

    it('updates order status to waiting_verification on success', async () => {
      vi.mocked(cloudflareD1.queryD1)
        .mockResolvedValueOnce([
          {
            id: 'ORD-123',
            status: 'pending_payment',
            plan: 'pro',
            desired_slug: 'nanda-design',
            buyer_name: 'Nanda',
            buyer_whatsapp: '62812345'
          }
        ]) // SELECT order
        .mockResolvedValueOnce([]); // UPDATE orders

      const res = await uploadPaymentProof('ORD-123', 'https://proof.png');
      expect(res.success).toBe(true);
    });

    it('updates order status to waiting_verification on success for expired (late) order', async () => {
      vi.mocked(slugService.isSlugAvailable).mockResolvedValueOnce(true);
      vi.mocked(cloudflareD1.queryD1)
        .mockResolvedValueOnce([
          {
            id: 'ORD-124',
            status: 'expired',
            amount: 299001,
            plan: 'pro',
            desired_slug: 'late-design',
            buyer_name: 'Nanda Late',
            buyer_whatsapp: '62812345'
          }
        ]) // SELECT order
        .mockResolvedValueOnce([]) // no active amount conflict
        .mockResolvedValueOnce([]); // UPDATE orders

      const res = await uploadPaymentProof('ORD-124', 'https://proof.png');
      expect(res.success).toBe(true);
    });

    it('rejects late proof when the expired order slug has been taken by another order/site', async () => {
      vi.mocked(slugService.isSlugAvailable).mockResolvedValueOnce(false);
      vi.mocked(cloudflareD1.queryD1)
        .mockResolvedValueOnce([
          {
            id: 'ORD-124',
            status: 'expired',
            amount: 299001,
            plan: 'pro',
            desired_slug: 'late-design',
            buyer_name: 'Nanda Late',
            buyer_whatsapp: '62812345'
          }
        ]) // SELECT order
        .mockResolvedValueOnce([]); // no active amount conflict

      const res = await uploadPaymentProof('ORD-124', 'https://proof.png');
      expect(res.success).toBe(false);
      expect(res.error).toContain('slug-nya sudah dipakai');
    });

    it('rejects late proof when its expired amount has been reused by another active order', async () => {
      vi.mocked(cloudflareD1.queryD1)
        .mockResolvedValueOnce([
          {
            id: 'ORD-124',
            status: 'expired',
            amount: 299001,
            plan: 'pro',
            desired_slug: 'late-design',
            buyer_name: 'Nanda Late',
            buyer_whatsapp: '62812345'
          }
        ]) // SELECT order
        .mockResolvedValueOnce([{ id: 'ORD-NEW' }]); // amount conflict

      const res = await uploadPaymentProof('ORD-124', 'https://proof.png');
      expect(res.success).toBe(false);
      expect(res.error).toContain('nominalnya sudah dipakai');
    });
  });

  describe('activateOrder', () => {
    it('fails if order cannot be locked or is already activated', async () => {
      vi.mocked(cloudflareD1.queryD1)
        .mockResolvedValueOnce([]) // SELECT pending orders returns empty
        .mockResolvedValueOnce([{ status: 'activated' }]); // SELECT status returns activated

      const res = await activateOrder('ORD-123');
      expect(res.success).toBe(true);
      expect(res.message).toContain('sudah diaktifkan');
    });

    it('provisions new site for new buyer', async () => {
      const order = {
        id: 'ORD-123',
        desired_slug: 'nanda-design',
        buyer_name: 'Nanda',
        buyer_email: 'newbuyer@test.com',
        buyer_whatsapp: '628123456789',
        plan: 'pro',
        payment_proof_url: 'https://proof.png',
        status: 'waiting_verification'
      };

      vi.mocked(cloudflareD1.queryD1)
        .mockResolvedValueOnce([order]) // lock order with UPDATE RETURNING
        .mockResolvedValueOnce([]) // insert sites
        .mockResolvedValueOnce([]) // insert site_subscriptions
        .mockResolvedValueOnce([]) // update order activated
        .mockResolvedValueOnce([]); // insert audit_log

      const res = await activateOrder('ORD-123');
      expect(res.success).toBe(true);
      expect(res.message).toContain('Berhasil mengaktifkan pesanan');
      expect(res.siteId).toBeDefined();
    });

    it('refuses activation before payment proof is uploaded', async () => {
      vi.mocked(cloudflareD1.queryD1)
        .mockResolvedValueOnce([]) // lock order fails
        .mockResolvedValueOnce([{ status: 'pending_payment', payment_proof_url: null }]);

      const res = await activateOrder('ORD-789');
      expect(res.success).toBe(false);
      expect(res.message).toContain('bukti bayar');
    });

    it('cleans up partially created rows when provisioning fails mid-way', async () => {
      const order = {
        id: 'ORD-777',
        desired_slug: 'cleanup-design',
        buyer_name: 'Nanda',
        buyer_email: 'cleanup@test.com',
        buyer_whatsapp: '628123456789',
        plan: 'pro',
        payment_proof_url: 'https://proof.png',
        status: 'waiting_verification'
      };

      vi.mocked(cloudflareD1.queryD1)
        .mockResolvedValueOnce([order]) // lock order
        .mockResolvedValueOnce([]) // insert sites
        .mockResolvedValueOnce([]) // insert site_subscriptions
        .mockRejectedValueOnce(new Error('UPDATE orders activated failed')); // fail after inserts

      const res = await activateOrder('ORD-777');

      expect(res.success).toBe(false);
      expect(res.message).toContain('Aktivasi gagal');
      const deleteCalls = vi.mocked(cloudflareD1.queryD1).mock.calls.filter(
        ([sql]) => typeof sql === 'string' && sql.includes('DELETE FROM')
      );
      const deleteSql = deleteCalls.map(([sql]) => String(sql));
      expect(deleteSql.some((sql) => sql.includes('DELETE FROM sites WHERE id = ?'))).toBe(true);
      expect(deleteSql.some((sql) => sql.includes('DELETE FROM site_subscriptions WHERE id = ?'))).toBe(true);
    });
  });

  describe('cancelOrder', () => {
    it('refuses to cancel an activated order', async () => {
      vi.mocked(cloudflareD1.queryD1).mockResolvedValueOnce([
        {
          id: 'ORD-999',
          status: 'activated',
        }
      ]);

      const res = await cancelOrder('ORD-999');
      expect(res.success).toBe(false);
      expect(res.message).toContain('sudah aktif');
    });
  });

  describe('expireOrderIfStale', () => {
    it('marks an overdue pending order as expired on read', async () => {
      vi.mocked(cloudflareD1.queryD1)
        .mockResolvedValueOnce([
          {
            id: 'ORD-STALE',
            status: 'pending_payment',
            buyer_email: 'a@b.com',
            buyer_name: 'A',
            desired_slug: 'stale-site',
            plan: 'pro',
          },
        ]) // UPDATE ... RETURNING (expired)
        .mockResolvedValueOnce([]); // activating recovery update

      await expireOrderIfStale('ORD-STALE');

      const sqls = vi.mocked(cloudflareD1.queryD1).mock.calls.map(([sql]) => String(sql));
      expect(sqls[0]).toContain("SET status = 'expired'");
    });
  });

  describe('sweepExpiredOrders', () => {
    it('skips the global sweep while the guard is fresh', async () => {
      vi.mocked(cloudflareD1.queryD1).mockResolvedValueOnce([{ value: String(Date.now()) }]);

      await sweepExpiredOrders();

      expect(vi.mocked(cloudflareD1.queryD1).mock.calls.length).toBe(1);
    });

    it('runs the sweep and refreshes the guard when absent', async () => {
      vi.mocked(cloudflareD1.queryD1)
        .mockResolvedValueOnce([]) // guard select
        .mockResolvedValueOnce([]) // activating recovery
        .mockResolvedValueOnce([]) // 7-day auto-cancel
        .mockResolvedValueOnce([]) // stale pending select
        .mockResolvedValueOnce([]); // INSERT platform_settings

      await sweepExpiredOrders();

      const sqls = vi.mocked(cloudflareD1.queryD1).mock.calls;
      const guardCall = sqls.find(
        ([sql, params]) =>
          String(sql).includes('platform_settings') && (params as string[]).includes('billing_expire_sweep_at')
      );
      expect(guardCall).toBeDefined();
    });
  });

  describe('activateOrder (late path)', () => {
    it('activates an expired order when allowExpired is set', async () => {
      const order = {
        id: 'ORD-LATE',
        desired_slug: 'late-site',
        buyer_name: 'L',
        buyer_email: 'late@test.com',
        buyer_whatsapp: '628',
        plan: 'pro',
        payment_proof_url: null,
        status: 'waiting_verification',
      };

      vi.mocked(cloudflareD1.queryD1)
        .mockResolvedValueOnce([]) // expired -> waiting_verification update
        .mockResolvedValueOnce([order]) // lock order with UPDATE RETURNING
        .mockResolvedValueOnce([]) // existingClients check (empty)
        .mockResolvedValueOnce([]) // insert sites
        .mockResolvedValueOnce([]) // insert client_access
        .mockResolvedValueOnce([]) // insert site_subscriptions
        .mockResolvedValueOnce([]) // update order activated
        .mockResolvedValueOnce([]); // insert audit_log

      const res = await activateOrder('ORD-LATE', {}, { allowExpired: true, proofUrl: 'https://proof.png' });

      expect(res.success).toBe(true);
      expect(res.message).toContain('Berhasil mengaktifkan pesanan');
    });
  });

  describe('getAdminOrders', () => {
    it('returns pagination metadata (total, hasMore, page)', async () => {
      vi.mocked(cloudflareD1.queryD1)
        .mockResolvedValueOnce([{ total: 120 }]) // count
        .mockResolvedValueOnce([{ id: 'ORD-P1', amount: 100 }]); // page 1

      const res = await getAdminOrders({}, { page: 1, limit: 50 });

      expect(res.total).toBe(120);
      expect(res.hasMore).toBe(true);
      expect(res.orders.length).toBe(1);
    });

    it('clamps limit to 100 and computes hasMore=false on last page', async () => {
      vi.mocked(cloudflareD1.queryD1)
        .mockResolvedValueOnce([{ total: 3 }]) // count
        .mockResolvedValueOnce([{ id: 'ORD-LAST' }, { id: 'ORD-2' }, { id: 'ORD-3' }]); // page

      const res = await getAdminOrders({}, { page: 2, limit: 500 });

      expect(res.limit).toBe(100);
      expect(res.hasMore).toBe(false);
    });
  });
});
