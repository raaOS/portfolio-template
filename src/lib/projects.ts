import type { Project } from '@/types/projects';
import { projectSqlService } from '@/lib/services/project/projectSqlService';

export async function allProjectsAsync(siteId = 'default-site'): Promise<Project[]> {
  const { projects } = await projectSqlService.getProjectsSql(siteId, 'published');
  return projects;
}

export async function getProjectBySlugAsync(slug: string, siteId = 'default-site'): Promise<Project | null> {
  try {
    const project = await projectSqlService.getProjectBySlugSql(siteId, slug);
    if (project && project.status === 'draft') return null;
    return project;
  } catch {
    return null;
  }
}
