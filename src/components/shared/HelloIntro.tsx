'use client';

// ─── HelloIntro: layar pembuka animasi lottie HELLO ────────────────────────
// Dipakai template spatial-gallery & infinite-canvas (permintaan owner
// v1.3.36): animasi HELLO diputar sampai SELESAI satu putaran penuh, baru
// overlay fade-out dan menampilkan halaman utama. Varian `hello orange`
// dipakai karena kontras di latar gelap (varian "hitam" hanya untuk latar
// terang). Lottie dimuat via dynamic import ssr:false — pola sama dengan
// OS Desktop StartScreen & infinite-canvas (CanvasControls).

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import helloAnimationData from '../../../public/lottie/hello orange.json';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

interface HelloIntroProps {
  /**
   * Kondisi tambahan dari pemakai (opsional): intro baru mulai sembunyi
   * setelah animasi minimal satu putaran penuh SEKALIGUS kondisi ini true —
   * mis. spatial-gallery memakainya untuk scene 3D yang sudah siap, supaya
   * pengunjung tidak disuguhi layar hitam setelah intro. Default true.
   */
  ready?: boolean;
}

const FADE_MS = 700;

export function HelloIntro({ ready = true }: HelloIntroProps) {
  const [completedOnce, setCompletedOnce] = useState(false);
  const [gone, setGone] = useState(false);

  // Animasi loop=true (tetap hidup selagi menunggu ready); onComplete /
  // onLoopComplete terpicu di akir setiap putaran → satu putaran penuh selesai.
  const markCompleted = () => setCompletedOnce(true);

  // Turunan: mulai fade-out setelah satu putaran penuh SEKALIGUS konten siap.
  const leaving = completedOnce && ready;

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setGone(true), FADE_MS);
    return () => clearTimeout(t);
  }, [leaving]);

  if (gone) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center bg-black"
      style={{ opacity: leaving ? 0 : 1, transition: `opacity ${FADE_MS / 1000}s ease` }}
    >
      <div className="w-[min(72vw,440px)]">
        <Lottie
          animationData={helloAnimationData}
          loop
          autoplay
          onComplete={markCompleted}
          onLoopComplete={markCompleted}
        />
      </div>
    </div>
  );
}

export default HelloIntro;
