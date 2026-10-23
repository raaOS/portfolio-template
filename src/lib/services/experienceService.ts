/**
 * Experience Service — CRUD data pengalaman kerja.
 *
 * Instansiasi ContentService untuk domain experience dengan fallback JSON.
 * Digunakan oleh halaman CV dan admin panel.
 *
 * @module experienceService
 */
import { ContentService } from './contentService';
import { ExperienceData, WorkExperience } from '@/types/experience';

import experienceFixed from '@/data/experience.json';

const service = new ContentService<ExperienceData>(
  'experience.json',
  experienceFixed as unknown as ExperienceData
);

function slugifyWorkField(value: unknown) {
  if (typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildWorkExperienceId(work: Omit<WorkExperience, 'id'>, index: number) {
  const parts = [work.company, work.position, work.year].map(slugifyWorkField).filter(Boolean);

  return parts.length > 0 ? `${parts.join('-')}-${index}` : `experience-${index}`;
}

function normalizeWorkExperience(workExperience: WorkExperience[]): WorkExperience[] {
  return workExperience.map((work, index) => ({
    ...work,
    id: work.id?.trim() || buildWorkExperienceId(work, index),
  }));
}

export const experienceService = {
  /**
   * Retrieves the current "Experience" data (stats and work history).
   *
   * @returns A promise that resolves to the ExperienceData.
   */
  async getExperienceData(noCache: boolean | string = false, throwOnError = false, siteId = 'default-site') {
    const actualNoCache = typeof noCache === 'boolean' ? noCache : false;
    const actualSiteId = typeof noCache === 'string' ? noCache : siteId;
    const data = await service.getData(actualNoCache, throwOnError, actualSiteId);
    return {
      ...data,
      workExperience: normalizeWorkExperience(data.workExperience || []),
    };
  },

  /**
   * Updates the "Experience" data.
   * Merges statistics and replaces/updates work experience list.
   *
   * @param updates - The partial experience data to update.
   * @returns A promise that resolves to the updated experience data.
   */
  async updateExperienceData(updates: Partial<ExperienceData>, siteId = 'default-site') {
    const current = await this.getExperienceData(true, true, siteId);
    const normalizedIncomingWorkExperience = updates.workExperience
      ? normalizeWorkExperience(updates.workExperience)
      : undefined;

    // Merge logic
    const mergedData: ExperienceData = {
      ...current,
      statistics: { ...current.statistics, ...(updates.statistics || {}) },
      workExperience: normalizedIncomingWorkExperience ?? current.workExperience,
      lastUpdated: new Date().toISOString(),
    };

    const success = await service.saveData(mergedData, 'Update experience content', siteId);
    if (!success) {
      throw new Error('Failed to save experience data');
    }
    return mergedData;
  },
};
