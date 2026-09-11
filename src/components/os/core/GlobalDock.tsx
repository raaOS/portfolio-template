// ═══════════════════════════════════════════════════════════════════
// GlobalDock — Dock untuk route non-OS (mis. /projects, /contact).
// Diekstrak dari Dock.tsx (Phase 2). Pada route OS desktop (`/`)
// komponen ini disembunyikan; OSDock yang aktif. Render via DockPortal
// ke GlobalDockSlot.
// ═══════════════════════════════════════════════════════════════════
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useTransitionRouter } from 'next-view-transitions';
import { Grid, User, Mail, FileText } from 'lucide-react';
import type { DockPreferences } from '@/types/about';
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
import { DockPortal } from '@/components/layout/GlobalDockSlot';
import Dock, { type DockItemData } from './Dock';

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
