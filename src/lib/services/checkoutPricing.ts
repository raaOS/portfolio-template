/**
 * Mesin harga checkout multi-template (v1.3.93).
 *
 * Aturan bisnis yang dikunci owner (2026-11-19):
 * - Satu checkout = SATU order + SATU pembayaran QRIS, boleh berisi beberapa
 *   template. Bukan satu order per template (index `orders(amount)` unik untuk
 *   status aktif membuat itu mustahil tanpa dua nominal berbeda).
 * - Harga per template sama (harga dasar dari panel Harga Jual).
 * - Diskon bundel otomatis: 2 template → 10%, 3+ → 15% (bisa diubah owner).
 * - Kupon dan bundel TIDAK ditumpuk: dipakai yang lebih besar (best-of).
 * - Total yang harus dibayar tidak boleh di bawah Rp1.000. Gratis sepenuhnya
 *   tetap lewat aktivasi gratis portal owner, bukan kupon 100%.
 *
 * Modul ini murni (tanpa D1/jaringan) supaya bisa diuji unit dan dipakai
 * bersama oleh endpoint quote, createOrder, dan panel admin.
 */

export const MIN_PAYABLE_TOTAL = 1_000;

/** Batas aman diskon bundel agar salah ketik tidak menjual gratis. */
export const MAX_BUNDLE_PERCENT = 50;
export const MAX_BUNDLE_TIERS = 5;
export const MIN_BUNDLE_ITEMS = 2;

export interface BundleTier {
  /** Jumlah template minimal agar diskon berlaku (>= 2). */
  minItems: number;
  /** Persentase diskon dari subtotal (1–50). */
  percent: number;
}

/** Default keputusan owner: 2 template 10%, 3 template 15%. */
export const DEFAULT_BUNDLE_TIERS: BundleTier[] = [
  { minItems: 3, percent: 15 },
  { minItems: 2, percent: 10 },
];

export type CouponKind = 'percent' | 'fixed';

/** Aturan kupon yang dibutuhkan mesin harga (bukan seluruh baris D1). */
export interface CouponRule {
  code: string;
  kind: CouponKind;
  /** Persen (1–90) untuk `percent`, rupiah untuk `fixed`. */
  value: number;
  minSubtotal: number;
  /** Batas maksimum potongan rupiah; null = tanpa batas. */
  maxDiscount: number | null;
  /** Daftar template yang memenuhi syarat; null = semua template. */
  appliesTo: string[] | null;
}

export interface QuoteItem {
  templateId: string;
  listPrice: number;
}

export type DiscountSource = 'none' | 'bundle' | 'coupon';

export interface QuoteItemResult extends QuoteItem {
  discount: number;
  finalPrice: number;
}

export interface QuoteResult {
  items: QuoteItemResult[];
  itemCount: number;
  subtotal: number;
  bundlePercent: number;
  bundleDiscount: number;
  couponDiscount: number;
  /** Diskon yang benar-benar dipakai (best-of, tidak ditumpuk). */
  appliedDiscount: number;
  appliedSource: DiscountSource;
  /** Subtotal item yang memenuhi syarat kupon (0 bila tanpa kupon). */
  couponEligibleSubtotal: number;
  total: number;
}

/** Normalisasi kode kupon: trim, uppercase, hanya A–Z 0–9 _ dan -. */
export function normalizeCouponCode(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

export function isValidCouponCode(code: string): boolean {
  return /^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code);
}

/**
 * Generator kode kupon acak yang mudah dibaca/diketik (tanpa 0/O/1/I).
 * `crypto` dipakai bila tersedia (Node 18+/Worker); fallback Math.random
 * hanya untuk lingkungan uji tanpa Web Crypto.
 */
export function generateCouponCode(prefix = 'HEMAT', length = 5): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const cleanPrefix = normalizeCouponCode(prefix).slice(0, 12) || 'HEMAT';
  let suffix = '';
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
  const bytes = new Uint8Array(length);
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < length; i += 1) {
    suffix += alphabet[bytes[i] % alphabet.length];
  }
  return `${cleanPrefix}-${suffix}`;
}

/**
 * Validasi daftar tier bundel. Mengembalikan daftar terurut (minItems naik)
 * atau error yang bisa ditampilkan ke owner.
 */
export function normalizeBundleTiers(
  raw: unknown
): { valid: boolean; tiers?: BundleTier[]; error?: string } {
  if (raw === null || raw === undefined) {
    return { valid: true, tiers: [...DEFAULT_BUNDLE_TIERS].sort((a, b) => a.minItems - b.minItems) };
  }
  if (!Array.isArray(raw)) {
    return { valid: false, error: 'Diskon bundel harus berupa daftar tier.' };
  }
  if (raw.length === 0) {
    return { valid: true, tiers: [] };
  }
  if (raw.length > MAX_BUNDLE_TIERS) {
    return { valid: false, error: `Maksimal ${MAX_BUNDLE_TIERS} tier diskon bundel.` };
  }

  const tiers: BundleTier[] = [];
  const seen = new Set<number>();
  for (const entry of raw) {
    const minItems = Number((entry as BundleTier)?.minItems);
    const percent = Number((entry as BundleTier)?.percent);
    if (!Number.isInteger(minItems) || minItems < MIN_BUNDLE_ITEMS || minItems > 10) {
      return { valid: false, error: 'Jumlah template pada tier harus bilangan bulat 2–10.' };
    }
    if (!Number.isInteger(percent) || percent < 1 || percent > MAX_BUNDLE_PERCENT) {
      return {
        valid: false,
        error: `Persentase diskon harus bilangan bulat 1–${MAX_BUNDLE_PERCENT}.`,
      };
    }
    if (seen.has(minItems)) {
      return { valid: false, error: `Tier untuk ${minItems} template ditulis lebih dari sekali.` };
    }
    seen.add(minItems);
    tiers.push({ minItems, percent });
  }

  tiers.sort((a, b) => a.minItems - b.minItems);
  return { valid: true, tiers };
}

/** Tier dengan `minItems` terbesar yang masih terpenuhi; 0 bila tidak ada. */
export function resolveBundlePercent(tiers: BundleTier[], itemCount: number): number {
  let percent = 0;
  for (const tier of tiers) {
    if (itemCount >= tier.minItems && tier.percent > percent) percent = tier.percent;
  }
  return percent;
}

/** Validasi draft kupon (dipakai API admin) — murni, tanpa D1. */
export function validateCouponDraft(
  raw: unknown
): { valid: boolean; error?: string; value?: CouponRule } {
  const input = (raw || {}) as Partial<CouponRule> & Record<string, unknown>;
  const code = normalizeCouponCode(input.code);
  if (!isValidCouponCode(code)) {
    return {
      valid: false,
      error: 'Kode kupon 3–32 karakter: huruf A–Z, angka 0–9, garis bawah, atau tanda hubung.',
    };
  }

  const kind: CouponKind = input.kind === 'fixed' ? 'fixed' : 'percent';
  const value = Number(input.value);
  if (!Number.isInteger(value)) {
    return { valid: false, error: 'Nilai kupon harus bilangan bulat (tanpa desimal).' };
  }
  if (kind === 'percent' && (value < 1 || value > 90)) {
    return { valid: false, error: 'Kupon persen harus 1–90.' };
  }
  if (kind === 'fixed' && (value < 1_000 || value > 50_000_000)) {
    return { valid: false, error: 'Kupon nominal harus Rp1.000–Rp50.000.000.' };
  }

  const minSubtotal = Number(input.minSubtotal ?? 0);
  if (!Number.isInteger(minSubtotal) || minSubtotal < 0 || minSubtotal > 50_000_000) {
    return { valid: false, error: 'Minimal belanja harus 0–Rp50.000.000.' };
  }

  const rawMax = input.maxDiscount;
  const maxDiscount =
    rawMax === null || rawMax === undefined || rawMax === ('' as unknown)
      ? null
      : Number(rawMax);
  if (
    maxDiscount !== null &&
    (!Number.isInteger(maxDiscount) || maxDiscount < 1 || maxDiscount > 50_000_000)
  ) {
    return { valid: false, error: 'Maksimal potongan harus Rp1–Rp50.000.000 atau kosong.' };
  }

  const appliesToRaw = input.appliesTo;
  let appliesTo: string[] | null = null;
  if (Array.isArray(appliesToRaw) && appliesToRaw.length > 0) {
    appliesTo = Array.from(
      new Set(appliesToRaw.map((id) => String(id).trim()).filter(Boolean))
    );
  }

  return {
    valid: true,
    value: { code, kind, value, minSubtotal, maxDiscount, appliesTo },
  };
}

/**
 * Hitung potongan kupon terhadap item yang memenuhi syarat.
 * `null` berarti kupon tidak bisa dipakai (minimal belanja tidak tercapai
 * atau tidak ada item yang cocok).
 */
export function computeCouponDiscount(
  items: QuoteItem[],
  coupon: CouponRule
): { discount: number; eligibleSubtotal: number } | null {
  const eligible = coupon.appliesTo
    ? items.filter((item) => coupon.appliesTo!.includes(item.templateId))
    : items;

  if (eligible.length === 0) return null;

  const eligibleSubtotal = eligible.reduce((sum, item) => sum + item.listPrice, 0);
  if (eligibleSubtotal < coupon.minSubtotal) return null;

  const raw =
    coupon.kind === 'percent'
      ? Math.floor((eligibleSubtotal * coupon.value) / 100)
      : coupon.value;
  const capped = coupon.maxDiscount === null ? raw : Math.min(raw, coupon.maxDiscount);

  return {
    discount: Math.max(0, Math.min(capped, eligibleSubtotal)),
    eligibleSubtotal,
  };
}

/**
 * Alokasi potongan ke tiap item secara proporsional (metode sisa terbesar)
 * supaya `order_items.discount_amount` selalu berjumlah tepat sama dengan
 * total potongan order. Item yang tidak memenuhi syarat kupon mendapat 0
 * bila potongan berasal dari kupon.
 */
function allocateDiscount(
  items: QuoteItem[],
  discount: number,
  eligibleIds: Set<string> | null
): number[] {
  const result = items.map(() => 0);
  if (discount <= 0) return result;

  const indexes = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !eligibleIds || eligibleIds.has(item.templateId));
  const base = indexes.reduce((sum, { item }) => sum + item.listPrice, 0);
  if (base <= 0) return result;

  let allocated = 0;
  const remainders: Array<{ index: number; remainder: number }> = [];
  for (const { item, index } of indexes) {
    const exact = (discount * item.listPrice) / base;
    const floor = Math.floor(exact);
    result[index] = floor;
    allocated += floor;
    remainders.push({ index, remainder: exact - floor });
  }

  remainders.sort((a, b) => b.remainder - a.remainder);
  let leftover = discount - allocated;
  for (let i = 0; i < remainders.length && leftover > 0; i += 1) {
    const target = remainders[i].index;
    if (result[target] < items[target].listPrice) {
      result[target] += 1;
      leftover -= 1;
    }
  }
  return result;
}

/**
 * Hitung total checkout. Diskon bundel dan kupon dibandingkan, lalu hanya
 * yang terbesar yang dipakai. Total yang harus dibayar tidak pernah di bawah
 * `MIN_PAYABLE_TOTAL` selama subtotal mencukupi.
 */
export function computeQuote(
  input: {
    items: QuoteItem[];
    bundleTiers?: BundleTier[];
    coupon?: CouponRule | null;
  }
): QuoteResult {
  // Dedupe berdasarkan templateId — pembeli tidak bisa memilih template yang
  // sama dua kali untuk menggandakan diskon bundel.
  const seen = new Set<string>();
  const items = input.items
    .filter((item) => {
      if (!item.templateId || seen.has(item.templateId)) return false;
      seen.add(item.templateId);
      return true;
    })
    .map((item) => ({
      templateId: item.templateId,
      listPrice: Math.max(0, Math.floor(item.listPrice)),
    }));

  const subtotal = items.reduce((sum, item) => sum + item.listPrice, 0);
  const tiers = normalizeBundleTiers(input.bundleTiers ?? DEFAULT_BUNDLE_TIERS).tiers ?? [];
  const bundlePercent = resolveBundlePercent(tiers, items.length);
  const bundleDiscount = Math.floor((subtotal * bundlePercent) / 100);

  let couponDiscount = 0;
  let couponEligibleSubtotal = 0;
  let couponEligibleIds: Set<string> | null = null;
  if (input.coupon) {
    const evaluation = computeCouponDiscount(items, input.coupon);
    if (evaluation) {
      couponDiscount = evaluation.discount;
      couponEligibleSubtotal = evaluation.eligibleSubtotal;
      couponEligibleIds = new Set(
        input.coupon.appliesTo
          ? items
              .filter((item) => input.coupon!.appliesTo!.includes(item.templateId))
              .map((item) => item.templateId)
          : items.map((item) => item.templateId)
      );
    }
  }

  // Best-of: kupon hanya dipakai bila BENAR-BENAR lebih besar; seri → bundel
  // (agar kuota kupon tidak terbakar tanpa manfaat tambahan bagi pembeli).
  const useCoupon = couponDiscount > bundleDiscount;
  let appliedDiscount = useCoupon ? couponDiscount : bundleDiscount;
  const appliedSource: DiscountSource = useCoupon
    ? 'coupon'
    : bundleDiscount > 0
      ? 'bundle'
      : 'none';

  // Batas bawah total: kupon/bundel tidak boleh membuat order di bawah
  // Rp1.000 (pembayaran QRIS perlu nominal yang bisa dicocokkan).
  if (subtotal >= MIN_PAYABLE_TOTAL) {
    appliedDiscount = Math.min(appliedDiscount, subtotal - MIN_PAYABLE_TOTAL);
  } else {
    appliedDiscount = 0;
  }

  const total = subtotal - appliedDiscount;
  const allocations = allocateDiscount(
    items,
    appliedDiscount,
    appliedSource === 'coupon' ? couponEligibleIds : null
  );

  return {
    items: items.map((item, index) => ({
      ...item,
      discount: allocations[index],
      finalPrice: item.listPrice - allocations[index],
    })),
    itemCount: items.length,
    subtotal,
    bundlePercent,
    bundleDiscount,
    couponDiscount,
    appliedDiscount,
    appliedSource,
    couponEligibleSubtotal,
    total,
  };
}
