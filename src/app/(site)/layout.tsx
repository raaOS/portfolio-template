import React from 'react';
import { loadAboutData } from '@/lib/about';
import LayoutClient from '@/components/layout/LayoutClient';
import VersionGuard from '@/components/shared/VersionGuard';
import SmoothScroll from '@/components/layout/SmoothScroll';
import NavDirectionReset from '@/components/layout/NavDirectionReset';
import { LastUpdatedProvider } from '@/contexts/LastUpdatedContext';

export default async function SiteLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  // Layout berlaku untuk semua route (site) — bukan hanya `/` — jadi sengaja
  // pakai loadAboutData (1 key) bukan loadHomepageData (6 keys) untuk hindari
  // over-fetch di /about, /contact, /cv, /projects, /projects/[slug].
  //
  // loadAboutData → aboutService.getAboutData → ContentService cache (5 detik) →
  // D1 fetch `content/about`. Untuk route `/`, page.tsx panggil loadHomepageData
  // yang reuse aboutData dari ContentService cache layer (cache hit dalam request
  // yang sama karena TTL 5 detik > waktu tempuh batch + sequential read).
  const aboutData = await loadAboutData();

  return (
    <LastUpdatedProvider>
      <SmoothScroll />
      <NavDirectionReset />
      <LayoutClient modal={modal} dockConfig={aboutData?.dockConfig}>
        {children}
      </LayoutClient>

      <VersionGuard />
    </LastUpdatedProvider>
  );
}
