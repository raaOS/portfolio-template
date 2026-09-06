'use client';

import React from 'react';
import type { TemplateRendererProps } from '@/types/template';
import { useCanvasControls } from './hooks/useCanvasControls';
import { CornerBrackets } from './components/CornerBrackets';
import { CanvasControls } from './components/CanvasControls';
import { CanvasProfile } from './components/CanvasProfile';
import { CanvasProject } from './components/CanvasProject';

/**
 * Posisi awal project cards di canvas.
 * Koordinat dalam pixel dari pusat canvas (0, 0).
 * Rotate dalam derajat.
 */
const PROJECT_POSITIONS: Array<{
  offsetX: number;
  offsetY: number;
  rotate: number;
}> = [
  { offsetX: -420, offsetY: -180, rotate: -4 },
  { offsetX: 320, offsetY: -120, rotate: 3 },
  { offsetX: -350, offsetY: 160, rotate: 2 },
  { offsetX: 380, offsetY: 200, rotate: -2 },
  { offsetX: -100, offsetY: -280, rotate: -1 },
  { offsetX: 150, offsetY: 300, rotate: 4 },
  { offsetX: -500, offsetY: 20, rotate: -3 },
  { offsetX: 500, offsetY: -20, rotate: 1 },
];

/**
 * InfiniteCanvasRenderer — Template portfolio dengan infinite canvas.
 *
 * Fitur:
 * - Drag untuk pindah posisi canvas
 * - Zoom in/out via scroll wheel
 * - Reset camera ke posisi awal
 * - Project cards berserakan di canvas
 * - Profile card di tengah
 * - Corner brackets sebagai penanda area
 *
 * Inspired by: https://www.chungsunglau.co.uk/
 */
export default function InfiniteCanvasRenderer({ data }: TemplateRendererProps) {
  const { about, projects } = data;

  const {
    zoom,
    offset,
    isDragging,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    resetCamera,
    zoomIn,
    zoomOut,
  } = useCanvasControls({
    minZoom: 0.3,
    maxZoom: 3,
    zoomStep: 0.1,
    initialZoom: 1,
  });

  return (
    <div
      className="relative h-screen w-full overflow-hidden bg-[#16161b] select-none"
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Corner brackets */}
      <CornerBrackets />

      {/* Controls */}
      <CanvasControls
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onReset={resetCamera}
        zoom={zoom}
      />

      {/* Canvas — bergerak saat drag/zoom */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          willChange: 'transform',
        }}
      >
        {/* Profile di tengah */}
        <CanvasProfile
          name={about?.professional?.bio?.content ? 'Portfolio' : 'My Portfolio'}
          bio={about?.professional?.bio?.content || 'Welcome to my portfolio.'}
          avatarUrl={about?.hero?.backgroundTrail?.[0]
            ? typeof about.hero.backgroundTrail[0] === 'string'
              ? about.hero.backgroundTrail[0]
              : about.hero.backgroundTrail[0].src
            : undefined
          }
        />

        {/* Project cards — berserakan di canvas */}
        {projects?.slice(0, PROJECT_POSITIONS.length).map((project, index) => {
          const pos = PROJECT_POSITIONS[index];
          return (
            <CanvasProject
              key={project.id}
              project={project}
              style={{
                left: `calc(50% + ${pos.offsetX}px)`,
                top: `calc(50% + ${pos.offsetY}px)`,
                transform: `rotate(${pos.rotate}deg)`,
              }}
            />
          );
        })}
      </div>

      {/* Gradient overlay — edges */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#16161b] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#16161b] to-transparent" />
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#16161b] to-transparent" />
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#16161b] to-transparent" />
      </div>
    </div>
  );
}
