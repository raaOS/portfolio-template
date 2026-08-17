'use client';

import React, { useCallback, useState } from 'react';
import { m } from 'motion/react';
import { Grid, Box } from 'lucide-react';
import Link from 'next/link';
import { useTransitionRouter } from 'next-view-transitions';
import { AnimatePresence } from 'motion/react';

interface ModeOption {
  id: string;
  label: string;
  icon: React.ElementType;
  view: string;
  description: string;
}

const MODES: ModeOption[] = [
  {
    id: 'grid',
    label: 'Grid View',
    icon: Grid,
    view: 'grid',
    description: 'Pinterest style masonry',
  },
  {
    id: 'canvas',
    label: '3D Canvas',
    icon: Box,
    view: '3d',
    description: 'Infinite 3D exploration',
  },
];

const STAGGER_BASE_DELAY = 0.1;
const STAGGER_INCREMENT = 0.05;

interface DockProjectModesProps {
  onSelect?: () => void;
  projectsBasePath?: string;
}

export default function DockProjectModes({
  onSelect,
  projectsBasePath = '',
}: DockProjectModesProps) {
  const router = useTransitionRouter();
  const [pendingMode, setPendingMode] = useState<string | null>(null);
  const normalizedBasePath = projectsBasePath && projectsBasePath !== '/' ? projectsBasePath : '';

  // Preload NonOSChrome as soon as the popover mounts to act as a fast safety net
  React.useEffect(() => {
    import('@/components/layout/NonOSChrome').catch(() => {});
  }, []);

  const handleModeSelect = useCallback(
    (mode: ModeOption) => (e: React.MouseEvent) => {
      // Prevent default Link navigation dan pakai useTransitionRouter
      // biar slide animation kena trigger.
      e.preventDefault();
      // Reset direction ke forward eksplisit — atribut `data-vt-direction='back'`
      // bisa tertinggal dari interaksi sebelumnya (mis. user pernah klik
      // back button). Tanpa reset, slide animasi akan terbalik dan terlihat
      // seperti "tidak ada efek".
      if (typeof document !== 'undefined') {
        document.documentElement.removeAttribute('data-vt-direction');
      }
      setPendingMode(mode.id);
      router.push(`${normalizedBasePath}/projects?view=${mode.view}`);
      onSelect?.();
    },
    [normalizedBasePath, onSelect, router]
  );

  return (
    <div
      className="flex min-w-[180px] flex-col gap-1 p-2"
      role="menu"
      aria-label="Select project view mode"
    >
      {/* Title Header */}
      <div className="mb-1 px-3 py-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-black/40">
          Select View Mode
        </span>
      </div>

      <div className="flex flex-col gap-1">
        {MODES.map((mode, idx) => (
          <ModeButton
            key={mode.id}
            mode={mode}
            idx={idx}
            href={`${normalizedBasePath}/projects?view=${mode.view}`}
            pending={pendingMode === mode.id}
            onClick={handleModeSelect(mode)}
          />
        ))}
      </div>
    </div>
  );
}

interface ModeButtonProps {
  mode: ModeOption;
  idx: number;
  href: string;
  pending: boolean;
  onClick: (e: React.MouseEvent) => void;
}

function ModeButton({ mode, idx, href, pending, onClick }: ModeButtonProps) {
  return (
    <Link
      href={href}
      role="menuitem"
      aria-label={`${mode.label}: ${mode.description}`}
      onClick={onClick}
      prefetch={true}
      className="group/mode relative flex w-full items-center gap-3 overflow-hidden rounded-xl border border-transparent p-2.5 text-left no-underline transition-all hover:border-[#00880B] hover:bg-[#E6F7E8] focus-visible:border-[#00880B] focus-visible:bg-[#E6F7E8] focus-visible:outline-none active:border-[#00880B] active:bg-[#E6F7E8]"
    >
      <AnimatePresence>
        {pending && (
          <m.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1.1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            className="pointer-events-none absolute inset-0 z-0 rounded-xl bg-[#00880B]/5 ring-1 ring-[#00880B]/20"
          />
        )}
      </AnimatePresence>

      <m.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: idx * STAGGER_INCREMENT + STAGGER_BASE_DELAY, duration: 0.2 }}
        className="relative z-10 flex w-full items-center gap-3"
      >
        {/* Micro Preview Container */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 transition-all group-hover/mode:bg-[#E6F7E8] group-focus-visible/mode:bg-[#E6F7E8] group-active/mode:bg-[#E6F7E8]">
          <mode.icon
            className="h-5 w-5 text-zinc-900 transition-colors group-hover/mode:text-[#00880B] group-focus-visible/mode:text-[#00880B] group-active/mode:text-[#00880B]"
            strokeWidth={1.5}
          />
        </div>

        <div className="flex flex-col">
          <span className="mb-1 text-sm font-semibold leading-none text-zinc-900 transition-colors group-hover/mode:text-[#00880B] group-focus-visible/mode:text-[#00880B] group-active/mode:text-[#00880B]">
            {mode.label}
          </span>
          <span className="text-[10px] leading-none text-zinc-700 transition-colors group-hover/mode:text-[#00880B] group-focus-visible/mode:text-[#00880B] group-active/mode:text-[#00880B]">
            {mode.description}
          </span>
        </div>
      </m.div>
    </Link>
  );
}
