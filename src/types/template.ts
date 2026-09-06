/**
 * Specification & TypeScript Interface Kontrak Multi-Template
 * Portfolio OS Multi-Tenant Platform
 * @module
 */

import type { AboutData } from './about';
import type { ContactData } from './contact';
import type { EventPage } from './event-page';
import type { WorkExperience } from './experience';
import type { HardSkill } from './hardSkill';
import type { Project } from './projects';
import type { Testimonial } from './testimonial';

export interface SiteProfileHeader {
  id: string;
  slug: string;
  title: string;
  description?: string;
  avatarUrl?: string;
  activeTemplateKey: string;
}

/**
 * Single Source of Truth Universal Data Contract untuk seluruh Template Renderer.
 * Seluruh renderer template wajib mengonsumsi data ini.
 */
export interface PortfolioTemplateData {
  site: SiteProfileHeader;
  about: AboutData;
  projects: Project[];
  experiences: WorkExperience[];
  events: EventPage[];
  hardSkills: HardSkill[];
  contact: ContactData;
  testimonials: Testimonial[];
  lastUpdated: string;
}

export interface TemplateRendererProps {
  data: PortfolioTemplateData;
  isPreview?: boolean;
}
