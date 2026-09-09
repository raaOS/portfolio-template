'use client';

import React from 'react';
import Link from 'next/link';
import { formatIdr, BASE_PRICE } from '@/constants/plans';
import './landing.css';

const TEMPLATES = [
  {
    id: 'os-desktop',
    name: 'OS Desktop',
    description:
      'Desktop simulator bergaya macOS — window system, dock, menu bar, dan efek visual interaktif.',
    previewUrl: '/preview/os-desktop',
    href: '/preview/os-desktop',
  },
  {
    id: 'infinite-canvas',
    name: 'Infinite Canvas',
    description:
      'Kanvas tak terbatas — drag, zoom, dan jelajahi project dalam tampilan scattered cards.',
    previewUrl: '/preview/infinite-canvas',
    href: '/preview/infinite-canvas',
  },
];

const FEATURES = [
  {
    title: 'Admin Panel',
    description:
      'Dashboard lengkap untuk kelola project, profil, pengalaman, skill, dan testimoni.',
  },
  {
    title: 'AI Assistant',
    description:
      'Chatbot terintegrasi yang mendukung Gemini, OpenAI, OpenRouter, Groq, dan provider custom.',
  },
  {
    title: 'Media Pipeline',
    description:
      'Upload langsung ke Cloudflare R2 dengan kompresi video WASM dan optimasi gambar otomatis.',
  },
];

export default function LandingPage() {
  const year = new Date().getFullYear();

  return (
    <div className="landing">
      {/* Nav */}
      <nav className="landing-nav">
        <Link href="/" className="landing-logo">
          Make it Better Studio
        </Link>
      </nav>

      {/* Hero */}
      <section className="landing-hero" id="main-content">
        <h1>Template portfolio interaktif yang siap pakai</h1>
        <p>
          Dua pilihan template — deploy ke Cloudflare, kelola lewat admin panel,
          sesuaikan sesuka hati.
        </p>
      </section>

      {/* Template Showcase */}
      <section className="landing-templates">
        {TEMPLATES.map((tpl) => (
          <article key={tpl.id} className="landing-card">
            <div className="landing-card-preview">
              <iframe
                src={tpl.previewUrl}
                title={`Preview ${tpl.name}`}
                className="landing-card-iframe"
                loading="lazy"
              />
            </div>
            <div className="landing-card-body">
              <h2>{tpl.name}</h2>
              <p>{tpl.description}</p>
              <Link
                href={tpl.href}
                target="_blank"
                rel="noopener noreferrer"
                className="landing-card-link"
              >
                Live Preview
              </Link>
            </div>
          </article>
        ))}
      </section>

      {/* Features */}
      <section className="landing-features">
        <h2 className="landing-features-heading">Fitur Utama</h2>
        <div className="landing-features-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="landing-feature">
              <h3>{f.title}</h3>
              <p>{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing CTA */}
      <section className="landing-cta">
        <hr className="landing-cta-divider" />
        <p className="landing-price-label">Harga template</p>
        <p className="landing-price">{formatIdr(BASE_PRICE)}</p>
        <p className="landing-price-note">
          Sekali bayar — termasuk source code, admin panel, dan setup Cloudflare.
        </p>
        <Link href="/checkout" className="landing-btn">
          Pesan Sekarang
        </Link>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>&copy; {year} Make it Better Studio</p>
      </footer>
    </div>
  );
}
