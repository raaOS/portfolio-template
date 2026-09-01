import React from 'react';
import { notFound } from 'next/navigation';
import { getSiteBySlug } from '@/lib/adapters/siteDataAdapter';
import { loadHomepageData } from '@/lib/loaders';
import { canUseWhatsappTestimonials } from '@/lib/product/sitePlan';
import { mapD1ToTemplateData } from '@/lib/templates/dataMapper';
import OSDesktopRenderer from '@/components/templates/os-desktop/OSDesktopRenderer';

export const revalidate = 60;

interface TenantPageProps {
  params: Promise<{ siteSlug: string }>;
}

export default async function TenantPage({ params }: TenantPageProps) {
  const { siteSlug } = await params;
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

  const templateData = mapD1ToTemplateData({
    site: {
      ...site,
      active_template_key: 'os-desktop',
    },
    homepageData: effectiveHomepageData,
  });

  return <OSDesktopRenderer data={templateData} />;
}
