import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  queryD1Mock,
  extractSiteProjectMediaKeysMock,
  purgeSiteProjectMediaAssetsMock,
  purgeUnreferencedSiteProjectMediaAssetsMock,
} = vi.hoisted(() => ({
  queryD1Mock: vi.fn(),
  extractSiteProjectMediaKeysMock: vi.fn(),
  purgeSiteProjectMediaAssetsMock: vi.fn(),
  purgeUnreferencedSiteProjectMediaAssetsMock: vi.fn(),
}));

vi.mock('@/lib/cloudflareD1', () => ({
  queryD1: queryD1Mock,
}));

vi.mock('@/lib/services/project/projectStorage', () => ({
  extractSiteProjectMediaKeys: extractSiteProjectMediaKeysMock,
  purgeSiteProjectMediaAssets: purgeSiteProjectMediaAssetsMock,
  purgeUnreferencedSiteProjectMediaAssets: purgeUnreferencedSiteProjectMediaAssetsMock,
}));

import { projectSqlService } from './projectSqlService';

const beforeRow = {
  id: 'proj-1',
  site_id: 'default-site',
  slug: 'project-one',
  title: 'Project One',
  cover_media_id: null,
  status: 'published',
  order_index: 1,
  metadata_json: JSON.stringify({
    client: 'Client',
    year: 2026,
    tags: ['web'],
    description: 'Before description',
    cover: 'https://media.example.com/sites/default-site/projects/covers/old-cover.webp',
    gallery: ['https://media.example.com/sites/default-site/projects/gallery/keep.webp'],
  }),
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const afterRow = {
  ...beforeRow,
  title: 'Project One Updated',
  metadata_json: JSON.stringify({
    client: 'Client',
    year: 2026,
    tags: ['web'],
    description: 'After description',
    cover: 'https://media.example.com/sites/default-site/projects/covers/new-cover.webp',
    gallery: ['https://media.example.com/sites/default-site/projects/gallery/keep.webp'],
  }),
  updated_at: '2026-01-02T00:00:00.000Z',
};

function mockCommonSelects(rowSelector: () => typeof beforeRow) {
  queryD1Mock.mockImplementation((sql: string) => {
    if (sql.startsWith('SELECT * FROM projects WHERE id = ? AND site_id = ?')) {
      return Promise.resolve([rowSelector()]);
    }
    if (sql.startsWith('SELECT * FROM project_narratives')) {
      return Promise.resolve([]);
    }
    if (sql.startsWith('SELECT * FROM media_assets')) {
      return Promise.resolve([]);
    }
    if (sql.startsWith('SELECT r2_key FROM media_assets')) {
      return Promise.resolve([
        { r2_key: 'sites/default-site/projects/gallery/media-row.webp' },
        { r2_key: 'assets/projects/legacy-row.webp' },
      ]);
    }
    return Promise.resolve([]);
  });
}

describe('projectSqlService media cleanup lifecycle', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    extractSiteProjectMediaKeysMock.mockReturnValue([]);
    purgeSiteProjectMediaAssetsMock.mockResolvedValue({
      requested: 1,
      deleted: 1,
      failed: 0,
      skipped: 0,
    });
    purgeUnreferencedSiteProjectMediaAssetsMock.mockResolvedValue({
      requested: 1,
      deleted: 1,
      failed: 0,
      skipped: 0,
    });
  });

  it('purges all site-scoped project media after SQL delete succeeds', async () => {
    mockCommonSelects(() => beforeRow);

    const deleted = await projectSqlService.deleteProjectSql('default-site', 'proj-1');

    expect(deleted).toBe(true);
    expect(purgeUnreferencedSiteProjectMediaAssetsMock).toHaveBeenCalledWith({
      siteId: 'default-site',
      previousProject: expect.objectContaining({
        id: 'proj-1',
        cover: 'https://media.example.com/sites/default-site/projects/covers/old-cover.webp',
      }),
      nextProject: expect.objectContaining({ cover: '', gallery: [] }),
      previousAdditionalValues: [
        'sites/default-site/projects/gallery/media-row.webp',
        'assets/projects/legacy-row.webp',
      ],
      retainedKeys: [],
    });
  });

  it('purges stale site-scoped media after SQL update returns the next project', async () => {
    let updateApplied = false;
    queryD1Mock.mockImplementation((sql: string) => {
      if (sql.startsWith('SELECT * FROM projects WHERE id = ? AND site_id = ?')) {
        return Promise.resolve([updateApplied ? afterRow : beforeRow]);
      }
      if (sql.startsWith('SELECT * FROM project_narratives')) {
        return Promise.resolve([]);
      }
      if (sql.startsWith('SELECT * FROM media_assets')) {
        return Promise.resolve([]);
      }
      if (sql.startsWith('UPDATE projects SET')) {
        updateApplied = true;
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    const updated = await projectSqlService.updateProjectSql('default-site', 'proj-1', {
      id: 'proj-1',
      title: 'Project One Updated',
      cover: 'https://media.example.com/sites/default-site/projects/covers/new-cover.webp',
    });

    expect(updated?.cover).toBe('https://media.example.com/sites/default-site/projects/covers/new-cover.webp');
    expect(purgeUnreferencedSiteProjectMediaAssetsMock).toHaveBeenCalledWith({
      siteId: 'default-site',
      previousProject: expect.objectContaining({
        cover: 'https://media.example.com/sites/default-site/projects/covers/old-cover.webp',
      }),
      nextProject: expect.objectContaining({
        cover: 'https://media.example.com/sites/default-site/projects/covers/new-cover.webp',
      }),
      previousAdditionalValues: [],
      nextAdditionalValues: [],
      retainedKeys: [],
    });
  });
});
