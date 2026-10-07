import { cleanEnvVar } from '@/lib/utils/env';

/**
 * Pemilah deployment: situs penjual (storefront makeitbetter.my.id) vs
 * website klien.
 *
 * `STOREFRONT=true` hanya dipasang di `.env.local` owner sehingga ikut
 * ter-bake ke build owner. Build klien otomatis mengosongkan + membuangnya
 * dari `next-env.mjs` (fail-closed lewat `collectOwnerBlankKeys` dan
 * `rewriteNextEnvFile` di `scripts/onboarding/client-deploy.ts`), jadi nilai
 * ini tidak pernah bocor ke runtime klien.
 *
 * Default `false` = mode klien: arah gagal yang aman — salah konfigurasi
 * membuat situs tampil sebagai portofolio, tidak pernah membuka toko
 * (checkout/orders/billing) di website klien.
 */
export function isStorefrontDeployment(): boolean {
  return (cleanEnvVar('STOREFRONT') || '').toLowerCase() === 'true';
}
