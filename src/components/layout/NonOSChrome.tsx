'use client';

import React, { Suspense } from 'react';
import { LazyMotion, domAnimation, AnimatePresence } from 'motion/react';
import dynamic from 'next/dynamic';
import { usePathname, useSearchParams } from 'next/navigation';
import Header from '@/components/shared/Header';
import { useOSOverlays } from '@/components/os/context/OSSystemContext';
import WindowRenderer from './WindowRenderer';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';
import { isProjectsRoute } from '@/lib/routing/tenantRoutes';

const ControlCenter = dynamic(() => import('@/components/os/ui/ControlCenter'), {
  ssr: false,
});

const CalendarPopout = dynamic(() => import('@/components/os/ui/CalendarPopout'), {
  ssr: false,
});

/**
 * Non-OS chrome (Header + Dock + WindowRenderer + Control Center / Calendar).
 *
 * Diimport via `next/dynamic` di {@link LayoutClient} supaya chunk motion/dock/dll
 * TIDAK ikut initial bundle saat visitor buka homepage `/` (OS desktop). Untuk
 * route non-OS (`/projects`, `/contact`, dll) chunk ini di-load on-demand.
 *
 * Catatan: GlobalDock sengaja tidak punya entrance animation. Dock adalah
 * viewport chrome yang harus tetap anchored ketika konten halaman slide.
 */
export default function NonOSChrome({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showControlCenter, setShowControlCenter, showCalendar, setShowCalendar } =
    useOSOverlays();

  const isContact = pathname === '/contact' || pathname?.startsWith('/contact');
  const isProjects3D = isProjectsRoute(pathname) && searchParams?.get('view') === '3d';
  const mainClassName = isContact || isProjects3D ? '' : 'pb-24';

  return (
    <ErrorBoundary>
      <LazyMotion features={domAnimation}>
        <Suspense fallback={null}>
          <Header />
        </Suspense>
        <main
          data-vt-container="true"
          data-canvas-mode={isProjects3D ? 'true' : undefined}
          className={mainClassName}
        >
          {children}
        </main>
        {modal}

        <WindowRenderer />

        {/* Global Control Center for non-OS pages */}
        <AnimatePresence>
          {showControlCenter && (
            <div
              className="pointer-events-auto fixed inset-0 z-[10001]"
              onClick={() => setShowControlCenter(false)}
            >
              <div onClick={(e) => e.stopPropagation()}>
                <ControlCenter
                  isOpen={showControlCenter}
                  onClose={() => setShowControlCenter(false)}
                />
              </div>
            </div>
          )}
        </AnimatePresence>
        {/* Global Calendar Popout for non-OS pages */}
        <AnimatePresence>
          {showCalendar && (
            <div
              className="pointer-events-auto fixed inset-0 z-[10001]"
              onClick={() => setShowCalendar(false)}
            >
              <div onClick={(e) => e.stopPropagation()}>
                <CalendarPopout isOpen={showCalendar} onClose={() => setShowCalendar(false)} />
              </div>
            </div>
          )}
        </AnimatePresence>
      </LazyMotion>
    </ErrorBoundary>
  );
}
