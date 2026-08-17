import { describe, expect, it } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import BentoRenderer from './BentoRenderer';
import type { PortfolioTemplateData } from '@/types/template';

describe('BentoRenderer', () => {
  const dummyTemplateData: PortfolioTemplateData = {
    site: {
      id: 'site-bento-1',
      slug: 'bento-demo',
      title: 'Bento Portfolio',
      tier: 'lite',
      activeTemplateKey: 'landing-bento',
    },
    about: {
      hero: { title: 'Senior Product Designer', backgroundTrail: [] },
      professional: { motto: { badge: 'Motto', quote: 'Design first' }, bio: { content: 'Building human-centered UIs.' } },
      softSkills: { items: [] },
      lastUpdated: '2026-01-01',
    },
    projects: [
      {
        id: 'proj-bento-1',
        title: 'Fintech Mobile App',
        slug: 'fintech-app',
        client: 'Bank Co',
        year: 2026,
        tags: ['UX', 'Figma'],
        cover: 'https://example.com/cover.jpg',
        autoplay: false,
        muted: true,
        loop: true,
        playsInline: true,
        coverWidth: 800,
        coverHeight: 600,
        description: 'Banking simplified',
        order: 1,
        status: 'published',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ],
    experiences: [
      {
        id: 'exp-1',
        year: '2025',
        duration: '1 yr',
        company: 'Design Studio',
        position: 'Lead Designer',
        description: ['Designing apps'],
        imageUrl: '',
      },
    ],
    events: [],
    hardSkills: [
      {
        id: 'skill-1',
        name: 'Figma',
        iconUrl: '',
        level: 'Expert',
        order: 1,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ],
    contact: {
      info: { email: 'designer@example.com', phone: '', address: '', socialMedia: {} },
      formSettings: {
        enabled: true,
        fields: {
          name: { required: true, label: 'Name' },
          email: { required: true, label: 'Email' },
          phone: { required: false, label: 'Phone' },
          company: { required: false, label: 'Company' },
          subject: { required: false, label: 'Subject' },
          message: { required: true, label: 'Message' },
        },
        submitButtonText: 'Send',
        successMessage: 'Sent',
        errorMessage: 'Failed',
      },
      lastUpdated: '2026-01-01',
    },
    testimonials: [],
    lastUpdated: '2026-01-01',
  };

  it('renders title, hero, projects, and skills correctly', () => {
    render(<BentoRenderer data={dummyTemplateData} />);

    expect(screen.getAllByText('Bento Portfolio').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Senior Product Designer').length).toBeGreaterThan(0);
    expect(screen.getByText('Fintech Mobile App')).toBeInTheDocument();
    expect(screen.getByText('Lead Designer')).toBeInTheDocument();
    expect(screen.getAllByText('Figma').length).toBeGreaterThan(0);
  });
});
