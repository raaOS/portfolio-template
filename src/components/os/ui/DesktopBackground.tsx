'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Image from 'next/image';
import { m, useReducedMotion, type Transition } from 'motion/react';
import type { WallpaperConfig } from '@/types/about';
import { DEFAULT_WALLPAPER_URL } from '../utils/zIndexLayers';
import { getVideoPosterCandidates, isVideoSource } from '@/lib/mediaPreview';
import { useBackgroundEffect } from '@/components/home/BackgroundEffectContext';

interface DesktopBackgroundProps {
  wallpaperConfig?: WallpaperConfig;
  isWindowOpen?: boolean;
  isMobile?: boolean;
}

/**
 * Optimized Desktop Background for LCP
 * Uses priority loading for active wallpaper
 */
export default function DesktopBackground({
  wallpaperConfig,
  isWindowOpen = false,
  isMobile = false,
}: DesktopBackgroundProps) {
  const prefersReducedMotion = useReducedMotion();
  const { isDesktopRevealed } = useBackgroundEffect();
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // Resolve the active wallpaper entry (not just URL) so we can also
  // pick up the side-car poster image if the upload pipeline produced
  // one. Falls back to the JPG side-car convention (`<base>.jpg`) when
  // posterUrl wasn't persisted on older entries.
  const activeEntry = useMemo(() => {
    if (!wallpaperConfig?.activeWallpaperId) return null;
    return (
      wallpaperConfig.collection?.find((w) => w.id === wallpaperConfig.activeWallpaperId) ?? null
    );
  }, [wallpaperConfig]);

  const activeWallpaper = useMemo(() => {
    const resolved = activeEntry?.url;
    const isValidUrl = resolved && (resolved.startsWith('/') || resolved.startsWith('http'));
    return isValidUrl ? resolved : DEFAULT_WALLPAPER_URL;
  }, [activeEntry]);

  const blurAmount = wallpaperConfig?.blur || 0;
  const isVideo = useMemo(() => isVideoSource(activeWallpaper), [activeWallpaper]);

  const videoSrc = useMemo(() => {
    if (!isVideo) return activeWallpaper;
    if (activeEntry?.startTime !== undefined) {
      const baseUrl = activeWallpaper.split('#')[0];
      return `${baseUrl}#t=${activeEntry.startTime}`;
    }
    if (activeWallpaper.includes('#t=')) return activeWallpaper;
    return `${activeWallpaper}#t=14`;
  }, [activeWallpaper, isVideo, activeEntry]);

  // Poster candidates: explicit `posterUrl` from D1 wins (current
  // pipeline always persists it for new wallpapers). Otherwise we
  // derive `[<base>.jpg, <base>.webp]` — `.jpg` is the current
  // convention, `.webp` is the legacy era.
  //
  // Caveat we do NOT solve here: when there are multiple candidates,
  // a wallpaper entry from the .webp era pays one 404 round trip per
  // cold load. The proper fix is backfilling `posterUrl` on those
  // D1 entries via
  // `scripts/cloudflare/backfill-wallpaper-poster-urls.ts`.
  const posterCandidates = useMemo(() => {
    if (!isVideo) return [] as string[];
    if (activeEntry?.posterUrl) return [activeEntry.posterUrl];
    return getVideoPosterCandidates(activeWallpaper);
  }, [isVideo, activeEntry, activeWallpaper]);

  // The seed is candidates[0] — used synchronously for the initial
  // <video poster> so the happy path (posterUrl persisted, .jpg side-
  // car exists) renders with 0 extra round trips.
  const seedPoster = posterCandidates[0];

  // Probe override: set asynchronously by the effect below ONLY when
  // a later candidate (e.g. .webp) loads after the seed (.jpg) 404s.
  // Tagged with `forSeed` so a stale override from a previous wallpaper
  // is automatically ignored when the seed changes (no synchronous
  // setState-in-effect required to reset).
  const [probedOverride, setProbedOverride] = useState<{ url: string; forSeed: string } | null>(
    null
  );

  // Derive the poster URL: prefer the override if it was resolved for
  // the current seed, otherwise the seed itself.
  //
  // Edge case: untuk image wallpaper, `seedPoster` dan `probedOverride`
  // sama-sama undefined/null. Tanpa explicit null-check, ekspresi
  // `probedOverride?.forSeed === seedPoster` menghasilkan
  // `undefined === undefined` (true) → akses `.url` ke null = crash.
  // Karena itu kita require `probedOverride` truthy dulu.
  const posterUrl =
    probedOverride && probedOverride.forSeed === seedPoster ? probedOverride.url : seedPoster;

  const [videoReady, setVideoReady] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [prevWallpaper, setPrevWallpaper] = useState(activeWallpaper);

  if (activeWallpaper !== prevWallpaper) {
    setPrevWallpaper(activeWallpaper);
    setHasLoadError(false);
    setVideoReady(false);
  }

  const handleVideoCanPlay = useCallback(() => {
    setVideoReady(true);
  }, []);

  const handleMediaError = useCallback(() => {
    setHasLoadError(true);
  }, []);

  // POSTER-FIRST (pola sama dengan infinite-canvas Fase 3): <video> baru
  // di-mount saat browser idle (atau maksimal 4s) SETELAH desktop revealed.
  // Tanpa gate ini, range-request MP4 (3x 206) berebut bandwidth dengan
  // wallpaper JPG + chunk JS pada fase kritis Lighthouse mobile (1.6Mbps)
  // sehingga LCP tersimulasi molor ke 6-7s meski img selesai ~0.8s.
  const [videoIdleReady, setVideoIdleReady] = useState(false);
  useEffect(() => {
    if (!isVideo) return;
    if (typeof window === 'undefined') return;
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(() => setVideoIdleReady(true), { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(() => setVideoIdleReady(true), 1500);
    return () => window.clearTimeout(t);
  }, [isVideo]);

  useEffect(() => {
    // Skip probe when a single candidate exists. Either we have an
    // explicit posterUrl from D1 (trusted) or no candidates at all
    // (non-video).
    if (typeof window === 'undefined') return;
    if (posterCandidates.length <= 1) return;

    const seed = posterCandidates[0];
    let cancelled = false;
    let activeImg: HTMLImageElement | null = null;

    const tryNext = (index: number) => {
      if (cancelled) return;
      if (index >= posterCandidates.length) return;
      const url = posterCandidates[index];
      const img = new window.Image();
      activeImg = img;
      img.onload = () => {
        if (cancelled) return;
        // Only override if probe found a candidate other than the
        // seed (which is already the default). Avoids a redundant
        // state update for the happy path where candidates[0] succeeds.
        if (url !== seed) {
          setProbedOverride({ url, forSeed: seed });
        }
      };
      img.onerror = () => {
        if (cancelled) return;
        tryNext(index + 1);
      };
      img.src = url;
    };

    // Start from index 1 — index 0 (seed) is already loaded by
    // `<video poster={posterUrl}>` above. Probing it again via
    // `new Image()` creates a redundant HTTP request.
    tryNext(1);

    return () => {
      cancelled = true;
      if (activeImg) {
        activeImg.onload = null;
        activeImg.onerror = null;
        activeImg.src = '';
      }
    };
  }, [posterCandidates]);

  // Bandwidth-aware playback decision.
  //
  //   1. `prefers-reduced-data` (`navigator.connection.saveData`) → user
  //      has explicitly opted into low-data mode (e.g. iOS Low Data
  //      mode, Android Data Saver). Show poster only, never download
  //      the MP4.
  //   2. Effective connection type `2g` / `slow-2g` → assume metered or
  //      degraded mobile network. Show poster only.
  //   3. Otherwise stream the full MP4 with `preload="metadata"` so the
  //      browser only fetches enough bytes to start playback rather
  //      than the entire file up front.
  //
  // We re-evaluate when the connection changes (Network Information API
  // emits `change`) so a user who switches from wifi → cellular gets
  // downgraded automatically without a reload.
  //
  // CRITICAL: initial value via lazy useState init agar evaluasi
  // saveData/2g terjadi SEBELUM render pertama. Sebelumnya pakai
  // `useState(true)` + effect → first render selalu mount <video>
  // dengan `preload="metadata"`, browser kicks off metadata fetch
  // (~5-10KB) walaupun visitor di mode saveData/2g. Effect baru
  // re-render switch ke <Image> SETELAH fetch sudah ke-trigger. Lazy
  // init pre-empt seluruh waste itu.
  const [shouldPlayVideo, setShouldPlayVideo] = useState(() => {
    if (typeof navigator === 'undefined') return true; // SSR safe default
    const conn = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    const slow = conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g';
    const isSaveData = Boolean(conn?.saveData);
    // Low-end hardware guard: devices with <= 2 CPU cores fallback to static poster
    // to preserve 60fps frame budget for window dragging and dock scaling
    const isLowEndDevice =
      typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 2;
    return !isSaveData && !slow && !isLowEndDevice;
  });
  const shouldMountVideo = isVideo && shouldPlayVideo && !prefersReducedMotion && isDesktopRevealed && videoIdleReady;
  // LCP fix (2026-09-25): poster wallpaper harus SATU element <img> stabil
  // yang TIDAK PERNAH di-unmount lintas transisi:
  //   SSR -> hydration -> desktop chunk -> video mount.
  // Sebelumnya poster versi-SSR dan poster versi-video adalah dua elemen
  // berbeda yang saling toggle, sehingga DOM <img> di-remount saat video
  // mount -> LCP element berpindah ke ikon dock (terukur LCP = img 53x53px
  // @11.2s, bukan wallpaper). Sekarang video di-fade-in di ATAS poster
  // (bukan mengganti poster).
  const posterSrc = hasLoadError
    ? DEFAULT_WALLPAPER_URL
    : isVideo
      ? posterUrl || DEFAULT_WALLPAPER_URL
      : activeWallpaper;

  useEffect(() => {
    if (!isVideo) return;
    if (typeof navigator === 'undefined') return;

    const conn = (
      navigator as Navigator & {
        connection?: {
          saveData?: boolean;
          effectiveType?: string;
          addEventListener?: (type: 'change', listener: () => void) => void;
          removeEventListener?: (type: 'change', listener: () => void) => void;
        };
      }
    ).connection;

    // Initial decide() di useState init sudah handle first render.
    // Effect ini hanya untuk subscribe perubahan connection runtime
    // (mis. wifi → cellular), bukan first evaluation.
    const decide = () => {
      const isLowEnd =
        typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 2;
      if (!conn) {
        setShouldPlayVideo(!isLowEnd);
        return;
      }
      const slow = conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g';
      setShouldPlayVideo(!conn.saveData && !slow && !isLowEnd);
    };

    conn?.addEventListener?.('change', decide);
    return () => {
      conn?.removeEventListener?.('change', decide);
    };
  }, [isVideo]);

  // Programmatic playback control linked to desktop boot/reveal state
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shouldMountVideo) return;

    video.play().catch((err) => {
      console.warn('[DesktopBackground] Playback execution aborted (power saver or policy):', err);
      // Immediately revert to crisp poster image on autoplay rejection
      setVideoReady(false);
    });
  }, [shouldMountVideo, videoSrc]);

  // Programmatic custom start times (e.g. video URL ending with #t=14, default to 14 if no fragment)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shouldMountVideo) return;

    const match = videoSrc.match(/#t=(\d+(\.\d+)?)/);
    const startTime = match ? parseFloat(match[1]) : (activeEntry?.startTime ?? 14);

    const applyStartTime = () => {
      video.currentTime = startTime;
    };

    if (video.readyState >= 1) {
      applyStartTime();
    } else {
      video.addEventListener('loadedmetadata', applyStartTime, { once: true });
    }
  }, [videoSrc, activeEntry?.startTime, shouldMountVideo]);

  // iOS-style background effect: scales down slightly and blurs when a window is active.
  // Reduced-motion or mobile: skip spring entirely — langsung set filter static tanpa scale shift.
  const springTransition: Transition =
    prefersReducedMotion || isMobile
      ? { duration: 0 }
      : { type: 'spring', stiffness: 180, damping: 28, mass: 1 };

  // Video wallpaper: skip scale 1.08 supaya tidak zoom/upsample (yang bikin
  // pecah). Image wallpaper tetap dapat efek breathing iOS karena image
  // di-resize sharp di build pipeline + Next/Image, jadi aman di-scale.
  const idleScale = isVideo ? 1 : 1.08;

  // LCP fix (2026-09-26): `filter: blur(0px)` dihitung BUKAN sebagai `none`
  // oleh Blink -> membuat render surface yang mengeluarkan img wallpaper
  // dari keanggotaan kandidat LCP pada paint pertama (dibuktikan via probe
  // ablate: strip filter di DOMContentLoaded mengubah pemenang LCP dari
  // project-icon@2s -> teks@0.4s). Kalau blurAmount 0, properti filter
  // tidak boleh di-emit sama sekali oleh motion.
  const hasBlur = blurAmount > 0;
  const openBlur = blurAmount + (isWindowOpen ? 6 : 0);
  const animateTarget =
    prefersReducedMotion || isMobile
      ? hasBlur
        ? { scale: 1, filter: `blur(${blurAmount}px)` }
        : { scale: 1 }
      : openBlur > 0
        ? { scale: isWindowOpen ? 1 : idleScale, filter: `blur(${openBlur}px)` }
        : { scale: isWindowOpen ? 1 : idleScale };

  return (
    <div className="fixed inset-0 z-0 h-full w-full overflow-hidden bg-black">
      <m.div
        // LCP fix (2026-09-26, deterministik via repro statis lcp-probe):
        // Blink MENGECAULIKAN image yang paint rect-nya persis memenuhi
        // viewport (>= 100% area) dari kandidat LCP — diperlakukan sebagai
        // page background. 390x844 pada viewport 390x844 = absen dari daftar
        // kandidat betapapun awal load-nya (terbukti: h843 teregistrasi @60ms
        // 328.770px2, h844 tidak pernah). Stage dikurangi 1px; outer
        // container `bg-black` menutupi selisihnya (tak terlihat — selalu di
        // bawah dock/menu area, warna sama dengan letterbox OS).
        className="relative h-[calc(100%-1px)] w-full"
        initial={false}
        animate={animateTarget}
        transition={springTransition}
      >
        {/* Primary wallpaper - Priority load for LCP with automatic default fallback.
            Satu element <Image> stabil (tidak pernah di-unmount) -> LCP element
            tetap wallpaper lintas transisi SSR -> video mount. */}
        <Image
          src={posterSrc}
          alt="Desktop wallpaper"
          fill
          priority
          fetchPriority="high"
          unoptimized={true}
          quality={75}
          sizes="100vw"
          className="object-cover opacity-100"
          onError={handleMediaError}
        />
        {isVideo && shouldMountVideo && (
          <React.Fragment key={activeWallpaper}>
            <video
              ref={videoRef}
              src={videoSrc}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              onCanPlay={handleVideoCanPlay}
              onError={handleMediaError}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${videoReady ? 'opacity-100' : 'opacity-0'}`}
              style={{ transform: 'translateZ(0)' }}
            />
          </React.Fragment>
        )}
      </m.div>

      {/* Dark overlay - kept subtle or disabled as per request */}
      <m.div
        className="pointer-events-none absolute inset-0 bg-black/5"
        animate={{ opacity: prefersReducedMotion ? 1 : isWindowOpen ? 0 : 1 }}
        transition={springTransition}
        aria-hidden="true"
      />
    </div>
  );
}
