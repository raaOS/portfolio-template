'use client';

import React from 'react';
import type { Project } from '@/types/projects';

interface CanvasProjectProps {
  project: Project;
  style?: React.CSSProperties;
}

/**
 * Mengubah URL cover menjadi URL gambar untuk thumbnail.
 * Jika cover .mp4 → ambil .jpg yang sama nama.
 * Jika cover sudah .jpg/.png → return langsung.
 */
function getThumbnailUrl(cover: string): string {
  if (cover.endsWith('.mp4')) {
    return cover.replace('.mp4', '.jpg');
  }
  return cover;
}

/**
 * CanvasProject — Kartu project yang ditempatkan di canvas.
 * Bisa di-rotate, di-position, dan diklik untuk buka detail.
 *
 * @param style — CSS style untuk posisi/rotate (contoh: { left: 100, top: 200, rotate: -3 })
 */
export function CanvasProject({ project, style }: CanvasProjectProps) {
  const thumbnailUrl = project.cover ? getThumbnailUrl(project.cover) : null;

  return (
    <div
      className="absolute group cursor-pointer select-none"
      style={style}
    >
      <div className="relative w-48 md:w-56 transition-transform duration-300 group-hover:scale-105">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={project.title}
            className="w-full aspect-[4/3] object-cover rounded-sm border border-white/10"
            loading="lazy"
            onError={(e) => {
              // Fallback: coba load cover asli (mungkin video, tampilkan poster)
              const img = e.target as HTMLImageElement;
              if (img.src !== project.cover) {
                img.src = project.cover;
              }
            }}
          />
        ) : (
          <div className="w-full aspect-[4/3] bg-white/5 rounded-sm border border-white/10 flex items-center justify-center text-white/30 text-xs">
            No Image
          </div>
        )}
        {/* Label project — muncul saat hover */}
        <div className="absolute -bottom-6 left-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-white/60 text-[10px] font-mono uppercase tracking-wider">
            – {project.title}
          </span>
        </div>
      </div>
    </div>
  );
}
