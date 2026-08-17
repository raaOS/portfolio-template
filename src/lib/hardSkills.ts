/**
 * Hard Skills — Helper loader untuk data hard skills.
 *
 * Thin wrapper di atas `hardSkillService` untuk server component rendering.
 *
 * @module hardSkills
 */
import { hardSkillService } from '@/lib/services/hardSkillService';
import type { HardSkillsData } from '@/types/hardSkill';

export async function loadHardSkillsData(
  noCache: boolean | string = false,
  siteId = 'default-site'
): Promise<HardSkillsData | null> {
  try {
    return hardSkillService.getHardSkills(noCache, false, siteId);
  } catch (error) {
    console.error('Error loading hard skills data:', error);
    return null;
  }
}
