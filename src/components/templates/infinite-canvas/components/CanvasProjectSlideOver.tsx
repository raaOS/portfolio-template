'use client';

import React, { useEffect, useState } from 'react';
import { X, Maximize2, Minimize2, Minus, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Project } from '@/types/projects';
import ProjectDetailWrapper from '@/components/os/ui/ProjectDetailWrapper';

interface CanvasProjectSlideOverProps {
  project: Project | null;
  projects: Project[];
  siteId?: string;
  onClose: () => void;
}

/**
 * CanvasProjectSlideOver — Panel detail proyek yang meluncur dari kanan (Right Slide-Over Drawer).
 * Layout dan styling identik dengan jendela icon project di template macOS desktop:
 * - macOS Window Titlebar dengan traffic lights (merah, kuning, hijau)
 * - Tampilan dua kolom: Media cover + Vertical interaction bar di kiri,
 *   dan Tab ringkasan / narasi proses / galeri / komentar di kanan.
 */
export function CanvasProjectSlideOver({
  project,
  projects,
  siteId = 'default-site',
  onClose,
}: CanvasProjectSlideOverProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <AnimatePresence>
      {project && (
        <>
          {/* Backdrop Blur Overlay */}
          <motion.div
            key="project-slide-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-xs cursor-pointer"
            aria-hidden="true"
          />

          {/* Right Slide-Over Panel */}
          <motion.div
            key="project-slide-drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className={`fixed top-0 right-0 bottom-0 z-50 flex flex-col bg-white dark:bg-neutral-950 border-l border-neutral-200 dark:border-neutral-800 transition-[width,max-width] duration-300 ${
              isExpanded ? 'w-full max-w-6xl' : 'w-full max-w-4xl'
            }`}
          >
            {/* macOS Window Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-black/10 dark:border-white/10 bg-gray-100/90 dark:bg-neutral-900/90 backdrop-blur-md select-none shrink-0">
              {/* macOS Traffic Light Buttons */}
              <div className="group/traffic flex items-center gap-[7px] shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Tutup jendela"
                  style={{ width: 12, height: 12, minWidth: 12, minHeight: 12, maxWidth: 12, maxHeight: 12 }}
                  className="relative p-0 m-0 border-0 rounded-full bg-[#FF5F57] hover:brightness-95 active:brightness-90 flex items-center justify-center cursor-pointer outline-none ring-1 ring-black/15 shrink-0"
                >
                  <X className="w-2 h-2 text-black/60 opacity-0 group-hover/traffic:opacity-100 transition-opacity stroke-[3]" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Minimalkan jendela"
                  style={{ width: 12, height: 12, minWidth: 12, minHeight: 12, maxWidth: 12, maxHeight: 12 }}
                  className="relative p-0 m-0 border-0 rounded-full bg-[#FEBC2E] hover:brightness-95 active:brightness-90 flex items-center justify-center cursor-pointer outline-none ring-1 ring-black/15 shrink-0"
                >
                  <Minus className="w-2 h-2 text-black/60 opacity-0 group-hover/traffic:opacity-100 transition-opacity stroke-[3]" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsExpanded((prev) => !prev)}
                  aria-label="Perlebar ukuran jendela"
                  style={{ width: 12, height: 12, minWidth: 12, minHeight: 12, maxWidth: 12, maxHeight: 12 }}
                  className="relative p-0 m-0 border-0 rounded-full bg-[#28C840] hover:brightness-95 active:brightness-90 flex items-center justify-center cursor-pointer outline-none ring-1 ring-black/15 shrink-0"
                >
                  <Plus className="w-2 h-2 text-black/60 opacity-0 group-hover/traffic:opacity-100 transition-opacity stroke-[3]" />
                </button>
                <div className="ml-2.5 flex items-center gap-2 min-w-0">
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200 truncate max-w-xs sm:max-w-md">
                    Portfolio: {project.title}
                  </span>
                  {project.type && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-200/70 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 shrink-0">
                      {project.type}
                    </span>
                  )}
                </div>
              </div>

              {/* Right Window Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsExpanded((prev) => !prev)}
                  className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  title={isExpanded ? 'Kembalikan Ukuran' : 'Maksimalkan Ukuran'}
                >
                  {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  title="Tutup (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* macOS Window Content (ProjectDetailWrapper / ProjectDetailTwoColumn) */}
            <div className="flex-1 overflow-hidden relative">
              <ProjectDetailWrapper
                project={project}
                projects={projects}
                siteId={siteId}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
