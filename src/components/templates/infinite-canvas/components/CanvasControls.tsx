'use client';

import React from 'react';

interface CanvasControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  zoom: number;
}

/**
 * CanvasControls — Tombol kontrol canvas di bagian atas.
 * [ RESET CAM (•) ] [ ZOOM IN (+) ] [ ZOOM OUT (-) ]
 */
export function CanvasControls({
  onZoomIn,
  onZoomOut,
  onReset,
  zoom,
}: CanvasControlsProps) {
  return (
    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 flex gap-6 font-mono text-xs text-white/50 select-none">
      <button
        onClick={onReset}
        className="hover:text-white transition-colors cursor-pointer"
      >
        [ RESET CAM (•) ]
      </button>
      <button
        onClick={onZoomIn}
        className="hover:text-white transition-colors cursor-pointer"
      >
        [ ZOOM IN (+) ]
      </button>
      <button
        onClick={onZoomOut}
        className="hover:text-white transition-colors cursor-pointer"
      >
        [ ZOOM OUT (-) ]
      </button>
      <span className="text-white/30">
        {Math.round(zoom * 100)}%
      </span>
    </div>
  );
}
