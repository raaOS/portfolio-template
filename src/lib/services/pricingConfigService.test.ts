/**
 * Test pricingConfigService (PK4) — harga jual di D1 dengan fallback aman.
 *
 * Yang dijaga:
 * 1. `getBasePrice()` TIDAK PERNAH melempar & selalu jatuh ke `BASE_PRICE`
 *    saat data kosong/rusak/D1 mati (halaman jualan/checkout tidak boleh
 *    gagal render karena harga).
 * 2. `updateBasePrice()` menolak nilai di luar guardrail tanpa menyentuh D1.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/cloudflareD1', () => ({
  queryD1: vi.fn(),
}));

import { queryD1 } from '@/lib/cloudflareD1';
import { BASE_PRICE } from '@/constants/pricing';
import {
  clearBasePriceCache,
  clearOwnerWhatsappCache,
  getBasePrice,
  getOwnerWhatsapp,
  normalizeWhatsappNumber,
  updateBasePrice,
  updateOwnerWhatsapp,
  validateBasePrice
} from './pricingConfigService';

const queryMock = vi.mocked(queryD1);

beforeEach(() => {
  vi.clearAllMocks();
  clearBasePriceCache();
  clearOwnerWhatsappCache();
});

describe('getBasePrice', () => {
  it('mengembalikan harga tersimpan saat valid', async () => {
    queryMock.mockResolvedValueOnce([{ value: JSON.stringify({ basePrice: 250000 }) }]);

    await expect(getBasePrice()).resolves.toBe(250000);
  });

  it('membaca key base_price_idr dengan fallback key lama pricing_config', async () => {
    queryMock.mockResolvedValueOnce([{ value: JSON.stringify({ basePrice: 300000 }) }]);

    await expect(getBasePrice()).resolves.toBe(300000);

    const [sql, params] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(String(sql)).toContain('platform_settings');
    expect(params).toContain('base_price_idr');
    expect(params).toContain('pricing_config');
  });

  it('cache 60 detik: query D1 hanya sekali sampai cache dibersihkan', async () => {
    queryMock.mockResolvedValueOnce([{ value: JSON.stringify({ basePrice: 250000 }) }]);

    await expect(getBasePrice()).resolves.toBe(250000);
    await expect(getBasePrice()).resolves.toBe(250000);

    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('updateBasePrice membersihkan cache sehingga harga baru terbaca langsung', async () => {
    queryMock.mockResolvedValueOnce([{ value: JSON.stringify({ basePrice: 250000 }) }]);
    await expect(getBasePrice()).resolves.toBe(250000);

    queryMock.mockResolvedValueOnce([]); // upsert
    await expect(updateBasePrice(400000)).resolves.toMatchObject({
      success: true,
      basePrice: 400000
    });

    queryMock.mockResolvedValueOnce([{ value: JSON.stringify({ basePrice: 400000 }) }]);
    await expect(getBasePrice()).resolves.toBe(400000);
  });

  it('fallback BASE_PRICE saat key belum pernah disimpan', async () => {
    queryMock.mockResolvedValueOnce([]);

    await expect(getBasePrice()).resolves.toBe(BASE_PRICE);
  });

  it('fallback BASE_PRICE saat JSON tersimpan rusak', async () => {
    queryMock.mockResolvedValueOnce([{ value: 'bukan-json{' }]);

    await expect(getBasePrice()).resolves.toBe(BASE_PRICE);
  });

  it('fallback BASE_PRICE saat nilai tersimpan di luar guardrail', async () => {
    queryMock.mockResolvedValueOnce([{ value: JSON.stringify({ basePrice: 199 }) }]);

    await expect(getBasePrice()).resolves.toBe(BASE_PRICE);
  });

  it('fallback BASE_PRICE saat query D1 gagal (tidak melempar)', async () => {
    queryMock.mockRejectedValueOnce(new Error('D1 down'));

    await expect(getBasePrice()).resolves.toBe(BASE_PRICE);
  });
});

describe('validateBasePrice', () => {
  it('menerima bilangan bulat dalam guardrail Rp50.000–Rp50.000.000', () => {
    expect(validateBasePrice(199000)).toEqual({ valid: true, value: 199000 });
    expect(validateBasePrice('250000')).toEqual({ valid: true, value: 250000 });
    expect(validateBasePrice(50_000)).toEqual({ valid: true, value: 50_000 });
    expect(validateBasePrice(50_000_000)).toEqual({ valid: true, value: 50_000_000 });
  });

  it('menolak di bawah Rp50.000, di atas Rp50.000.000, desimal, dan non-angka', () => {
    expect(validateBasePrice(49_999).valid).toBe(false);
    expect(validateBasePrice(50_000_001).valid).toBe(false);
    expect(validateBasePrice(199000.5).valid).toBe(false);
    expect(validateBasePrice('murah').valid).toBe(false);
    expect(validateBasePrice(undefined).valid).toBe(false);
  });
});

describe('updateBasePrice', () => {
  it('menolak nilai invalid tanpa menulis D1', async () => {
    const result = await updateBasePrice(999);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Rp');
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('menyimpan harga valid via upsert ke platform_settings', async () => {
    queryMock.mockResolvedValueOnce([]);

    const result = await updateBasePrice(249000);

    expect(result.success).toBe(true);
    expect(result.basePrice).toBe(249000);

    const [sql, params] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO platform_settings');
    expect(sql).toContain('ON CONFLICT(key)');
    expect((params as string[])[0]).toBe('base_price_idr');
    expect(String(params[1])).toContain('"basePrice":249000');
  });

  it('mengembalikan error saat D1 menolak tulis (tidak melempar)', async () => {
    queryMock.mockRejectedValueOnce(new Error('disk penuh'));

    const result = await updateBasePrice(249000);

    expect(result.success).toBe(false);
    expect(result.error).toContain('disk penuh');
  });
});

// ── Nomor WhatsApp owner ──────────────────────────────────────────────────

describe('normalizeWhatsappNumber', () => {
  it('membuang pemformatan dan menyimpan digit saja', () => {
    expect(normalizeWhatsappNumber('+62 812-3456-7890')).toEqual({
      valid: true,
      value: '6281234567890',
    });
    expect(normalizeWhatsappNumber('6281234567890')).toEqual({
      valid: true,
      value: '6281234567890',
    });
  });

  it('menganggap nilai kosong/bukan-angka sebagai nomor yang dikosongkan (sah)', () => {
    expect(normalizeWhatsappNumber('')).toEqual({ valid: true, value: '' });
    expect(normalizeWhatsappNumber(undefined)).toEqual({ valid: true, value: '' });
    expect(normalizeWhatsappNumber('abc')).toEqual({ valid: true, value: '' });
  });

  it('menolak nomor di luar 8–15 digit', () => {
    expect(normalizeWhatsappNumber('1234567').valid).toBe(false);
    expect(normalizeWhatsappNumber('1'.repeat(16)).valid).toBe(false);
  });
});

describe('getOwnerWhatsapp', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('membaca key owner_whatsapp dengan nomor dinormalkan ke digit', async () => {
    vi.stubEnv('NEXT_PUBLIC_ADMIN_WA', '');
    queryMock.mockResolvedValueOnce([
      { value: JSON.stringify({ number: '+62 812-3456-7890' }) },
    ]);

    await expect(getOwnerWhatsapp()).resolves.toBe('6281234567890');

    const [sql, params] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(String(sql)).toContain('platform_settings');
    expect(params).toContain('owner_whatsapp');
  });

  it('jatuh ke env NEXT_PUBLIC_ADMIN_WA saat D1 kosong', async () => {
    vi.stubEnv('NEXT_PUBLIC_ADMIN_WA', '+62 899-000-111');
    queryMock.mockResolvedValueOnce([]);

    await expect(getOwnerWhatsapp()).resolves.toBe('62899000111');
  });

  it('jatuh ke env saat query D1 gagal (tidak melempar)', async () => {
    vi.stubEnv('NEXT_PUBLIC_ADMIN_WA', '628111122233');
    queryMock.mockRejectedValueOnce(new Error('D1 down'));

    await expect(getOwnerWhatsapp()).resolves.toBe('628111122233');
  });

  it('mengembalikan string kosong bila nomor belum pernah disimpan', async () => {
    vi.stubEnv('NEXT_PUBLIC_ADMIN_WA', '');
    queryMock.mockResolvedValueOnce([]);

    await expect(getOwnerWhatsapp()).resolves.toBe('');
  });

  it('cache 60 detik: query D1 hanya sekali sampai cache dibersihkan', async () => {
    vi.stubEnv('NEXT_PUBLIC_ADMIN_WA', '');
    queryMock.mockResolvedValueOnce([{ value: JSON.stringify({ number: '6281234567890' }) }]);

    await expect(getOwnerWhatsapp()).resolves.toBe('6281234567890');
    await expect(getOwnerWhatsapp()).resolves.toBe('6281234567890');

    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});

describe('updateOwnerWhatsapp', () => {
  it('menolak nomor invalid tanpa menulis D1', async () => {
    const result = await updateOwnerWhatsapp('123');

    expect(result.success).toBe(false);
    expect(result.error).toContain('digit');
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('menyimpan nomor valid via upsert ke platform_settings', async () => {
    queryMock.mockResolvedValueOnce([]);

    const result = await updateOwnerWhatsapp('+62 812-3456-7890');

    expect(result).toEqual({ success: true, adminWhatsapp: '6281234567890' });

    const [sql, params] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO platform_settings');
    expect(sql).toContain('ON CONFLICT(key)');
    expect((params as string[])[0]).toBe('owner_whatsapp');
  });

  it('membersihkan cache sehingga nomor baru langsung terbaca', async () => {
    queryMock.mockResolvedValueOnce([{ value: JSON.stringify({ number: '6281234567890' }) }]);
    await expect(getOwnerWhatsapp()).resolves.toBe('6281234567890');

    queryMock.mockResolvedValueOnce([]); // upsert
    await updateOwnerWhatsapp('628999888777');

    queryMock.mockResolvedValueOnce([{ value: JSON.stringify({ number: '628999888777' }) }]);
    await expect(getOwnerWhatsapp()).resolves.toBe('628999888777');
  });

  it('mengembalikan error saat D1 menolak tulis (tidak melempar)', async () => {
    queryMock.mockRejectedValueOnce(new Error('disk penuh'));

    const result = await updateOwnerWhatsapp('6281234567890');

    expect(result.success).toBe(false);
    expect(result.error).toContain('disk penuh');
  });
});
