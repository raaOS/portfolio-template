/** Type definitions untuk data pengalaman kerja (Work Experience). @module */
export interface WorkExperience {
  id: string;
  year: string;
  duration: string;
  company: string;
  position: string;
  position_id?: string;
  description: string[];
  description_id?: string[];
  imageUrl: string;
  isActive?: boolean;
}

import type { EventPage } from './event-page';

export interface ExperienceData {
  statistics: {
    years: string;
    projects: string;
    designTools: string;
    clientSatisfaction: string;
  };
  workExperience: WorkExperience[];
  events?: EventPage[];
  lastUpdated: string;
}

export interface CreateExperienceData {
  statistics: {
    years: string;
    projects: string;
    designTools: string;
    clientSatisfaction: string;
  };
  workExperience: WorkExperience[];
}

export interface UpdateExperienceData {
  id: string;
  year: string;
  duration: string;
  company: string;
  position: string;
  position_id?: string;
  description: string[];
  description_id?: string[];
  imageUrl: string;
}

export interface Statistics {
  years: string;
  projects: string;
  designTools: string;
  clientSatisfaction: string;
}
