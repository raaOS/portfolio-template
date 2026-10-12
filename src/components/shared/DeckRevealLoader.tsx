'use client';

/**
 * DeckRevealLoader — loader animasi tumpukan gambar ala k95.it.
 *
 * Komponen ini HIDUP SENDIRI: tidak pakai context, tidak menyentuh
 * document.documentElement, tidak mengubah state global apa pun.
 * Dipakai di homepage (via HomepageLoaderGate) dan sandbox /lab/loader.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// --- Timing & magic numbers (disesuaikan dengan spec k95) -------------------
// 10 layer: lebar akhir menumpuk sampai 100% (layer terakhir menutup semua).
const LAYER_TARGET_WIDTHS = [82, 84, 86, 88, 90, 92, 94, 96, 98, 100] as const;
const MAX_LAYERS = LAYER_TARGET_WIDTHS.length;
const DEFAULT_TOTAL_MS = 2800;
const EXIT_RESERVE_MS = 420;
const EXIT_LEAD_MS = 220;
const STAGGER_FACTOR = 0.28;
const IMG_PRELOAD_TIMEOUT_MS = 1800;
const PATCH_EXPAND_MS = 1000;
const DEFAULT_ACCENT_COLOR = '#1500E1';

// Easing cubic-bezier(.16, 1, .3, 1) — disolve pakai Newton-Raphson.
const EB_X1 = 0.16;
const EB_Y1 = 1;
const EB_X2 = 0.3;
const EB_Y2 = 1;

function bezierY(t: number, y1: number, y2: number): number {
  const u = 1 - 3 * y2 + 3 * y1;
  const v = 3 * y2 - 6 * y1;
  const w = 3 * y1;
  return ((u * t + v) * t + w) * t;
}

function solveBezierT(x: number, x1: number, x2: number): number {
  const u = 1 - 3 * x2 + 3 * x1;
  const v = 3 * x2 - 6 * x1;
  const w = 3 * x1;
  let t = x;
  for (let i = 0; i < 5; i += 1) {
    const f = ((u * t + v) * t + w) * t - x;
    const df = u * 3 * t * t + v * 2 * t + w;
    if (Math.abs(df) < 1e-6) break;
    t -= f / df;
    if (t <= 0) return 0;
    if (t >= 1) return 1;
  }
  return t;
}

function easeOutExpoish(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const t = solveBezierT(x, EB_X1, EB_X2);
  return bezierY(t, EB_Y1, EB_Y2);
}

function computeTiming(layerCount: number, totalMsConfigured: number) {
  const totalMs = Math.max(1, totalMsConfigured - EXIT_RESERVE_MS);
  const animEndMs = Math.max(0, totalMs - EXIT_LEAD_MS);
  const duration = Math.max(
    1,
    animEndMs / (1 + Math.max(0, layerCount - 1) * STAGGER_FACTOR),
  );
  const stagger = Math.max(0, duration * STAGGER_FACTOR);
  return { duration, stagger, animEndMs, totalMs };
}

function loadImage(src: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    const timer = setTimeout(() => done(false), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      done(true);
    };
    img.onerror = () => {
      clearTimeout(timer);
      done(false);
    };
    img.decoding = 'async';
    img.src = src;
  });
}

export type DeckRevealLoaderProps = {
  images: string[];
  /** Total durasi animasi dalam ms (default 2800). */
  durationMs?: number;
  /** Warna placeholder/counter (default #1500E1). */
  accentColor?: string;
  /** Tampilkan counter [0]→[100] (default true). */
  showCounter?: boolean;
  onDone?: () => void;
};

export default function DeckRevealLoader({
  images,
  durationMs = DEFAULT_TOTAL_MS,
  accentColor = DEFAULT_ACCENT_COLOR,
  showCounter = true,
  onDone,
}: DeckRevealLoaderProps) {
  const [visible, setVisible] = useState(true);
  const [preparedImages, setPreparedImages] = useState<string[]>([]);
  const [counter, setCounter] = useState(0);
  const [phase, setPhase] = useState<'stack' | 'preview' | 'expanding'>(
    'stack',
  );

  const stackRef = useRef<HTMLDivElement | null>(null);
  const patchRef = useRef<HTMLDivElement | null>(null);
  const layerRefs = useRef<Array<HTMLDivElement | null>>([]);
  const rafRef = useRef<number | null>(null);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const doneCalledRef = useRef(false);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  }, []);

  const finish = useCallback(() => {
    if (doneCalledRef.current) return;
    doneCalledRef.current = true;
    setVisible(false);
    onDone?.();
  }, [onDone]);

  // Preload & siapkan daftar gambar (dengan fallback warna solid).
  useEffect(() => {
    let cancelled = false;
    const unique = Array.from(new Set(images.filter(Boolean)));
    const limited = unique.slice(0, MAX_LAYERS);

    if (limited.length === 0) {
      finish();
      return;
    }

    (async () => {
      const results = await Promise.all(
        limited.map((src) => loadImage(src, IMG_PRELOAD_TIMEOUT_MS)),
      );
      if (cancelled) return;
      const firstOk = results.findIndex(Boolean);
      const fallback = firstOk >= 0 ? limited[firstOk] : null;
      const finalList = limited.map((src, i) =>
        results[i] ? src : (fallback ?? accentColor),
      );
      // Sisanya dilaporkan saja, tidak blocking.
      Promise.allSettled(
        unique.slice(MAX_LAYERS).map((s) => loadImage(s, 900)),
      ).catch(() => {});
      setPreparedImages(finalList);
    })();

    return () => {
      cancelled = true;
    };
  }, [images, finish, accentColor]);

  // Animasi counter + pelebaran layer.
  useEffect(() => {
    if (preparedImages.length === 0) return;

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      // Counter langsung 100 tanpa animasi (setState via callback async).
      timersRef.current.push(
        setTimeout(() => {
          setCounter(100);
          finish();
        }, EXIT_RESERVE_MS),
      );
      return;
    }

    const layerCount = Math.min(
      LAYER_TARGET_WIDTHS.length,
      preparedImages.length,
    );
    const { duration, stagger, animEndMs, totalMs } = computeTiming(
      layerCount,
      durationMs,
    );
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const clamped = Math.min(elapsed, animEndMs);

      for (let i = 0; i < layerCount; i += 1) {
        const el = layerRefs.current[i];
        if (!el) continue;
        const local = clamped - i * stagger;
        if (local <= 0) continue;
        const p = easeOutExpoish(Math.min(local / duration, 1));
        el.style.width = `${LAYER_TARGET_WIDTHS[Math.min(i, LAYER_TARGET_WIDTHS.length - 1)] * p}%`;
      }

      const progress = animEndMs > 0 ? Math.min(1, clamped / animEndMs) : 1;
      setCounter(Math.round(progress * 100));

      if (elapsed < totalMs) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      rafRef.current = null;
      setCounter(100);
      runExit();
    };

    const runExit = () => {
      // 1. Tampilkan patch (lubang transparan seukuran stack).
      setPhase('preview');
      timersRef.current.push(
        setTimeout(() => {
          // 2. Sembunyikan stack, rekam posisi patch.
          const stack = stackRef.current;
          const patch = patchRef.current;
          setPhase('expanding');
          if (stack && patch) {
            const r = stack.getBoundingClientRect();
            patch.style.left = `${Math.max(0, r.left)}px`;
            patch.style.top = `${Math.max(0, r.top)}px`;
            patch.style.width = `${Math.max(1, Math.round(r.width))}px`;
            patch.style.height = `${Math.max(1, Math.round(r.height))}px`;
            patch.style.opacity = '1';

            // 3. Scale patch sampai lubangnya menutup viewport.
            const centerX = Math.max(0, r.left) + r.width / 2;
            const centerY = Math.max(0, r.top) + r.height / 2;
            const reachX = Math.max(centerX, window.innerWidth - centerX);
            const reachY = Math.max(centerY, window.innerHeight - centerY);
            const K = 1.04;
            const scaleX = Math.max(1, (reachX * 2) / r.width * K);
            const scaleY = Math.max(1, (reachY * 2) / r.height * K);

            patch.style.transition = `transform ${PATCH_EXPAND_MS}ms cubic-bezier(.87,0,.13,1)`;
            requestAnimationFrame(() => {
              patch.style.transform = `translate3d(0,0,0) scale(${scaleX}, ${scaleY})`;
            });
            timersRef.current.push(
              setTimeout(finish, PATCH_EXPAND_MS + EXIT_RESERVE_MS / 2),
            );
          } else {
            finish();
          }
        }, 60),
      );
    };

    rafRef.current = requestAnimationFrame(tick);

    // Failsafe: apapun yang terjadi, pasti selesai.
    timersRef.current.push(
      setTimeout(finish, durationMs + EXIT_RESERVE_MS),
    );

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      clearTimers();
    };
  }, [preparedImages, finish, clearTimers, durationMs]);

  if (!visible) return null;

  const isDone = phase !== 'stack';

  return (
    <div
      aria-hidden="true"
      data-nosnippet
      className="boot-loader"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483646,
        display: 'grid',
        placeContent: 'center',
        background: phase === 'expanding' ? 'transparent' : '#ffffff',
        pointerEvents: 'auto',
      }}
    >
      <div
        ref={stackRef}
        className="boot-loader__stack"
        style={{
          aspectRatio: '3 / 4',
          position: 'relative',
          width: 'min(40vw, 420px)',
          zIndex: 2,
          opacity: isDone ? 0 : 1,
          filter: isDone ? 'blur(8px)' : 'none',
          transition: 'opacity .32s ease, filter .32s ease',
        }}
      >
        {preparedImages.map((src, i) => (
          <div
            key={`boot-layer-${i}-${src}`}
            ref={(el) => {
              layerRefs.current[i] = el;
            }}
            className="boot-loader__layer"
            style={{
              aspectRatio: '3 / 4',
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 0,
              overflow: 'hidden',
              background: accentColor,
              border: '1px solid hsla(0,0%,5%,.08)',
              zIndex: i + 1,
            }}
          >
            {src.startsWith('#') ? null : (
              <img
                src={src}
                alt=""
                className="boot-loader__img"
                style={{
                  position: 'absolute',
                  inset: -1,
                  width: 'calc(100% + 2px)',
                  height: 'calc(100% + 2px)',
                  objectFit: 'cover',
                  background: accentColor,
                }}
              />
            )}
          </div>
        ))}
        {showCounter && (
          <div
            className="boot-loader__counter"
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 'calc(100% + 12px)',
              color: accentColor,
              fontSize: 14,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '.02em',
              lineHeight: 1,
              whiteSpace: 'nowrap',
              zIndex: 11,
            }}
          >
            [{counter}]
          </div>
        )}
      </div>

      <div
        ref={patchRef}
        className="boot-loader__patch"
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 0,
          height: 0,
          background: 'transparent',
          boxShadow: '0 0 0 200vmax #ffffff',
          contain: 'paint',
          opacity: phase === 'stack' ? 0 : 1,
          transform: 'translateZ(0) scale(1)',
          transformOrigin: 'center center',
          zIndex: 10,
          pointerEvents: 'none',
          willChange: 'transform, opacity',
        }}
      />
    </div>
  );
}
