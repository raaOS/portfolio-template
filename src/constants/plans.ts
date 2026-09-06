/**
 * Harga dasar — sumber tunggal agar UI checkout dan billing service
 * selalu sinkron.
 */
export const BASE_PRICE = 199000;

/** @deprecated Use BASE_PRICE instead */
export const PLAN_BASE_PRICES = {
  lite: BASE_PRICE,
  pro: BASE_PRICE,
} as const;

/** @deprecated */
export type PlanKey = keyof typeof PLAN_BASE_PRICES;

export function formatIdr(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}
