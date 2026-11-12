'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Grid, Menu, X } from 'lucide-react';
import { archivoBlack } from '@/app/fonts';
import { TEMPLATES_DATA } from './templates';
import MagazineShowcase from './MagazineShowcase';
import './landing.css';

/**
 * Homepage storefront. Panggung hero = koridor majalah WebGL
 * (MagazineShowcase): koridor luncur → berhenti → lembaran terdekat
 * terangkat → DEMO LIVE sungguhan tayang di atasnya (bisa scroll/klik;
 * ✕/Esc menutup; v1.3.48 tanpa popup — lembarannya sendiri yang live).
 *
 * `heroVideos` (v1.3.49): peta { id template → URL video preview } dari D1
 * (panel admin "Video Hero", owner-only). Slot tanpa entry = gambar
 * screenshot statis (v1.3.53: video default bawaan tidak lagi ikut
 * tampil — hanya rekaman upload yang beranimasi).
 *
 * `heroPosters` (v1.3.57): peta { id template → URL foto poster otomatis }
 * — 1 frame dari rekaman yang diupload (diekstrak browser saat upload).
 * Poster menggantikan `src` (gambar STATIS lembaran) pada slot ber-video:
 * selagi video buffer (koneksi lambat) / reduced-motion, pengunjung melihat
 * frame videonya sendiri — bukan screenshot lama. `previewUrl` (tautan
 * demo live) TIDAK disentuh.
 */
const PUBLIC_LINKS = [
  { href: '/fitur', label: 'Fitur' },
  { href: '/harga', label: 'Harga' },
  { href: '/cara-pesan', label: 'Cara Pesan' },
] as const;

export default function LandingPage({
  heroVideos,
  heroPosters,
}: {
  heroVideos?: Record<string, string>;
  heroPosters?: Record<string, string>;
}) {
  const [bgPattern, setBgPattern] = useState<'grid' | 'dots'>('dots');
  const [menuOpen, setMenuOpen] = useState(false);
  /* v1.3.83 — tab yang barusan diklik. Di `/` tidak ada tab yang "aktif"
     (hero bukan salah satu halaman jualan), jadi pil penanda baru muncul
     setelah tab diketuk lalu meluncur ke tab itu sebelum navigasi selesai. */
  const [tabIndex, setTabIndex] = useState<number | null>(null);

  return (
    <main
      className={`wave-landing-viewport ${archivoBlack.variable} pattern-${bgPattern}`}
    >
      {/* Satu h1 tetap ada untuk SEO/a11y, disembunyikan secara visual —
          hero besar & hub bawah sudah dihapus atas permintaan owner. */}
      <h1 className="sr-only">PORTFOLIO OS</h1>

      <div className="mag-stage">
        <MagazineShowcase
          images={TEMPLATES_DATA.map((tpl) => ({
            // v1.3.57 — auto-poster: foto frame rekaman menggantikan
            // screenshot statis pada slot yang punya rekaman.
            src: heroPosters?.[tpl.id] || tpl.screenshot,
            alt: tpl.name,
            previewUrl: tpl.previewUrl,
            previewVideo: heroVideos?.[tpl.id],
          }))}
        />
      </div>

      {/* Floating Top Navbar */}
      <header className="wave-nav-floating">
        <Link href="/" className="wave-brand">
          <span className="wave-brand-dot" />
          <span className="wave-brand-title">Make it Better Studio</span>
        </Link>

        {/* Menu jualan — hanya tampil di desktop; di HP pindah ke sheet burger.
            Ketiga tab lebarnya sama (104 px) dan pil putih bergeser saat tab
            diketuk — sama seperti nav halaman Fitur/Harga/Cara Pesan. */}
        <nav
          className={`wave-nav-links${tabIndex === null ? ' is-idle' : ''}`}
          aria-label="Menu storefront"
          style={{ '--wave-active': tabIndex ?? 0 } as React.CSSProperties}
        >
          <span className="wave-nav-indicator" aria-hidden="true" />
          {PUBLIC_LINKS.map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              className={`wave-nav-link${tabIndex === index ? ' is-active' : ''}`}
              onClick={() => setTabIndex(index)}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="wave-nav-right">
          <div className="wave-nav-center">
            <div
              className={`wave-pattern-switcher is-${bgPattern}`}
              role="group"
              aria-label="Pilih background pattern"
              translate="no"
            >
              {/* Sliding Pill Indicator */}
              <span className="wave-pattern-indicator" aria-hidden="true" />

              <button
                type="button"
                onClick={() => setBgPattern('dots')}
                className={`wave-pattern-btn ${bgPattern === 'dots' ? 'active' : ''}`}
                title="Dot Pattern"
              >
                <span className="wave-pattern-dot-icon" />
                <span>Dot</span>
              </button>
              <button
                type="button"
                onClick={() => setBgPattern('grid')}
                className={`wave-pattern-btn ${bgPattern === 'grid' ? 'active' : ''}`}
                title="Grid Pattern"
              >
                <Grid size={11} />
                <span>Grid</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            className="wave-nav-burger"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="wave-nav-sheet"
            aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {/* Sheet menu HP — daftar tautan yang sama dengan nav desktop. */}
      {menuOpen && (
        <nav id="wave-nav-sheet" className="wave-nav-sheet" aria-label="Menu storefront">
          {PUBLIC_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="wave-nav-sheet-link"
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </main>
  );
}
