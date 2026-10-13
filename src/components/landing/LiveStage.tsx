'use client';

import * as React from 'react';

/* ── Live Stage — panggung tiga demo live menghadap lurus depan ─────
 * Konsep: satu kartu besar di tengah (demo aktif) + dua kartu samping
 * sedikit mundur, mengecil, dan sedikit redup di kiri-kanan. Ketiganya
 * iframe hidup sekaligus — TANPA putaran silinder, tanpa rotateY:
 * semua kemiringan/kesan berputar yang bikin pusing sudah dibuang.
 *
 * Yang membuatnya hidup (murni transform di kompositor):
 * - Ambient float: tiap kartu bergoyang pelan (sine, fase beda).
 * - Mouse parallax: panggung mengikuti kursor dengan easing lembut.
 * - Tukar posisi pakai spring overshoot (FLIP) — klik kartu samping
 *   atau pill 01–03, kartu terbang tukar dengan efek jelly.
 * - Entrance bertahap (stagger) saat halaman dimuat.
 *
 * Iframe tidak pernah berganti `src` (tak pernah reload): kartu hanya
 * berpindah slot lewat class CSS. `prefers-reduced-motion` mematikan
 * seluruh gerak ambient — panggung diam rapi, demo tetap hidup.
 * ─────────────────────────────────────────────────────────────── */

export type LiveStageItem = {
  id: string;
  name: string;
  src: string;
};

interface LiveStageProps {
  items: LiveStageItem[];
  /** Index demo yang berada di tengah (kartu aktif). */
  activeIndex: number;
  /** Kartu samping / pill diklik → panggung menukar posisi (FLIP spring). */
  onActiveChange: (index: number) => void;
  /** Kartu tengah (demo aktif) diklik → popup detail template. */
  onActivate: (index: number) => void;
}

export default function LiveStage({
  items,
  activeIndex,
  onActiveChange,
  onActivate,
}: LiveStageProps) {
  const stageRef = React.useRef<HTMLDivElement>(null);
  const parallaxRef = React.useRef<HTMLDivElement>(null);

  // Entrance: `is-live` dipasang setelah paint pertama supaya transisi
  // scale+opacity kartu benar-benar beranimasi (bukan terpotong).
  // Class dipasang langsung ke node DOM (bukan setState → tanpa render
  // berantai, lolos rule react-hooks/set-state-in-effect).
  React.useEffect(() => {
    stageRef.current?.classList.add('is-live');
  }, []);

  // Mouse parallax lembut — translate murni (tanpa rotateY → tanpa pusing).
  const handleMouseMove = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = parallaxRef.current;
      if (!el) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      el.style.setProperty('--px', px.toFixed(3));
      el.style.setProperty('--py', py.toFixed(3));
    },
    [],
  );

  const count = items.length;
  const slotOf = (index: number) => {
    if (index === activeIndex) return 'is-center';
    if (index === (activeIndex - 1 + count) % count) return 'is-left';
    return 'is-right';
  };

  return (
    <div className="live-stage" ref={stageRef} onMouseMove={handleMouseMove}>
      <div className="stage-parallax" ref={parallaxRef}>
        {items.map((item, index) => {
          const isCenter = index === activeIndex;
          return (
            <div key={item.id} className={`stage-slot ${slotOf(index)}`}>
              <div className="stage-float">
                <div className={`stage-card${isCenter ? ' is-active' : ''}`}>
                  <iframe
                    src={item.src}
                    title={`Demo template ${item.name}`}
                    loading="lazy"
                    className="stage-iframe"
                  />
                  {isCenter && (
                    <span className="stage-badge">
                      <span className="stage-badge-dot" />
                      {item.name}
                    </span>
                  )}
                  <button
                    type="button"
                    className="stage-hit"
                    aria-label={
                      isCenter
                        ? `Lihat detail template ${item.name}`
                        : `Tampilkan demo ${item.name}`
                    }
                    onClick={() =>
                      isCenter ? onActivate(index) : onActiveChange(index)
                    }
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
