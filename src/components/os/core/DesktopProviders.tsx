'use client';

import React from 'react';
import { LayoutPersistenceProvider } from '../contexts/LayoutPersistenceContext';
import { UnifiedZIndexProvider } from '../context/UnifiedZIndexContext';
import { DesktopWindowProvider } from '../context/DesktopWindowContext';
import DesktopErrorBoundary from '../windows/DesktopErrorBoundary';
import { WindowState } from '@/components/os/hooks/useWindowManager';
import { AboutData } from '@/types/about';
import { MusicPlayerProvider } from '@/contexts/MusicPlayerContext';

interface DesktopProvidersProps {
  children: React.ReactNode;
  initialWindows: WindowState[];
  aboutData: AboutData | null | undefined;
  siteId?: string;
  csrfToken?: string;
  isAdmin: boolean;
}

export default function DesktopProviders({
  children,
  initialWindows,
  aboutData,
  siteId,
  csrfToken,
  isAdmin,
}: DesktopProvidersProps) {
  return (
    <DesktopErrorBoundary isAdmin={isAdmin}>
      <MusicPlayerProvider>
        <LayoutPersistenceProvider>
          <UnifiedZIndexProvider>
            <DesktopWindowProvider
              initialWindows={initialWindows}
              aboutData={aboutData}
              siteId={siteId}
              csrfToken={csrfToken}
              isAdmin={isAdmin}
            >
              {children}
            </DesktopWindowProvider>
          </UnifiedZIndexProvider>
        </LayoutPersistenceProvider>
      </MusicPlayerProvider>
    </DesktopErrorBoundary>
  );
}
