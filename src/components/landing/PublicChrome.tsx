import Link from 'next/link';
import type { ReactNode } from 'react';
import { archivoBlack } from '@/app/fonts';
import { isStorefrontDeployment } from '@/lib/storefront';
import { PublicNav } from './PublicNav';
import './public-pages.css';

/**
 * Chrome bersama halaman publik storefront (v1.3.80).
 *
 * Kenapa dipisah dari `LandingPage`: halaman `/` adalah hero WebGL satu layar
 * (`height: 100svh; overflow: hidden`) sehingga tidak punya ruang untuk section
 * jualan. Halaman Fitur / Harga / Cara Pesan / Panduan / legal adalah rute
 * biasa yang bisa di-scroll — semuanya memakai nav + footer yang sama di sini.
 *
 * v1.3.81: nav pindah ke `PublicNav` (client, pil geser `usePathname`) dan
 * dirender oleh layout `src/app/(storefront)/layout.tsx` supaya tidak
 * ter-unmount saat pindah halaman. Halaman legal tetap memakai shell ini
 * langsung dan bisa diakses di situs klien — karena itu tautan jualan
 * (nav + footer toko) disembunyikan saat deployment bukan storefront.
 */

const CONTACT_EMAIL = 'm4keitbetter@gmail.com';

interface PublicShellProps {
  children: ReactNode;
}

export function PublicShell({ children }: PublicShellProps) {
  const year = new Date().getFullYear();
  const storefront = isStorefrontDeployment();

  return (
    <div className={`lp-shell ${archivoBlack.variable}`}>
      <header className="lp-nav">
        <Link href="/" className="lp-brand">
          <span className="lp-brand-dot" aria-hidden="true" />
          Make it Better Studio
        </Link>

        {storefront && <PublicNav />}
      </header>

      <main className="lp-main">{children}</main>

      <footer className="lp-footer">
        <span>© {year} Make it Better Studio</span>
        {storefront && (
          <>
            <Link href="/fitur">Fitur</Link>
            <Link href="/harga">Harga</Link>
            <Link href="/cara-pesan">Cara Pesan</Link>
            <Link href="/panduan">Panduan Klien</Link>
          </>
        )}
        <Link href="/syarat-ketentuan">Syarat &amp; Ketentuan</Link>
        <Link href="/kebijakan-privasi">Kebijakan Privasi</Link>
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </footer>
    </div>
  );
}
