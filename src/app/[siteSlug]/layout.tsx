import React from 'react';
import { notFound } from 'next/navigation';
import { getSiteBySlug } from '@/lib/adapters/siteDataAdapter';
import { aboutService } from '@/lib/services/aboutService';
import SoundConfigLoader from '@/components/layout/SoundConfigLoader';
import LayoutClient from '@/components/layout/LayoutClient';
import VersionGuard from '@/components/shared/VersionGuard';
import SmoothScroll from '@/components/layout/SmoothScroll';
import NavDirectionReset from '@/components/layout/NavDirectionReset';
import { LastUpdatedProvider } from '@/contexts/LastUpdatedContext';

interface TenantLayoutProps {
  children: React.ReactNode;
  params: Promise<{ siteSlug: string }>;
}

export default async function TenantLayout({
  children,
  params,
}: TenantLayoutProps) {
  const { siteSlug } = await params;
  const site = await getSiteBySlug(siteSlug);

  if (!site || site.status !== 'active') {
    notFound();
  }

  const aboutData = await aboutService.getAboutData(site.id);

  return (
    <LastUpdatedProvider>
      <SmoothScroll />
      <NavDirectionReset />
      <SoundConfigLoader soundConfig={aboutData?.soundConfig} />
      <LayoutClient dockConfig={aboutData?.dockConfig} modal={null}>
        {children}
      </LayoutClient>

      <VersionGuard />
    </LastUpdatedProvider>
  );
}
