// ═══════════════════════════════════════════════════════════════════
// SECTION: Core Dock (magnifikasi, popover terpusat, dnd-kit reorder)
// DockItem (hover physics, bounce, popover) → ./DockItem.tsx
// GlobalDock (wrapper non-OS routes)  → ./GlobalDock.tsx
// OSDock (wrapper route OS desktop)   → ./OSDock.tsx
// File ini: core Dock — mouse tracking magnifikasi, state popover
// terpusat, dnd-kit sortable + admin persist, glass material.
// ═══════════════════════════════════════════════════════════════════
'use client';

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useMotionValue } from 'motion/react';
import type { DockPreferences } from '@/types/about';
import { Link } from 'next-view-transitions';
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
import { Z_LAYERS } from '../utils/zIndexLayers';
import { DockItem } from './DockItem';

export { GlobalDock } from './GlobalDock';
export { OSDock } from './OSDock';
export type { OSDockProps } from './OSDock';

/**
 * Dock implementation — single source untuk semua varian.
 *
 * Tiga ekspor (GlobalDock/OSDock di file terpisah, re-export di sini
 * supaya import path lama `@/components/os/core/Dock` tetap valid):
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
    alignItems: isMobile ? ('center' as const) : ('end' as const),
    touchAction: isMobile ? ('manipulation' as const) : ('none' as const),
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...(isMobile ? {} : listeners)}>
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

/**
 * Komponen Dock inti. DnD context, sensors, drag handlers, glass material,
 * tooltip suppression, sound integration, bounce animation orchestration.
 */
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

    let cleanup: (() => void) | undefined;
    const timer = setTimeout(() => {
      const handleOutside = (e: MouseEvent | TouchEvent) => {
        const target = e.target as Node | null;
        if (target && target instanceof Element && target.closest('[data-dock-toolbar="true"]')) {
          return;
        }
        closePopover();
      };

      window.addEventListener('click', handleOutside);
      window.addEventListener('touchstart', handleOutside);

      cleanup = () => {
        window.removeEventListener('click', handleOutside);
        window.removeEventListener('touchstart', handleOutside);
      };
    }, 50);

    return () => {
      clearTimeout(timer);
      if (cleanup) cleanup();
    };
  }, [anyPopoverOpen, closePopover]);

  useEffect(() => {
    isClientHydrated = true;
    const frame = requestAnimationFrame(() => setIsMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const dockBaseWidth =
    sortedItems.length > 0 ? sortedItems.length * 52 + (sortedItems.length - 1) * 10 + 32 : 0;
  const hoverCaptureWidth = dockBaseWidth + 120;

  const tickingRef = React.useRef(false);
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (anyPopoverOpen) return;
      if (tickingRef.current) return;
      tickingRef.current = true;
      requestAnimationFrame(() => {
        mouseX.set(e.clientX);
        tickingRef.current = false;
      });
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
            className="fixed bottom-0 left-1/2 h-24 -translate-x-1/2 cursor-default"
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
          className={`pointer-events-auto relative ${isMobile ? 'max-w-[90vw]' : ''}`}
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
            className={`pointer-events-none absolute inset-0 overflow-hidden ${
              isMobile ? 'h-[68px] rounded-[24px]' : 'h-[72px] rounded-[22px]'
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
              items={sortedItems.map((item) => item.id)}
              strategy={horizontalListSortingStrategy}
            >
              {/* Icon row */}
              <div
                className={`relative z-10 flex ${
                  isMobile
                    ? 'scrollbar-hide h-[68px] items-center justify-center gap-2 overflow-visible px-5 py-2'
                    : 'h-[72px] items-end gap-2.5 px-4 py-2.5'
                }`}
                style={{
                  minWidth: isMobile ? 'auto' : dockBaseWidth,
                }}
              >
                {sortedItems.map((item, index) => {
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
                      isLastItem={index === sortedItems.length - 1}
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
                      <div className="flex items-end rounded-[18px] focus-visible:outline-none">
                        {dockItem}
                      </div>
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
