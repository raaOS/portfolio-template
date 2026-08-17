import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateSitemap, generateMetadata, generateSitemapUrls } from '../seo';
import type { Project } from '@/types/projects';

/** Minimal mock Project untuk testing. */
function mockProject(overrides?: Partial<Project>): Project {
  return {
    id: '1',
    slug: 'test-project',
    title: 'Test Project',
    description: 'A test project description',
    cover: '/test.jpg',
    tags: ['design'],
    status: 'published',
    order: 1,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-06-01T00:00:00Z',
    ...overrides,
  } as Project;
}

describe('SEO Utilities', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://portfolio-os.example');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('generateSitemap', () => {
    it('should include site URL and base routes', () => {
      const sitemap = generateSitemap([]);

      expect(sitemap).toContain('https://portfolio-os.example');
      expect(sitemap).toContain('/projects');
      expect(sitemap).toContain('/contact');
      expect(sitemap).toContain('<?xml version="1.0"');
      expect(sitemap).toContain('<urlset');
    });

    it('should include project slugs', () => {
      const projects = [mockProject({ slug: 'my-project' }), mockProject({ slug: 'another-one' })];
      const sitemap = generateSitemap(projects);

      expect(sitemap).toContain('/projects/my-project');
      expect(sitemap).toContain('/projects/another-one');
    });

    it('should include priority and changefreq for each URL', () => {
      const sitemap = generateSitemap([]);

      expect(sitemap).toContain('<priority>');
      expect(sitemap).toContain('<changefreq>');
      expect(sitemap).toContain('<lastmod>');
    });
  });

  describe('generateSitemapUrls', () => {
    it('should return base URLs plus project URLs', () => {
      const projects = [mockProject()];
      const urls = generateSitemapUrls(projects);

      expect(urls.length).toBeGreaterThanOrEqual(4); // 3 base + 1 project
      expect(urls.some((u) => u.url === '/')).toBe(true);
      expect(urls.some((u) => u.url === '/projects')).toBe(true);
      expect(urls.some((u) => u.url === '/projects/test-project')).toBe(true);
    });

    it('should assign highest priority to homepage', () => {
      const urls = generateSitemapUrls([]);
      const homepage = urls.find((u) => u.url === '/');

      expect(homepage?.priority).toBe(1.0);
    });
  });

  describe('generateMetadata', () => {
    it('should generate metadata with title and description', () => {
      const metadata = generateMetadata({
        title: 'Test Page',
        description: 'Test description',
        path: '/test',
      });

      expect(metadata.title).toContain('Test Page');
      expect(metadata.description).toBe('Test description');
    });

    it('should include canonical URL', () => {
      const metadata = generateMetadata({ path: '/about' });

      expect(metadata.alternates?.canonical).toBe('https://portfolio-os.example/about');
    });

    it('should include OpenGraph data', () => {
      const metadata = generateMetadata({
        title: 'OG Test',
        path: '/og',
      });

      expect(metadata.openGraph).toBeDefined();
      expect(metadata.openGraph?.title).toContain('OG Test');
    });

    it('should include Twitter metadata', () => {
      const metadata = generateMetadata({ title: 'Twitter Test' });

      expect(metadata.twitter).toBeDefined();
      // Type-safe check: twitter metadata exists (card field type varies by Next.js version)
      expect((metadata.twitter as Record<string, unknown>)?.card).toBe('summary_large_image');
    });
  });
});
