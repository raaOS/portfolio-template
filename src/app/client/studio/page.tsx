import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyClientToken } from '@/lib/clientAuth';
import { getSiteBySlug } from '@/lib/adapters/siteDataAdapter';
import { loadHomepageData } from '@/lib/loaders';
import { mapD1ToTemplateData } from '@/lib/templates/dataMapper';
import { templateRegistryService } from '@/lib/services/templateRegistryService';
import { templateSettingsService } from '@/lib/services/templateSettingsService';
import { BENTO_TEMPLATE_ID } from '@/lib/templates/bento/settings';
import { BentoStudioEditor } from './BentoStudioEditor';

export const dynamic = 'force-dynamic';

/**
 * Halaman editor Bento Studio (Pro-only).
 * Membaca client session dari cookie, memuat data tenant + settings,
 * lalu melempar semuanya ke editor client untuk preview live berbasis draft.
 */
export default async function BentoStudioPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('client_token')?.value;
  const payload = token ? verifyClientToken(token) : null;
  if (!payload?.siteId || !payload.siteSlug) redirect('/client/login');

  const site = await getSiteBySlug(payload.siteSlug);
  if (!site) redirect('/client/login');

  const isPro = site.plan === 'pro';

  const homepageData = await loadHomepageData(site.id);
  const resolvedTemplateKey = await templateRegistryService.resolveActiveTemplate(
    site.id,
    site.plan,
    BENTO_TEMPLATE_ID
  );
  const templateSettings = await templateSettingsService.getSettings(
    site.id,
    resolvedTemplateKey
  );

  const templateData = mapD1ToTemplateData({
    site: {
      ...site,
      active_template_key: resolvedTemplateKey,
    },
    homepageData,
    settings: templateSettings ?? undefined,
  });

  return (
    <BentoStudioEditor
      siteId={site.id}
      siteSlug={site.slug}
      siteName={site.name}
      isPro={isPro}
      templateData={templateData}
    />
  );
}