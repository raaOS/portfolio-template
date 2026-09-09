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
      className="absolute group cursor-pointer select-none"
      style={style}
      onClick={handleClick}
    >
      <div className="relative w-56 md:w-64 bg-[#1c1c24]/90 rounded-xl overflow-hidden border border-white/10 shadow-xl transition-all duration-300 group-hover:scale-105 group-hover:border-indigo-500/50 group-hover:shadow-2xl group-hover:shadow-indigo-500/10">
        {/* Cover / Thumbnail */}
        <div className="relative w-full aspect-[16/10] bg-black/40 overflow-hidden">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={project.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                if (img.src !== project.cover) {
                  img.src = project.cover;
                }
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/30 text-xs font-mono">
              No Preview
            </div>
          )}

          {/* Category / Year Badge Overlay */}
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
            {(project.type || (project.tags && project.tags[0])) && (
              <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-mono text-white/90 border border-white/10 uppercase tracking-wider">
                {project.type || project.tags?.[0]}
              </span>
            )}
            {project.year && (
              <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-mono text-white/70 border border-white/10">
                {project.year}
              </span>
            )}
          </div>
        </div>

        {/* Content Info */}
        <div className="p-3.5 space-y-1">
          <h3 className="text-white text-sm font-medium tracking-tight truncate group-hover:text-indigo-400 transition-colors">
            {project.title}
          </h3>
          {project.description && (
            <p className="text-white/50 text-xs line-clamp-2 leading-relaxed">
              {project.description}
            </p>
          )}

          {/* Tags */}
          {project.tags && project.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1.5">
              {project.tags.slice(0, 3).map((tag, idx) => (
                <span
                  key={idx}
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-white/60"
                >
                  #{tag}
                </span>
              ))}
              {project.tags.length > 3 && (
                <span className="text-[9px] font-mono text-white/40 self-center">
                  +{project.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Click prompt overlay on hover */}
        <div className="absolute inset-0 bg-indigo-600/10 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity flex items-center justify-center">
          <span className="px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-[11px] font-medium border border-white/20 shadow-lg">
            Buka Detail ↗
          </span>
        </div>
      </div>
    </div>
  );
}
