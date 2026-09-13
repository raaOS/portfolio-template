'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'motion/react';
import { RotateCcw, ZoomIn, ZoomOut, Grid2X2, Grid3X3, Square } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import type { LottieRefCurrentProps } from 'lottie-react';
import logoAnimationData from '../../../../../public/lottie/mata.json';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

export type CanvasGridStyle = 'dots' | 'grid' | 'blank';

const GRID_OPTIONS: { id: CanvasGridStyle; label: string; Icon: typeof Grid2X2 }[] = [
  { id: 'dots', label: 'DOTS', Icon: Grid2X2 },
  { id: 'grid', label: 'GRID', Icon: Grid3X3 },
  { id: 'blank', label: 'BLANK', Icon: Square },
];

interface CanvasControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  zoom: number;
  className?: string;
  isAdmin?: boolean;
  loginUrl?: string;
  gridStyle?: CanvasGridStyle;
  onSetGridStyle?: (style: CanvasGridStyle) => void;
}

/**
 * SecretEyeLogin — Ikon animasi mata (Lottie mata.json) bergaya discreet branding.
 * Pengunjung umum hanya melihatnya sebagai logo animasi estetik ("Portfolio OS"),
 * namun bagi pemilik website, mengklik mata ini akan membuka portal login admin.
 */
function SecretEyeLogin({ loginUrl }: { loginUrl: string }) {
  const prefersReducedMotion = useReducedMotion();
  const lottieRef = useRef<LottieRefCurrentProps | null>(null);

  useEffect(() => {
    const instance = lottieRef.current;
    return () => {
      instance?.destroy?.();
    };
  }, []);

  return (
    <a
      href={loginUrl}
      title="Portfolio OS"
      aria-label="Portfolio OS"
      className="relative flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full overflow-hidden transition-transform hover:scale-110 active:scale-90"
    >
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <Lottie
          lottieRef={lottieRef}
          animationData={logoAnimationData}
          loop={!prefersReducedMotion}
          autoplay={!prefersReducedMotion}
          rendererSettings={{ preserveAspectRatio: 'xMidYMid meet' }}
          style={{ width: 64, height: 64 }}
          aria-hidden="true"
        />
      </div>
    </a>
  );
}

/**
 * CanvasControls — Tombol kontrol zoom & reset kamera di bagian atas.
 * Dikemas dalam kapsul glassmorphism mengambang yang elegan dan konsisten dengan HUD bawah.
 */
export function CanvasControls({
  onZoomIn,
  onZoomOut,
  onReset,
  zoom,
  className = 'top-6',
  isAdmin = false,
  loginUrl = '/admin/login?redirect=/preview/infinite-canvas',
  gridStyle = 'dots',
  onSetGridStyle,
}: CanvasControlsProps) {
  const [gridOpen, setGridOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const closeGrid = useCallback(() => setGridOpen(false), []);

  useEffect(() => {
    if (!gridOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (gridRef.current && !gridRef.current.contains(e.target as Node)) {
        closeGrid();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [gridOpen, closeGrid]);

  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 p-1.5 rounded-full bg-white/95 dark:bg-neutral-900/90 backdrop-blur-md border border-neutral-250 dark:border-white/10 select-none transition-all duration-300 ${className}`}
    >
      <button
        type="button"
        onClick={onReset}
        title="Reset Kamera ke Pusat"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span className="hidden sm:inline font-mono text-[11px] font-semibold">RESET</span>
      </button>

      <div className="h-4 w-px bg-neutral-200 dark:bg-white/15" />

      <div className="flex items-center">
        <button
          type="button"
          onClick={onZoomOut}
          title="Perkecil Kanvas (Zoom Out)"
          className="flex items-center justify-center px-2.5 py-1.5 rounded-full text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <span className="font-mono text-[11px] leading-none font-semibold text-neutral-700 dark:text-neutral-200 min-w-12 text-center">
          {Math.round(zoom * 100)}%
        </span>

        <button
          type="button"
          onClick={onZoomIn}
          title="Perbesar Kanvas (Zoom In)"
          className="flex items-center justify-center px-2.5 py-1.5 rounded-full text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Canvas Grid Style Dropdown (Dots / Blueprint Grid / Blank) */}
      {onSetGridStyle && (
        <>
          <div className="h-4 w-px bg-neutral-200 dark:bg-white/15" />
          <div ref={gridRef} className="relative">
            <button
              type="button"
              onClick={() => setGridOpen((p) => !p)}
              title="Pilih Gaya Grid Latar Belakang"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
              aria-label="Pilih gaya grid latar belakang kanvas"
              aria-expanded={gridOpen}
            >
              {gridStyle === 'dots' && <Grid2X2 className="w-3.5 h-3.5" />}
              {gridStyle === 'grid' && <Grid3X3 className="w-3.5 h-3.5" />}
              {gridStyle === 'blank' && <Square className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline font-mono text-[11px] font-semibold uppercase">
                {gridStyle === 'dots' ? 'DOTS' : gridStyle === 'grid' ? 'GRID' : 'BLANK'}
              </span>
            </button>

            <AnimatePresence>
              {gridOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                  style={{ x: '-50%' }}
                  className="absolute top-full mt-2 left-1/2 min-w-[140px] rounded-lg bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border border-neutral-200 dark:border-white/10 shadow-lg py-1.5 z-30"
                >
                  {GRID_OPTIONS.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        onSetGridStyle(id);
                        closeGrid();
                      }}
                      className={`flex items-center gap-2.5 w-full px-4 py-2 text-xs font-medium transition-colors cursor-pointer ${
                        gridStyle === id
                          ? 'text-neutral-900 dark:text-white bg-neutral-100 dark:bg-white/10'
                          : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="font-mono text-[11px] font-semibold uppercase">{label}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* Secret Logo Icon: Mata Lottie Bergerak (Disguised Admin Login) */}
      {!isAdmin && (
        <>
          <div className="h-4 w-px bg-neutral-200 dark:bg-white/15" />
          <SecretEyeLogin loginUrl={loginUrl} />
        </>
      )}
    </div>
  );
}
