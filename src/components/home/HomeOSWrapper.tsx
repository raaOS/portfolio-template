'use client';

import React, { useEffect, useState } from 'react';
import DesktopSkeleton from '@/components/os/ui/DesktopSkeleton';
import DesktopBackground from '@/components/os/ui/DesktopBackground';
import type { DesktopEnvironmentProps } from '@/components/os/core/DesktopEnvironment';
import { BackgroundEffectProvider, useBackgroundEffect } from './BackgroundEffectContext';
import { GhostCursorsLayer } from '@/components/os/layers/GhostCursorsLayer';
import { useOSOverlays } from '@/components/os/context/OSSystemContext';

type DesktopComponent = React.ComponentType<DesktopEnvironmentProps>;
const BOOT_SESSION_KEY = 'portfolio_os_booted';

function shouldLoadDesktopImmediately() {
  try {
    return (
      document.documentElement.getAttribute('data-os-booted') === 'true' ||
      sessionStorage.getItem(BOOT_SESSION_KEY) === 'true'
    );
  } catch {
    return false;
  }
}

/**
 * Cold-start optimization:
 *
 * Sebelumnya komponen ini render skeleton text "LOADING RAMOS OS..." selama
 * SSR + first-pass hydration, lalu lazy-load `DesktopEnvironmentClient` di
 * pass kedua. Itu bikin LCP harus tunggu JS chunk download + parse.
 *
 * Sekarang: SSR langsung render `DesktopSkeleton` (wallpaper-first shell).
 * Wallpaper jadi LCP element yang streamed dari HTML response, jadi visitor
 * langsung lihat tampilan akhir. Heavy desktop chunk masih di-import lazy pada
 * cold boot, tetapi langsung dimuat saat tab ini sudah pernah boot supaya
 * refresh halaman utama tidak berhenti terlalu lama di skeleton.
 *
 * Important: jangan ubah jadi dynamic({ ssr: false }) tanpa loading skeleton —
 * itu malah buang manfaat SSR yang sudah dipakai untuk LCP wallpaper.
 *
 * Wallpaper stability fix:
 *   `DesktopBackground` di-render di level WRAPPER (bukan di dalam DesktopMain
 *   seperti sebelumnya). Tujuannya: element `<video>` tidak ke-remount saat
 *   transisi:
 *     1. SSR -> hydration
 *     2. Skeleton -> DesktopOS (chunk loaded)
 *     3. mounted=false -> mounted=true (di useDesktopLock)
 *   Sebelum fix, ketiga transisi di atas membuang DOM `<video>` lalu
 *   bikin baru, sehingga browser fetch ulang dari awal di tiap step.
 *   Visitor lihat poster JPG (atau layar hitam) selama beberapa detik
 *   sebelum video pertama bisa play. Sekarang `<video>` stable lintas
 *   semua transisi -> 1 kali fetch saja, autoplay langsung jalan begitu
 *   metadata siap.
 *
 *   `DesktopMain` masih perlu trigger efek blur+scale saat project window
 *   terbuka. Untuk itu kita pakai `BackgroundEffectContext`: DesktopMain
 *   panggil `setIsWindowOpen(...)` lewat hook, DesktopBackground baca
 *   `isWindowOpen` dari context.
 */
// Module-level cache for the dynamically imported DesktopOS component.
// Resolves synchronously on returning to the home page, preventing 1-frame skeleton glitches.
let cachedDesktopOS: DesktopComponent | null = null;

export default function HomeOSWrapper(props: DesktopEnvironmentProps) {
  return (
    <BackgroundEffectProvider>
      <HomeOSWrapperInner {...props} />
    </BackgroundEffectProvider>
  );
}

function HomeOSWrapperInner(props: DesktopEnvironmentProps) {
  const { isWindowOpen } = useBackgroundEffect();
  const { showGhostCursors } = useOSOverlays();

  // Keep the first client render identical to SSR. Reading window.innerWidth
  // in the state initializer makes mobile hydrate with a different background
  // transform than the server markup, which React correctly reports as a
  // mismatch. The effect below updates the value immediately after hydration.
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    handler();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const [DesktopOS, setDesktopOS] = useState<DesktopComponent | null>(() => cachedDesktopOS);
  const [chunkError, setChunkError] = useState<string | null>(null);
  const [transitionPhase, setTransitionPhase] = useState<'loading' | 'fading' | 'ready'>(() =>
    cachedDesktopOS ? 'ready' : 'loading'
  );

  useEffect(() => {
    let cancelled = false;
    const retries = { count: 0 };

    const loadChunk = () => {
      import('@/components/os/core/DesktopEnvironmentClient')
        .then((mod) => {
          cachedDesktopOS = mod.default;
          if (!cancelled) {
            setDesktopOS(() => mod.default);
            if (shouldLoadDesktopImmediately()) {
              setTransitionPhase('ready');
            } else {
              setTransitionPhase('fading');
              setTimeout(() => setTransitionPhase('ready'), 100);
            }
          }
        })
        .catch((err) => {
          console.error('[HomeOSWrapper] Failed to load DesktopOS chunk:', err);
          if (!cancelled && retries.count < 1) {
            retries.count++;
            setTimeout(loadChunk, 2000);
          } else if (!cancelled) {
            setChunkError('Failed to load desktop. Please check your connection and reload.');
          }
        });
    };

    if (shouldLoadDesktopImmediately()) {
      loadChunk();
      return () => {
        cancelled = true;
      };
    }

    const win = window;
    let tid: number | null = null;
    const rafId = win.requestAnimationFrame(() => {
      tid = win.setTimeout(loadChunk, 0);
    });

    return () => {
      cancelled = true;
      win.cancelAnimationFrame(rafId);
      if (tid !== null) win.clearTimeout(tid);
    };
  }, []);

  if (chunkError) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-black text-white">
        <p className="text-lg font-medium">{chunkError}</p>
        <button
          onClick={() => {
            setChunkError(null);
            setDesktopOS(null);
            setTransitionPhase('loading');
            cachedDesktopOS = null;
          }}
          className="rounded-lg bg-white/10 px-4 py-2 text-sm transition hover:bg-white/20"
        >
          Reload Desktop
        </button>
      </div>
    );
  }

  return (
    <>
      {/*
       * Wallpaper layer hidup di sini supaya stable lintas transisi
       * skeleton -> DesktopOS dan mounted false -> true. Lihat header
       * komentar HomeOSWrapper untuk konteks lengkap.
       */}
      <DesktopBackground
        wallpaperConfig={props.aboutData?.wallpaperConfig}
        isMobile={isMobile}
        isWindowOpen={isWindowOpen}
      />
      {transitionPhase === 'ready' && DesktopOS ? (
        <DesktopOS {...props} />
      ) : (
        <DesktopSkeleton fading={transitionPhase === 'fading'} />
      )}
      {/* Ghost Cursors Overlay - Global, outside desktop z-index stack */}
      {showGhostCursors && <GhostCursorsLayer enabled={true} />}
    </>
  );
}
