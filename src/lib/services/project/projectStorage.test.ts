import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '@/types/projects';

const { deleteFromR2Mock, isR2StorageConfiguredMock } = vi.hoisted(() => ({
  deleteFromR2Mock: vi.fn(),
  isR2StorageConfiguredMock: vi.fn(),
}));

vi.mock('@/lib/r2Storage', () => ({
  deleteFromR2: deleteFromR2Mock,
  isR2StorageConfigured: isR2StorageConfiguredMock,
}));

import {
  extractProjectAssets,
  extractSiteProjectMediaKey,
  extractSiteProjectMediaKeys,
  purgeSiteProjectMediaAssets,
  purgeUnreferencedSiteProjectMediaAssets,
} from './projectStorage';

const baseProject: Project = {
  id: 'proj-1',
  slug: 'project-one',
  title: 'Project One',
  client: 'Client',
  year: 2026,
  tags: ['web'],
  cover: 'https://media.example.com/sites/site-a/projects/covers/cover.webp',
  autoplay: false,
  muted: true,
  loop: false,
  playsInline: true,
  coverWidth: 1200,
  coverHeight: 800,
  description: 'Description',
  gallery: ['https://media.example.com/sites/site-a/projects/gallery/one.webp'],
  galleryItems: [
    {
      kind: 'video',
      src: 'https://media.example.com/sites/site-a/projects/gallery/demo.mp4',
      poster: 'https://media.example.com/sites/site-a/projects/gallery/demo.jpg',
    },
  ],
  galleryGroups: [
    {
      id: 'group-1',
      name: 'Group',
      items: [
        {
          kind: 'image',
          src: '/r2/sites/site-a/projects/gallery/group.webp',
          poster: '/r2/sites/site-a/projects/gallery/group-poster.webp',
        },
      ],
    },
  ],
  order: 1,
  status: 'published',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('projectStorage site-scoped media cleanup', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    isR2StorageConfiguredMock.mockReturnValue(true);
    deleteFromR2Mock.mockResolvedValue(undefined);
  });

  it('extracts all project asset references including gallery arrays and posters', () => {
    const assets = extractProjectAssets(baseProject);

    expect(assets).toEqual(
      expect.arrayContaining([
        baseProject.cover,
        'https://media.example.com/sites/site-a/projects/gallery/one.webp',
        'https://media.example.com/sites/site-a/projects/gallery/demo.mp4',
        'https://media.example.com/sites/site-a/projects/gallery/demo.jpg',
        '/r2/sites/site-a/projects/gallery/group.webp',
        '/r2/sites/site-a/projects/gallery/group-poster.webp',
      ])
    );
  });

  it('only extracts keys inside the matching site project prefix', () => {
    expect(
      extractSiteProjectMediaKey(
        'site-a',
        'https://media.example.com/sites/site-a/projects/gallery/image%201.webp'
      )
    ).toBe('sites/site-a/projects/gallery/image 1.webp');
    expect(extractSiteProjectMediaKey('site-a', '/r2/sites/site-a/projects/covers/cover.webp')).toBe(
      'sites/site-a/projects/covers/cover.webp'
    );
    expect(extractSiteProjectMediaKey('site-a', 'sites/site-a/projects/gallery/raw.webp')).toBe(
      'sites/site-a/projects/gallery/raw.webp'
    );
    expect(extractSiteProjectMediaKey('site-a', 'sites/site-b/projects/gallery/raw.webp')).toBeNull();
    expect(extractSiteProjectMediaKey('site-a', 'https://cdn.example.com/assets/projects/raw.webp')).toBeNull();
  });

  it('dedupes keys and expands known video sidecars', () => {
    const keys = extractSiteProjectMediaKeys('site-a', baseProject, [
      'sites/site-a/projects/gallery/one.webp',
    ]);

    expect(keys).toEqual(
      expect.arrayContaining([
        'sites/site-a/projects/covers/cover.webp',
        'sites/site-a/projects/gallery/one.webp',
        'sites/site-a/projects/gallery/demo.mp4',
        'sites/site-a/projects/gallery/demo-preview.mp4',
        'sites/site-a/projects/gallery/demo.jpg',
        'sites/site-a/projects/gallery/demo.webp',
      ])
    );
    expect(keys.filter((key) => key === 'sites/site-a/projects/gallery/one.webp')).toHaveLength(1);
  });

  it('purges stale site media while keeping media still referenced by the next project', async () => {
    const nextProject: Project = {
      ...baseProject,
      cover: 'https://media.example.com/sites/site-a/projects/covers/new-cover.webp',
      gallery: ['https://media.example.com/sites/site-a/projects/gallery/one.webp'],
      galleryItems: [],
      galleryGroups: [],
    };

    const result = await purgeUnreferencedSiteProjectMediaAssets({
      siteId: 'site-a',
      previousProject: baseProject,
      nextProject,
    });

    expect(result.requested).toBeGreaterThan(0);
    expect(deleteFromR2Mock).toHaveBeenCalledWith('sites/site-a/projects/covers/cover.webp');
    expect(deleteFromR2Mock).not.toHaveBeenCalledWith('sites/site-a/projects/gallery/one.webp');
    expect(deleteFromR2Mock).not.toHaveBeenCalledWith(
      'sites/site-a/projects/covers/new-cover.webp'
    );
  });

  it('does not purge stale keys that are retained by another project', async () => {
    const nextProject: Project = {
      ...baseProject,
      cover: 'https://media.example.com/sites/site-a/projects/covers/new-cover.webp',
      gallery: [],
      galleryItems: [],
      galleryGroups: [],
    };

    await purgeUnreferencedSiteProjectMediaAssets({
      siteId: 'site-a',
      previousProject: baseProject,
      nextProject,
      retainedKeys: ['sites/site-a/projects/covers/cover.webp'],
    });

    expect(deleteFromR2Mock).not.toHaveBeenCalledWith('sites/site-a/projects/covers/cover.webp');
  });

  it('skips purge when R2 is not configured', async () => {
    isR2StorageConfiguredMock.mockReturnValue(false);

    const result = await purgeSiteProjectMediaAssets('site-a', baseProject);

    expect(result.requested).toBeGreaterThan(1);
    expect(result.deleted).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(result.requested);
    expect(deleteFromR2Mock).not.toHaveBeenCalled();
  });
});
