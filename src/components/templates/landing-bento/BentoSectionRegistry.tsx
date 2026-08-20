'use client';

import React from 'react';
import type { PortfolioTemplateData } from '@/types/template';
import type { BentoSectionConfig, BentoTemplateSettings } from '@/lib/templates/bento/settings';
import { AnimatedSection } from './AnimatedSection';
import { HeroSection } from './sections/HeroSection';
import { BentoImageSequence } from './components/BentoImageSequence';
import { BentoProjects } from './components/BentoProjects';
import { BentoExperience } from './components/BentoExperience';
import { BentoContact } from './components/BentoContact';

interface BentoSectionRendererProps {
  section: BentoSectionConfig;
  motion: BentoTemplateSettings['motion'];
  data: PortfolioTemplateData;
}

/**
 * Merender satu section sesuai `type` + `variant` dari config settings,
 * dibungkus animasi preset dari `section.animation`.
 * `normalizeBentoSettings` menjamin `variant` selalu valid untuk type-nya,
 * sehingga cast di sini aman.
 */
export function BentoSectionRenderer({ section, motion, data }: BentoSectionRendererProps) {
  let body: React.ReactNode;

  switch (section.type) {
    case 'hero':
      body = <HeroSection variant={section.variant as 'default' | 'compact'} data={data} />;
      break;
    case 'sequence':
      body = <BentoImageSequence variant={section.variant as 'full' | 'minimal'} />;
      break;
    case 'projects':
      body = <BentoProjects variant={section.variant as 'grid' | 'list'} projects={data.projects} />;
      break;
    case 'experience':
      body = (
        <BentoExperience
          variant={section.variant as 'timeline' | 'cards'}
          experiences={data.experiences}
          skills={data.hardSkills}
        />
      );
      break;
    case 'contact':
      body = (
        <BentoContact variant={section.variant as 'split' | 'centered'} contact={data.contact} />
      );
      break;
    default:
      body = null;
  }

  return (
    <AnimatedSection animation={section.animation} stagger={motion.stagger} parallax={motion.parallax}>
      {body}
    </AnimatedSection>
  );
}