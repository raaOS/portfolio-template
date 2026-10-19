'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { BASE_PRICE } from '@/constants/pricing';
import { archivoBlack } from '@/app/fonts';
import { TEMPLATES_DATA, type TemplateItem } from './templates';
import MagazineShowcase from './MagazineShowcase';
import { TemplateDetailModal } from './TemplateDetailModal';
import './landing.css';

interface LandingPageProps {
  basePrice?: number;
  adminWhatsapp?: string;
}

export default function LandingPage({
  basePrice = BASE_PRICE,
  adminWhatsapp,
}: LandingPageProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);

  return (
    <main className={`wave-landing-viewport ${archivoBlack.variable}`}>
      {/* Satu h1 tetap ada untuk SEO/a11y, disembunyikan secara visual —
          hero besar & hub bawah sudah dihapus atas permintaan owner. */}
      <h1 className="sr-only">PORTFOLIO OS</h1>

      {/*
        Panggung majalah (MagazineShowcase, pengganti LiveStage v1.3.47):
        koridor lembaran WebGL berisi tangkapan layar 3 template yang
        berjalan tanpa henti — drag/geser menjelajah, ketuk lembaran →
        terangkat → popup detail (iframe LIVE interaktif, v1.3.41).
        Ringan: 3 gambar ±102 KB, tanpa 3 iframe live (±4,7 MB) di hero.
      */}
      <div className="mag-stage">
        <MagazineShowcase
          images={TEMPLATES_DATA.map((tpl) => ({
            src: tpl.screenshot,
            alt: tpl.name,
          }))}
          onSheetActivate={(index) => setSelectedTemplate(TEMPLATES_DATA[index])}
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

      {/* Popup Dialog saat Template Diklik */}
      <TemplateDetailModal
        template={selectedTemplate}
        basePrice={basePrice}
        adminWhatsapp={adminWhatsapp}
        onClose={() => setSelectedTemplate(null)}
      />
    </main>
  );
}
