/**
 * Hard Skill Concept Service — CRUD data konsep detail tiap hard skill.
 *
 * @module hardSkillConceptService
 */
import { ContentService } from './contentService';
import { HardSkillConcept, HardSkillConceptsData } from '@/types/hardSkillConcept';
import { FALLBACK_HARD_SKILL_CONCEPTS } from '@/data/fallback-content';

const defaultData: HardSkillConceptsData = {
  concepts: FALLBACK_HARD_SKILL_CONCEPTS,
  lastUpdated: new Date().toISOString(),
};

const service = new ContentService<HardSkillConceptsData>('hardSkillConcepts.json', defaultData);

export const hardSkillConceptService = {
  async getConcepts(noCache: boolean | string = false, throwOnError = false, siteId = 'default-site') {
    const actualNoCache = typeof noCache === 'boolean' ? noCache : false;
    const actualSiteId = typeof noCache === 'string' ? noCache : siteId;
    return await service.getData(actualNoCache, throwOnError, actualSiteId);
  },

  async createConcept(
    conceptData: Omit<HardSkillConcept, 'id' | 'createdAt' | 'updatedAt'>,
    siteId = 'default-site'
  ) {
    const data = await this.getConcepts(true, true, siteId);
    const newConcept: HardSkillConcept = {
      id: `concept-${Date.now()}`,
      ...conceptData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    data.concepts.push(newConcept);
    data.lastUpdated = new Date().toISOString();

    const success = await service.saveData(data, `Add concept: ${newConcept.title}`, siteId);
    if (!success) {
      throw new Error('Failed to save new concept');
    }
    return newConcept;
  },

  async updateConcept(id: string, updates: Partial<HardSkillConcept>, siteId = 'default-site') {
    const data = await this.getConcepts(true, true, siteId);
    const index = data.concepts.findIndex((c) => c.id === id);
    if (index === -1) return null;

    data.concepts[index] = {
      ...data.concepts[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    data.lastUpdated = new Date().toISOString();

    const success = await service.saveData(
      data,
      `Update concept: ${data.concepts[index].title}`,
      siteId
    );
    if (!success) {
      throw new Error('Failed to save concept update');
    }
    return data.concepts[index];
  },

  async deleteConcept(id: string, siteId = 'default-site') {
    const data = await this.getConcepts(true, true, siteId);
    const initialLen = data.concepts.length;
    data.concepts = data.concepts.filter((c) => c.id !== id);

    if (data.concepts.length === initialLen) return false;

    data.lastUpdated = new Date().toISOString();
    const success = await service.saveData(data, `Delete concept ID: ${id}`, siteId);
    if (!success) {
      throw new Error('Failed to delete concept');
    }
    return true;
  },
};
