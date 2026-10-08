import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createOrder,
  uploadPaymentProof,
  activateOrder,
  cancelOrder,
  reopenOrder,
  expireOrderIfStale,
  sweepExpiredOrders,
  getAdminOrders,
} from './orderService';
import * as cloudflareD1 from '@/lib/cloudflareD1';
import * as slugService from './slugService';
import { clearBasePriceCache, updateBasePrice } from './pricingConfigService';

/**
 * Set env jadi "tidak dikonfigurasi".
 * Sengaja lewat cast: `cloudflare-env.d.ts` (hasil `wrangler types`, gitignored)
 * mendeklarasikan `NOTIFICATION_PROVIDER` properti wajib, jadi
 * `delete process.env.NOTIFICATION_PROVIDER` gagal type-check (TS2790).
 */
function unsetEnv(name: string): void {
  delete (process.env as Record<string, string | undefined>)[name];
}

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
    clearBasePriceCache();
  });

  describe('createOrder', () => {
    it('fails if slug is not available', async () => {
      vi.mocked(slugService.isSlugAvailable).mockResolvedValueOnce(false);

      const res = await createOrder({
        buyerName: 'Nanda',
        buyerEmail: 'nanda@test.com',
        buyerWhatsapp: '628123456789',
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
        .mockResolvedValueOnce([]) // pricing: harga dasar dari platform_settings
        .mockResolvedValueOnce([]) // used unique offsets
        .mockResolvedValueOnce([]); // insert order

      const res = await createOrder({
        buyerName: 'Nanda',
        buyerEmail: 'nanda@test.com',
        buyerWhatsapp: '628123456789',
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
        .mockResolvedValueOnce([]) // pricing: harga dasar dari platform_settings
        .mockResolvedValueOnce([{ amount: 199001 }]) // active amount already used
        .mockResolvedValueOnce([]); // insert order

      const res = await createOrder({
        buyerName: 'Nanda',
        buyerEmail: 'nanda@test.com',
        buyerWhatsapp: '628123456789',
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
        .mockResolvedValueOnce([]) // pricing: harga dasar dari platform_settings
        .mockRejectedValueOnce(new Error('UNIQUE constraint failed: orders.amount'))
        .mockResolvedValueOnce([]) // used unique offsets
        .mockResolvedValueOnce([]); // insert order

      const res = await createOrder({
        buyerName: 'Nanda',
        buyerEmail: 'nanda@test.com',
        buyerWhatsapp: '628123456789',
        desiredSlug: 'nanda-design'
      });

      expect(res.success).toBe(true);
      expect(res.order?.amount).toBeGreaterThanOrEqual(199001);
      expect(res.order?.amount).toBeLessThanOrEqual(199999);
    });

    it('PK4: nominal order dibaca dari harga D1 (bukan konstanta) saat amount tidak dikirim', async () => {
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
        .mockResolvedValueOnce(configRows) // payment config
        .mockResolvedValueOnce([]) // M5: duplicate order check
        .mockResolvedValueOnce([
          { value: JSON.stringify({ basePrice: 250000 }) } // harga D1 (panel Harga Jual)
        ])
        .mockResolvedValueOnce([]); // insert order

      const res = await createOrder({
        buyerName: 'Nanda',
        buyerEmail: 'nanda@test.com',
        buyerWhatsapp: '628123456789',
        desiredSlug: 'nanda-design'
      });

      expect(res.success).toBe(true);
      // Nominal = harga tersimpan di platform_settings, bukan BASE_PRICE (199000).
      expect(res.order?.amount).toBe(250000);

      const pricingCalls = vi.mocked(cloudflareD1.queryD1).mock.calls.filter(
        ([sql, params]) =>
          String(sql).includes('platform_settings') &&
          Array.isArray(params) &&
          params.includes('base_price_idr')
      );
      expect(pricingCalls.length).toBeGreaterThan(0);
    });

    it('PK4: perubahan harga baru TIDAK menghitung ulang nominal order lama', async () => {
      vi.mocked(slugService.isSlugAvailable).mockResolvedValue(true);
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
        // Order A dibuat saat harga D1 = Rp250.000
        .mockResolvedValueOnce([]) // expire stale: activating-recovery sweep
        .mockResolvedValueOnce([]) // expire stale: 7-day auto-cancel sweep
        .mockResolvedValueOnce([]) // expire stale pending orders
        .mockResolvedValueOnce(configRows) // payment config
        .mockResolvedValueOnce([]) // M5: duplicate order check
        .mockResolvedValueOnce([{ value: JSON.stringify({ basePrice: 250000 }) }])
        .mockResolvedValueOnce([]) // insert order A
        // Owner mengubah harga lewat panel → Rp400.000
        .mockResolvedValueOnce([]) // upsert platform_settings
        // Order B dibuat SETELAH harga berubah
        .mockResolvedValueOnce([]) // expire stale: activating-recovery sweep
        .mockResolvedValueOnce([]) // expire stale: 7-day auto-cancel sweep
        .mockResolvedValueOnce([]) // expire stale pending orders
        .mockResolvedValueOnce(configRows) // payment config
        .mockResolvedValueOnce([]) // M5: duplicate order check
        .mockResolvedValueOnce([{ value: JSON.stringify({ basePrice: 400000 }) }])
        .mockResolvedValueOnce([]); // insert order B

      const orderA = await createOrder({
        buyerName: 'Nanda',
        buyerEmail: 'nanda@test.com',
        buyerWhatsapp: '628123456789',
        desiredSlug: 'nanda-design'
      });
      expect(orderA.success).toBe(true);
      expect(orderA.order?.amount).toBe(250000);

      const saved = await updateBasePrice(400000);
      expect(saved.success).toBe(true);

      const orderB = await createOrder({
        buyerName: 'Budi',
        buyerEmail: 'budi@test.com',
        buyerWhatsapp: '628987654321',
        desiredSlug: 'budi-studio'
      });
      expect(orderB.success).toBe(true);
      // Order BARU memakai harga baru…
      expect(orderB.order?.amount).toBe(400000);

      const calls = vi.mocked(cloudflareD1.queryD1).mock.calls;
      // …tapi order LAMA (Rp250.000) tidak dihitung ulang: tidak ada satu pun
      // UPDATE yang menyentuh kolom amount, dan order A tetap Rp250.000.
      const amountUpdates = calls.filter(
        ([sql]) =>
          /UPDATE\s+orders/i.test(String(sql)) && /\bamount\b/i.test(String(sql))
      );
      expect(amountUpdates).toHaveLength(0);

      // Penulisan harga memakai key spesifikasi `base_price_idr`.
      const priceWrite = calls.filter(
        ([sql, params]) =>
          String(sql).includes('INSERT INTO platform_settings') &&
          Array.isArray(params) &&
          params[0] === 'base_price_idr'
      );
      expect(priceWrite).toHaveLength(1);
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

    it('activates order with generative label and no sites insert', async () => {
      const order = {
        id: 'ORD-123',
        desired_slug: 'nanda-design',
        buyer_name: 'Nanda',
        buyer_email: 'newbuyer@test.com',
        buyer_whatsapp: '628123456789',
        payment_proof_url: 'https://proof.png',
        status: 'waiting_verification'
      };

      vi.mocked(cloudflareD1.queryD1)
        .mockResolvedValueOnce([order]) // lock order with UPDATE RETURNING
        .mockResolvedValueOnce([]) // update order activated
        .mockResolvedValueOnce([]); // insert audit_log

      const res = await activateOrder('ORD-123');
      expect(res.success).toBe(true);
      expect(res.message).toContain('Berhasil mengaktifkan pesanan');
      expect(res.siteId).toBeDefined();

      // Opsi A (keputusan owner 2026-10-07): label generatif TANPA menanam
      // baris ke tabel sites — konsep tenant sudah dihapus.
      const sqls = vi.mocked(cloudflareD1.queryD1).mock.calls.map(([sql]) => String(sql));
      expect(sqls.some((sql) => sql.includes('INSERT INTO sites'))).toBe(false);
      expect(sqls.some((sql) => sql.includes('UPDATE orders') && sql.includes("'activated'"))).toBe(true);
    });

    it('refuses activation before payment proof is uploaded', async () => {
      vi.mocked(cloudflareD1.queryD1)
        .mockResolvedValueOnce([]) // lock order fails
        .mockResolvedValueOnce([{ status: 'pending_payment', payment_proof_url: null }]);

      const res = await activateOrder('ORD-789');
      expect(res.success).toBe(false);
      expect(res.message).toContain('bukti bayar');
    });

    it('rolls back status when activation fails and never touches sites table', async () => {
      const order = {
        id: 'ORD-777',
        desired_slug: 'cleanup-design',
        buyer_name: 'Nanda',
        buyer_email: 'cleanup@test.com',
        buyer_whatsapp: '628123456789',
        payment_proof_url: 'https://proof.png',
        status: 'waiting_verification'
      };

      vi.mocked(cloudflareD1.queryD1)
        .mockResolvedValueOnce([order]) // lock order
        .mockRejectedValueOnce(new Error('UPDATE orders activated failed')); // gagal di langkah pertama

      const res = await activateOrder('ORD-777');

      expect(res.success).toBe(false);
      expect(res.message).toContain('Aktivasi gagal');

      const sqls = vi.mocked(cloudflareD1.queryD1).mock.calls.map(([sql]) => String(sql));
      // Tidak pernah menulis tabel sites, dan rollback menandai order gagal.
      expect(sqls.some((sql) => sql.includes('sites'))).toBe(false);
      expect(
        sqls.some((sql) => sql.includes("SET status = 'failed'") && sql.includes("status = 'activating'"))
      ).toBe(true);
    });
  });

  describe('activateOrder (email serah-terima)', () => {
    const savedEmailEnv: Record<string, string | undefined> = {
      NOTIFICATION_PROVIDER: process.env.NOTIFICATION_PROVIDER,
      NOTIFICATION_API_KEY: process.env.NOTIFICATION_API_KEY,
      NOTIFICATION_DEFAULT_FROM: process.env.NOTIFICATION_DEFAULT_FROM,
    };

    function enableResend(): void {
      process.env.NOTIFICATION_PROVIDER = 'resend';
      process.env.NOTIFICATION_API_KEY = 're_test_key';
      process.env.NOTIFICATION_DEFAULT_FROM = 'halo@example.com';
    }

    function mockSuccessfulActivation(): void {
      const order = {
        id: 'ORD-123',
        desired_slug: 'nanda-design',
        buyer_name: 'Nanda',
        buyer_email: 'newbuyer@test.com',
        buyer_whatsapp: '628123456789',
        amount: 1500000,
        payment_proof_url: 'https://proof.png',
        status: 'waiting_verification',
      };

      vi.mocked(cloudflareD1.queryD1)
        .mockResolvedValueOnce([order]) // lock order with UPDATE RETURNING
        .mockResolvedValueOnce([]) // update order activated
        .mockResolvedValueOnce([]); // insert audit_log
    }

    afterEach(() => {
      vi.unstubAllGlobals();
      for (const [key, value] of Object.entries(savedEmailEnv)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });

    it('sends an honest payment-verified email with no website link after activation', async () => {
      enableResend();
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', fetchMock);
      mockSuccessfulActivation();

      const res = await activateOrder('ORD-123');

      expect(res.success).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.resend.com/emails');

      const payload = JSON.parse(String(init.body));
      expect(payload.to).toBe('newbuyer@test.com');
      // Judul & isi jujur: pembayaran masuk, website BELUM online.
      expect(payload.subject).toContain('Pembayaran Terverifikasi');
      expect(payload.subject).toContain('Sedang Disiapkan');
      expect(payload.text).toContain('1×24 jam');
      expect(payload.text).toContain('WhatsApp');
      expect(payload.text).toContain('ORD-123');
      expect(payload.text).toContain('Rp 1.500.000');
      // TANPA link/tombol/URL website apa pun (tidak ada yang bisa dibuka).
      expect(payload.text).not.toMatch(/https?:\/\//);
      expect(payload.text).not.toContain('nanda-design');
      expect(payload.html).not.toContain('nanda-design');
      expect(payload.html).not.toContain('Buka Website Anda');
    });

    it('still reports activation as successful when the email provider fails', async () => {
      enableResend();
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('resend down')));
      mockSuccessfulActivation();

      const res = await activateOrder('ORD-123');

      expect(res.success).toBe(true);
      expect(res.message).toContain('Berhasil mengaktifkan');
      expect(res.siteId).toBeDefined();
    });

    it('does not call the provider when notifications are not configured', async () => {
      unsetEnv('NOTIFICATION_PROVIDER');
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', fetchMock);
      mockSuccessfulActivation();

      const res = await activateOrder('ORD-123');

      expect(res.success).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('activateOrder (tiket kerja bengkel)', () => {
    const savedEnv: Record<string, string | undefined> = {
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
      TELEGRAM_ADMIN_CHAT_ID: process.env.TELEGRAM_ADMIN_CHAT_ID,
      NOTIFICATION_PROVIDER: process.env.NOTIFICATION_PROVIDER,
      NOTIFICATION_API_KEY: process.env.NOTIFICATION_API_KEY,
      NOTIFICATION_DEFAULT_FROM: process.env.NOTIFICATION_DEFAULT_FROM,
    };

    afterEach(() => {
      vi.unstubAllGlobals();
      for (const [key, value] of Object.entries(savedEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });

    it('sends a workshop ticket to Telegram after activation', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'tg_test_token';
      process.env.TELEGRAM_ADMIN_CHAT_ID = '12345';
      unsetEnv('NOTIFICATION_PROVIDER');

      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', fetchMock);

      const order = {
        id: 'ORD-TKT',
        desired_slug: 'tiket-site',
        buyer_name: 'Nanda',
        buyer_email: 'nanda@test.com',
        buyer_whatsapp: '628123456789',
        payment_proof_url: 'https://proof.png',
        status: 'waiting_verification',
      };

      vi.mocked(cloudflareD1.queryD1)
        .mockResolvedValueOnce([order]) // lock order with UPDATE RETURNING
        .mockResolvedValueOnce([]) // update order activated
        .mockResolvedValueOnce([]); // insert audit_log

      const res = await activateOrder('ORD-TKT');

      expect(res.success).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.telegram.org/bottg_test_token/sendMessage');

      const payload = JSON.parse(String(init.body));
      expect(payload.chat_id).toBe('12345');
      expect(payload.parse_mode).toBe('HTML');
      expect(payload.text).toContain('TIKET KERJA');
      expect(payload.text).toContain('PENGELOLA_KLIEN.bat');
      // URL tiket = alamat masa depan klien (workers.dev), bukan rute tenant
      // di domain toko yang sudah dihapus.
      expect(payload.text).toContain('tiket-site.workers.dev');
      expect(payload.text).toContain('nanda@test.com');
    });

    it('still succeeds when Telegram is not configured', async () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_ADMIN_CHAT_ID;
      unsetEnv('NOTIFICATION_PROVIDER');

      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', fetchMock);

      const order = {
        id: 'ORD-NTG',
        desired_slug: 'tanpa-telegram',
        buyer_name: 'Nanda',
        buyer_email: 'nanda@test.com',
        buyer_whatsapp: '628123456789',
        payment_proof_url: 'https://proof.png',
        status: 'waiting_verification',
      };

      vi.mocked(cloudflareD1.queryD1)
        .mockResolvedValueOnce([order])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const res = await activateOrder('ORD-NTG');

      expect(res.success).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
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

  describe('reopenOrder', () => {
    it('reopens a canceled order into the verification queue and flags missing proof', async () => {
      vi.mocked(cloudflareD1.queryD1)
        .mockResolvedValueOnce([
          { id: 'ORD-RC', status: 'canceled', payment_proof_url: null },
        ]) // SELECT before reopen
        .mockResolvedValueOnce([
          { id: 'ORD-RC', status: 'waiting_verification', payment_proof_url: null },
        ]); // UPDATE ... RETURNING *

      const res = await reopenOrder('ORD-RC');

      expect(res.success).toBe(true);
      expect(res.message).toContain('upload ulang bukti');
      expect(res.order?.status).toBe('waiting_verification');

      const sqls = vi.mocked(cloudflareD1.queryD1).mock.calls.map(([sql]) => String(sql));
      expect(sqls[1]).toContain("SET status = 'waiting_verification'");
      expect(sqls[1]).toContain("'canceled', 'failed'");
    });

    it('refuses to reopen an activated order', async () => {
      vi.mocked(cloudflareD1.queryD1).mockResolvedValueOnce([
        { id: 'ORD-ACT', status: 'activated' },
      ]);

      const res = await reopenOrder('ORD-ACT');

      expect(res.success).toBe(false);
      expect(res.message).toContain('Status saat ini: activated');
      expect(vi.mocked(cloudflareD1.queryD1).mock.calls.length).toBe(1);
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

  describe('sweepExpiredOrders (notifikasi pembatalan otomatis 7 hari)', () => {
    const savedEnv: Record<string, string | undefined> = {
      NOTIFICATION_PROVIDER: process.env.NOTIFICATION_PROVIDER,
      NOTIFICATION_API_KEY: process.env.NOTIFICATION_API_KEY,
      NOTIFICATION_DEFAULT_FROM: process.env.NOTIFICATION_DEFAULT_FROM,
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
      TELEGRAM_ADMIN_CHAT_ID: process.env.TELEGRAM_ADMIN_CHAT_ID,
    };

    afterEach(() => {
      vi.unstubAllGlobals();
      for (const [key, value] of Object.entries(savedEnv)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });

    it('emails the buyer and alerts the admin with a reopen button when auto-cancel fires', async () => {
      process.env.NOTIFICATION_PROVIDER = 'resend';
      process.env.NOTIFICATION_API_KEY = 're_test_key';
      process.env.NOTIFICATION_DEFAULT_FROM = 'halo@example.com';
      process.env.TELEGRAM_BOT_TOKEN = 'tg_test_token';
      process.env.TELEGRAM_ADMIN_CHAT_ID = '111';

      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', fetchMock);

      vi.mocked(cloudflareD1.queryD1)
        .mockResolvedValueOnce([]) // guard select
        .mockResolvedValueOnce([]) // activating recovery
        .mockResolvedValueOnce([
          {
            id: 'ORD-AC',
            buyer_name: 'Budi',
            buyer_email: 'budi@test.com',
            desired_slug: 'budi-site',
          },
        ]) // 7-day auto-cancel UPDATE ... RETURNING
        .mockResolvedValueOnce([]) // stale pending select
        .mockResolvedValueOnce([]); // INSERT platform_settings guard

      await sweepExpiredOrders();

      const calls = fetchMock.mock.calls.map(([url, init]) => ({
        url: String(url),
        body: String((init as RequestInit | undefined)?.body || ''),
      }));

      const email = calls.find((c) => c.url === 'https://api.resend.com/emails');
      expect(email).toBeDefined();
      expect(email?.body).toContain('budi@test.com');
      expect(email?.body).toContain('Dibatalkan Otomatis');
      expect(email?.body).toContain('ORD-AC');

      const telegram = calls.find((c) => c.url.includes('api.telegram.org') && c.url.includes('sendMessage'));
      expect(telegram).toBeDefined();
      expect(telegram?.body).toContain('reopen_ORD-AC');
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
        payment_proof_url: null,
        status: 'waiting_verification',
      };

      vi.mocked(cloudflareD1.queryD1)
        .mockResolvedValueOnce([]) // expired -> waiting_verification update
        .mockResolvedValueOnce([order]) // lock order with UPDATE RETURNING
        .mockResolvedValueOnce([]) // update order activated
        .mockResolvedValueOnce([]); // insert audit_log

      const res = await activateOrder('ORD-LATE', { allowExpired: true, proofUrl: 'https://proof.png' });

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
