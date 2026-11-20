/**
 * Test mesin harga checkout multi-template (v1.3.93).
 *
 * Yang dijaga:
 * 1. Bundel memakai tier terbesar yang terpenuhi dan hanya dihitung sekali.
 * 2. Kupon & bundel TIDAK ditumpuk — dipakai yang lebih besar (seri → bundel).
 * 3. Total tidak pernah turun di bawah MIN_PAYABLE_TOTAL.
 * 4. Alokasi diskon per item selalu berjumlah tepat sama dengan total diskon.
 * 5. Input jahat (template ganda, harga negatif) tidak menggandakan diskon.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BUNDLE_TIERS,
  MIN_PAYABLE_TOTAL,
  computeCouponDiscount,
  computeQuote,
  generateCouponCode,
  normalizeBundleTiers,
  normalizeCouponCode,
  resolveBundlePercent,
  validateCouponDraft,
} from './checkoutPricing';

const price = 199_000;

function items(count: number) {
  const ids = ['os-desktop', 'infinite-canvas', 'spatial-gallery'];
  return ids.slice(0, count).map((templateId) => ({ templateId, listPrice: price }));
}

describe('computeQuote — bundel', () => {
  it('1 template: tanpa diskon', () => {
    const quote = computeQuote({ items: items(1) });
    expect(quote.itemCount).toBe(1);
    expect(quote.subtotal).toBe(price);
    expect(quote.appliedDiscount).toBe(0);
    expect(quote.appliedSource).toBe('none');
    expect(quote.total).toBe(price);
  });

  it('2 template: diskon 10%', () => {
    const quote = computeQuote({ items: items(2) });
    expect(quote.subtotal).toBe(price * 2);
    expect(quote.bundlePercent).toBe(10);
    expect(quote.appliedDiscount).toBe(39_800);
    expect(quote.appliedSource).toBe('bundle');
    expect(quote.total).toBe(358_200);
  });

  it('3 template: diskon 15%', () => {
    const quote = computeQuote({ items: items(3) });
    expect(quote.subtotal).toBe(price * 3);
    expect(quote.bundlePercent).toBe(15);
    expect(quote.total).toBe(507_450);
  });

  it('template ganda tidak menggandakan diskon bundel', () => {
    const duplicated = [
      { templateId: 'os-desktop', listPrice: price },
      { templateId: 'os-desktop', listPrice: price },
    ];
    const quote = computeQuote({ items: duplicated });
    expect(quote.itemCount).toBe(1);
    expect(quote.appliedDiscount).toBe(0);
  });

  it('harga negatif tidak menurunkan subtotal', () => {
    const quote = computeQuote({
      items: [
        { templateId: 'os-desktop', listPrice: -50_000 },
        { templateId: 'infinite-canvas', listPrice: price },
      ],
    });
    expect(quote.subtotal).toBe(price);
  });
});

describe('computeQuote — kupon best-of', () => {
  const tenPercentCoupon = {
    code: 'HEMAT10',
    kind: 'percent' as const,
    value: 10,
    minSubtotal: 0,
    maxDiscount: null,
    appliesTo: null,
  };

  it('kupon lebih besar dari bundel → kupon dipakai', () => {
    const quote = computeQuote({
      items: items(2),
      coupon: { ...tenPercentCoupon, value: 30 },
    });
    expect(quote.bundleDiscount).toBe(39_800);
    expect(quote.couponDiscount).toBe(119_400);
    expect(quote.appliedSource).toBe('coupon');
    expect(quote.total).toBe(price * 2 - 119_400);
  });

  it('kupon lebih kecil → bundel dipakai, kupon tidak mengurangi lagi', () => {
    const quote = computeQuote({
      items: items(2),
      coupon: { ...tenPercentCoupon, value: 5 },
    });
    expect(quote.bundleDiscount).toBe(39_800);
    expect(quote.couponDiscount).toBe(19_900);
    expect(quote.appliedSource).toBe('bundle');
    expect(quote.total).toBe(358_200);
  });

  it('seri → bundel dipakai (kuota kupon tidak terbakar)', () => {
    const quote = computeQuote({
      items: items(2),
      coupon: { ...tenPercentCoupon, value: 10 },
    });
    expect(quote.appliedSource).toBe('bundle');
    expect(quote.total).toBe(358_200);
  });

  it('minimal belanja tidak terpenuhi → kupon diabaikan', () => {
    const quote = computeQuote({
      items: items(1),
      coupon: { ...tenPercentCoupon, minSubtotal: 500_000 },
    });
    expect(quote.couponDiscount).toBe(0);
    expect(quote.appliedSource).toBe('none');
    expect(quote.total).toBe(price);
  });

  it('kupon hanya untuk template tertentu tidak memotong item lain', () => {
    const quote = computeQuote({
      items: items(3),
      coupon: {
        ...tenPercentCoupon,
        value: 50,
        appliesTo: ['spatial-gallery'],
      },
    });
    expect(quote.couponEligibleSubtotal).toBe(price);
    expect(quote.couponDiscount).toBe(99_500);
    // 50% dari 1 item (99.500) < bundel 15% dari 3 item (89.550)? Tidak:
    // 99.500 > 89.550 → kupon dipakai, tetapi hanya item spatial yang dipotong.
    expect(quote.appliedSource).toBe('coupon');
    const gallery = quote.items.find((item) => item.templateId === 'spatial-gallery');
    const desktop = quote.items.find((item) => item.templateId === 'os-desktop');
    expect(gallery?.discount).toBe(99_500);
    expect(desktop?.discount).toBe(0);
  });

  it('maxDiscount membatasi potongan persen', () => {
    const quote = computeQuote({
      items: items(3),
      coupon: { ...tenPercentCoupon, value: 90, maxDiscount: 50_000 },
    });
    expect(quote.couponDiscount).toBe(50_000);
  });
});

describe('computeQuote — batas bawah', () => {
  it('diskon tidak membuat total di bawah Rp1.000', () => {
    const quote = computeQuote({
      items: [{ templateId: 'os-desktop', listPrice: 100_000 }],
      bundleTiers: [],
      coupon: {
        code: 'GRATIS',
        kind: 'fixed',
        value: 100_000,
        minSubtotal: 0,
        maxDiscount: null,
        appliesTo: null,
      },
    });
    expect(quote.total).toBe(MIN_PAYABLE_TOTAL);
    expect(quote.appliedDiscount).toBe(99_000);
  });

  it('subtotal di bawah Rp1.000 tidak didiskon', () => {
    const quote = computeQuote({
      items: [{ templateId: 'os-desktop', listPrice: 500 }],
      bundleTiers: [],
      coupon: {
        code: 'GRATIS',
        kind: 'fixed',
        value: 100_000,
        minSubtotal: 0,
        maxDiscount: null,
        appliesTo: null,
      },
    });
    expect(quote.total).toBe(500);
    expect(quote.appliedDiscount).toBe(0);
  });
});

describe('computeQuote — alokasi per item', () => {
  it('jumlah diskon item selalu sama dengan total diskon', () => {
    const quote = computeQuote({
      items: [
        { templateId: 'os-desktop', listPrice: price },
        { templateId: 'infinite-canvas', listPrice: price },
        { templateId: 'spatial-gallery', listPrice: price },
      ],
      coupon: {
        code: 'GANJIL',
        kind: 'fixed',
        value: 33_333,
        minSubtotal: 0,
        maxDiscount: null,
        appliesTo: null,
      },
    });
    const totalItemDiscount = quote.items.reduce((sum, item) => sum + item.discount, 0);
    expect(totalItemDiscount).toBe(quote.appliedDiscount);
    expect(quote.items.reduce((sum, item) => sum + item.finalPrice, 0)).toBe(quote.total);
  });
});

describe('normalizeBundleTiers', () => {
  it('mengurutkan tier dan menerima input valid', () => {
    const result = normalizeBundleTiers([
      { minItems: 4, percent: 20 },
      { minItems: 2, percent: 5 },
    ]);
    expect(result.valid).toBe(true);
    expect(result.tiers?.map((tier) => tier.minItems)).toEqual([2, 4]);
  });

  it('menolak persen di atas batas aman', () => {
    const result = normalizeBundleTiers([{ minItems: 2, percent: 80 }]);
    expect(result.valid).toBe(false);
  });

  it('menolak tier ganda', () => {
    const result = normalizeBundleTiers([
      { minItems: 2, percent: 10 },
      { minItems: 2, percent: 15 },
    ]);
    expect(result.valid).toBe(false);
  });

  it('null → default owner (10% / 15%)', () => {
    const result = normalizeBundleTiers(null);
    expect(result.tiers).toEqual(DEFAULT_BUNDLE_TIERS.slice().sort((a, b) => a.minItems - b.minItems));
  });
});

describe('resolveBundlePercent', () => {
  it('memakai tier terbesar yang terpenuhi', () => {
    expect(resolveBundlePercent(DEFAULT_BUNDLE_TIERS, 1)).toBe(0);
    expect(resolveBundlePercent(DEFAULT_BUNDLE_TIERS, 2)).toBe(10);
    expect(resolveBundlePercent(DEFAULT_BUNDLE_TIERS, 3)).toBe(15);
    expect(resolveBundlePercent(DEFAULT_BUNDLE_TIERS, 9)).toBe(15);
  });
});

describe('normalisasi kode & validasi draft kupon', () => {
  it('kode dinormalisasi uppercase dan simbol aneh dibuang', () => {
    expect(normalizeCouponCode(' hemat10! ')).toBe('HEMAT10');
  });

  it('generateCouponCode selalu valid dan berawalan prefix', () => {
    for (let i = 0; i < 20; i += 1) {
      const code = generateCouponCode('PROMO');
      expect(code.startsWith('PROMO-')).toBe(true);
      expect(normalizeCouponCode(code)).toBe(code);
      expect(masterRegex().test(code)).toBe(true);
    }
  });

  it('menolak persen di atas 90', () => {
    const result = validateCouponDraft({
      code: 'X',
      kind: 'percent',
      value: 100,
    });
    expect(result.valid).toBe(false);
  });

  it('menolak kode terlalu pendek', () => {
    const result = validateCouponDraft({ code: 'AB', kind: 'percent', value: 10 });
    expect(result.valid).toBe(false);
  });

  it('menerima kupon persen valid', () => {
    const result = validateCouponDraft({
      code: 'hemat25',
      kind: 'percent',
      value: 25,
      minSubtotal: 199_000,
      maxDiscount: 100_000,
      appliesTo: ['os-desktop', 'os-desktop'],
    });
    expect(result.valid).toBe(true);
    expect(result.value?.code).toBe('HEMAT25');
    expect(result.value?.appliesTo).toEqual(['os-desktop']);
  });

  it('appliesTo kosong berarti semua template', () => {
    const result = validateCouponDraft({
      code: 'ALL',
      kind: 'fixed',
      value: 10_000,
      appliesTo: [],
    });
    expect(result.value?.appliesTo).toBeNull();
  });
});

describe('computeCouponDiscount', () => {
  it('mengembalikan null bila tidak ada item yang cocok', () => {
    expect(
      computeCouponDiscount(items(2), {
        code: 'X',
        kind: 'percent',
        value: 10,
        minSubtotal: 0,
        maxDiscount: null,
        appliesTo: ['template-tidak-ada'],
      })
    ).toBeNull();
  });
});

function masterRegex() {
  return /^[A-Z0-9][A-Z0-9_-]{2,31}$/;
}
