/**
 * Harga dasar paket — sumber tunggal agar UI checkout dan billing service
 * selalu sinkron. Jangan hardcode 149000/299000 di tempat lain.
 */
export const PLAN_BASE_PRICES = {
  lite: 149000,
  pro: 299000,
} as const;

export type PlanKey = keyof typeof PLAN_BASE_PRICES;

export function formatIdr(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}
