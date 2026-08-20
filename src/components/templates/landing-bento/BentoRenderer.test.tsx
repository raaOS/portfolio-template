import { describe, expect, it } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import BentoRenderer from './BentoRenderer';
import type { PortfolioTemplateData } from '@/types/template';
import { DEFAULT_BENTO_SETTINGS } from '@/lib/templates/bento/settings';

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

  it('renders all default sections in config order', () => {
    render(<BentoRenderer data={dummyTemplateData} />);

    const containers = [
      screen.getByTestId('bento-section-hero-default'),
      screen.getByTestId('bento-section-sequence-full'),
      screen.getByTestId('bento-section-projects-grid'),
      screen.getByTestId('bento-section-experience-timeline'),
      screen.getByTestId('bento-section-contact-split'),
    ];

    for (let idx = 0; idx < containers.length - 1; idx += 1) {
      expect(
        containers[idx].compareDocumentPosition(containers[idx + 1]) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    }
  });

  it('skips hidden sections and honors custom order', () => {
    const data: PortfolioTemplateData = {
      ...dummyTemplateData,
      settings: {
        templateId: 'landing-bento',
        options: {
          ...DEFAULT_BENTO_SETTINGS,
          sections: [
            { id: 'contact', type: 'contact', order: 0, visible: true, variant: 'split', animation: 'none' },
            { id: 'hero', type: 'hero', order: 1, visible: false, variant: 'compact', animation: 'none' },
            { id: 'projects', type: 'projects', order: 2, visible: true, variant: 'list', animation: 'none' },
          ],
        },
      },
    };

    render(<BentoRenderer data={data} />);

    expect(screen.queryByTestId('bento-section-hero-compact')).not.toBeInTheDocument();
    expect(screen.getByTestId('bento-section-contact-split')).toBeInTheDocument();
    expect(screen.getByTestId('bento-section-projects-list')).toBeInTheDocument();
    // Sequence/experience hilang dari config → normalizer menambahkan kembali default-nya
    expect(screen.getByTestId('bento-section-sequence-full')).toBeInTheDocument();
    expect(screen.getByTestId('bento-section-experience-timeline')).toBeInTheDocument();
  });

  it('applies theme accent token as CSS variable on root', () => {
    const data: PortfolioTemplateData = {
      ...dummyTemplateData,
      settings: {
        templateId: 'landing-bento',
        options: {
          ...DEFAULT_BENTO_SETTINGS,
          theme: { accent: 'rose', font: 'outfit', background: 'light' },
        },
      },
    };

    const { container } = render(<BentoRenderer data={data} />);
    const root = container.firstChild as HTMLElement;

    expect(root.style.getPropertyValue('--bento-accent')).toBe('#f43f5e');
    expect(root.style.fontFamily).toContain('Outfit');
  });
});
