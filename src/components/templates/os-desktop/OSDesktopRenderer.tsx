'use client';

import React from 'react';
import HomeOSWrapper from '@/components/home/HomeOSWrapper';
import type { TemplateRendererProps } from '@/types/template';

export default function OSDesktopRenderer({ data }: TemplateRendererProps) {
  const { site, about, projects, experiences, events, hardSkills, testimonials, contact, lastUpdated } = data;

  const experienceData = {
    statistics: {
      years: '5+',
      projects: '20+',
      designTools: '10+',
      clientSatisfaction: '100%',
    },
    workExperience: experiences || [],
    events: events || [],
    lastUpdated: lastUpdated || new Date().toISOString(),
  };

  const hardSkillsData = {
    skills: hardSkills || [],
    lastUpdated: lastUpdated || new Date().toISOString(),
  };

  const testimonialsData = {
    testimonials: testimonials || [],
    lastUpdated: lastUpdated || new Date().toISOString(),
  };

  return (
    <main
      role="main"
      aria-label="macOS Desktop Simulator"
      className="relative h-screen w-full overflow-hidden bg-[#050505]"
    >
      <HomeOSWrapper
        siteId={site.id}
        aboutData={about}
        experienceData={experienceData}
        hardSkillsData={hardSkillsData}
        projects={projects || []}
        testimonialsData={testimonialsData}
        contactData={contact}
      />
    </main>
  );
}
