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

export type TemplateCategory = 'os' | 'landing' | '3d';
export type TemplateTier = 'lite' | 'pro';

export interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  tierRequired: TemplateTier;
  priceIdr: number;
  isActive: boolean;
  previewImageUrl?: string;
  demoSlug?: string;
  features?: string[];
  createdAt?: string;
}

export interface SiteTemplateEntitlement {
  id: string;
  siteId: string;
  templateId: string;
  grantedBy: 'system' | 'purchase' | 'master_admin';
  createdAt: string;
}

export interface SiteTemplateSettings {
  templateId: string;
  theme?: 'dark' | 'light' | 'auto';
  accentColor?: string;
  customCss?: string;
  options?: Record<string, unknown>;
}

export interface SiteProfileHeader {
  id: string;
  slug: string;
  title: string;
  description?: string;
  avatarUrl?: string;
  tier: TemplateTier;
  activeTemplateKey: string;
}

/**
 * Single Source of Truth Universal Data Contract untuk seluruh Template Renderer.
 * Seluruh renderer template (OS Desktop, Bento) wajib mengonsumsi data ini.
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
  settings?: SiteTemplateSettings;
  lastUpdated: string;
}

export interface TemplateRendererProps {
  data: PortfolioTemplateData;
  isPreview?: boolean;
}
