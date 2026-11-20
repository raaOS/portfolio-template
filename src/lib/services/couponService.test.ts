/**
 * Test couponService (v1.3.93).
 *
 * Yang dijaga:
 * 1. Validasi input admin menolak kupon mustahil (persen >90, tanggal terbalik,
 *    kuota negatif) tanpa menyentuh D1.
 * 2. Status kupon menghormati arsip, jadwal, dan jam.
 * 3. Reservasi kuota memakai SATU statement atomik (INSERT ... SELECT ... WHERE
 *    COUNT < kuota), bukan SELECT lalu INSERT.
 * 4. Reservasi hanya dianggap sukses bila baris order benar-benar tertulis.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/cloudflareD1', () => ({
  queryD1: vi.fn(),
}));

import { queryD1 } from '@/lib/cloudflareD1';
import {
  PUBLIC_COUPON_ERROR,
  evaluateCoupon,
  getCouponStatus,
  reserveCouponRedemption,
  validateCouponInput,
  type CouponRecord,
} from './couponService';

const queryMock = vi.mocked(queryD1);

function coupon(overrides: Partial<CouponRecord> = {}): CouponRecord {
  return {
    id: 'cpn-1',
    code: 'HEMAT10',
    kind: 'percent',
    value: 10,
    min_subtotal: 0,
    max_discount: null,
    applies_to: null,
    starts_at: null,
    ends_at: null,
    max_redemptions: 10,
    max_per_email: null,
    is_active: 1,
    note: null,
    archived_at: null,
    created_at: '2026-11-19T00:00:00.000Z',
    updated_at: '2026-11-19T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('validateCouponInput', () => {
  it('menolak kode kosong', () => {
    const result = validateCouponInput({ code: '', kind: 'percent', value: 10 });
    expect(result.valid).toBe(false);
  });

  it('menolak persen di atas 90', () => {
    const result = validateCouponInput({ code: 'BIG', kind: 'percent', value: 95 });
    expect(result.valid).toBe(false);
  });

  it('menolak tanggal berakhir sebelum tanggal mulai', () => {
    const result = validateCouponInput({
      code: 'TIME',
      kind: 'percent',
      value: 10,
      startsAt: '2026-12-01T00:00:00.000Z',
      endsAt: '2026-11-01T00:00:00.000Z',
    });
    expect(result.valid).toBe(false);
  });

  it('menolak kuota negatif', () => {
    const result = validateCouponInput({
      code: 'NEG',
      kind: 'percent',
      value: 10,
      maxRedemptions: -5,
    });
    expect(result.valid).toBe(false);
  });

  it('menerima input valid dan menormalkan kode', () => {
    const result = validateCouponInput({
      code: ' hemat25 ',
      kind: 'percent',
      value: 25,
      startsAt: '2026-11-01T00:00:00.000Z',
      endsAt: '2026-12-01T00:00:00.000Z',
      maxRedemptions: 100,
    });
    expect(result.valid).toBe(true);
    expect(result.value?.code).toBe('HEMAT25');
    expect(result.value?.startsAt).toBe('2026-11-01T00:00:00.000Z');
  });
});

describe('getCouponStatus', () => {
  it('menolak kupon yang diarsipkan', () => {
    expect(getCouponStatus(coupon({ archived_at: '2026-11-01T00:00:00.000Z' })).usable).toBe(false);
  });

  it('menolak kupon nonaktif', () => {
    expect(getCouponStatus(coupon({ is_active: 0 })).usable).toBe(false);
  });

  it('menolak kupon yang belum mulai', () => {
    const status = getCouponStatus(
      coupon({ starts_at: '2026-12-01T00:00:00.000Z' }),
      new Date('2026-11-19T00:00:00.000Z')
    );
    expect(status.usable).toBe(false);
  });

  it('menolak kupon yang sudah berakhir', () => {
    const status = getCouponStatus(
      coupon({ ends_at: '2026-11-01T00:00:00.000Z' }),
      new Date('2026-11-19T00:00:00.000Z')
    );
    expect(status.usable).toBe(false);
  });

  it('menerima kupon aktif dalam jadwal', () => {
    expect(getCouponStatus(coupon(), new Date('2026-11-19T00:00:00.000Z')).usable).toBe(true);
  });
});

describe('evaluateCoupon', () => {
  const items = [{ templateId: 'os-desktop', listPrice: 199_000 }];

  it('mengembalikan alasan generik untuk kode tidak dikenal', async () => {
    queryMock.mockResolvedValueOnce([]);
    const result = await evaluateCoupon('TIDAKADA', items);
    expect(result.usable).toBe(false);
    expect(result.reason).toBe(PUBLIC_COUPON_ERROR);
  });

  it('menghitung potongan persen yang valid', async () => {
    queryMock.mockResolvedValueOnce([coupon()]);
    const result = await evaluateCoupon('hemat10', items);
    expect(result.usable).toBe(true);
    expect(result.discount).toBe(19_900);
    expect(result.rule?.code).toBe('HEMAT10');
  });

  it('menolak bila minimal belanja tidak tercapai', async () => {
    queryMock.mockResolvedValueOnce([coupon({ min_subtotal: 500_000 })]);
    const result = await evaluateCoupon('HEMAT10', items);
    expect(result.usable).toBe(false);
  });
});

describe('reserveCouponRedemption', () => {
  it('memakai satu statement atomik dengan subquery COUNT', async () => {
    queryMock
      .mockResolvedValueOnce([]) // INSERT ... SELECT
      .mockResolvedValueOnce([{ id: 'red-1' }]); // verifikasi baris

    const ok = await reserveCouponRedemption(coupon(), {
      orderId: 'ORD-1',
      buyerEmail: 'Buyer@Example.com',
      discount: 19_900,
    });

    expect(ok).toBe(true);
    const insertSql = String(queryMock.mock.calls[0][0]);
    // `OR IGNORE` membuat pemanggilan ulang untuk order yang sama (reopen)
    // idempoten, tanpa melonggarkan pengecekan kuota di WHERE.
    expect(insertSql).toContain('INSERT OR IGNORE INTO coupon_redemptions');
    expect(insertSql).toContain('SELECT COUNT(*) FROM coupon_redemptions');
    expect(insertSql).toContain('LOWER(buyer_email)');
    // Email dinormalkan lowercase agar batas per-email tidak bisa diakali.
    expect(queryMock.mock.calls[0][1]).toContain('buyer@example.com');
  });

  it('gagal bila baris order tidak tertulis (kuota penuh)', async () => {
    queryMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const ok = await reserveCouponRedemption(coupon(), {
      orderId: 'ORD-2',
      buyerEmail: 'buyer@example.com',
      discount: 19_900,
    });
    expect(ok).toBe(false);
  });
});
