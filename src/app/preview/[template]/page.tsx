import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { loadHomepageData } from '@/lib/loaders';
import { mapD1ToTemplateData } from '@/lib/templates/dataMapper';
import { getTemplate } from '@/lib/templates/registry';
import { SITE_ID } from '@/crud/shared/config';
import { DEFAULT_SITE_URL } from '@/lib/constants';
import InfiniteCanvasRenderer from '@/components/templates/infinite-canvas/InfiniteCanvasRenderer';

export const revalidate = 60;

const PREVIEW_SLUGS = ['os-desktop', 'infinite-canvas', 'spatial-gallery'] as const;

// Tanpa ini /preview/* selalu render penuh per-request (TTFB 6.3s terukur di
// produksi). Dengan gSP, halaman jadi ISR: pre-render saat build + cache 60s.
export function generateStaticParams() {
  return PREVIEW_SLUGS.map((template) => ({ template }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ template: string }>;
}): Promise<Metadata> {
  const { template: templateSlug } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
  const canonicalUrl = `${baseUrl}/preview/${templateSlug}`;

  const title =
    templateSlug === 'os-desktop'
      ? 'macOS Desktop OS Template Demo'
      : templateSlug === 'infinite-canvas'
        ? '3D Infinite Canvas Template Demo'
        : templateSlug === 'spatial-gallery'
          ? '3D Spatial Gallery Template Demo'
          : 'Portfolio Template Demo';

  return {
    title,
    description: 'Interactive portfolio template demo built for creators and developers.',
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      url: canonicalUrl,
    },
  };
}

/**
 * Preview route untuk template.
 * URL: /preview/[template]
 *
 * Contoh:
 * - /preview/infinite-canvas → Infinite Canvas template
 * - /preview/os-desktop → OS Desktop template
 */
export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ template: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { template: templateSlug } = await params;

  if (templateSlug === 'projects') {
    const sp = searchParams ? await searchParams : {};
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (typeof v === 'string') qs.set(k, v);
      else if (Array.isArray(v)) v.forEach((item) => qs.append(k, item));
    }
    const query = qs.toString() ? `?${qs.toString()}` : '';
    redirect(`/projects${query}`);
  }

  // Cek apakah template ada di registry
  const templateMeta = getTemplate(templateSlug);
  if (!templateMeta) {
    notFound();
  }

  // Load data
  const homepageData = await loadHomepageData(SITE_ID);
  const templateData = mapD1ToTemplateData({
    site: {
      id: SITE_ID,
      slug: SITE_ID,
      title: 'Portfolio',
      name: 'Portfolio',
      status: 'active',
      active_template_key: templateSlug,
    },
    homepageData,
  });

  // Render template berdasarkan slug
  switch (templateSlug) {
    case 'infinite-canvas':
      return <InfiniteCanvasRenderer data={templateData} />;
    case 'spatial-gallery':
      const { default: SpatialGalleryRenderer } = await import(
        '@/components/templates/spatial-gallery/SpatialGalleryRenderer'
      );
      return <SpatialGalleryRenderer data={templateData} />;
    case 'os-desktop':
      // Redirect ke homepage jika pilih OS Desktop
      const { default: OSDesktopRenderer } = await import(
        '@/components/templates/os-desktop/OSDesktopRenderer'
      );
      return <OSDesktopRenderer data={templateData} />;
    default:
      notFound();
  }
}
