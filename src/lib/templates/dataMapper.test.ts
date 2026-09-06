import { describe, expect, it } from 'vitest';
import { mapD1ToTemplateData, SiteRecordWithTemplate } from './dataMapper';
import type { HomepageData } from '@/lib/loaders';

describe('dataMapper', () => {
  const dummySite: SiteRecordWithTemplate = {
    id: 'site-123',
    slug: 'johndoe',
    name: 'John Doe Portfolio',
    title: 'John Doe - Creative Developer',
    status: 'active',
  };

  const dummyHomepageData: HomepageData = {
    aboutData: {
      hero: {
        title: 'Creative Technologist',
        backgroundTrail: ['https://example.com/avatar.jpg'],
      },
      professional: {
        motto: { badge: 'Motto', quote: 'Design meets code' },
        bio: { content: 'Fullstack developer building cool things.' },
      },
      softSkills: { items: [] },
      lastUpdated: '2026-01-01T00:00:00Z',
    },
    projects: [
      {
        id: 'proj-1',
        title: 'Cool App',
        slug: 'cool-app',
        client: 'Acme',
        year: 2026,
        tags: ['React', 'Next.js'],
        cover: 'https://example.com/cover.jpg',
        autoplay: false,
        muted: true,
        loop: true,
        playsInline: true,
        coverWidth: 1920,
        coverHeight: 1080,
        description: 'A very cool app',
        order: 1,
        status: 'published',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ],
    experienceData: {
      statistics: {
        years: '5+',
        projects: '20+',
        designTools: '10+',
        clientSatisfaction: '100%',
      },
      workExperience: [
        {
          id: 'exp-1',
          year: '2024 - Present',
          duration: '1 yr',
          position: 'Senior Engineer',
          company: 'Tech Corp',
          description: ['Leading frontend team'],
          imageUrl: 'https://example.com/techcorp.jpg',
        },
      ],
      events: [],
      lastUpdated: '2026-01-01T00:00:00Z',
    },
    hardSkillsData: {
      skills: [
        {
          id: 'skill-1',
          name: 'TypeScript',
          iconUrl: 'https://cdn.simpleicons.org/typescript',
          level: 'Advanced',
          order: 1,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ],
      lastUpdated: '2026-01-01T00:00:00Z',
    },
    testimonialsData: {
      testimonials: [
        {
          id: 'testi-1',
          name: 'Jane Smith',
          notificationText: 'Left a review',
        },
      ],
      lastUpdated: '2026-01-01T00:00:00Z',
    },
    contactData: {
      info: {
        email: 'john@example.com',
        phone: '123456',
        address: 'Jakarta',
        socialMedia: {},
      },
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
        successMessage: 'Sent!',
        errorMessage: 'Failed',
      },
      lastUpdated: '2026-01-01T00:00:00Z',
    },
  };

  it('correctly maps D1 and HomepageData to PortfolioTemplateData', () => {
    const result = mapD1ToTemplateData({
      site: dummySite,
      homepageData: dummyHomepageData,
    });

    expect(result.site.id).toBe('site-123');
    expect(result.site.slug).toBe('johndoe');
    expect(result.site.activeTemplateKey).toBe('os-desktop');
    expect(result.site.avatarUrl).toBe('https://example.com/avatar.jpg');

    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].title).toBe('Cool App');

    expect(result.experiences).toHaveLength(1);
    expect(result.experiences[0].company).toBe('Tech Corp');

    expect(result.testimonials).toHaveLength(1);
    expect(result.testimonials[0].name).toBe('Jane Smith');

    expect(result.contact.info.email).toBe('john@example.com');
  });

  it('fallbacks to os-desktop if active_template_key is undefined', () => {
    const result = mapD1ToTemplateData({
      site: { ...dummySite, active_template_key: undefined },
      homepageData: dummyHomepageData,
    });

    expect(result.site.activeTemplateKey).toBe('os-desktop');
  });
});
