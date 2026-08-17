'use client';

import React from 'react';
import { Link } from 'next-view-transitions';
import { motion } from 'motion/react';
import { ChevronRight, Monitor, Zap } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { markBack } from '@/lib/navigationDirection';
import { useDictionary } from '@/contexts/LanguageContext';
import { buildTenantHomeHref, isProjectsRoute } from '@/lib/routing/tenantRoutes';

interface SystemNavFrameProps {
  children: React.ReactNode;
  title?: string;
  hideFooter?: boolean;
}

export default function SystemNavFrame({
  children,
  title: _title,
  hideFooter,
}: SystemNavFrameProps) {
  const t = useDictionary();
  const searchParams = useSearchParams();
  const isPrintMode = searchParams?.get('print') === 'true';
  const pathname = usePathname();

  const view = searchParams?.get('view');
  const is3D = view === '3d';
  const isList = view === 'list';
  const isContact = pathname === '/contact' || pathname?.startsWith('/contact');
  const isProjects = isProjectsRoute(pathname);
  const homeHref = buildTenantHomeHref(pathname);
  const effectiveHideFooter = hideFooter || isContact || is3D;
  const showSystemHeader = !isProjects && !isPrintMode;

  // Generate Breadcrumbs from pathname
  const pathSegments = pathname.split('/').filter(Boolean);
  const breadcrumbs = [
    { label: 'Portfolio OS', href: homeHref, isLast: pathSegments.length === 0 },
    ...pathSegments.map((segment, i) => ({
      label: segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' '),
      href: `/${pathSegments.slice(0, i + 1).join('/')}`,
      isLast: i === pathSegments.length - 1,
    })),
  ];

  return (
    <div
      className={`${is3D || isList ? 'h-screen overflow-hidden' : 'min-h-screen'} flex flex-col bg-white dark:bg-gray-950`}
    >
      {/* Retro System Header */}
      {showSystemHeader && (
        <header
          className="sticky top-0 z-50 flex h-9 w-full select-none items-center justify-between border-b border-[#D1D1D1] bg-[#EFEFEF] px-4 print:hidden"
          style={{ viewTransitionName: 'system-nav' }}
        >
          <div className="flex items-center gap-4">
            {/* System OS Label */}
            <div className="flex items-center gap-2 border-r border-gray-300 pr-4">
              <Monitor size={14} className="text-gray-600" />
              <span className="text-[11px] font-bold tracking-tight text-gray-800">
                Portfolio OS{' '}
                <span className="ml-1 font-normal text-gray-500">({t.systemNav.connected})</span>
              </span>
            </div>

            {/* Breadcrumb Navigator */}
            <nav className="no-scrollbar hidden items-center gap-1.5 overflow-x-auto md:flex">
              {breadcrumbs.map((crumb, i) => (
                <React.Fragment key={crumb.href}>
                  {i > 0 && <ChevronRight size={12} className="shrink-0 text-gray-400" />}
                  <Link
                    href={crumb.href}
                    className={`whitespace-nowrap text-[11px] font-medium transition-colors hover:text-black ${
                      crumb.isLast ? 'font-bold text-black' : 'text-gray-500'
                    }`}
                  >
                    {crumb.label}
                  </Link>
                </React.Fragment>
              ))}
            </nav>
          </div>

          {/* System Status Indicators */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Zap size={12} className="fill-green-600 text-green-600" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-700">
                {t.systemNav.live}
              </span>
            </div>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      {is3D ? (
        <div className="flex flex-1 flex-col">{children}</div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex flex-1 flex-col"
        >
          {children}
        </motion.div>
      )}

      {/* Minimal Retro Footer (Print Hidden) */}
      {!effectiveHideFooter && (
        <footer className="mt-auto w-full border-t border-gray-100 bg-gray-50/50 px-8 py-6 print:hidden">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
            <div className="text-[10px] font-medium uppercase tracking-widest text-gray-400">
              {t.systemNav.footer}
            </div>
            <div className="flex gap-6">
              <Link
                href={homeHref}
                onClickCapture={markBack}
                className="text-[10px] font-bold uppercase tracking-widest text-gray-500 transition-colors hover:text-black"
              >
                {t.systemNav.backToOS}
              </Link>
              <Link
                href="/cv"
                className="text-[10px] font-bold uppercase tracking-widest text-gray-500 transition-colors hover:text-black"
              >
                {t.header.resume}
              </Link>
              <Link
                href="/contact"
                className="text-[10px] font-bold uppercase tracking-widest text-gray-500 transition-colors hover:text-black"
              >
                {t.header.contact}
              </Link>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
