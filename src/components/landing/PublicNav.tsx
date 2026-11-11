'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Nav storefront dengan pil geser (v1.3.81).
 *
 * Ketiga tautan lebarnya sama (104 px di desktop, `flex: 1 1 0` di HP) dan
 * indikator putih bergeser satu slot saat halaman aktif berpindah. Karena
 * komponen ini hidup di layout route group `(storefront)`, elemennya tidak
 * di-unmount saat pindah halaman — jadi transisi `transform` benar-benar
 * terlihat seperti slider, bukan lompatan.
 */

export const PUBLIC_NAV = [
  { href: '/fitur', label: 'Fitur' },
  { href: '/harga', label: 'Harga' },
  { href: '/cara-pesan', label: 'Cara Pesan' },
] as const;

export function PublicNav() {
  const pathname = usePathname();
  const activeIndex = PUBLIC_NAV.findIndex(
    (item) => pathname === item.href || pathname?.startsWith(`${item.href}/`),
  );

  return (
    <nav
      className="lp-nav-links"
      aria-label="Navigasi utama"
      style={{ '--lp-active': Math.max(activeIndex, 0) } as CSSProperties}
    >
      <span
        className={`lp-nav-indicator${activeIndex < 0 ? ' is-hidden' : ''}`}
        aria-hidden="true"
      />
      {PUBLIC_NAV.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`lp-nav-link${isActive ? ' is-active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
