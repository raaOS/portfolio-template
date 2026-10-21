'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight, Sparkles } from 'lucide-react';
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
export default function LandingPage({
  heroVideos,
  heroPosters,
}: {
  heroVideos?: Record<string, string>;
  heroPosters?: Record<string, string>;
}) {
  return (
    <main className={`wave-landing-viewport ${archivoBlack.variable}`}>
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

        <div className="wave-nav-center">
          <div className="wave-badge-pill">
            <Sparkles size={13} className="text-[#0008FF]" />
            <span>Interactive 3D Portfolio OS</span>
          </div>
        </div>

        <div className="wave-nav-actions">
          <Link href="/checkout" className="wave-nav-cta">
            <span>Pesan Template</span>
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </header>
    </main>
  );
}
