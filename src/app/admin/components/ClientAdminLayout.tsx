'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { warmAdminCrudQueries } from '../lib/adminQueries';
import { ConfirmDialogProvider } from '@/components/admin/ConfirmDialog';
import { useAdminDesktop } from '../desktop/useAdminDesktop';
import AdminDesktopShell from '../desktop/AdminDesktopShell';
import { APP_ROUTE_MAP } from '../desktop/registry';

interface ClientAdminLayoutProps {
  children: ReactNode;
}

/**
 * Maps a Next.js pathname (e.g. /admin/content/profile) to the desktop appId.
 */
function pathnameToAppId(pathname: string): string | null {
  for (const [appId, route] of Object.entries(APP_ROUTE_MAP)) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      return appId;
    }
  }
  return null;
}

import { BackgroundUploadProvider } from '@/contexts/BackgroundUploadContext';

export default function ClientAdminLayout({ children }: ClientAdminLayoutProps) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/admin/login';
  const queryClient = useQueryClient();
  const { logout } = useAdminAuth();
  const { windows, actions } = useAdminDesktop();
  const { openApp } = actions;
  const warmedRef = useRef(false);
  const deepLinkedRef = useRef(false);

  const handleLogout = async () => {
    await logout();
  };

  // Prefetch admin data once per session
  useEffect(() => {
    if (isLoginPage) return;
    if (warmedRef.current) return;
    warmedRef.current = true;

    const timeout = window.setTimeout(() => {
      void warmAdminCrudQueries(queryClient);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [isLoginPage, queryClient]);

  // Deep-link: if user visits a sub-route directly (e.g. /admin/content/experience),
  // auto-open the corresponding window on the desktop.
  useEffect(() => {
    if (isLoginPage || pathname === '/admin') return;
    if (deepLinkedRef.current) return;

    const appId = pathnameToAppId(pathname);
    if (appId) {
      // Small delay to ensure desktop is mounted
      const timeout = window.setTimeout(() => {
        deepLinkedRef.current = true;
        openApp('', appId);
      }, 100);
      return () => window.clearTimeout(timeout);
    }
  }, [isLoginPage, pathname, openApp]);

  // Login page: don't render the desktop shell
  if (isLoginPage) {
    return <ConfirmDialogProvider>{children}</ConfirmDialogProvider>;
  }

  // Admin Desktop Shell (replaces old sidebar layout)
  return (
    <ConfirmDialogProvider>
      <BackgroundUploadProvider>
        <AdminDesktopShell
          windows={windows}
          actions={actions}
          onLogout={handleLogout}
        />
      </BackgroundUploadProvider>
    </ConfirmDialogProvider>
  );
}
