// ═══════════════════════════════════════════════════════════════════
// DockItem — inner component Dock (diekstrak dari Dock.tsx, Phase 2).
// Hover physics (spring scale), bounce animation, popover handling,
// click/keyboard handlers, navigation dengan view-transition delay.
//
// Props-driven: menerima `mouseX` MotionValue via prop dan mengukur
// rect-nya sendiri — tidak memegang ref container Dock.
// ═══════════════════════════════════════════════════════════════════
'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { m, useTransform, useSpring, AnimatePresence, MotionValue } from 'motion/react';
import { useSystemSound } from '@/components/os/hooks/useSystemSound';
// next-view-transitions/Link wraps next/link tapi auto-trigger
// document.startViewTransition() di setiap klik. Tanpa ini, slide animation
// antara halaman tidak akan jalan saat user klik dock dari /projects ke
// /?app=about (atau route OS lain). useLinkStatus tetap dari next/link
// karena hook ini context-based dan kompatibel dengan kedua varian.
import { useLinkStatus } from 'next/link';
import { useTransitionRouter } from 'next-view-transitions';
import { Z_LAYERS } from '../utils/zIndexLayers';

// Delay pendek supaya bounce terlihat sebelum route change membuat dock unmount.
const LINK_BOUNCE_DELAY_MS = 90;

export interface DockItemProps {
  id: string;
  icon: React.ReactNode;
  label: string;
  onActivate: () => void;
  href?: string;
  mouseX: MotionValue<number>;
  shouldBounceExternal?: boolean;
  isMobile?: boolean;
  popoverContent?: React.ReactNode;
  isPopoverOpen: boolean;
  onTogglePopover: () => void;
  anyPopoverOpen: boolean;
  disableTooltips?: boolean;
  isOpen?: boolean;
  isFirstItem?: boolean;
  isLastItem?: boolean;
}

export function DockItem({
  id,
  icon,
  label,
  onActivate,
  href,
  mouseX,
  shouldBounceExternal = false,
  isMobile = false,
  popoverContent,
  isPopoverOpen,
  onTogglePopover,
  anyPopoverOpen,
  disableTooltips = false,
  isOpen = false,
  isFirstItem = false,
  isLastItem = false,
}: DockItemProps) {
  const ref = useRef<HTMLDivElement>(null);
  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useTransitionRouter();
  const { playPop } = useSystemSound();
  // Aman dipanggil di luar <Link>: Next.js mengembalikan { pending: false }
  // ketika tidak ada Link parent.
  const { pending } = useLinkStatus();

  // Bounds harus dihitung per-frame: saat satu item magnifies, item-item
  // tetangga visualnya bergeser. Cache statis akan membuat magnifikasi
  // terasa kaku karena distance dihitung pakai posisi awal. N=6 item,
  // getBoundingClientRect modern di-batch dengan layout pass Framer
  // Motion — cost-nya tidak signifikan dibanding visual quality yang
  // hilang kalau bounds di-cache.
  const distance = useTransform(mouseX, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const baseWidth = isMobile ? 48 : 52;
  const hoverScaleMultiplier = isMobile ? 1 : 1.35;
  const scaleSync = useTransform(distance, [-100, 0, 100], [1, hoverScaleMultiplier, 1]);
  const springScale = useSpring(scaleSync, { mass: 0.1, stiffness: 250, damping: 20 });
  const width = useTransform(springScale, (s) => (anyPopoverOpen ? baseWidth : s * baseWidth));
  const height = useTransform(springScale, (s) => (anyPopoverOpen ? baseWidth : s * baseWidth));

  const [bounceKey, setBounceKey] = useState(0);
  const [isBouncing, setIsBouncing] = useState(false);

  useEffect(() => {
    if (!isBouncing) return;
    const timer = setTimeout(() => setIsBouncing(false), 1000);
    return () => clearTimeout(timer);
  }, [isBouncing]);

  useEffect(() => {
    return () => {
      if (navigationTimerRef.current) {
        clearTimeout(navigationTimerRef.current);
      }
    };
  }, []);

  const triggerLocalFeedback = useCallback(() => {
    playPop();
    setIsBouncing(true);
    setBounceKey((prev) => prev + 1);
  }, [playPop]);

  const isLinkWrapped = !!href;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (popoverContent) {
        // Popover: jangan navigate, hanya toggle.
        e.preventDefault();
        e.stopPropagation();
        onTogglePopover();
        return;
      }

      if (isLinkWrapped && href) {
        const shouldUseNativeNavigation =
          e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;

        if (!shouldUseNativeNavigation) {
          // Delay pendek supaya bounce terlihat sebelum route change membuat dock unmount.
          e.preventDefault();
          e.stopPropagation();
          triggerLocalFeedback();
          onActivate();

          if (navigationTimerRef.current) {
            clearTimeout(navigationTimerRef.current);
          }

          navigationTimerRef.current = setTimeout(() => {
            router.push(href);
          }, LINK_BOUNCE_DELAY_MS);
          return;
        }
      }

      // Item biasa: jalankan feedback + onActivate. Link modified-click tetap native.
      triggerLocalFeedback();
      onActivate();
    },
    [href, isLinkWrapped, onActivate, onTogglePopover, popoverContent, router, triggerLocalFeedback]
  );

  // Hanya menangani Enter/Space lokal. Arrow navigation diurus di toolbar
  // level supaya tetap jalan saat focus berada di <Link> anchor parent
  // (event tidak bubble ke React handler m.div di dalamnya).
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (popoverContent && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        onTogglePopover();
        return;
      }

      if (!isLinkWrapped && (e.key === 'Enter' || e.key === ' ')) {
        // Anchor menangani Enter/Space natively (browser men-dispatch
        // click → handleClick di m.div tetap jalan via bubble). Untuk
        // varian button kita aktifkan manual.
        e.preventDefault();
        triggerLocalFeedback();
        onActivate();
      }
    },
    [popoverContent, onTogglePopover, isLinkWrapped, triggerLocalFeedback, onActivate]
  );

  const activeBounce = isBouncing || shouldBounceExternal;

  return (
    <m.div
      key={`${id}-${bounceKey}`}
      id={`dock-item-${id}`}
      ref={ref}
      data-dock-item="true"
      // Saat dibungkus Link, anchor adalah elemen interaktif sebenarnya.
      // m.div jadi presentational supaya tidak ada "interactive nested
      // in interactive" (a11y violation) dan tidak duplikat focus stop.
      data-dock-focusable={isLinkWrapped ? undefined : 'true'}
      style={
        isMobile ? { width: 48, height: 48 } : { width, height, transformOrigin: 'center bottom' }
      }
      animate={
        activeBounce
          ? {
              y: isMobile ? [0, -10, 0, -7, 0, -3, 0] : [0, -18, 0, -12, 0, -5, 0],
              scaleX: isMobile ? [1, 0.9, 1.1, 1] : undefined,
              scaleY: isMobile ? [1, 1.2, 0.9, 1] : undefined,
            }
          : { y: 0 }
      }
      transition={
        activeBounce
          ? {
              duration: 0.85,
              times: [0, 0.14, 0.28, 0.45, 0.62, 0.8, 1],
              ease: ['easeOut', 'easeIn', 'easeOut', 'easeIn', 'easeOut', 'easeIn'],
            }
          : { type: 'spring', mass: 0.1, stiffness: 250, damping: 20 }
      }
      onClick={handleClick}
      className="group relative flex aspect-square shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-[18px] outline-none transition-[filter] duration-200 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
      role={isLinkWrapped ? undefined : 'button'}
      aria-label={isLinkWrapped ? undefined : label}
      // A11y fix (Fase 5): aria-haspopup/aria-expanded hanya valid pada
      // elemen ber-role interaktif. Saat isLinkWrapped, role dihapus (anchor
      // luar yang handle interaksi) -> atribut ini jadi aria-allowed-attr
      // violation (skor A11y mobile os 89).
      aria-haspopup={!isLinkWrapped && popoverContent ? 'menu' : undefined}
      aria-expanded={!isLinkWrapped && popoverContent ? isPopoverOpen : undefined}
      tabIndex={isLinkWrapped ? -1 : 0}
      onKeyDown={handleKeyDown}
    >
      {!isMobile && !isPopoverOpen && !anyPopoverOpen && !disableTooltips && (
        <div
          data-dock-tooltip="true"
          className={`pointer-events-none absolute -top-12 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded border border-black/5 bg-white px-2 py-1 text-[10px] font-medium text-black opacity-0 transition-opacity ${anyPopoverOpen || disableTooltips ? '' : 'group-hover:opacity-100'}`}
        >
          {label}
        </div>
      )}

      <AnimatePresence>
        {isPopoverOpen && popoverContent && (
          <m.div
            initial={{
              opacity: 0,
              y: 10,
              scale: 0.8,
              x: isFirstItem ? '0%' : isLastItem ? '-100%' : '-50%',
            }}
            animate={{
              opacity: 1,
              y: -20,
              scale: 1,
              x: isFirstItem ? '0%' : isLastItem ? '-100%' : '-50%',
            }}
            exit={{
              opacity: 0,
              y: 10,
              scale: 0.8,
              x: isFirstItem ? '0%' : isLastItem ? '-100%' : '-50%',
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            // viewTransitionName: pisahkan popover dari snapshot 'global-dock'.
            // Tanpa ini, popover ikut tertangkap di snapshot dock dan
            // memperbesar bbox snapshot OLD jauh ke atas (popover extend ~200px
            // di atas dock). Akibatnya `::view-transition-group(global-dock)`
            // jadi punya size/position berbeda antara OLD dan NEW → walau
            // animation:none, NEW dock snapshot dirender dengan offset di
            // dalam group → user lihat "dock ikut slide sepersekian detik".
            // Dengan name sendiri, popover punya pair (exit-only di route
            // tujuan) yang dimatikan via display:none di globals.css. Slot
            // dock jadi tetap kecil dan konsisten.
            style={{ zIndex: Z_LAYERS.DOCK_POPOVER, viewTransitionName: 'dock-popover' }}
            className={`absolute bottom-full mb-3 ${
              isFirstItem ? 'left-0' : isLastItem ? 'right-0' : 'left-1/2 -translate-x-1/2'
            } rounded-2xl border border-white/40 bg-zinc-100 ring-1 ring-black/5`}
            onClick={(e) => e.stopPropagation()}
          >
            {React.cloneElement(popoverContent as React.ReactElement<{ onSelect?: () => void }>, {
              onSelect: onTogglePopover,
            })}
            <div
              className={`absolute bottom-[-6px] h-3 w-3 rotate-45 border-b border-r border-white/40 bg-zinc-100 ${
                isFirstItem ? 'left-8' : isLastItem ? 'right-8' : 'left-1/2 -translate-x-1/2'
              }`}
            />
          </m.div>
        )}
      </AnimatePresence>

      {/* Premium Navigation Hint (Loading Ring) — hanya aktif kalau ada Link parent */}
      <AnimatePresence>
        {pending && (
          <m.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{
              opacity: [0.2, 0.6, 0.2],
              scale: [1, 1.2, 1],
            }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            className="pointer-events-none absolute inset-0 z-0 rounded-2xl bg-black/10 ring-1 ring-black/20"
          />
        )}
      </AnimatePresence>

      <div className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden rounded-[18px]">
        {React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
          className: 'w-full h-full',
        })}
      </div>

      {isOpen && (
        <div className="absolute bottom-[3px] left-1/2 h-[4px] w-[4px] -translate-x-1/2 rounded-full bg-black/60 dark:bg-white/80" />
      )}
    </m.div>
  );
}
