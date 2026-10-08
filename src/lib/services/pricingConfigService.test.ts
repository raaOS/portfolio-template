/**
 * Test pricingConfigService (PK4) — harga jual di D1 dengan fallback aman.
 *
 * Yang dijaga:
 * 1. `getBasePrice()` TIDAK PERNAH melempar & selalu jatuh ke `BASE_PRICE`
 *    saat data kosong/rusak/D1 mati (halaman jualan/checkout tidak boleh
 *    gagal render karena harga).
 * 2. `updateBasePrice()` menolak nilai di luar guardrail tanpa menyentuh D1.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/cloudflareD1', () => ({
  queryD1: vi.fn(),
}));

import { queryD1 } from '@/lib/cloudflareD1';
import { BASE_PRICE } from '@/constants/pricing';
import {
  clearBasePriceCache,
  getBasePrice,
  updateBasePrice,
  validateBasePrice
} from './pricingConfigService';

const queryMock = vi.mocked(queryD1);

beforeEach(() => {
  vi.clearAllMocks();
  clearBasePriceCache();
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
