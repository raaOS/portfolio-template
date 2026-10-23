'use client';

// ─── HelloIntro: layar pembuka animasi lottie HELLO ────────────────────────
// Dipakai template spatial-gallery & infinite-canvas (permintaan owner
// v1.3.36): animasi HELLO diputar sampai SELESAI satu putaran penuh, baru
// overlay fade-out dan menampilkan halaman utama.
//
// CRUD "Intro Animasi" (v1.3.42): prop `style` memilih varian —
// - `hello-orange` (default): HELLO oranye, latar hitam (kontras latar gelap).
// - `hello-black`: HELLO hitam, latar putih (gaya os-desktop StartScreen).
//
// JARING PENAMAN ABSOLUT (v1.3.42, perbaikan cacat logika C1): overlay dipaksa
// hilang setelah SAFETY_HIDE_MS meski sinyal onComplete tak pernah fire
// (chunk lottie-react gagal dimuat) MAUPUN `ready` tak pernah true (WebGL
// gagal / scene 3D lama siap di spatial-gallery). Sebelumnya kedua jalur itu
// membuat layar hitam permanen / loop HELLO selamanya. Timer di tab
// tersembunyi di-throttle browser — hide justru tertunda sampai tab terlihat
// kembali (perilaku aman, bukan regresi).
//
// Lottie dimuat via dynamic import ssr:false — pola sama dengan OS Desktop
// StartScreen & infinite-canvas (CanvasControls).

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import helloOrangeAnimationData from '../../../public/lottie/hello orange.json';
import helloBlackAnimationData from '../../../public/lottie/hello hitam.json';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

export type HelloIntroStyle = 'hello-orange' | 'hello-black';

interface HelloIntroProps {
  /**
   * Kondisi tambahan dari pemakai (opsional): intro baru mulai sembunyi
   * setelah animasi minimal satu putaran penuh SEKALIGUS kondisi ini true —
   * mis. spatial-gallery memakainya untuk scene 3D yang sudah siap, supaya
   * pengunjung tidak disuguhi layar hitam setelah intro. Default true.
   */
  ready?: boolean;
  /** Gaya animasi & latar. Default 'hello-orange' (latar hitam). */
  style?: HelloIntroStyle;
}

const FADE_MS = 700;

// Jaring pengaman absolut: > idle-timeout 20 dtk SpatialGalleryRenderer
// (requestIdleCallback { timeout: 20000 }) supaya scene lambat masih sempat
// mount, tapi tetap memaksa keluar kalau scene/gagal WebGL tak pernah siap.
const SAFETY_HIDE_MS = 30000;

export function HelloIntro({ ready = true, style = 'hello-orange' }: HelloIntroProps) {
  const [completedOnce, setCompletedOnce] = useState(false);
  const [safetyTriggered, setSafetyTriggered] = useState(false);
  const [gone, setGone] = useState(false);

  // Animasi loop=true (tetap hidup selagi menunggu ready); onComplete /
  // onLoopComplete terpicu di akhir setiap putaran → satu putaran penuh selesai.
  const markCompleted = () => setCompletedOnce(true);

  // Turunan: mulai fade-out setelah (satu putaran penuh SEKALIGUS konten siap)
  // ATAU jaring pengaman absolut terpicu.
  const leaving = (completedOnce && ready) || safetyTriggered;

  // Jaring pengaman absolut (C1): paksa overlay hilang meski sinyal selesai
  // tak pernah datang. Timer hanya di-arm selama overlay belum mulai keluar.
  useEffect(() => {
    if (leaving) return;
    const t = setTimeout(() => setSafetyTriggered(true), SAFETY_HIDE_MS);
    return () => clearTimeout(t);
  }, [leaving]);

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setGone(true), FADE_MS);
    return () => clearTimeout(t);
  }, [leaving]);

  if (gone) return null;

  const isBlackVariant = style === 'hello-black';

  return (
    <div
      aria-hidden="true"
      data-testid="hello-intro"
      data-intro-style={style}
      className={`pointer-events-none fixed inset-0 z-[200] flex items-center justify-center ${
        isBlackVariant ? 'bg-white' : 'bg-black'
      }`}
      style={{ opacity: leaving ? 0 : 1, transition: `opacity ${FADE_MS / 1000}s ease` }}
    >
      <div className="w-[min(72vw,440px)]">
        <Lottie
          animationData={isBlackVariant ? helloBlackAnimationData : helloOrangeAnimationData}
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
