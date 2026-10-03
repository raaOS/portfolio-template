/**
 * Harga dasar — sumber tunggal agar UI checkout dan billing service
 * selalu sinkron.
 */
export const BASE_PRICE = 199000;

export function formatIdr(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}
