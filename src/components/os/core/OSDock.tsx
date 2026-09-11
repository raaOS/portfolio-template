// ═══════════════════════════════════════════════════════════════════
// OSDock — Dock untuk route OS desktop (`/`).
// Diekstrak dari Dock.tsx (Phase 2). Integrasi window context, item
// config, isOpen state tracking.
// ═══════════════════════════════════════════════════════════════════
'use client';

import { useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useTransitionRouter } from 'next-view-transitions';
import { Grid, User, Mail, FileText } from 'lucide-react';
import type { AboutData } from '@/types/about';
import AppIcon from '../ui/AppIcon';
import WhatsAppIcon from '../ui/WhatsAppIcon';
import DockProjectModes from '../ui/DockProjectModes';
import { getDockItemConfig } from '../utils/dockUtils';
import {
  buildTenantProjectsHref,
  getTenantBasePath,
} from '@/lib/routing/tenantRoutes';
import Dock, { type DockItemData } from './Dock';

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
    // slide akan terbalik (slide ke kanan, terrihat "tidak ada efek"
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
