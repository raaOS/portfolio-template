import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  validateAdminRequestMock,
  getAboutDataMock,
  updateAboutDataMock,
  getProjectsMock,
  getHardSkillsMock,
  getAllNodesMock,
  extractProjectAssetsMock,
  listR2ObjectKeysMock,
  isR2StorageConfiguredMock,
  getMissingR2EnvKeysMock,
} = vi.hoisted(() => ({
  validateAdminRequestMock: vi.fn(),
  getAboutDataMock: vi.fn(),
  updateAboutDataMock: vi.fn(),
  getProjectsMock: vi.fn(),
  getHardSkillsMock: vi.fn(),
  getAllNodesMock: vi.fn(),
  extractProjectAssetsMock: vi.fn(),
  listR2ObjectKeysMock: vi.fn(),
  isR2StorageConfiguredMock: vi.fn(() => true),
  getMissingR2EnvKeysMock: vi.fn(() => [] as string[]),
}));

vi.mock('@/lib/auth', () => ({
  validateAdminRequest: validateAdminRequestMock,
}));

vi.mock('@/lib/services/aboutService', () => ({
  aboutService: { getAboutData: getAboutDataMock, updateAboutData: updateAboutDataMock },
}));

vi.mock('@/lib/services/projectService', () => ({
  projectService: { getProjects: getProjectsMock },
}));

vi.mock('@/lib/services/hardSkillService', () => ({
  hardSkillService: { getHardSkills: getHardSkillsMock },
}));

vi.mock('@/lib/services/explorerService', () => ({
  explorerService: { getAllNodes: getAllNodesMock },
}));

vi.mock('@/lib/services/project/projectStorage', () => ({
  extractProjectAssets: extractProjectAssetsMock,
}));

vi.mock('@/lib/urlResolver', () => ({
  extractStoragePath: vi.fn((url: string) => {
    if (url?.startsWith('/r2/')) return url.replace('/r2/', '');
    if (url?.startsWith('assets/')) return url;
    return null;
  }),
}));

vi.mock('@/lib/r2Storage', () => ({
  listR2ObjectKeys: listR2ObjectKeysMock,
  isR2StorageConfigured: isR2StorageConfiguredMock,
  getMissingR2EnvKeys: getMissingR2EnvKeysMock,
}));

import { GET } from './route';

function buildGetRequest(fresh = false): NextRequest {
  const url = fresh
    ? 'http://localhost/api/admin/storage-stats?fresh=true'
    : 'http://localhost/api/admin/storage-stats';
  return new NextRequest(url, { method: 'GET' });
}

describe('GET /api/admin/storage-stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateAdminRequestMock.mockResolvedValue(true);
    isR2StorageConfiguredMock.mockReturnValue(true);
    listR2ObjectKeysMock.mockResolvedValue([]);
    getAboutDataMock.mockResolvedValue(null);
    getProjectsMock.mockResolvedValue({ projects: [], lastUpdated: '' });
    getHardSkillsMock.mockResolvedValue({ skills: [], lastUpdated: '' });
    getAllNodesMock.mockResolvedValue([]);
    extractProjectAssetsMock.mockReturnValue([]);
  });

  it('rejects unauthenticated requests', async () => {
    validateAdminRequestMock.mockResolvedValue(false);
    const res = await GET(buildGetRequest());
    expect(res.status).toBe(401);
  });

  it('returns categories when all sources are empty', async () => {
    const res = await GET(buildGetRequest(true));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.categories).toBeInstanceOf(Array);
    expect(body.categories.length).toBeGreaterThanOrEqual(4);
    expect(body.warnings).toEqual([]);

    const wallpaperCat = body.categories.find((c: { id: string }) => c.id === 'wallpapers');
    expect(wallpaperCat).toBeDefined();
    expect(wallpaperCat.d1.total).toBe(0);
    expect(wallpaperCat.r2.total).toBe(0);
  });

  it('counts wallpaper refs from aboutData.wallpaperConfig.collection', async () => {
    getAboutDataMock.mockResolvedValue({
      wallpaperConfig: {
        activeWallpaperId: 'w1',
        collection: [
          {
            id: 'w1',
            url: '/r2/assets/wallpapers/w1.mp4',
            posterUrl: '/r2/assets/wallpapers/w1.jpg',
          },
          { id: 'w2', url: '/r2/assets/wallpapers/w2.png' },
        ],
      },
    });
    listR2ObjectKeysMock.mockResolvedValue([
      'assets/wallpapers/w1.mp4',
      'assets/wallpapers/w1.jpg',
      'assets/wallpapers/w2.png',
    ]);

    const res = await GET(buildGetRequest(true));
    expect(res.status).toBe(200);

    const body = await res.json();
    const cat = body.categories.find((c: { id: string }) => c.id === 'wallpapers');
    expect(cat.d1.total).toBe(3);
    expect(cat.d1.video).toBe(1);
    expect(cat.d1.image).toBe(2);
  });

  it('detects orphan and dangling refs', async () => {
    getAboutDataMock.mockResolvedValue({
      wallpaperConfig: {
        activeWallpaperId: 'w1',
        collection: [
          {
            id: 'w1',
            url: '/r2/assets/wallpapers/w1.mp4',
            posterUrl: '/r2/assets/wallpapers/w1.jpg',
          },
        ],
      },
    });
    listR2ObjectKeysMock.mockResolvedValue([
      'assets/wallpapers/w1.jpg',
      'assets/wallpapers/orphan.mp4',
    ]);

    const res = await GET(buildGetRequest(true));
    expect(res.status).toBe(200);

    const body = await res.json();
    const cat = body.categories.find((c: { id: string }) => c.id === 'wallpapers');
    expect(cat.orphans).toBe(1);
    expect(cat.dangling).toBe(1);
  });

  it('does not flag video side-cars as orphans', async () => {
    getAboutDataMock.mockResolvedValue({
      wallpaperConfig: {
        activeWallpaperId: 'w1',
        collection: [{ id: 'w1', url: '/r2/assets/wallpapers/w1.mp4' }],
      },
    });
    listR2ObjectKeysMock.mockResolvedValue([
      'assets/wallpapers/w1.mp4',
      'assets/wallpapers/w1-preview.mp4',
      'assets/wallpapers/w1.jpg',
    ]);

    const res = await GET(buildGetRequest(true));
    const body = await res.json();
    const cat = body.categories.find((c: { id: string }) => c.id === 'wallpapers');
    expect(cat.orphans).toBe(0);
    expect(cat.sidecarCount).toBe(2);
  });

  it('does not flag bundled or external icons as missing R2 objects', async () => {
    getAboutDataMock.mockResolvedValue({
      dockConfig: {
        notes: { iconUrl: '/assets/icons-library/notes.webp' },
        custom: { iconUrl: '/r2/assets/icons-library/missing.webp' },
      },
    });
    getHardSkillsMock.mockResolvedValue({
      skills: [{ iconUrl: 'https://cdn.simpleicons.org/figma' }],
      lastUpdated: '',
    });

    const res = await GET(buildGetRequest(true));
    const body = await res.json();
    const cat = body.categories.find((c: { id: string }) => c.id === 'hardSkillIcons');

    expect(cat.d1.total).toBe(3);
    expect(cat.r2.total).toBe(0);
    expect(cat.dangling).toBe(1);
    expect(cat.danglingPaths).toEqual(['assets/icons-library/missing.webp']);
  });

  it('returns fallback categories with empty r2 when R2 is not configured', async () => {
    isR2StorageConfiguredMock.mockReturnValue(false);
    getMissingR2EnvKeysMock.mockReturnValue(['CLOUDFLARE_R2_BUCKET']);
    getAboutDataMock.mockResolvedValue({
      wallpaperConfig: { activeWallpaperId: '', collection: [] },
      dockConfig: {},
    });

    const res = await GET(buildGetRequest(true));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.warnings.length).toBeGreaterThan(0);
    const cat = body.categories.find((c: { id: string }) => c.id === 'projects');
    expect(cat.r2.total).toBe(0);
    expect(cat.orphans).toBe(0);
  });

  it('surfaces service failures as warnings without 500', async () => {
    getAboutDataMock.mockRejectedValue(new Error('D1 timeout'));

    const res = await GET(buildGetRequest(true));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.warnings.length).toBeGreaterThan(0);
    expect(body.warnings.some((w: string) => w.includes('aboutService'))).toBe(true);
  });

  it('surfaces Explorer service failures as warnings without 500', async () => {
    getAllNodesMock.mockRejectedValue(new Error('Explorer timeout'));

    const res = await GET(buildGetRequest(true));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.warnings.length).toBeGreaterThan(0);
    expect(body.warnings.some((w: string) => w.includes('explorerService'))).toBe(true);
  });

  it('serves cached payload on repeated request within TTL', async () => {
    getAboutDataMock.mockResolvedValue({
      wallpaperConfig: { activeWallpaperId: '', collection: [] },
    });

    const res1 = await GET(buildGetRequest(true));
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.cached).toBe(false);

    const res2 = await GET(buildGetRequest());
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.cached).toBe(true);

    const res3 = await GET(buildGetRequest(true));
    const body3 = await res3.json();
    expect(body3.cached).toBe(false);
  });

  it('includes notes on every category', async () => {
    getAboutDataMock.mockResolvedValue({
      wallpaperConfig: { activeWallpaperId: '', collection: [] },
    });

    const res = await GET(buildGetRequest(true));
    const body = await res.json();

    for (const cat of body.categories) {
      expect(typeof cat.note).toBe('string');
    }
  });
});
