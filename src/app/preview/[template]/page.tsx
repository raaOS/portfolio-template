import { notFound } from 'next/navigation';
import { loadHomepageData } from '@/lib/loaders';
import { mapD1ToTemplateData } from '@/lib/templates/dataMapper';
import { getTemplate, SYSTEM_DEFAULT_TEMPLATE_ID } from '@/lib/templates/registry';
import { SITE_ID } from '@/crud/shared/config';
import InfiniteCanvasRenderer from '@/components/templates/infinite-canvas/InfiniteCanvasRenderer';

export const dynamic = 'force-dynamic';

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
}: {
  params: Promise<{ template: string }>;
}) {
  const { template: templateSlug } = await params;

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
