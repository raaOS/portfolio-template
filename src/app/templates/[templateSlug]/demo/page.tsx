import React from 'react';
import { notFound } from 'next/navigation';
import { getSiteBySlug } from '@/lib/adapters/siteDataAdapter';
import { loadHomepageData } from '@/lib/loaders';
import { mapD1ToTemplateData } from '@/lib/templates/dataMapper';
import { templateRegistryService } from '@/lib/services/templateRegistryService';
import TemplateDispatcher from '@/components/templates/TemplateDispatcher';
import HomeOSWrapper from '@/components/home/HomeOSWrapper';
import { DemoThemeWrapper } from '@/components/templates/demo/DemoThemeWrapper';

export const revalidate = 60;

interface DemoPageProps {
  params: Promise<{ templateSlug: string }>;
}

export default async function TemplateDemoPage({ params }: DemoPageProps) {
  const { templateSlug } = await params;
  const templateMetadata = await templateRegistryService.getTemplateMetadata(templateSlug);

  if (!templateMetadata) {
    notFound();
  }

  const isLegacyOSDemo = templateSlug === 'os-desktop';

  let site = await getSiteBySlug(isLegacyOSDemo ? 'default-site' : 'demo-designer');
  if (!site) {
    site = await getSiteBySlug(isLegacyOSDemo ? 'demo-designer' : 'default-site');
  }

  if (!site) {
    notFound();
  }

  const homepageData = await loadHomepageData(site.id);
  const resolvedTemplateKey = await templateRegistryService.resolveActiveTemplate(
    site.id,
    'pro',
    templateSlug
  );

  const templateData = mapD1ToTemplateData({
    site: {
      ...site,
      active_template_key: resolvedTemplateKey,
    },
    homepageData,
  });

  return (
    <DemoThemeWrapper>
      <div className={`relative h-screen w-full ${isLegacyOSDemo ? 'overflow-hidden' : 'overflow-y-auto'}`}>

        {/* Main Full-Height Template Canvas */}
        <div className="h-full w-full">
          {isLegacyOSDemo ? (
            <HomeOSWrapper
              siteId={site.id}
              aboutData={homepageData.aboutData}
              experienceData={homepageData.experienceData}
              hardSkillsData={homepageData.hardSkillsData}
              projects={homepageData.projects}
              testimonialsData={homepageData.testimonialsData}
              contactData={homepageData.contactData}
            />
          ) : (
            <TemplateDispatcher data={templateData} isPreview={true} />
          )}
        </div>
      </div>
    </DemoThemeWrapper>
  );
}
