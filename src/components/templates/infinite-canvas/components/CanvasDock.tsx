'use client';

import React from 'react';
import { motion } from 'motion/react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { CanvasLeftPanelType } from './CanvasLeftDrawer';

interface CanvasDockProps {
  activeLeftPanel: CanvasLeftPanelType | null;
  onSelectLeftPanel: (panel: CanvasLeftPanelType) => void;
  onProjectClick: () => void;
}

interface DockItemDef {
  id: string;
  label: string;
  onClick: () => void;
  isActive?: boolean;
}

/**
 * CanvasDock — Floating Text Navigation Dock di bagian bawah layar.
 * Menyajikan 5 menu teks interaktif:
 * 1. About Me
 * 2. WA
 * 3. Project
 * 4. Hubungi Saya / Contact Me
 * 5. Noted / Notes
 */
export function CanvasDock({
  activeLeftPanel,
  onSelectLeftPanel,
  onProjectClick,
}: CanvasDockProps) {
  const { locale } = useLanguage();

  const items: DockItemDef[] = [
    {
      id: 'about',
      label: 'About Me',
      onClick: () => onSelectLeftPanel('about'),
      isActive: activeLeftPanel === 'about',
    },
    {
      id: 'wa',
      label: 'WA',
      onClick: () => onSelectLeftPanel('wa'),
      isActive: activeLeftPanel === 'wa',
    },
    {
      id: 'project',
      label: locale === 'en' ? 'Projects' : 'Project',
      onClick: onProjectClick,
      isActive: false,
    },
    {
      id: 'contact',
      label: locale === 'en' ? 'Contact Me' : 'Hubungi Saya',
      onClick: () => onSelectLeftPanel('contact'),
      isActive: activeLeftPanel === 'contact',
    },
    {
      id: 'notes',
      label: locale === 'en' ? 'Notes' : 'Noted',
      onClick: () => onSelectLeftPanel('notes'),
      isActive: activeLeftPanel === 'notes',
    },
  ];

  return (
    <nav
      aria-label="Interactive macOS Dock"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 sm:gap-1.5 p-1.5 rounded-full bg-white/90 dark:bg-neutral-900/90 backdrop-blur-2xl border border-neutral-200/80 dark:border-neutral-800/80 select-none"
    >
      {items.map((item) => (
        <motion.button
          key={item.id}
          type="button"
          onClick={item.onClick}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          className={`relative px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-[13px] font-semibold tracking-tight transition-all duration-200 cursor-pointer ${
            item.isActive
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 ring-1 ring-black/10 dark:ring-white/20'
              : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
          aria-label={item.label}
        >
          {item.label}
          {item.isActive && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-neutral-900 dark:bg-white" />
          )}
        </motion.button>
      ))}
    </nav>
  );
}
