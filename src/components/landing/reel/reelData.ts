import { formatIdr } from '@/constants/pricing';
import { getPublicBaseUrl } from '@/lib/constants';

export interface ReelTemplate {
  id: string;
  name: string;
  description: string;
  previewUrl: string;
}

/**
 * Tiga template yang tampil di reel halaman jualan. `previewUrl` memakai
 * route preview yang sudah ada (ISR 60 dtk) sehingga iframe tidak melakukan
 * render penuh per-request.
 */
export const REEL_TEMPLATES: readonly ReelTemplate[] = [
  {
    id: 'os-desktop',
    name: 'OS Desktop',
    description: 'Desktop simulator bergaya macOS — window system, dock, dan efek visual interaktif.',
    previewUrl: '/preview/os-desktop',
  },
  {
    id: 'infinite-canvas',
    name: 'Infinite Canvas',
    description: 'Kanvas tak terbatas — drag, zoom, dan jelajahi project dalam scattered cards.',
    previewUrl: '/preview/infinite-canvas',
  },
  {
    id: 'spatial-gallery',
    name: 'Spatial Gallery',
    description: 'Galeri 3D dengan curved grid dan orbital artwork dalam scene spatial.',
    previewUrl: '/preview/spatial-gallery',
  },
] as const;

/**
 * Membangun link tujuan tombol "Pesan".
 *
 * - Nomor WA tersedia → `wa.me` dengan pesan prefill (nama template + harga
 *   + link checkout supaya jalur order tetap tercatat bila pembeli memilih
 *   mengisi form sendiri).
 * - Nomor kosong → jatuh ke `/checkout` (alur order formal), jadi tombol
 *   tidak pernah menghasilkan link mati.
 */
export function buildOrderHref(
  adminWhatsapp: string,
  template?: ReelTemplate,
  price?: number
): string {
  const digits = (adminWhatsapp || '').replace(/\D/g, '');
  if (!digits) return '/checkout';

  const label = `template ${template ? template.name : 'portfolio'}${
    typeof price === 'number' ? ` (${formatIdr(price)})` : ''
  }`;
  const message = [
    `Halo Make it Better Studio, saya mau pesan ${label}.`,
    'Boleh dibantu? 🙏',
    `Isi form order mandiri (opsional): ${getPublicBaseUrl()}/checkout`,
  ].join('\n');

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
