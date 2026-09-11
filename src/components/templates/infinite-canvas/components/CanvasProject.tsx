'use client';

import React from 'react';
import type { Project } from '@/types/projects';

interface CanvasProjectProps {
  project: Project;
  style?: React.CSSProperties;
  onSelect?: (project: Project) => void;
  hasDragged?: boolean;
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
 * Menampilkan thumbnail, tag, tahun, dan event onClick untuk membuka modal detail.
 */
export function CanvasProject({ project, style, onSelect, hasDragged }: CanvasProjectProps) {
  const thumbnailUrl = project.cover ? getThumbnailUrl(project.cover) : null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasDragged) return;
    onSelect?.(project);
  };

  return (
    <div
      className="absolute group cursor-pointer select-none -translate-x-1/2 -translate-y-1/2 hover:z-30 transition-[z-index] duration-200"
      style={style}
      onClick={handleClick}
    >
      <div className="relative w-60 md:w-64 bg-white rounded-xl overflow-hidden border border-neutral-200 shadow-[0_4px_20px_rgba(0,0,0,0.05)] transition-all duration-300 group-hover:scale-105 group-hover:border-neutral-900 group-hover:shadow-[0_16px_36px_rgba(0,0,0,0.12)]">
        {/* Cover / Thumbnail */}
        <div className="relative w-full aspect-[16/10] bg-neutral-100 overflow-hidden border-b border-neutral-100">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={project.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                if (img.src !== project.cover) {
                  img.src = project.cover;
                }
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xs font-mono">
              NO PREVIEW
            </div>
          )}

          {/* Category / Year Badge Overlay */}
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
            {(project.type || (project.tags && project.tags[0])) && (
              <span className="px-2 py-0.5 rounded bg-white/90 backdrop-blur-sm text-[10px] font-mono font-semibold text-neutral-800 border border-neutral-200/80 shadow-xs uppercase tracking-wider">
                {project.type || project.tags?.[0]}
              </span>
            )}
            {project.year && (
              <span className="px-2 py-0.5 rounded bg-white/90 backdrop-blur-sm text-[10px] font-mono font-medium text-neutral-600 border border-neutral-200/80 shadow-xs">
                {project.year}
              </span>
            )}
          </div>
        </div>

        {/* Content Info */}
        <div className="p-3.5 space-y-1.5">
          <h3 className="text-neutral-900 text-sm font-semibold tracking-tight truncate group-hover:text-black transition-colors">
            {project.title}
          </h3>
          {project.description && (
            <p className="text-neutral-500 text-xs line-clamp-2 leading-relaxed">
              {project.description}
            </p>
          )}

          {/* Tags */}
          {project.tags && project.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {project.tags.slice(0, 3).map((tag, idx) => (
                <span
                  key={idx}
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 border border-neutral-200/60"
                >
                  #{tag}
                </span>
              ))}
              {project.tags.length > 3 && (
                <span className="text-[9px] font-mono text-neutral-400 self-center">
                  +{project.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Hover action badge */}
        <div className="absolute bottom-2.5 right-2.5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
          <span className="px-2 py-0.5 rounded bg-neutral-900 text-white text-[10px] font-mono font-medium shadow-sm">
            DETAIL ↗
          </span>
        </div>
      </div>
    </div>
  );
}
