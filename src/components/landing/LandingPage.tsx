'use client';

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { formatIdr, BASE_PRICE } from '@/constants/pricing';
import ReelSection from './reel/ReelSection';
import TemplateModal from './reel/TemplateModal';
import { buildOrderHref, type ReelTemplate } from './reel/reelData';
import './landing.css';

/**
 * Penempatan tampilan harga di halaman jualan — ubah nilai di sini saja.
 * Nilai harga itself datang dari panel admin "Harga Jual" (D1), di-inject
 * server lewat props `basePrice`, jadi tidak perlu menyentuh kode sama sekali
 * untuk mengganti nominal.
 *
 * Catatan: footer sengaja TIDAK lagi memuat blok harga/CTA (permintaan owner
 * 2026-10-13) — footer hanya baris © tahun + link legal.
 */
const PRICE_PLACEMENT = {
  nav: true,
  modal: true,
} as const;

/**
 * Halaman jualan storefront. Harga (`basePrice`) dan nomor WhatsApp owner
 * (`adminWhatsapp`) di-inject server dari D1 (panel "Harga Jual") pada render
 * `/` mode storefront — tanpa fetch tambahan di sisi klien.
 *
 * Struktur: nav lengket → SATU section reel (3 demo live dalam iframe yang
 * bergerak & berombak saat scroll) → footer mini (© tahun + link legal).
 */
export default function LandingPage({
  basePrice = BASE_PRICE,
  adminWhatsapp = '',
}: {
  basePrice?: number;
  adminWhatsapp?: string;
}) {
  const [activeTemplate, setActiveTemplate] = useState<ReelTemplate | null>(null);
  const closeModal = useCallback(() => setActiveTemplate(null), []);

  const year = new Date().getFullYear();
  const orderHref = buildOrderHref(adminWhatsapp, undefined, basePrice);
  const opensInNewTab = orderHref.startsWith('https://');

  const orderLinkProps = opensInNewTab
    ? ({ target: '_blank', rel: 'noopener noreferrer' } as const)
    : {};

  return (
    <div className="landing">
      <nav className="landing-nav" aria-label="Navigasi utama">
        <Link href="/" className="landing-logo">
          Make it Better Studio
        </Link>
        <div className="landing-nav-actions">
          {PRICE_PLACEMENT.nav && (
            <span className="landing-nav-price">{formatIdr(basePrice)}</span>
          )}
          <a className="landing-btn landing-btn-sm" href={orderHref} {...orderLinkProps}>
            Pesan
          </a>
        </div>
      </nav>

      <main id="main-content">
        <ReelSection onSelect={setActiveTemplate} />

        <footer className="landing-footer">
          <div className="landing-footer-meta">
            <p>© {year} Make it Better Studio</p>
            <p className="landing-footer-links">
              <Link href="/syarat-ketentuan">Syarat &amp; Ketentuan</Link>
              <Link href="/kebijakan-privasi">Kebijakan Privasi</Link>
            </p>
          </div>
        </footer>
      </main>

      <TemplateModal
        template={activeTemplate}
        basePrice={basePrice}
        adminWhatsapp={adminWhatsapp}
        showPrice={PRICE_PLACEMENT.modal}
        onClose={closeModal}
      />
    </div>
  );
}
