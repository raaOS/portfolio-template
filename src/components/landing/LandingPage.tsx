'use client';

import React, { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { formatIdr, BASE_PRICE } from '@/constants/plans';
import { motion, useInView, useScroll, useTransform } from 'motion/react';
import LivingDesktop from './LivingDesktop';
import './landing.css';

const MARQUEE_WORKS = [
  { src: '/assets/projects/manipulasi-foto-musik-alam.jpg', label: 'Manipulasi Musik' },
  { src: '/assets/projects/tipografi-mekar-gotik.jpg', label: 'Tipografi Mekar' },
  { src: '/assets/projects/pastoral-kawanan-berhalo.jpg', label: 'Pastoral' },
  { src: '/assets/projects/kaleidoskop-tipografi-gradien.jpg', label: 'Kaleidoskop' },
  { src: '/assets/projects/belenggu-sandal-surgawi.jpg', label: 'Belenggu Sandal' },
  { src: '/assets/projects/efek-poster-bunga-berkerut.jpg', label: 'Poster Bunga' },
  { src: '/assets/projects/seni-poster-flatiron-neon.jpg', label: 'Flatiron Neon' },
  { src: '/assets/projects/overlay-bunga-barok-digital.jpg', label: 'Bunga Barok' },
];

const PAINS = [
  {
    emoji: '🗄️',
    title: 'Domain menganggur 2 tahun?',
    body: 'Kamu bukan tidak bisa bikin. Kamu cuma tidak pernah punya waktu untuk menyelesaikannya. Sekarang tinggal serahkan fotomu — sisanya kami yang urus.',
  },
  {
    emoji: '🎨',
    title: 'Portofolio PDF itu sudah mati',
    body: 'Klien tidak lagi membuka PDF 20 halaman. Mereka menilai dari 8 detik pertama di layar. Beri mereka sesuatu yang diingat.',
  },
  {
    emoji: '🧱',
    title: 'Template biasa = terlihat biasa',
    body: 'Grid-kecepatkan-template di mana-mana. Kalau kamu berdiri sama dengan ribuan orang, kamu tidak berdiri.',
  },
];

const BENEFITS = [
  {
    icon: '⚡',
    title: '48 jam jadi',
    body: 'Kamu kirim foto + bio, kami pasang semuanya. Domain, hosting, konten — semua beres dalam 2 hari.',
    detail: 'Bukan 2 minggu "nyusul deh".',
  },
  {
    icon: '🖊️',
    title: 'Ganti isi dalam 2 menit',
    body: 'Login ke ruang admin bergaya macOS — klik project, ganti foto, tulis deskripsi, selesai. Tanpa sentuh kode.',
    detail: 'Serius. Sekarang coba sendiri di demo di atas.',
  },
  {
    icon: '🤖',
    title: 'Asisten AI bantu menulis',
    body: 'Mati gaya menulis deskripsi karya? Asisten AI di dalam admin bantu menyusun kalimat yang menjual.',
    detail: 'Gemini, OpenAI, atau provider pilihanmu.',
  },
  {
    icon: '🎬',
    title: 'Video 4K? Langsung upload',
    body: 'Rekaman karya beresolusi tinggi masuk apa adanya — dikompresi otomatis di browser, web tetap ngebut.',
    detail: 'Tidak ada "file terlalu besar" lagi.',
  },
  {
    icon: '🛡️',
    title: 'Dipelihara, bukan ditinggal',
    body: 'Bug diperbaiki, fitur baru mengalir. Kamu tidak membeli file yang beku — kamu membeli produk yang hidup.',
    detail: 'Pembaruan otomatis, data tetap aman.',
  },
  {
    icon: '🇮🇩',
    title: 'Support bahasa manusia',
    body: 'Ada kendala? Chat WhatsApp, dijawab orang — bukan bot, bukan ticket number, bukan forum luar negeri.',
    detail: 'Waktu respons < 24 jam.',
  },
];

const CHATS = [
  { from: 'them', text: 'bro ini beneran website lo bikin?? 😭 keren parah' },
  { from: 'me', text: 'hehe iya. sekali buka langsung ada yang chat" gini di WA' },
  { from: 'them', text: 'gila client gw kemarin nanya "website lo pake jasa mana"' },
  { from: 'me', text: 'dan itu baru 3 hari online 👀' },
];

function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function WhatsAppChat() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    CHATS.forEach((_, idx) => {
      timers.push(
        setTimeout(() => {
          setShown(idx + 1);
        }, 600 + idx * 900)
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [inView]);

  return (
    <div ref={ref} className="lp-chat" role="img" aria-label="Cuplikan percakapan WhatsApp tentang portofolio">
      <div className="lp-chat-header">💬 WhatsApp — 21:42</div>
      <div className="lp-chat-body">
        {CHATS.slice(0, shown).map((c, i) => (
          <motion.div
            key={i}
            className={`lp-bubble ${c.from === 'me' ? 'lp-bubble-me' : 'lp-bubble-them'}`}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
          >
            {c.text}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const year = new Date().getFullYear();
  const priceRef = useRef<HTMLDivElement>(null);
  const priceInView = useInView(priceRef, { once: true, margin: '-40px' });
  const [priceCount, setPriceCount] = useState(0);

  // Spotlight cursor tracking for benefit cards (CSS-driven, no re-render).
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const card = (e.target as HTMLElement).closest?.('[data-spotlight]') as HTMLElement | null;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
      card.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
    };
    window.addEventListener('mousemove', handler, { passive: true });
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  // Price count-up
  useEffect(() => {
    if (!priceInView) return;
    const start = performance.now();
    const duration = 1200;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      setPriceCount(Math.round(BASE_PRICE * e));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [priceInView]);

  // Hero parallax tilt on scroll
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.92]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.9], [1, 0.35]);
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 60]);

  return (
    <div className="landing">
      {/* ============ NAV ============ */}
      <nav className="landing-nav">
        <Link href="/" className="landing-logo">
          <span className="landing-logo-dot" aria-hidden />
          makeitbetter<span className="landing-logo-accent">.studio</span>
        </Link>
        <div className="landing-nav-actions">
          <Link href="/preview/os-desktop" className="landing-nav-link">
            Lihat Demo
          </Link>
          <Link href="#harga" className="landing-nav-cta">
            Pesan — {formatIdr(BASE_PRICE)}
          </Link>
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <header className="landing-hero" ref={heroRef} id="main-content">
        <motion.div className="landing-hero-copy" style={{ opacity: heroOpacity, y: heroY }}>
          <Reveal>
            <h1 className="landing-h1">
              Portofolio yang bikin
              <br />
              <span className="landing-h1-grad">klien ingat kamu.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="landing-sub">
              Website portofolio interaktif bergaya macOS desktop — fotomu, karyamu, ceritamu.
              Aktif dalam <strong>48 jam</strong>, tanpa kamu menyentuh satu baris kode.
            </p>
          </Reveal>
          <Reveal delay={0.22}>
            <div className="landing-hero-ctas">
              <Link href="/preview/os-desktop" className="landing-btn landing-btn-primary">
                Coba Demonya Sekarang →
              </Link>
              <Link href="#harga" className="landing-btn landing-btn-ghost">
                Lihat Harga
              </Link>
            </div>
          </Reveal>
        </motion.div>

        {/* THE LIVING DESKTOP */}
        <motion.div className="landing-stage-wrap" style={{ scale: heroScale }}>
          <LivingDesktop />
        </motion.div>

        <p className="landing-hint-caption">
          ↑ Itu bukan video. Gerakkan kursormu di atasnya — dia akan berhenti dan menyerahkan kendali padamu.
        </p>
      </header>

      {/* ============ MARQUEE KARYA ============ */}
      <section className="landing-marquee-section" aria-label="Contoh karya">
        <div className="landing-marquee-mask">
          <div className="landing-marquee">
            {[...MARQUEE_WORKS, ...MARQUEE_WORKS].map((w, i) => (
              <figure key={i} className="landing-marquee-item">
                <img src={w.src} alt={w.label} loading="lazy" />
                <figcaption>{w.label}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PAIN ============ */}
      <section className="landing-pains">
        <Reveal>
          <h2 className="landing-section-title">Kenapa belum punya website?</h2>
        </Reveal>
        <p className="landing-section-sub">Jawaban jujurnya mungkin salah satu dari ini:</p>
        <div className="landing-pains-grid">
          {PAINS.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.08}>
              <div className="landing-pain-card">
                <span className="landing-pain-emoji" aria-hidden>{p.emoji}</span>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============ BENEFITS (spotlight) ============ */}
      <section className="landing-benefits">
        <Reveal>
          <h2 className="landing-section-title">
            Yang kamu dapat <span className="landing-title-amp">bukan cuma file.</span>
          </h2>
        </Reveal>
        <p className="landing-section-sub">
          Ini produk yang hidup — dan kamu tidak sendirian setelah beli.
        </p>
        <div className="landing-benefits-grid">
          {BENEFITS.map((b, i) => (
            <Reveal key={b.title} delay={(i % 3) * 0.08}>
              <article className="landing-benefit-card" data-spotlight>
                <span className="landing-benefit-icon" aria-hidden>{b.icon}</span>
                <h3>{b.title}</h3>
                <p>{b.body}</p>
                <p className="landing-benefit-detail">{b.detail}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============ TESTIMONI CHAT ============ */}
      <section className="landing-proof">
        <div className="landing-proof-grid">
          <Reveal>
            <div className="landing-proof-copy">
              <h2 className="landing-section-title landing-align-start">
                3 hari online,
                <br />
                pesan masuk duluan.
              </h2>
              <p className="landing-section-sub landing-align-start">
                Efek paling nyata dari portofolio interaktif: orang <em>mengetik
                pesan duluan</em> sebelum kamu jualan apa pun. Karena mereka
                sudah terhibur sejak klik pertama.
              </p>
              <Link href="/preview/os-desktop" className="landing-btn landing-btn-primary">
                Lihat kenapa — buka demo
              </Link>
            </div>
          </Reveal>
          <Reveal delay={0.15}>
            <WhatsAppChat />
          </Reveal>
        </div>
      </section>

      {/* ============ PRICING ============ */}
      <section className="landing-pricing" id="harga" ref={priceRef}>
        <Reveal>
          <p className="landing-price-label">Sekali bayar, milik selamanya</p>
          <p className="landing-price">{formatIdr(priceCount)}</p>
          <ul className="landing-price-list">
            <li>✅ Website aktif dalam 48 jam — domain, hosting, konten pertama dimasukkan</li>
            <li>✅ Ruang admin macOS — ganti foto & tulisan kapan saja, 2 menit</li>
            <li>✅ Asisten AI penulis deskripsi karya</li>
            <li>✅ Pembaruan versi otomatis — bugfix & fitur baru, gratis</li>
            <li>✅ Support WhatsApp bahasa manusia</li>
          </ul>
          <Link href="/checkout" className="landing-btn landing-btn-primary landing-btn-big">
            Pesan Sekarang — {formatIdr(BASE_PRICE)}
          </Link>
          <p className="landing-price-note">
            Belum yakin? Main dulu demonya 5 menit. Kalau tidak jualan sendiri ke dirimu, jangan beli.
          </p>
        </Reveal>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <span className="landing-logo">
            <span className="landing-logo-dot" aria-hidden />
            makeitbetter<span className="landing-logo-accent">.studio</span>
          </span>
          <span>&copy; {year} — dibuat dengan template yang sedang kamu lihat</span>
        </div>
      </footer>
    </div>
  );
}
