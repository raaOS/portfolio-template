import type { ReactNode } from 'react';
import { PublicShell } from '@/components/landing/PublicChrome';

/**
 * Layout bersama halaman jualan (v1.3.81).
 *
 * Kenapa route group: nav berisi pil geser (indikator `translateX`). Animasi
 * geser hanya mungkin kalau elemen nav TETAP ter-mount saat pindah halaman.
 * Kalau `PublicShell` dirender per halaman (seperti sebelumnya), React
 * meng-unmount subtree halaman lama lalu mount yang baru — indikator langsung
 * "lompat", tanpa transisi.
 *
 * URL tidak berubah: `(storefront)` hanya pengelompokan.
 */
export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
