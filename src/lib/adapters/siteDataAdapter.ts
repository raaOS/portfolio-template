import { queryD1 } from '@/lib/cloudflareD1';
import { aboutService } from '@/lib/services/aboutService';
import { experienceService } from '@/lib/services/experienceService';
import { hardSkillService } from '@/lib/services/hardSkillService';
import { testimonialService } from '@/lib/services/testimonialService';
import { projectSqlService } from '@/lib/services/project/projectSqlService';
import { getContactData } from '@/lib/contact';
import { HomepageData } from '@/lib/loaders';
import { Project } from '@/types/projects';
import { resolveProjectMediaUrls, resolveProjectMediaUrl } from '@/lib/urlResolver';

export interface SiteInfo {
  id: string;
  slug: string;
  name: string;
  plan: string;
  status: string;
}

export async function getSiteBySlug(slug: string): Promise<SiteInfo | null> {
  const rows = await queryD1<SiteInfo>(`SELECT * FROM sites WHERE slug = ? LIMIT 1`, [slug]);
  return rows[0] || null;
}

export async function getHomepageDataBySlug(siteSlug: string): Promise<HomepageData | null> {
  const site = await getSiteBySlug(siteSlug);
  if (!site || site.status !== 'active') return null;

  const siteId = site.id;

  const [aboutData, projectsResult, experienceData, hardSkillsData, testimonialsData, contactData] =
    await Promise.all([
      aboutService.getAboutData(siteId),
      projectSqlService.getProjectsSql(siteId, 'published'),
      experienceService.getExperienceData(siteId),
      hardSkillService.getHardSkills(siteId),
      testimonialService.getSiteTestimonials(siteId),
      getContactData(false, siteId),
    ]);

  const projects = resolveProjectMediaUrls(projectsResult.projects);

  return {
    aboutData,
    projects,
    experienceData,
    hardSkillsData,
    testimonialsData,
    contactData,
  };
}

export async function getProjectBySlugAndSiteSlug(
  siteSlug: string,
  projectSlug: string
): Promise<Project | null> {
  const site = await getSiteBySlug(siteSlug);
  if (!site || site.status !== 'active') return null;

  const project = await projectSqlService.getProjectBySlugSql(site.id, projectSlug);
  if (!project || project.status === 'draft') return null;

  return resolveProjectMediaUrl(project);
}
