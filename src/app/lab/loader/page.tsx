'use client';

/**
 * Preview isolated loader ala k95.it — /lab/loader
 *
 * Rute showcase: tidak menyentuh logic 3 template sama sekali.
 * Kalau hasilnya tidak dipakai, hapus file ini + BootStackLoader.tsx = bersih.
 */

import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState } from 'react';

const DeckRevealLoader = dynamic(
  () => import('@/components/shared/DeckRevealLoader'),
  { ssr: false },
);

const PREVIEW_IMAGES = [
  '/assets/projects/manipulasi-foto-musik-alam.jpg',
  '/assets/projects/kolase-lanskap-menanjak.jpg',
  '/assets/projects/politik-pop-digital-cover.jpg',
  '/assets/projects/tipografi-mekar-gotik.jpg',
  '/assets/projects/seni-poster-flatiron-neon.jpg',
  '/assets/projects/pastoral-kawanan-berhalo.jpg',
  '/assets/projects/overlay-bunga-barok-digital.jpg',
  '/assets/projects/komposit-gerbang-neraka.jpg',
  '/assets/projects/kaleidoskop-tipografi-gradien.jpg',
];

const DEMO_CARDS = [
  { title: 'Manipulasi Foto Musik Alam', tag: 'Visual Art' },
  { title: 'Kolase Lanskap Menanjak', tag: 'Digital Collage' },
  { title: 'Politik Pop Digital', tag: 'Poster' },
  { title: 'Tipografi Mekar Gotik', tag: 'Typography' },
  { title: 'Poster Flatiron Neon', tag: 'Poster' },
  { title: 'Pastoral Kawanan Berhalo', tag: 'Surreal' },
];

export default function LabLoaderPage() {
  const [runId, setRunId] = useState(0);
  const [loading, setLoading] = useState(true);

  const replay = useCallback(() => {
    setLoading(true);
    setRunId((n) => n + 1);
  }, []);

  const images = useMemo(() => PREVIEW_IMAGES, []);

  return (
    <main className="relative h-screen w-full overflow-hidden bg-[#0a0a0f] text-white">
      {/* Konten demo di belakang loader — supaya efek patch-reveal kelihatan */}
      <div className="absolute inset-0 flex flex-col justify-center gap-6 px-[6vw]">
        <header className="max-w-2xl">
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">
            Lab · Boot Loader Preview
          </p>
          <h1 className="mt-3 text-4xl font-bold md:text-6xl">
            Tumpukan Gambar 0–100
          </h1>
          <p className="mt-4 text-white/60">
            Loader terisolasi ala k95.it. Tidak menyentuh logic template
            manapun.
          </p>
        </header>

        <div className="grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-3">
          {DEMO_CARDS.map((c, i) => (
            <div
              key={c.title}
              className="overflow-hidden rounded-xl border border-white/10 bg-white/5"
            >
              {/* img statis untuk preview, bukan konten produksi */}
              <img
                src={PREVIEW_IMAGES[i % PREVIEW_IMAGES.length]}
                alt=""
                className="h-32 w-full object-cover opacity-80"
              />
              <div className="p-3">
                <p className="text-sm font-semibold">{c.title}</p>
                <p className="text-xs text-white/50">{c.tag}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <DeckRevealLoader key={runId} images={images} onDone={() => setLoading(false)} />
      ) : (
        <button
          type="button"
          onClick={replay}
          className="fixed bottom-6 right-6 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm uppercase tracking-wider backdrop-blur transition hover:bg-white/20"
        >
          ↻ Replay
        </button>
      )}
    </main>
  );
}
