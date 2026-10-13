'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { BASE_PRICE } from '@/constants/pricing';
import { archivoBlack } from '@/app/fonts';
import { TEMPLATES_DATA, type TemplateItem } from './templates';
import LiveStage from './LiveStage';
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
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <main className={`wave-landing-viewport ${archivoBlack.variable}`}>
      {/* Satu h1 tetap ada untuk SEO/a11y, disembunyikan secara visual —
          hero besar & hub bawah sudah dihapus atas permintaan owner. */}
      <h1 className="sr-only">PORTFOLIO OS</h1>

      {/*
        Panggung demo live (satu-satunya konten utama): tiga iframe preview
        template menghadap lurus depan — kartu tengah besar (demo aktif),
        dua kartu samping mengecil & redup. Geraknya ambient float +
        parallax + tukar posisi FLIP-spring (LiveStage). Klik kartu tengah
        → popup detail; klik kartu samping → tukar demo.
      */}
      <div className="wave-stage">
        <LiveStage
          items={TEMPLATES_DATA.map((tpl) => ({
            id: tpl.id,
            name: tpl.name,
            src: tpl.previewUrl,
          }))}
          activeIndex={activeIndex}
          onActiveChange={setActiveIndex}
          onActivate={(index) => setSelectedTemplate(TEMPLATES_DATA[index])}
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
