'use client';

import React from 'react';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

interface CanvasControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  zoom: number;
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
}: CanvasControlsProps) {
  return (
    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 p-1.5 rounded-full bg-white/95 backdrop-blur-md border border-neutral-250 shadow-[0_4px_16px_rgba(0,0,0,0.06)] select-none">
      <button
        type="button"
        onClick={onReset}
        title="Reset Kamera ke Pusat"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span className="hidden sm:inline font-mono text-[11px] font-semibold">RESET</span>
      </button>

      <div className="h-4 w-px bg-neutral-200" />

      <button
        type="button"
        onClick={onZoomOut}
        title="Perkecil Kanvas (Zoom Out)"
        className="p-1.5 rounded-full text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
      >
        <ZoomOut className="w-3.5 h-3.5" />
      </button>

      <span className="font-mono text-[11px] font-semibold text-neutral-700 px-1 min-w-10 text-center">
        {Math.round(zoom * 100)}%
      </span>

      <button
        type="button"
        onClick={onZoomIn}
        title="Perbesar Kanvas (Zoom In)"
        className="p-1.5 rounded-full text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
      >
        <ZoomIn className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
