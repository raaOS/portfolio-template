'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Move } from 'lucide-react';
import type { Project } from '@/types/projects';

interface CanvasProjectProps {
  project: Project;
  style?: React.CSSProperties;
  onSelect?: (project: Project) => void;
  hasDragged?: boolean;
  isAdminMode?: boolean;
  zoom?: number;
  currentOffsetX?: number;
  currentOffsetY?: number;
  eager?: boolean;
  onPositionChange?: (id: string, newOffsetX: number, newOffsetY: number) => void;
}

/**
 * Mengubah URL cover menjadi URL gambar untuk thumbnail.
 */
function getThumbnailUrl(cover: string): string {
  if (cover.endsWith('.mp4')) {
    return cover.replace('.mp4', '.jpg');
  }
  return cover;
}

/**
 * CanvasProject — Kartu project yang ditempatkan di canvas.
 * - Mode Visitor: Klik membuka detail slide-over, drag kanvas menggeser ruang visual.
 * - Mode Admin: Kartu dapat di-drag langsung untuk mengatur koordinatnya di kanvas.
 */
export function CanvasProject({
  project,
  style,
  onSelect,
  hasDragged,
  isAdminMode = false,
  zoom = 1,
  currentOffsetX = 0,
  currentOffsetY = 0,
  eager = false,
  onPositionChange,
}: CanvasProjectProps) {
  const [isDraggingCard, setIsDraggingCard] = useState(false);
  const dragInfoRef = useRef<{
    startX: number;
    startY: number;
    startClientX: number;
    startClientY: number;
    hasMoved: boolean;
  } | null>(null);

  const thumbnailUrl = project.cover ? getThumbnailUrl(project.cover) : null;

  // Pointer down handler khusus Mode Admin untuk drag-to-reposition
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isAdminMode) return;

    // Hentikan propagasi agar background kanvas tidak ikut bergeser
    e.stopPropagation();

    dragInfoRef.current = {
      startX: currentOffsetX,
      startY: currentOffsetY,
      startClientX: e.clientX,
      startClientY: e.clientY,
      hasMoved: false,
    };

    setIsDraggingCard(true);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!dragInfoRef.current) return;

      const deltaScreenX = moveEvent.clientX - dragInfoRef.current.startClientX;
      const deltaScreenY = moveEvent.clientY - dragInfoRef.current.startClientY;

      // Ambang batas 5px untuk membedakan antara klik dan drag
      if (
        !dragInfoRef.current.hasMoved &&
        Math.hypot(deltaScreenX, deltaScreenY) > 5
      ) {
        dragInfoRef.current.hasMoved = true;
      }

      if (dragInfoRef.current.hasMoved) {
        // Kompensasikan dengan tingkat pembesaran (zoom) kanvas
        const deltaCanvasX = deltaScreenX / (zoom || 1);
        const deltaCanvasY = deltaScreenY / (zoom || 1);

        onPositionChange?.(
          project.id,
          Math.round(dragInfoRef.current.startX + deltaCanvasX),
          Math.round(dragInfoRef.current.startY + deltaCanvasY)
        );
      }
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);

      const hadMoved = dragInfoRef.current?.hasMoved;
      dragInfoRef.current = null;
      setIsDraggingCard(false);

      // Jika hanya klik tanpa digeser, buka detail project
      if (!hadMoved) {
        onSelect?.(project);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasDragged) return;
    if (isAdminMode) return; // Klik di-handle oleh pointer-up pada mode admin
    onSelect?.(project);
  };

  const isVideo =
    project.cover?.endsWith('.mp4') ||
    project.cover?.endsWith('.webm') ||
    Boolean(project.autoplay);

  // LCP/teater-streaming fix (2026-09-25): kartu video dulu langsung mount
  // <video autoPlay preload> -> 4 video x ~3MB (11MB) tersedot di window
  // LCP + di-fetch berulang (terukur x5 per URL via range request 206).
  // Sekarang: poster <img> dulu; <video> baru di-mount saat hover atau
  // setelah idle (khusus kartu eager) supaya autoplay tetap hidup tanpa
  // memangsa bandwidth/parse budget fase boot.
  const [videoActive, setVideoActive] = useState(false);
  useEffect(() => {
    if (!isVideo || !eager) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let idleId: number | undefined;
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const start = () => {
      if (!cancelled) setVideoActive(true);
    };
    if (typeof w.requestIdleCallback === 'function') {
      idleId = w.requestIdleCallback(start, { timeout: 3000 });
    } else {
      timer = setTimeout(start, 1500);
    }
    return () => {
      cancelled = true;
      if (idleId !== undefined && typeof w.cancelIdleCallback === 'function') {
        w.cancelIdleCallback(idleId);
      }
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [isVideo, eager]);

  // Ratio asli dari database coverWidth/coverHeight, fallback ke natural dimension saat media termuat
  const [aspectRatio, setAspectRatio] = useState<string>(() => {
    if (
      project.coverWidth &&
      project.coverHeight &&
      project.coverWidth > 0 &&
      project.coverHeight > 0
    ) {
      return `${project.coverWidth} / ${project.coverHeight}`;
    }
    return '4 / 5';
  });

  const ratioVal = (() => {
    const parts = aspectRatio.split('/');
    if (parts.length === 2) {
      const w = parseFloat(parts[0]);
      const h = parseFloat(parts[1]);
      if (w > 0 && h > 0) return w / h;
    }
    return 0.8;
  })();

  // Lebar proporsional: aset vertikal (story) lebih ramping, landscape lebih lebar
  const widthClass =
    ratioVal < 0.65
      ? 'w-48 sm:w-52 md:w-56'
      : ratioVal <= 1.0
      ? 'w-56 sm:w-64 md:w-72'
      : 'w-64 sm:w-76 md:w-84';

  return (
    <div
      data-testid={`canvas-project-${project.id}`}
      aria-label={project.title}
      title={project.title}
      className={`absolute group select-none -translate-x-1/2 -translate-y-1/2 transition-[z-index] duration-200 ${
        isAdminMode
          ? isDraggingCard
            ? 'cursor-grabbing z-50'
            : 'cursor-grab z-20 hover:z-40'
          : 'cursor-pointer hover:z-30'
      }`}
      style={style}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerEnter={() => {
        if (isVideo) setVideoActive(true);
      }}
    >
      <div
        className={`relative ${widthClass} bg-neutral-100 dark:bg-neutral-900 rounded-2xl overflow-hidden border transition-all duration-300 ${
          isAdminMode
            ? isDraggingCard
              ? 'scale-105 border-amber-500 ring-4 ring-amber-400/40'
              : 'border-amber-300/80 dark:border-amber-500/40 ring-1 ring-amber-400/20 group-hover:border-amber-500'
            : 'border-white/40 dark:border-white/10 group-hover:scale-105 group-hover:border-neutral-900 dark:group-hover:border-white'
        }`}
        style={{
          aspectRatio,
        }}
      >
        {/* Pure Media Display (Image or Video) — Mengikuti rasio asli 100% tanpa crop */}
        {isVideo && project.cover ? (
          videoActive ? (
            <video
              src={project.cover}
              poster={thumbnailUrl || undefined}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                if (v.videoWidth && v.videoHeight) {
                  setAspectRatio(`${v.videoWidth} / ${v.videoHeight}`);
                }
              }}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <img
              src={thumbnailUrl || project.cover}
              alt={project.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading={eager ? 'eager' : 'lazy'}
              fetchPriority={eager ? 'high' : 'auto'}
              decoding={eager ? 'sync' : 'async'}
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth && img.naturalHeight) {
                  setAspectRatio(`${img.naturalWidth} / ${img.naturalHeight}`);
                }
              }}
            />
          )
        ) : thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={project.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading={eager ? 'eager' : 'lazy'}
            fetchPriority={eager ? 'high' : 'auto'}
            decoding={eager ? 'sync' : 'async'}
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth && img.naturalHeight) {
                setAspectRatio(`${img.naturalWidth} / ${img.naturalHeight}`);
              }
            }}
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              if (img.src !== project.cover) {
                img.src = project.cover;
              }
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-neutral-200 dark:bg-neutral-800 text-neutral-400">
            <span className="sr-only">{project.title}</span>
          </div>
        )}

        {/* Indikator Handle Drag Khusus Mode Admin */}
        {isAdminMode && (
          <div
            title="Tarik untuk memindahkan posisi"
            className="absolute top-2.5 right-2.5 flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/95 text-neutral-950 backdrop-blur-xs ring-1 ring-black/10"
          >
            <Move className="w-3 h-3" />
          </div>
        )}
      </div>
    </div>
  );
}

