import { cache } from 'react';
import { getCachedAboutData } from './services/aboutService';
import { projectSqlService } from './services/project/projectSqlService';
import { experienceService } from './services/experienceService';
import { hardSkillService } from './services/hardSkillService';
import { testimonialService } from './services/testimonialService';
import { getContactData } from './contact';
import { getD1Value, isD1Configured } from './cloudflareD1';
import experienceFallback from '@/data/experience.json';
import hardSkillsFallback from '@/data/hardSkills.json';
import testimonialFallback from '@/data/testimonial.json';
import contactFallback from '@/data/contact.json';
import type { AboutData } from '@/types/about';
import type { ContactData } from '@/types/contact';
import type { ExperienceData, WorkExperience } from '@/types/experience';
import type { HardSkill, HardSkillsData } from '@/types/hardSkill';
import type { Project } from '@/types/projects';
import type { Testimonial, TestimonialData } from '@/types/testimonial';

export type HomepageData = {
  aboutData: AboutData;
  projects: Project[];
  experienceData: ExperienceData;
  hardSkillsData: HardSkillsData;
  testimonialsData: TestimonialData;
  contactData: ContactData;
};

type HomepageContentRow = {
  contact?: unknown;
  experience?: unknown;
  hardSkills?: unknown;
  testimonial?: unknown;
};

function deepMerge<T>(base: T, override: unknown): T {
  if (override === null || override === undefined) return base;
  if (base === null || base === undefined) return override as T;
  if (Array.isArray(override)) return override as T;
  if (typeof override !== 'object' || typeof base !== 'object') return override as T;

  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const key of Object.keys(override as Record<string, unknown>)) {
    result[key] = deepMerge(result[key], (override as Record<string, unknown>)[key]);
  }
  return result as T;
}

function slugifyWorkField(value: unknown) {
  if (typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeWorkExperience(workExperience: WorkExperience[]): WorkExperience[] {
  return workExperience.map((work, index) => {
    const parts = [work.company, work.position, work.year].map(slugifyWorkField).filter(Boolean);
    const fallbackId = parts.length > 0 ? `${parts.join('-')}-${index}` : `experience-${index}`;
    return {
      ...work,
      id: work.id?.trim() || fallbackId,
    };
  });
}

const DEFAULT_ICON_URLS: Record<string, string> = {
  'hard-ps': 'https://cdn.simpleicons.org/adobephotoshop',
  'hard-ai': 'https://cdn.simpleicons.org/adobeillustrator',
  'hard-figma': 'https://cdn.simpleicons.org/figma',
  'hard-canva': 'https://cdn.simpleicons.org/canva',
};

function getDefaultIconUrl(skill: Pick<HardSkill, 'id' | 'name'>) {
  const normalizedName = skill.name.toLowerCase();
  if (DEFAULT_ICON_URLS[skill.id]) return DEFAULT_ICON_URLS[skill.id];
  if (normalizedName.includes('photoshop')) return DEFAULT_ICON_URLS['hard-ps'];
  if (normalizedName.includes('illustrator')) return DEFAULT_ICON_URLS['hard-ai'];
  if (normalizedName.includes('figma')) return DEFAULT_ICON_URLS['hard-figma'];
  if (normalizedName.includes('canva')) return DEFAULT_ICON_URLS['hard-canva'];
  return 'https://cdn.simpleicons.org/adobecreativecloud';
}

function normalizeHardSkill(
  skill: Partial<HardSkill> & { id: string; name: string },
  index: number
): HardSkill {
  const now = new Date().toISOString();
  return {
    id: skill.id,
    name: skill.name,
    iconUrl: skill.iconUrl || getDefaultIconUrl(skill),
    level: skill.level || 'Intermediate',
    order: typeof skill.order === 'number' ? skill.order : index + 1,
    description: skill.description,
    description_id: skill.description_id,
    isActive: skill.isActive,
    details: skill.details,
    createdAt: skill.createdAt || now,
    updatedAt: skill.updatedAt || now,
  };
}

function normalizeTestimonialData(data: TestimonialData): TestimonialData {
  return {
    ...data,
    testimonials: data.testimonials.map((testimonial: Testimonial) => ({
      ...testimonial,
      id: String(testimonial.id).trim(),
    })),
  };
}

function emptyTenantTestimonials(): TestimonialData {
  return {
    testimonials: [],
    lastUpdated: new Date().toISOString(),
  };
}

async function loadHomepageDataFromD1(siteId = 'default-site'): Promise<HomepageData> {
  const [contentVal, projectsResult, aboutData] = await Promise.all([
    getD1Value<HomepageContentRow>(`content_${siteId}`),
    projectSqlService.getProjectsSql(siteId, 'published'),
    getCachedAboutData(siteId),
  ]);

  let contentRow = contentVal ?? {};
  if (!contentVal && siteId === 'default-site') {
    contentRow = (await getD1Value<HomepageContentRow>('content')) ?? {};
  }

  const experienceData = deepMerge(
    experienceFallback as unknown as ExperienceData,
    contentRow.experience
  );
  const hardSkillsData = deepMerge(
    hardSkillsFallback as unknown as HardSkillsData,
    contentRow.hardSkills
  );
  const testimonialsData =
    siteId === 'default-site'
      ? deepMerge(testimonialFallback as unknown as TestimonialData, contentRow.testimonial)
      : contentRow.testimonial
        ? deepMerge(emptyTenantTestimonials(), contentRow.testimonial)
        : emptyTenantTestimonials();
  const contactData = deepMerge(contactFallback as ContactData, contentRow.contact);

  return {
    aboutData,
    projects: projectsResult.projects,
    experienceData: {
      ...experienceData,
      workExperience: normalizeWorkExperience(experienceData.workExperience || []),
    },
    hardSkillsData: {
      ...hardSkillsData,
      skills: (hardSkillsData.skills || []).map((skill, index) => normalizeHardSkill(skill, index)),
      lastUpdated: hardSkillsData.lastUpdated || new Date().toISOString(),
    },
    testimonialsData: normalizeTestimonialData(testimonialsData),
    contactData,
  };
}

async function loadHomepageDataFromServices(siteId = 'default-site'): Promise<HomepageData> {
  const [aboutData, projectsResult, experienceData, hardSkillsData, testimonialsData, contactData] =
    await Promise.all([
      getCachedAboutData(siteId),
      projectSqlService.getProjectsSql(siteId, 'published'),
      experienceService.getExperienceData(siteId),
      hardSkillService.getHardSkills(siteId),
      testimonialService.getSiteTestimonials(siteId),
      getContactData(false, siteId),
    ]);

  return {
    aboutData,
    projects: projectsResult.projects,
    experienceData,
    hardSkillsData,
    testimonialsData,
    contactData,
  };
}

/**
 * Consolidates homepage data fetching into one D1 batch read for cold paths.
 * Falls back to service-level loaders if D1 env/network is unavailable.
 *
 * Caching strategy:
 * - **Per-request dedup** via React `cache()` — kalau dipanggil dari layout DAN page
 *   dalam satu request (mis. `(site)/layout.tsx` + `(site)/page.tsx` saat render
 *   homepage), cuma satu kali batch D1 read terjadi.
 * - **Cross-request caching** diserahkan ke ISR/runtime cache (`revalidate = 60`),
 *   yang konsisten dengan `revalidatePath('/', 'layout')` di admin routes.
 *
 * Catatan: module-level cache di-drop karena bug tersembunyi — `revalidatePath`
 * tidak menjangkau cache module di lambda yang masih hangat, sehingga visitor
 * lihat data stale sampai TTL habis. ISR + per-request dedup lebih konsisten
 * dan tidak butuh dance invalidation manual.
 */
export const loadHomepageData = cache(async (siteId = 'default-site'): Promise<HomepageData> => {
  return isD1Configured()
    ? await loadHomepageDataFromD1(siteId).catch((error) => {
        console.warn(
          `[HomepageLoader] D1 batch read failed for site ${siteId}, falling back to service loaders:`,
          error
        );
        return loadHomepageDataFromServices(siteId);
      })
    : await loadHomepageDataFromServices(siteId);
});
