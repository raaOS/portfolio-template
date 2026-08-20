import React from 'react';
import { notFound } from 'next/navigation';
import { getSiteBySlug } from '@/lib/adapters/siteDataAdapter';
import { loadHomepageData } from '@/lib/loaders';
import { canUseWhatsappTestimonials } from '@/lib/product/sitePlan';
import { mapD1ToTemplateData } from '@/lib/templates/dataMapper';
import { templateRegistryService } from '@/lib/services/templateRegistryService';
import { templateSettingsService } from '@/lib/services/templateSettingsService';
import TemplateDispatcher from '@/components/templates/TemplateDispatcher';

export const revalidate = 60;

interface TenantPageProps {
  params: Promise<{ siteSlug: string }>;
  searchParams?: Promise<{ preview_template?: string }>;
}

export default async function TenantPage({ params, searchParams }: TenantPageProps) {
  const { siteSlug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const site = await getSiteBySlug(siteSlug);

  if (!site || site.status !== 'active') {
    notFound();
  }

  const homepageData = await loadHomepageData(site.id);
  const canShowWhatsappTestimonials = canUseWhatsappTestimonials(site.plan);

  const effectiveAboutData = canShowWhatsappTestimonials
    ? homepageData.aboutData
    : {
        ...homepageData.aboutData,
        dockConfig: {
          ...homepageData.aboutData.dockConfig,
          whatsapp: {
            ...homepageData.aboutData.dockConfig?.whatsapp,
            isHidden: true,
          },
        },
      };

  const effectiveTestimonialsData = canShowWhatsappTestimonials
    ? homepageData.testimonialsData
    : {
        testimonials: [],
        lastUpdated: homepageData.testimonialsData.lastUpdated,
      };

  const effectiveHomepageData = {
    ...homepageData,
    aboutData: effectiveAboutData,
    testimonialsData: effectiveTestimonialsData,
  };

  const requestedKey = resolvedSearchParams.preview_template || (site as { active_template_key?: string }).active_template_key;
  const resolvedTemplateKey = await templateRegistryService.resolveActiveTemplate(
    site.id,
    site.plan,
    requestedKey
  );

  const templateSettings = await templateSettingsService.getSettings(site.id, resolvedTemplateKey);

  const templateData = mapD1ToTemplateData({
    site: {
      ...site,
      active_template_key: resolvedTemplateKey,
    },
    homepageData: effectiveHomepageData,
    settings: templateSettings ?? undefined,
  });

  return <TemplateDispatcher data={templateData} isPreview={Boolean(resolvedSearchParams.preview_template)} />;
}
