/**
 * Mapper Service: Konversi Raw D1 Data & HomepageData ke PortfolioTemplateData
 * @module
 */

import type { HomepageData } from '@/lib/loaders';
import type { SiteInfo } from '@/lib/adapters/siteDataAdapter';
import type {
  PortfolioTemplateData,
  SiteProfileHeader,
  SiteTemplateSettings,
} from '@/types/template';

export interface SiteRecordWithTemplate extends SiteInfo {
  title?: string;
  active_template_key?: string;
}

export interface DataMapperOptions {
  site: SiteRecordWithTemplate;
  homepageData: HomepageData;
  settings?: SiteTemplateSettings;
}

/**
 * Memetakan data dari D1 / HomepageLoader menjadi objek PortfolioTemplateData
 * yang siap dikonsumsi oleh seluruh template renderer.
 */
export function mapD1ToTemplateData(options: DataMapperOptions): PortfolioTemplateData {
  const { site, homepageData, settings } = options;

  const siteHeader: SiteProfileHeader = {
    id: site.id,
    slug: site.slug,
    title: site.title || site.name || site.slug,
    description: homepageData.aboutData.hero.title || '',
    avatarUrl: homepageData.aboutData.hero.backgroundTrail?.[0]
      ? typeof homepageData.aboutData.hero.backgroundTrail[0] === 'string'
        ? homepageData.aboutData.hero.backgroundTrail[0]
        : homepageData.aboutData.hero.backgroundTrail[0].src
      : undefined,
    tier: (site.plan as 'lite' | 'pro') || 'lite',
    activeTemplateKey: site.active_template_key || 'os-desktop',
  };

  return {
    site: siteHeader,
    about: homepageData.aboutData,
    projects: homepageData.projects || [],
    experiences: homepageData.experienceData.workExperience || [],
    events: homepageData.experienceData.events || [],
    hardSkills: homepageData.hardSkillsData.skills || [],
    contact: homepageData.contactData,
    testimonials: homepageData.testimonialsData.testimonials || [],
    settings,
    lastUpdated: new Date().toISOString(),
  };
}
