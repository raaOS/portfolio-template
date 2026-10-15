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

describe('projectSqlService.getProjectsSql (batch, bukan N+1)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const projRow = (id: string, title: string, order: number) => ({
    id,
    site_id: 'default-site',
    slug: id,
    title,
    cover_media_id: null,
    status: 'published',
    order_index: order,
    metadata_json: '{}',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  });

  it('memuat semua project hanya dengan 3 query (1 projects + 2 batch paralel)', async () => {
    queryD1Mock.mockImplementation((sql: string) => {
      if (sql.startsWith('SELECT * FROM projects WHERE site_id = ?')) {
        return Promise.resolve([projRow('p1', 'Satu', 1), projRow('p2', 'Dua', 2)]);
      }
      if (sql.startsWith('SELECT * FROM project_narratives')) {
        return Promise.resolve([
          { id: 'n2', project_id: 'p2', challenge: 'Tantangan Dua', solution: '', impact: '' },
          { id: 'n1', project_id: 'p1', challenge: 'Tantangan Satu', solution: '', impact: '' },
        ]);
      }
      if (sql.startsWith('SELECT * FROM media_assets')) {
        return Promise.resolve([
          {
            id: 'm2',
            project_id: 'p2',
            sort_order: 1,
            public_url: 'https://cdn.example.com/two.jpg',
            alt_text: '',
            r2_key: 'k/two.jpg',
          },
          {
            id: 'm1',
            project_id: 'p1',
            sort_order: 1,
            public_url: 'https://cdn.example.com/one.mp4',
            alt_text: '',
            r2_key: 'k/one.mp4',
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const { projects } = await projectSqlService.getProjectsSql('default-site', 'published');

    // REGRESI N+1: tanpa batch ini, 2 project = 5 query; di produksi (20 project)
    // pola lama menghasilkan ±41 query REST berurutan ≈ 8 detik render ulang.
    expect(queryD1Mock).toHaveBeenCalledTimes(3);

    expect(projects.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(projects[0].narrative?.challenge).toBe('Tantangan Satu');
    expect(projects[1].narrative?.challenge).toBe('Tantangan Dua');
    expect(projects[0].galleryItems).toEqual([
      { kind: 'video', src: 'https://cdn.example.com/one.mp4', alt: 'Satu' },
    ]);
    expect(projects[1].galleryItems).toEqual([
      { kind: 'image', src: 'https://cdn.example.com/two.jpg', alt: 'Dua' },
    ]);
  });

  it('berhenti di 1 query saat tidak ada project sama sekali', async () => {
    queryD1Mock.mockResolvedValue([]);

    const { projects } = await projectSqlService.getProjectsSql('default-site', 'published');

    expect(projects).toEqual([]);
    expect(queryD1Mock).toHaveBeenCalledTimes(1);
  });
});
