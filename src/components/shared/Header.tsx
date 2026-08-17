'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'next-view-transitions';
import { usePathname, useSearchParams } from 'next/navigation';
import { Search, Wifi, Volume2 } from 'lucide-react';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useOSOverlays } from '@/components/os/context/OSSystemContext';
import { markBack } from '@/lib/navigationDirection';
import dynamic from 'next/dynamic';
import { useReducedMotion } from 'motion/react';
import logoAnimationData from '../../../public/lottie/mata.json';
import LanguageSwitch from './LanguageSwitch';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  buildTenantHomeHref,
  buildTenantProjectsHref,
  isProjectsRoute,
} from '@/lib/routing/tenantRoutes';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

const Header: React.FC = () => {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { trackEvent } = useAnalytics();
  const { setShowControlCenter, showCalendar, setShowCalendar } = useOSOverlays();
  const { dictionary: t, meta } = useLanguage();

  const prefersReducedMotion = useReducedMotion();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lottieRef = useRef<any>(null);

  const isPrintMode = searchParams.get('print') === 'true';
  const projectsHref = buildTenantProjectsHref(pathname);
  const homeHref = buildTenantHomeHref(pathname);

  useEffect(() => {
    const instance = lottieRef.current;
    return () => {
      instance?.destroy?.();
    };
  }, []);

  useEffect(() => {
    setCurrentTime(new Date()); // eslint-disable-line
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60_000); // Update every 60s — clock only shows HH:MM
    return () => clearInterval(timer);
  }, []);

  const formatTime = useCallback(
    (date: Date) => {
      return date.toLocaleTimeString(meta.intlLocale, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: meta.intlLocale === 'en-US',
      });
    },
    [meta.intlLocale]
  );

  const formatDate = useCallback(
    (date: Date) => {
      return date.toLocaleDateString(meta.intlLocale, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    },
    [meta.intlLocale]
  );

  // Memoize app name to avoid recalculating on every timer tick
  const appName = useMemo(() => {
    if (pathname === '/') return t.header.appNames.finder;
    if (isProjectsRoute(pathname)) return t.header.appNames.portfolio;
    if (pathname?.startsWith('/cv')) return t.header.appNames.resume;
    if (pathname?.startsWith('/contact')) return t.header.appNames.contact;
    if (pathname?.startsWith('/about')) return t.header.appNames.about;
    return t.header.appNames.portfolio;
  }, [pathname, t]);

  const isProjectsPage = isProjectsRoute(pathname);

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-[100] flex h-8 select-none items-center justify-between bg-white/80 px-4 text-xs text-black backdrop-blur-md print:hidden ${isPrintMode ? 'border-none shadow-none' : 'border-b border-gray-200 shadow-sm'}`}
      style={{
        ...(isPrintMode ? { border: 'none', boxShadow: 'none' } : {}),
        // Isolate from page view transition slide agar header tidak ikut geser
        viewTransitionName: 'site-header',
      }}
    >
      {/* Left Side */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/login?redirect=%2Fadmin"
          className="relative flex h-8 w-12 shrink-0 cursor-pointer items-center justify-center"
          aria-label="Admin Login"
        >
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <Lottie
              lottieRef={lottieRef}
              animationData={logoAnimationData}
              loop={!prefersReducedMotion}
              autoplay={!prefersReducedMotion}
              rendererSettings={{ preserveAspectRatio: 'xMidYMid meet' }}
              style={{ width: 96, height: 96 }}
              aria-hidden="true"
            />
          </div>
        </Link>
        <div className="hidden cursor-default px-2 py-1 font-bold sm:block">{appName}</div>

        {/* Menus (Nav Links Disguised as Menus) - Hidden on clean Project pages or print mode */}
        {!isProjectsPage && !isPrintMode && (
          <nav className="hidden items-center gap-1 font-medium md:flex">
            <Link
              href={projectsHref}
              className="cursor-pointer rounded px-3 py-1 transition-colors hover:bg-black/5"
            >
              {t.header.works}
            </Link>
            <Link
              href={homeHref}
              onClickCapture={markBack}
              className="cursor-pointer rounded px-3 py-1 transition-colors hover:bg-black/5"
            >
              {t.header.about}
            </Link>
            <Link
              href="/contact"
              className="cursor-pointer rounded px-3 py-1 transition-colors hover:bg-black/5"
            >
              {t.header.contact}
            </Link>
            <Link
              href="/cv"
              className="cursor-pointer rounded px-3 py-1 transition-colors hover:bg-black/5"
            >
              {t.header.resume}
            </Link>
          </nav>
        )}
      </div>

      {/* Right Side */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <LanguageSwitch className="hidden sm:inline-grid" />
        <div
          className="flex cursor-pointer items-center gap-3 text-black/80"
          onClick={() => setShowControlCenter(true)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              trackEvent('header_search_click', { page: pathname });
            }}
            aria-label={t.header.search}
          >
            <Search size={14} className="transition-colors hover:text-black" />
          </button>
          <Wifi size={14} />

          {/* Custom Battery 100% Green - Matching OS Style */}
          <span
            className="flex items-center gap-[1px]"
            title={t.menuBar.batteryFull}
            role="img"
            aria-label={t.menuBar.batteryFull}
          >
            <div className="flex h-[11px] w-[22px] items-center justify-center rounded-[2.5px] border border-[#16a34a] bg-[#22c55e]">
              <span
                className="pt-[0.5px] text-[7px] font-bold leading-none text-black"
                aria-hidden="true"
              >
                100
              </span>
            </div>
            <div className="h-[3.5px] w-[1.5px] rounded-r-[1px] bg-[#16a34a] opacity-80" />
          </span>

          <Volume2 size={14} />
        </div>
        <div
          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 font-medium transition-colors hover:bg-black/5"
          onClick={(e) => {
            e.stopPropagation();
            setShowCalendar(!showCalendar);
          }}
        >
          {currentTime && (
            <>
              <span>{formatDate(currentTime)}</span>
              <span className="w-[60px] text-right">{formatTime(currentTime)}</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
