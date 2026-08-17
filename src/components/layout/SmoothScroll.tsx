'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useReducedMotion } from 'motion/react';
import type Lenis from 'lenis';
import { isProjectsRoute as isProjectRoutePath } from '@/lib/routing/tenantRoutes';

export default function SmoothScroll() {
  const pathname = usePathname();
  const isOsMode = pathname?.startsWith('/about-test');
  const isProjectsRoute = isProjectRoutePath(pathname);
  const prefersReducedMotion = useReducedMotion();
  const lenisInstanceRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (isOsMode || isProjectsRoute || prefersReducedMotion) return;

    let cancelled = false;
    let rafId: number;
    let hidden = false;

    import('lenis').then((LenisModule) => {
      if (cancelled) return;

      const Lenis = LenisModule.default;
      const lenis = new Lenis({
        duration: 1.5,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        smoothWheel: true,
        wheelMultiplier: 0.9,
        touchMultiplier: 2,
      });

      lenisInstanceRef.current = lenis;

      const handleVisibility = () => {
        hidden = document.visibilityState === 'hidden';
      };
      document.addEventListener('visibilitychange', handleVisibility);

      function raf(time: number) {
        if (cancelled) {
          document.removeEventListener('visibilitychange', handleVisibility);
          lenis.destroy();
          lenisInstanceRef.current = null;
          return;
        }
        if (!hidden) lenis.raf(time);
        rafId = requestAnimationFrame(raf);
      }

      rafId = requestAnimationFrame(raf);
    });

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (lenisInstanceRef.current) {
        lenisInstanceRef.current.destroy();
        lenisInstanceRef.current = null;
      }
    };
  }, [isOsMode, isProjectsRoute, prefersReducedMotion]);

  return null;
}
