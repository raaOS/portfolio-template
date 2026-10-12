'use client';

/**
 * HomepageLoaderGate — wrapper loader homepage (DeckRevealLoader / HelloIntro).
 *
 * Bertugas:
 * 1. Cabang gaya: `deck-reveal` → tumpukan gambar cover project (maks 10);
 *    `hello` → animasi lottie HELLO (reuse komponen shared HelloIntro).
 * 2. Gaya hello di template yang SUDAH punya intro HELLO bawaan
 *    (spatial-gallery & infinite-canvas): gate DIAM — intro bawaan template
 *    yang memutar (visual identik + penjagaan ready-scene 3D di spatial),
 *    jadi pengunjung tidak pernah melihat HELLO dua kali.
 * 3. Tampilkan loader HANYA sekali per sesi browser (sessionStorage) supaya
 *    tidak mengganggu navigasi antar halaman.
 * 4. Hormati `prefers-reduced-motion` (DeckRevealLoader sudah handle).
 *
 * Tidak menyentuh logic template renderer manapun — murni overlay.
 */

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Project } from '@/types/projects';
import type { LoaderConfig } from '@/types/about';
import { resolveCover } from '@/lib/images';

const DeckRevealLoader = dynamic(
  () => import('@/components/shared/DeckRevealLoader'),
  { ssr: false },
);

const HelloIntro = dynamic(
  () => import('@/components/shared/HelloIntro'),
  { ssr: false },
);

const SESSION_KEY = 'portfolio_loader_played';

/** Cari URL gambar statis dari sebuah project (cover image, atau poster video). */
function pickProjectImage(project?: Project): string | null {
  if (!project?.cover) return null; // cover kosong → resolveCover balikin SVG placeholder
  const cover = resolveCover(project);
  if (cover.kind === 'image') return cover.src;
  return cover.poster ?? null;
}

export type HomepageLoaderGateProps = {
  config: LoaderConfig;
  projects: Project[];
  /** Key template aktif — gaya `hello` hanya bermain di os-desktop. */
  activeTemplateKey?: string;
};

export default function HomepageLoaderGate({
  config,
  projects,
  activeTemplateKey = 'os-desktop',
}: HomepageLoaderGateProps) {
  // Cek sesi hanya di client; default false supaya SSR aman.
  const [shouldPlay, setShouldPlay] = useState(false);

  useEffect(() => {
    if (!config.enabled) return;
    // Keputusan sesi DI DALAM callback timer, bukan di badan effect:
    // React StrictMode (dev, `reactStrictMode: true`) menjalankan
    // setup → cleanup → setup. Kalau flag sesi dibaca/ditulis di badan effect,
    // run pertama mengonsumsi flag lalu cleanup membatalkan timer-nya —
    // run kedua melihat flag terisi dan loader tidak pernah tampil.
    // Dengan menaruh keputusan di callback, timer yang selamat dari siklus
    // StrictMode-lah yang mengambil keputusan (sekali, idempoten).
    const timer = setTimeout(() => {
      try {
        if (sessionStorage.getItem(SESSION_KEY)) return; // sudah pernah main
        sessionStorage.setItem(SESSION_KEY, '1');
      } catch {
        // sessionStorage unavailable (private mode dsb.) — putuskan main.
      }
      setShouldPlay(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [config.enabled]);

  const images = useMemo(() => {
    const byId = new Map(projects.map((p) => [p.id, p]));
    const resolved: string[] = [];
    for (const id of config.imageProjectIds) {
      const url = pickProjectImage(byId.get(id));
      if (url && !resolved.includes(url)) resolved.push(url);
      if (resolved.length >= 10) break;
    }
    // Kalau admin belum pilih project sama sekali, fallback ke cover project
    // apa adanya (maks 10) supaya loader tetap punya konten.
    if (resolved.length === 0) {
      for (const p of projects) {
        const url = pickProjectImage(p);
        if (url && !resolved.includes(url)) resolved.push(url);
        if (resolved.length >= 10) break;
      }
    }
    return resolved;
  }, [config.imageProjectIds, projects]);

  if (!shouldPlay) return null;

  if (config.style === 'hello') {
    // Template dengan intro HELLO bawaan (spatial-gallery & infinite-canvas):
    // gate diam, intro bawaan yang memutar → tidak pernah dobel.
    if (activeTemplateKey !== 'os-desktop') return null;
    return <HelloIntro />;
  }

  if (images.length === 0) return null;

  return (
    <DeckRevealLoader
      images={images}
      durationMs={config.durationMs}
      accentColor={config.accentColor}
      showCounter={config.showCounter !== false}
    />
  );
}
