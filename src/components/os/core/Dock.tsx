// ═══════════════════════════════════════════════════════════════════
// SECTION: Imports & Constants (L1-88)
// Imports: motion/react, @dnd-kit, next-view-transitions, contexts
// Constants: LINK_BOUNCE_DELAY_MS, DockProps type
// ═══════════════════════════════════════════════════════════════════
'use client';

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  m,
  useMotionValue,
  useTransform,
  useSpring,
  MotionValue,
  AnimatePresence,
} from 'motion/react';
import { useSystemSound } from '@/components/os/hooks/useSystemSound';
import type { AboutData, DockPreferences } from '@/types/about';
// next-view-transitions/Link wraps next/link tapi auto-trigger
// document.startViewTransition() di setiap klik. Tanpa ini, slide animation
// antara halaman tidak akan jalan saat user klik dock dari /projects ke
// /?app=about (atau route OS lain). useLinkStatus tetap dari next/link
// karena hook ini context-based dan kompatibel dengan kedua varian.
import { Link } from 'next-view-transitions';
import { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import { useTransitionRouter } from 'next-view-transitions';
import { Grid, User, Mail, FileText } from 'lucide-react';
import AppIcon from '../ui/AppIcon';
import WhatsAppIcon from '../ui/WhatsAppIcon';
import DockProjectModes from '../ui/DockProjectModes';
import { useWindowContext } from '@/contexts/WindowContext';
import { getDockItemConfig } from '../utils/dockUtils';
import { markBack } from '@/lib/navigationDirection';
import {
  buildTenantHomeHref,
  buildTenantProjectsHref,
  getTenantBasePath,
} from '@/lib/routing/tenantRoutes';
import { Z_LAYERS } from '../utils/zIndexLayers';
import { DockPortal } from '@/components/layout/GlobalDockSlot';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { applyDockItemOrder } from '../utils/dockOrder';

const LINK_BOUNCE_DELAY_MS = 280;

/**
 * Dock implementation — single source untuk semua varian.
 *
 * Tiga ekspor:
 *   - default `Dock`        — komponen presentational (icons + glass material)
 *   - named  `OSDock`       — wrapper untuk route OS desktop (`/`)
 *   - named  `GlobalDock`   — wrapper untuk route non-OS (`/projects`, dst)
 *
 * OSDock dan GlobalDock mutually exclusive: OSDock dipasang dari
 * UIOverlaysLayer di route `/`, GlobalDock dipasang dari NonOSChrome
 * di route lain (return null saat di `/`).
 *
 * Pattern penting yang harus dipertahankan:
 * - Items yang menavigasi ke route lain harus mengirim `href`. Dock akan
 *   membungkus item dengan `<Link prefetch>` untuk navigasi + prefetch
 *   bawaan Next.js. `onClick` dijalankan SEBELUM Link push (mis. untuk
 *   `markBack()`), navigasi sendiri dilakukan oleh Link — JANGAN memanggil
 *   `router.push` di `onClick` lagi (akan double-navigate).
 * - Items tanpa `href` (mis. di OSDock saat sudah di route `/`) memakai
 *   tombol biasa: klik langsung memanggil `onClick` (mis. `openWindow`)
 *   tanpa mengubah URL.
 * - Popover (mis. Project mode selector) memakai state terpusat di Dock,
 *   bukan per-item, supaya outside-click handler hanya satu listener.
 */

interface DockItemProps {
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

// ═══════════════════════════════════════════════════════════════════
// SECTION: DockItem Component (L89-326)
// Inner component: hover physics (spring scale), bounce animation,
// popover handling, click/keyboard handlers, navigation with view-transition
// ═══════════════════════════════════════════════════════════════════
function DockItem({
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

  const baseWidth = isMobile ? 64 : 72;
  const magnification = isMobile ? 88 : 110;
  const hoverScaleMultiplier = magnification / baseWidth;
  const scaleSync = useTransform(distance, isMobile ? [-100, 0, 100] : [-140, 0, 140], [
    1,
    hoverScaleMultiplier,
    1,
  ]);
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
        isMobile
          ? { width: 'clamp(44px, 13vw, 52px)', height: 'clamp(44px, 13vw, 52px)' }
          : { width, height, transformOrigin: 'center bottom' }
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
      className="group relative flex aspect-square shrink-0 cursor-pointer items-center justify-center rounded-[18px] outline-none transition-[filter] duration-200 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
      role={isLinkWrapped ? undefined : 'button'}
      aria-label={isLinkWrapped ? undefined : label}
      aria-haspopup={popoverContent ? 'menu' : undefined}
      aria-expanded={popoverContent ? isPopoverOpen : undefined}
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

// ═══════════════════════════════════════════════════════════════════
// SECTION: SortableDockItem & Sort Helper (L335-395)
// @dnd-kit sortable wrapper + sortDockItemsWithLocalOrder
// ═══════════════════════════════════════════════════════════════════
export interface DockItemData {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  /** Jika diisi, item akan dirender di dalam <Link> dengan prefetch. */
  href?: string;
  isOpen?: boolean;
  popoverContent?: React.ReactNode;
}

interface DockProps {
  items: DockItemData[];
  bouncingId?: string | null;
  isMobile?: boolean;
  dockConfig?: DockPreferences;
  siteId?: string;
}

function SortableDockItem({
  id,
  children,
  isMobile,
}: {
  id: string;
  children: React.ReactNode;
  isMobile?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: isMobile,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? Z_LAYERS.DOCK + 10 : 'auto',
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'end',
    touchAction: isMobile ? 'manipulation' : 'none',
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

function sortDockItemsWithLocalOrder(rawItems: DockItemData[]): DockItemData[] {
  if (typeof window === 'undefined') return rawItems;
  const localOrderRaw = localStorage.getItem('visitor-dock-order');
  if (localOrderRaw) {
    try {
      const localOrder = JSON.parse(localOrderRaw) as string[];
      if (Array.isArray(localOrder) && localOrder.length > 0) {
        return applyDockItemOrder(rawItems, localOrder);
      }
    } catch (e) {
      console.warn('Failed to parse visitor dock order:', e);
    }
  }
  return rawItems;
}

// Module-level flag to track client-side hydration.
// Persists across client-side page transitions to bypass the 1-frame hydration guard
// and render the full Dock synchronously during view transitions.
let isClientHydrated = false;

// ═══════════════════════════════════════════════════════════════════
// SECTION: Main Dock Component (L400-745) — export default
// DnD context, sensors, drag handlers, glass material, tooltip,
// sound integration, bounce animation orchestration
// ═══════════════════════════════════════════════════════════════════
export default function Dock({
  items,
  bouncingId,
  isMobile = false,
  dockConfig,
  siteId = 'default-site',
}: DockProps) {
  const mouseX = useMotionValue(Infinity);
  const [isMounted, setIsMounted] = useState(isClientHydrated);
  const [activePopoverId, setActivePopoverId] = useState<string | null>(null);
  const [disableTooltips, setDisableTooltips] = useState(false);
  const prevPopoverIdRef = useRef<string | null>(null);

  const { isAdmin, csrfToken } = useAdminAuth();
  const [isDraggingActive, setIsDraggingActive] = useState(false);

  // Sync sortedItems when items prop changes (moved from render body to effect)
  const [sortedItems, setSortedItems] = useState<DockItemData[]>(() =>
    sortDockItemsWithLocalOrder(items)
  );

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const prevIds = sortedItems.map((item) => item.id).join(',');
    const sortedRaw = sortDockItemsWithLocalOrder(items);
    const sortedRawIds = sortedRaw.map((item) => item.id).join(',');
    if (prevIds === sortedRawIds) {
      const itemMap = new Map(items.map((item) => [item.id, item]));
      setSortedItems(
        sortedItems.map(
          (item) =>
            ({
              ...item,
              ...itemMap.get(item.id),
            }) as DockItemData
        )
      );
    } else {
      setSortedItems(sortedRaw);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const pointerSensorConfig = useMemo(() => ({ activationConstraint: { distance: 8 } }), []);
  const sensors = useSensors(useSensor(PointerSensor, pointerSensorConfig));

  const handleDragStart = useCallback(() => {
    setIsDraggingActive(true);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setIsDraggingActive(false);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      let updatedOrderIds: string[] = [];

      setSortedItems((prev) => {
        const oldIndex = prev.findIndex((i) => i.id === active.id);
        const newIndex = prev.findIndex((i) => i.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;

        const newItems = [...prev];
        const [movedItem] = newItems.splice(oldIndex, 1);
        newItems.splice(newIndex, 0, movedItem);

        updatedOrderIds = newItems.map((item) => item.id);
        return newItems;
      });

      if (updatedOrderIds.length > 0) {
        if (isAdmin) {
          const updatedDockConfig: DockPreferences = {};
          const currentPrefs = dockConfig || {};

          updatedOrderIds.forEach((id, index) => {
            updatedDockConfig[id] = {
              ...(currentPrefs[id] || {}),
              order: index,
            };
          });

          try {
            const response = await fetch('/api/about', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrfToken,
              },
              credentials: 'include',
              body: JSON.stringify({ siteId, dockConfig: updatedDockConfig }),
            });
            if (!response.ok) {
              console.error('Failed to save admin dock order on backend');
            }
          } catch (err) {
            console.error('Network error saving admin dock order:', err);
          }
        } else {
          localStorage.setItem('visitor-dock-order', JSON.stringify(updatedOrderIds));
        }
      }
    },
    [isAdmin, csrfToken, dockConfig, siteId]
  );

  // Suppress tooltips for 1000ms when any popover is closed (e.g. view mode selected)
  // to cover the page transition gap and prevent flash overlays.
  useEffect(() => {
    if (prevPopoverIdRef.current !== null && activePopoverId === null) {
      setDisableTooltips(true);
      const timer = setTimeout(() => setDisableTooltips(false), 1000);
      return () => clearTimeout(timer);
    }
    prevPopoverIdRef.current = activePopoverId;
  }, [activePopoverId]);

  // Stable callback (functional setState). Sebelumnya callback recreated setiap
  // render → DockItem.useEffect ngedaftar/clean-up window listener berkali-kali.
  const togglePopover = useCallback((id: string) => {
    setActivePopoverId((prev) => {
      if (prev === id) {
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-dock-popover-closing', 'true');
          setTimeout(() => {
            document.documentElement.removeAttribute('data-dock-popover-closing');
          }, 1000);
        }
        return null;
      }
      return id;
    });
  }, []);

  const closePopover = useCallback(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-dock-popover-closing', 'true');
      setTimeout(() => {
        document.documentElement.removeAttribute('data-dock-popover-closing');
      }, 1000);
    }
    setActivePopoverId(null);
  }, []);

  const anyPopoverOpen = activePopoverId !== null;

  // Reset magnifikasi saat popover terbuka — hanya satu efek di parent,
  // bukan satu listener per item.
  useEffect(() => {
    if (anyPopoverOpen) mouseX.set(Infinity);
  }, [anyPopoverOpen, mouseX]);

  // Outside click untuk menutup popover — single listener di parent Dock.
  useEffect(() => {
    if (!anyPopoverOpen) return;
    const handleOutside = () => closePopover();
    window.addEventListener('click', handleOutside);
    return () => window.removeEventListener('click', handleOutside);
  }, [anyPopoverOpen, closePopover]);

  useEffect(() => {
    isClientHydrated = true;
    const frame = requestAnimationFrame(() => setIsMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const filteredItems = sortedItems;

  const dockBaseWidth =
    filteredItems.length > 0 ? filteredItems.length * 64 + (filteredItems.length - 1) * 8 + 24 : 0;
  const hoverCaptureWidth = dockBaseWidth + 160;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (anyPopoverOpen) return;
      mouseX.set(e.clientX);
    },
    [anyPopoverOpen, mouseX]
  );

  const handleMouseLeave = useCallback(() => {
    mouseX.set(Infinity);
  }, [mouseX]);

  // Arrow navigation di tingkat toolbar — bekerja konsisten baik untuk
  // tombol biasa maupun item yang dibungkus <Link>. focus berpindah antar
  // elemen yang ditandai data-dock-focusable.
  const handleToolbarKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const toolbar = e.currentTarget;
    const focusables = Array.from(
      toolbar.querySelectorAll<HTMLElement>('[data-dock-focusable="true"]')
    );
    if (focusables.length === 0) return;
    const active = document.activeElement as HTMLElement | null;
    const idx = focusables.findIndex((el) => el === active || el.contains(active));
    if (idx === -1) return;
    e.preventDefault();
    const next =
      e.key === 'ArrowRight'
        ? focusables[Math.min(idx + 1, focusables.length - 1)]
        : focusables[Math.max(idx - 1, 0)];
    next?.focus();
  }, []);

  const togglePopoverHandlers = useMemo(() => {
    const map: Record<string, () => void> = {};
    for (const item of items) {
      map[item.id] = () => togglePopover(item.id);
    }
    return map;
  }, [items, togglePopover]);

  if (!isMounted) {
    // Static placeholder during SSR; mencegah hydration mismatch karena
    // initial state Framer Motion berbeda antara server dan client.
    return <div className="print:hidden" style={{ opacity: 0 }} aria-hidden="true" />;
  }

  return (
    <div className="print:hidden">
      <div>
        {/* Hit-area transparan: capture mouse move di atas konten halaman
                    (mis. masonry grid) supaya magnifikasi tetap bekerja terlepas
                    dari stacking context. Hanya mode desktop. */}
        {!isMobile && (
          <div
            className="fixed bottom-0 left-1/2 h-28 -translate-x-1/2 cursor-default"
            style={{
              width: hoverCaptureWidth,
              pointerEvents: anyPopoverOpen ? 'none' : 'auto',
              background: 'transparent',
              zIndex: Z_LAYERS.DOCK,
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            aria-hidden="true"
          />
        )}
        <nav
          data-dock-toolbar="true"
          className={`pointer-events-auto relative ${isMobile ? 'max-w-[95vw]' : ''}`}
          style={{ zIndex: Z_LAYERS.DOCK }}
          role="toolbar"
          aria-label="Application dock"
          aria-orientation="horizontal"
          onKeyDown={handleToolbarKeyDown}
          // Hit-area dan nav menangani region berbeda, BUKAN duplikat:
          //   - Hit-area: cursor mendekati dock dari atas/samping
          //     (magnifikasi "approach" sebelum cursor masuk dock).
          //   - Nav: cursor berada di atas icon row. Icon punya
          //     pointer-events sendiri, mouseMove tidak bubble ke
          //     hit-area (sibling, bukan ancestor). Tanpa handler di
          //     sini, magnifikasi mati saat cursor di atas icon.
          onMouseMove={isMobile ? undefined : handleMouseMove}
          onMouseLeave={isMobile ? undefined : handleMouseLeave}
        >
          {/* iOS-style transparent glass without blur: translucent layers, border, and shadow only. */}
          <div
            className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[28px] ${
              isMobile ? 'h-[72px]' : 'h-[96px]'
            }`}
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.44) 0%, rgba(255,255,255,0.24) 46%, rgba(255,255,255,0.16) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.52)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.72), inset 0 -1px 0 rgba(0,0,0,0.08)',
            }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.35),transparent_58%)]" />
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredItems.map((item) => item.id)}
              strategy={horizontalListSortingStrategy}
            >
              {/* Icon row */}
              <div
                className={`relative z-10 flex items-end ${
                  isMobile
                    ? 'scrollbar-hide h-[76px] gap-1 overflow-visible px-1.5 py-2'
                    : 'h-[104px] gap-1.5 px-3 py-4'
                }`}
                style={{
                  minWidth: isMobile ? 'auto' : dockBaseWidth,
                }}
              >
                {filteredItems.map((item, index) => {
                  const dockItem = (
                    <DockItem
                      key={item.id}
                      id={item.id}
                      icon={item.icon}
                      label={item.label}
                      onActivate={item.onClick}
                      href={item.href}
                      mouseX={mouseX}
                      popoverContent={item.popoverContent}
                      isPopoverOpen={activePopoverId === item.id}
                      onTogglePopover={togglePopoverHandlers[item.id]}
                      anyPopoverOpen={anyPopoverOpen || isDraggingActive}
                      shouldBounceExternal={bouncingId === item.id}
                      isMobile={isMobile}
                      disableTooltips={disableTooltips}
                      isOpen={item.isOpen}
                      isFirstItem={index === 0}
                      isLastItem={index === filteredItems.length - 1}
                    />
                  );

                  const renderedItem =
                    item.href && !item.popoverContent ? (
                      <Link
                        key={item.id}
                        href={item.href}
                        prefetch={true}
                        data-dock-focusable="true"
                        aria-label={item.label}
                        className="flex items-end rounded-[18px] no-underline focus-visible:outline-none"
                      >
                        {dockItem}
                      </Link>
                    ) : (
                      dockItem
                    );

                  return (
                    <SortableDockItem key={item.id} id={item.id} isMobile={isMobile}>
                      {renderedItem}
                    </SortableDockItem>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </nav>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SECTION: GlobalDock (L755-880) — named export for non-OS routes
// Hidden on `/`, active on /projects, /contact, etc.
// Uses DockPortal to render into GlobalDockSlot
// ═══════════════════════════════════════════════════════════════════
/**
 * GlobalDock — Dock untuk route non-OS (mis. /projects, /contact).
 * Pada route OS desktop (`/`) komponen ini disembunyikan; OSDock yang aktif.
 */
export function GlobalDock({ dockConfig }: { dockConfig?: DockPreferences }) {
  const pathname = usePathname();
  const router = useTransitionRouter();
  const { isWindowOpen, bouncingDocId } = useWindowContext();
  const [isMobile, setIsMobile] = useState(false);
  const projectsHref = buildTenantProjectsHref(pathname);
  const projectsBasePath = getTenantBasePath(pathname);

  useEffect(() => {
    const syncViewport = () => setIsMobile(window.innerWidth < 768);
    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  // Stable handler: markBack untuk view transition arah, navigasi sendiri
  // ditangani oleh <Link> di dalam Dock. Tidak ada router.push manual lagi.
  const markNav = useCallback(() => {
    markBack();
  }, []);

  // Pisahkan struktur item statis dari status `isOpen` agar reference stabil
  // (lihat fix #9): defaultItems hanya bergantung pada handler stable; status
  // `isOpen` di-merge belakangan tanpa membuat icon node baru.
  const baseItems = useMemo<DockItemData[]>(() => {
    const items: DockItemData[] = [
      {
        id: 'projects',
        label: 'Projects',
        icon: <AppIcon icon={Grid} color="from-zinc-700 to-zinc-900" />,
        onClick: isMobile
          ? () => {
              if (typeof document !== 'undefined') {
                document.documentElement.removeAttribute('data-vt-direction');
              }
              router.push(projectsHref);
            }
          : () => {},
        href: isMobile ? projectsHref : undefined,
        popoverContent: <DockProjectModes projectsBasePath={projectsBasePath} />,
      },
      {
        id: 'about',
        label: 'About Me',
        icon: <AppIcon icon={User} color="from-gray-300 to-gray-400" />,
        onClick: markNav,
        href: buildTenantHomeHref(pathname, '?app=about'),
      },
      {
        id: 'whatsapp',
        label: 'WhatsApp',
        icon: <WhatsAppIcon />,
        onClick: markNav,
        href: buildTenantHomeHref(pathname, '?app=whatsapp'),
      },
      {
        id: 'contact',
        label: 'Contact',
        icon: <AppIcon icon={Mail} color="from-blue-400 to-indigo-500" />,
        onClick: markNav,
        href: buildTenantHomeHref(pathname, '?app=contact'),
      },
      {
        id: 'notes',
        label: 'Notes',
        icon: <AppIcon icon={FileText} color="from-yellow-300 to-orange-400" />,
        onClick: markNav,
        href: buildTenantHomeHref(pathname, '?app=notes'),
      },
    ];
    return getDockItemConfig(items, dockConfig);
  }, [markNav, dockConfig, isMobile, router, projectsBasePath, projectsHref, pathname]);

  // Status `isOpen` di-merge tanpa membuat ulang icon/popoverContent —
  // mencegah re-create React elements setiap mutasi window state.
  const dockItems = useMemo<DockItemData[]>(() => {
    return baseItems.map((item) => {
      switch (item.id) {
        case 'about':
          return { ...item, isOpen: isWindowOpen('about') };
        case 'whatsapp':
          return { ...item, isOpen: isWindowOpen('whatsapp') };
        case 'notes':
          return { ...item, isOpen: isWindowOpen('notes') };
        default:
          return item;
      }
    });
  }, [baseItems, isWindowOpen]);

  // SSR-safe: pathname null saat server. Sembunyikan di route OS desktop
  // dan admin. (`/about` dropped — route tidak ada lagi.)
  if (
    !pathname ||
    pathname === '/' ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/preview/os-desktop')
  ) {
    return null;
  }

  return (
    <DockPortal>
      <div className="pointer-events-auto">
        <Dock
          items={dockItems}
          bouncingId={bouncingDocId}
          isMobile={isMobile}
          dockConfig={dockConfig}
        />
      </div>
    </DockPortal>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SECTION: OSDock (L890-1030) — named export for OS desktop route `/`
// Window context integration, item config, isOpen state tracking
// ═══════════════════════════════════════════════════════════════════
/**
 * OSDock — Dock untuk route OS desktop (`/`).
 *
 * Item DI SINI tidak memakai `href`: klik membuka window via state context
 * yang di-pass dari parent (UIOverlaysLayer), bukan navigasi route.
 * Mencegah double-action yang sebelumnya muncul saat anchor `<Link>` ikut
 * push URL ke `/?app=...` setelah window sudah dibuka oleh `onClick`.
 */
export interface OSDockProps {
  aboutData?: AboutData;
  siteId?: string;
  onOpenWindow: (windowId: string) => void;
  onOpenWhatsApp: () => void;
  onOpenContact: () => void;
  onOpenNotes: () => void;
  onOpenTrash?: () => void;
  isWindowOpen: (windowId: string) => boolean;
  notesVisible: boolean;
  bouncingId?: string | null;
  className?: string;
  isMobile?: boolean;
}

export function OSDock({
  aboutData,
  siteId,
  onOpenWindow,
  onOpenWhatsApp,
  onOpenContact,
  onOpenNotes,
  isWindowOpen,
  notesVisible,
  bouncingId,
  className,
  isMobile = false,
}: OSDockProps) {
  const router = useTransitionRouter();
  const pathname = usePathname();
  const projectsHref = buildTenantProjectsHref(pathname);
  const projectsBasePath = getTenantBasePath(pathname);

  // Stable handler — projects adalah satu-satunya item OS yang menavigasi
  // ke route lain. Pakai useTransitionRouter agar view-transition arah
  // tetap kena snapshot. markForward() sebelum push memastikan slide
  // direction default (kanan-ke-kiri) tidak ter-warisi dari `data-vt-direction='back'`
  // yang mungkin tertinggal dari klik back button sebelumnya.
  const handleOpenProjects = useCallback(() => {
    // Reset direction ke forward eksplisit — kalau atribut `back` masih
    // melekat dari interaksi sebelumnya (mis. back button view), animasi
    // slide akan terbalik (slide ke kanan, terlihat "tidak ada efek"
    // karena halaman lama masih kelihatan saat halaman baru masuk dari kiri).
    if (typeof document !== 'undefined') {
      document.documentElement.removeAttribute('data-vt-direction');
    }
    router.push(projectsHref);
  }, [router, projectsHref]);

  // Pisahkan struktur item dari status `isOpen`: icon nodes hanya dibuat
  // sekali, lalu status `isOpen` di-merge tanpa rebuild elements.
  const baseItems = useMemo<DockItemData[]>(() => {
    const items: DockItemData[] = [
      {
        id: 'projects',
        label: 'Projects',
        icon: <AppIcon icon={Grid} color="from-zinc-700 to-zinc-900" />,
        onClick: handleOpenProjects,
        href: isMobile ? projectsHref : undefined,
        popoverContent: <DockProjectModes projectsBasePath={projectsBasePath} />,
      },
      {
        id: 'about',
        label: 'About Me',
        icon: <AppIcon icon={User} color="from-gray-300 to-gray-400" />,
        onClick: () => onOpenWindow('about'),
      },
      {
        id: 'whatsapp',
        label: 'WhatsApp',
        icon: <WhatsAppIcon />,
        onClick: onOpenWhatsApp,
      },
      {
        id: 'contact',
        label: 'Contact',
        icon: <AppIcon icon={Mail} color="from-blue-400 to-indigo-500" />,
        onClick: onOpenContact,
      },
      {
        id: 'notes',
        label: 'Notes',
        icon: <AppIcon icon={FileText} color="from-yellow-300 to-orange-400" />,
        onClick: onOpenNotes,
      },
    ];
    return getDockItemConfig(items, aboutData?.dockConfig);
  }, [
    aboutData?.dockConfig,
    handleOpenProjects,
    onOpenWindow,
    onOpenWhatsApp,
    onOpenContact,
    onOpenNotes,
    isMobile,
    projectsBasePath,
    projectsHref,
  ]);

  const dockItems = useMemo<DockItemData[]>(() => {
    return baseItems.map((item) => {
      switch (item.id) {
        case 'about':
          return { ...item, isOpen: isWindowOpen('about') };
        case 'whatsapp':
          return { ...item, isOpen: isWindowOpen('whatsapp') };
        case 'contact':
          return { ...item, isOpen: isWindowOpen('contact') };
        case 'notes':
          return { ...item, isOpen: notesVisible };
        default:
          return item;
      }
    });
  }, [baseItems, isWindowOpen, notesVisible]);

  return (
    <div className={className}>
      <Dock
        items={dockItems}
        bouncingId={bouncingId}
        isMobile={isMobile}
        dockConfig={aboutData?.dockConfig}
        siteId={siteId}
      />
    </div>
  );
}
