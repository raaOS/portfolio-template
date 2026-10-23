'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { REEL_TEMPLATES, type ReelTemplate } from './reelData';
import { useReelMotion } from './useReelMotion';

interface ReelSectionProps {
  onSelect: (template: ReelTemplate) => void;
}

/**
 * Satu-satunya section utama halaman jualan: pita tiga demo template dalam
 * iframe yang mengalir horizontal dalam gelombang melengkung mengikuti
 * kecepatan scroll — siluet kartu ikut melengkung (clip-path + garis tepi SVG
 * ditulis hook `useReelMotion` tiap frame).
 *
 * - `iframesReady` dijaga IntersectionObserver (lewat `useReelMotion`) supaya
 *   tiga iframe live baru di-mount setelah section terlihat — beban berat tidak
 *   bersaing dengan paint pertama halaman.
 * - Layout gerak (kartu absolut, pita sticky) dan layout fallback
 *   `prefers-reduced-motion` (baris kartu statis) sepenuhnya diatur CSS.
 */
export default function ReelSection({ onSelect }: ReelSectionProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const counterRef = useRef<HTMLSpanElement>(null);
  const [iframesReady, setIframesReady] = useState(false);
  const [showHint, setShowHint] = useState(true);

  const handleFirstVisible = useCallback(() => setIframesReady(true), []);

  useReelMotion({
    stageRef,
    itemRefs,
    counterRef,
    count: REEL_TEMPLATES.length,
    onFirstVisible: handleFirstVisible,
  });

  // Petunjuk "gulir" disembunyikan setelah pengunjung benar-benar scroll.
  useEffect(() => {
    if (!showHint) return;
    const handleScroll = () => {
      if (window.scrollY > 40) setShowHint(false);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [showHint]);

  return (
    <section className="reel" aria-labelledby="reel-title">
      <div className="reel-stage" ref={stageRef}>
        <header className="reel-head">
          <h1 id="reel-title">Template portfolio interaktif yang siap pakai</h1>
          <p>
            Tiga pilihan template — deploy ke Cloudflare, kelola lewat admin panel,
            sesuaikan sesuka hati. Gulir untuk menelusuri, klik kartu untuk detail.
          </p>
        </header>

        <div className="reel-track">
          {REEL_TEMPLATES.map((template, index) => (
            <article
              key={template.id}
              className="reel-item"
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
            >
              <div className="reel-card">
                <div className="reel-frame">
                  {iframesReady && (
                    <iframe
                      src={template.previewUrl}
                      title={`Demo template ${template.name}`}
                      className="reel-iframe"
                      loading="lazy"
                    />
                  )}
                  <button
                    type="button"
                    className="reel-open"
                    onClick={() => onSelect(template)}
                    aria-label={`Lihat detail template ${template.name}`}
                  />
                  {/*
                    Garis tepi kartu. Digambar sebagai SVG (bukan border CSS)
                    karena siluet kartu melengkung mengikuti gelombang — hook
                    useReelMotion menulis `d` path ini tiap frame, sekaligus
                    menjadi `clip-path` isi kartu supaya tepinya presisi.
                  */}
                  <svg className="reel-edge" aria-hidden="true" focusable="false">
                    <path />
                  </svg>
                </div>
              </div>
              <p className="reel-caption">
                <span className="reel-caption-index">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="reel-caption-name">{template.name}</span>
                <span className="reel-caption-desc">{template.description}</span>
              </p>
            </article>
          ))}
        </div>

        <div className="reel-foot">
          <span className="reel-hint" data-hidden={!showHint} aria-hidden={!showHint}>
            Gulir untuk menelusuri ↓
          </span>
          <span className="reel-counter">
            <span ref={counterRef}>01 / 03</span>
          </span>
          <span className="reel-foot-note">Klik kartu untuk detail</span>
        </div>
      </div>
    </section>
  );
}
