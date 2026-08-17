'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { DockPreferences } from '@/types/about';
import GlobalDockSlot from './GlobalDockSlot';
import { GlobalDock } from '@/components/os/core/Dock';
import { WindowProvider } from '@/contexts/WindowContext';
import { isTenantRoute } from '@/lib/routing/tenantRoutes';

/**
 * NonOSChrome (motion + Header + Dock + WindowRenderer + ControlCenter +
 * CalendarPopout) di-lazy load.
 *
 * Manfaat utama:
 * - Homepage `/` (OS desktop) dan semua route admin TIDAK ikut bawa chunk
 *   `motion/react`, `lucide-react/Header`, GlobalDock, WindowRenderer,
 *   ControlCenter, CalendarPopout di initial JS bundle.
 * - Cold-start visitor (mostly hit `/`) dapat HTML + skeleton wallpaper tanpa
 *   menunggu motion/react di-parse.
 * - Route non-OS (mis. `/projects`, `/contact`, `/cv`) tetap dapat chrome
 *   lengkap; chunk-nya di-fetch on-demand setelah hydration.
 *
 * `ssr: false` aman karena chrome ini cuma punya komponen interaktif (dock,
 * window manager). Server tetap render `{children}` dan SEO tidak terdampak.
 */
const NonOSChrome = dynamic(() => import('./NonOSChrome'), {
  ssr: false,
});

import { LazyMotion, domAnimation } from 'motion/react';

export default function LayoutClient({
  children,
  modal,
  dockConfig,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
  dockConfig?: DockPreferences;
}) {
  const pathname = usePathname();
  const isAdminRequest = pathname?.startsWith('/admin');
  const isTenantRequest = isTenantRoute(pathname ?? null);
  const isOsMode =
    pathname === '/' ||
    pathname?.startsWith('/about-test') ||
    pathname?.startsWith('/about') ||
    pathname?.includes('/demo') ||
    isTenantRequest;

  // Slot dock yang persistent: dirender di level non-lazy supaya element
  // dengan viewTransitionName 'global-dock' selalu ada di kedua snapshot
  // saat navigasi `/` ↔ non-OS. OSDock & GlobalDock portal kontennya
  // ke slot ini. Admin tidak butuh dock.
  //
  // PENTING: slot dirender di posisi yang SAMA di kedua branch (terakhir,
  // di luar conditional) agar React reconciler tidak unmount/remount node-nya
  // saat pathname berubah. Kalau slot pernah unmount, DOM element dengan
  // viewTransitionName lenyap di tengah transisi → fallback ke root animation
  // → dock terlihat ikut slide.
  const showDockSlot = !isAdminRequest;
  const showGlobalDock = !isAdminRequest && !isOsMode;

  const content =
    isAdminRequest || isOsMode ? (
      <>
        {children}
        {modal}
      </>
    ) : (
      <NonOSChrome modal={modal}>{children}</NonOSChrome>
    );

  return (
    <WindowProvider>
      <LazyMotion features={domAnimation}>
        {content}
        {showDockSlot && <GlobalDockSlot />}
        {showGlobalDock && <GlobalDock dockConfig={dockConfig} />}
      </LazyMotion>
    </WindowProvider>
  );
}
