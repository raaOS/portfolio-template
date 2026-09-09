'use client';

import React, { useEffect, useState } from 'react';
import { X, Calendar, User, Tag, Layers } from 'lucide-react';
import type { Project } from '@/types/projects';

interface CanvasProjectModalProps {
  project: Project | null;
  onClose: () => void;
}

export function CanvasProjectModal({ project, onClose }: CanvasProjectModalProps) {
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!project) return null;

  const activeMedia = selectedMedia ?? project.cover;

  const isVideo = (url: string) => url?.endsWith('.mp4') || url?.endsWith('.webm');
  const allMedia = [project.cover, ...(project.gallery || [])].filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[#181820] border border-white/15 rounded-2xl shadow-2xl flex flex-col text-white select-text"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#181820]/90 backdrop-blur-md border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">{project.title}</h2>
            {project.client && (
              <p className="text-xs text-white/50 font-mono mt-0.5">Klien: {project.client}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Media Preview */}
        <div className="relative w-full aspect-[16/10] bg-black/60 overflow-hidden flex items-center justify-center">
          {isVideo(activeMedia) ? (
            <video
              src={activeMedia}
              controls
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-contain"
            />
          ) : imgError ? (
            <div className="flex flex-col items-center justify-center gap-2 text-white/30 p-8 text-center">
              <span className="text-2xl">🖼️</span>
              <span className="text-xs font-mono text-white/50">Gambar Tidak Tersedia / URL Rusak</span>
            </div>
          ) : (
            <img
              src={activeMedia || project.cover}
              alt={project.title}
              className="w-full h-full object-contain"
              onError={() => setImgError(true)}
            />
          )}
        </div>

        {/* Thumbnail gallery if multiple images */}
        {allMedia.length > 1 && (
          <div className="flex gap-2 p-3 overflow-x-auto bg-black/40 border-b border-white/5">
            {allMedia.map((url, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedMedia(url)}
                className={`relative w-16 h-12 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                  activeMedia === url
                    ? 'border-indigo-500 scale-105 shadow-md'
                    : 'border-white/10 opacity-60 hover:opacity-100'
                }`}
              >
                {isVideo(url) ? (
                  <div className="w-full h-full bg-indigo-900/50 flex items-center justify-center text-[9px] font-mono text-white">
                    VIDEO
                  </div>
                ) : (
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Body content */}
        <div className="p-6 space-y-6">
          {/* Metadata Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-white/5 border border-white/5 text-xs">
            {project.year && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <div>
                  <span className="text-white/40 block text-[10px]">Tahun</span>
                  <span className="text-white font-medium">{project.year}</span>
                </div>
              </div>
            )}
            {project.role && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-purple-400" />
                <div>
                  <span className="text-white/40 block text-[10px]">Peran</span>
                  <span className="text-white font-medium">{project.role}</span>
                </div>
              </div>
            )}
            {project.timeline && (
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="text-white/40 block text-[10px]">Durasi</span>
                  <span className="text-white font-medium">{project.timeline}</span>
                </div>
              </div>
            )}
            {project.software && project.software.length > 0 && (
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-400" />
                <div>
                  <span className="text-white/40 block text-[10px]">Software</span>
                  <span className="text-white font-medium truncate max-w-[120px] block">
                    {project.software.join(', ')}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          {project.description && (
            <div className="space-y-2">
              <h4 className="text-xs font-mono uppercase tracking-wider text-white/40">Tentang Proyek</h4>
              <p className="text-sm text-white/80 leading-relaxed whitespace-pre-line">
                {project.description}
              </p>
            </div>
          )}

          {/* Narrative / Case study if present */}
          {project.narrative && (
            <div className="space-y-4 pt-4 border-t border-white/10">
              <h4 className="text-xs font-mono uppercase tracking-wider text-white/40">Case Study</h4>
              <div className="grid md:grid-cols-2 gap-4">
                {project.narrative.challenge && (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-1">
                    <span className="text-xs font-semibold text-rose-300">Tantangan:</span>
                    <p className="text-xs text-white/70">{project.narrative.challenge}</p>
                  </div>
                )}
                {project.narrative.solution && (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-1">
                    <span className="text-xs font-semibold text-emerald-300">Solusi:</span>
                    <p className="text-xs text-white/70">{project.narrative.solution}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tags */}
          {project.tags && project.tags.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-white/10">
              <h4 className="text-xs font-mono uppercase tracking-wider text-white/40">Teknologi & Tag</h4>
              <div className="flex flex-wrap gap-1.5">
                {project.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
