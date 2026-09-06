import { loadHomepageData } from '@/lib/loaders';
import { mapD1ToTemplateData } from '@/lib/templates/dataMapper';
import OSDesktopRenderer from '@/components/templates/os-desktop/OSDesktopRenderer';
import { SITE_ID } from '@/crud/shared/config';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const homepageData = await loadHomepageData(SITE_ID);

  const templateData = mapD1ToTemplateData({
    site: {
      id: SITE_ID,
      slug: SITE_ID,
      title: 'Portfolio',
      name: 'Portfolio',
      status: 'active',
      active_template_key: 'os-desktop',
    },
    homepageData,
  });

  return <OSDesktopRenderer data={templateData} />;
}
