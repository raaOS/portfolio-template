import LandingPage from '@/components/landing/LandingPage';
import { isStorefrontDeployment } from '@/lib/storefront';
import { SITE_ID } from '@/crud/shared/config';
import { queryD1 } from '@/lib/cloudflareD1';
import { loadHomepageData } from '@/lib/loaders';
import { loadAboutData } from '@/lib/about';
import { getBasePrice, getOwnerWhatsapp } from '@/lib/services/pricingConfigService';
import { mapD1ToTemplateData } from '@/lib/templates/dataMapper';
import SoundConfigLoader from '@/components/layout/SoundConfigLoader';
import LayoutClient from '@/components/layout/LayoutClient';
import VersionGuard from '@/components/shared/VersionGuard';
import SmoothScroll from '@/components/layout/SmoothScroll';
import NavDirectionReset from '@/components/layout/NavDirectionReset';
import { LastUpdatedProvider } from '@/contexts/LastUpdatedContext';
import OSDesktopRenderer from '@/components/templates/os-desktop/OSDesktopRenderer';
import InfiniteCanvasRenderer from '@/components/templates/infinite-canvas/InfiniteCanvasRenderer';
import SpatialGalleryRenderer from '@/components/templates/spatial-gallery/SpatialGalleryRenderer';

export const revalidate = 60;

interface SiteRow {
  id: string;
  slug: string;
  name: string | null;
  active_template_key: string | null;
}

/**
 * Halaman utama `/` punya dua wajah, dipilah saat build per deployment:
 *
 * - Storefront (makeitbetter.my.id): halaman penjualan template.
 * - Website klien (`<slug>.workers.dev` + custom domain): portofolio milik
 *   klien, dirender dari data D1 deployment ini sendiri (SITE_ID).
 *
 * Konsep lama `/<slug>` di domain owner sudah dihapus — tidak ada lagi
 * website klien yang "numpang" di domain storefront.
 */
export default async function Home() {
  if (isStorefrontDeployment()) {
    // Harga jual & nomor WhatsApp owner dibaca dari D1 (panel admin "Harga
    // Jual") — dirender server dan di-cache ISR (revalidate 60 dtk). Gagal
    // baca → masing-masing punya fallback sendiri (BASE_PRICE / env WA);
    // tidak pernah menjatuhkan build.
    const [basePrice, adminWhatsapp] = await Promise.all([
      getBasePrice(),
      getOwnerWhatsapp(),
    ]);
    return <LandingPage basePrice={basePrice} adminWhatsapp={adminWhatsapp} />;
  }

  // --- Mode klien: render portofolio deployment ini ---
  // Dibungkus try/catch: query ini ikut di-prerender saat build, kegagalan
  // D1 sesaat tidak boleh menjatuhkan build deploy klien (fallback: template
  // os-desktop + data loader yang sudah punya fallback sendiri).
  let siteRows: SiteRow[] = [];
  try {
    siteRows = await queryD1<SiteRow>(
      'SELECT id, slug, name, active_template_key FROM sites WHERE id = ? LIMIT 1',
      [SITE_ID]
    );
  } catch (error) {
    console.error('[home] Gagal membaca row sites (fallback os-desktop):', error);
  }
  const siteRow = siteRows[0];
  const activeTemplateKey = siteRow?.active_template_key || 'os-desktop';

  const homepageData = await loadHomepageData(SITE_ID);
  const templateData = mapD1ToTemplateData({
    site: {
      id: SITE_ID,
      slug: siteRow?.slug || SITE_ID,
      title: siteRow?.name || 'Portfolio',
      name: siteRow?.name || 'Portfolio',
      status: 'active',
      active_template_key: activeTemplateKey,
    },
    homepageData,
  });

  const renderer =
    activeTemplateKey === 'infinite-canvas' ? (
      <InfiniteCanvasRenderer data={templateData} />
    ) : activeTemplateKey === 'spatial-gallery' ? (
      <SpatialGalleryRenderer data={templateData} />
    ) : (
      <OSDesktopRenderer data={templateData} />
    );

  // Wrapper chrome (dock, konfigurasi suara OS, dsb.) yang dulu dipasang di
  // layout route tenant — kini dipasang manual karena route `/` berada di
  // luar route group `(site)`.
  const aboutData = await loadAboutData(SITE_ID);

  return (
    <LastUpdatedProvider>
      <SmoothScroll />
      <NavDirectionReset />
      <SoundConfigLoader soundConfig={aboutData?.soundConfig} />
      <LayoutClient modal={null} dockConfig={aboutData?.dockConfig}>
        {renderer}
      </LayoutClient>
      <VersionGuard />
    </LastUpdatedProvider>
  );
}
