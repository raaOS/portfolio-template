'use client';

import React, { useEffect, useState } from 'react';
import { X, Calendar, User, Tag, Layers, ImageOff } from 'lucide-react';
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white border border-neutral-200 rounded-2xl flex flex-col text-neutral-900 select-text"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white/95 backdrop-blur-md border-b border-neutral-200">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-neutral-900">{project.title}</h2>
            {project.client && (
              <p className="text-xs text-neutral-500 font-mono mt-0.5">Klien: {project.client}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Media Preview */}
        <div className="relative w-full aspect-[16/10] bg-neutral-100 overflow-hidden flex items-center justify-center border-b border-neutral-200">
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
            <div className="flex flex-col items-center justify-center gap-2 text-neutral-400 p-8 text-center">
              <ImageOff className="w-8 h-8 text-neutral-400" />
              <span className="text-xs font-mono text-neutral-500 uppercase tracking-wide">Gambar Tidak Tersedia</span>
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
          <div className="flex gap-2 p-3 overflow-x-auto bg-neutral-50 border-b border-neutral-200">
            {allMedia.map((url, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedMedia(url)}
                className={`relative w-16 h-12 rounded-lg overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                  activeMedia === url
                    ? 'border-neutral-900 ring-1 ring-neutral-900 scale-105'
                    : 'border-neutral-200 opacity-70 hover:opacity-100'
                }`}
              >
                {isVideo(url) ? (
                  <div className="w-full h-full bg-neutral-800 flex items-center justify-center text-[9px] font-mono text-white font-semibold">
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-neutral-50 border border-neutral-200 text-xs">
            {project.year && (
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-neutral-700 shrink-0" />
                <div>
                  <span className="text-neutral-400 block text-[10px] font-mono uppercase">Tahun</span>
                  <span className="text-neutral-900 font-semibold">{project.year}</span>
                </div>
              </div>
            )}
            {project.role && (
              <div className="flex items-center gap-2.5">
                <User className="w-4 h-4 text-neutral-700 shrink-0" />
                <div>
                  <span className="text-neutral-400 block text-[10px] font-mono uppercase">Peran</span>
                  <span className="text-neutral-900 font-semibold">{project.role}</span>
                </div>
              </div>
            )}
            {project.timeline && (
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-neutral-700 shrink-0" />
                <div>
                  <span className="text-neutral-400 block text-[10px] font-mono uppercase">Durasi</span>
                  <span className="text-neutral-900 font-semibold">{project.timeline}</span>
                </div>
              </div>
            )}
            {project.software && project.software.length > 0 && (
              <div className="flex items-center gap-2.5">
                <Tag className="w-4 h-4 text-neutral-700 shrink-0" />
                <div>
                  <span className="text-neutral-400 block text-[10px] font-mono uppercase">Software</span>
                  <span className="text-neutral-900 font-semibold truncate max-w-[120px] block">
                    {project.software.join(', ')}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          {project.description && (
            <div className="space-y-2">
              <h4 className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold">Tentang Proyek</h4>
              <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-line">
                {project.description}
              </p>
            </div>
          )}

          {/* Narrative / Case study if present */}
          {project.narrative && (
            <div className="space-y-4 pt-4 border-t border-neutral-100">
              <h4 className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold">Case Study</h4>
              <div className="grid md:grid-cols-2 gap-4">
                {project.narrative.challenge && (
                  <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-1">
                    <span className="text-xs font-bold text-neutral-900 font-mono uppercase">Tantangan:</span>
                    <p className="text-xs text-neutral-600 leading-relaxed">{project.narrative.challenge}</p>
                  </div>
                )}
                {project.narrative.solution && (
                  <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-1">
                    <span className="text-xs font-bold text-neutral-900 font-mono uppercase">Solusi:</span>
                    <p className="text-xs text-neutral-600 leading-relaxed">{project.narrative.solution}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tags */}
          {project.tags && project.tags.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-neutral-100">
              <h4 className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold">Teknologi & Tag</h4>
              <div className="flex flex-wrap gap-1.5">
                {project.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-md bg-neutral-100 border border-neutral-200 text-neutral-700 text-xs font-mono font-medium"
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
