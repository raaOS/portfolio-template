import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import TemplateDispatcher from './TemplateDispatcher';
import type { PortfolioTemplateData } from '@/types/template';

// Mock HomeOSWrapper to avoid full desktop rendering overhead in unit tests
vi.mock('@/components/home/HomeOSWrapper', () => ({
  default: function DummyHomeOSWrapper(props: { siteId: string }) {
    return <div data-testid="os-wrapper">OS Desktop Shell: {props.siteId}</div>;
  },
}));

describe('TemplateDispatcher', () => {
  const dummyTemplateData: PortfolioTemplateData = {
    site: {
      id: 'site-test-1',
      slug: 'my-site',
      title: 'My Site',
      tier: 'lite',
      activeTemplateKey: 'os-desktop',
    },
    about: {
      hero: { title: 'Hello', backgroundTrail: [] },
      professional: { motto: { badge: 'B', quote: 'Q' }, bio: { content: 'C' } },
      softSkills: { items: [] },
      lastUpdated: '2026-01-01',
    },
    projects: [],
    experiences: [],
    events: [],
    hardSkills: [],
    contact: {
      info: { email: 'test@example.com', phone: '', address: '', socialMedia: {} },
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

  it('renders OSDesktopRenderer by default when activeTemplateKey is os-desktop', () => {
    render(<TemplateDispatcher data={dummyTemplateData} />);
    expect(screen.getByTestId('os-wrapper')).toBeInTheDocument();
    expect(screen.getByText('OS Desktop Shell: site-test-1')).toBeInTheDocument();
  });

  it('renders OSDesktopRenderer as fallback for unknown activeTemplateKey', () => {
    const unknownData = {
      ...dummyTemplateData,
      site: { ...dummyTemplateData.site, activeTemplateKey: 'unknown-key' },
    };
    render(<TemplateDispatcher data={unknownData} />);
    expect(screen.getByTestId('os-wrapper')).toBeInTheDocument();
  });
});
