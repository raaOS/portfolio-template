/**
 * Test heroVideoService (v1.3.49) — peta video hero di D1 dengan fallback
 * aman.
 *
 * Yang dijaga:
 * 1. `getHeroPreviewVideos()` TIDAK PERNAH melempar & jatuh ke `{}` saat
 *    data kosong/rusak/D1 mati (hero jatuh ke video default/gambar, halaman
 *    jualan tidak boleh gagal render).
 * 2. Slot tidak dikenal & URL tidak valid ditolak tanpa menyentuh D1.
 * 3. Hapus slot (`url` kosong) benar-benar mengeluarkan key dari peta.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/cloudflareD1', () => ({
  queryD1: vi.fn(),
}));

import { queryD1 } from '@/lib/cloudflareD1';
import {
  clearHeroVideosCache,
  getHeroPreviewPosters,
  getHeroPreviewVideos,
  HERO_VIDEO_SLOTS,
  isHeroVideoSlot,
  updateHeroPreviewVideo,
  validateHeroVideoUrl,
} from './heroVideoService';

const queryMock = vi.mocked(queryD1);

beforeEach(() => {
  vi.clearAllMocks();
  clearHeroVideosCache();
});

describe('validateHeroVideoUrl', () => {
  it('menerima URL http(s) absolut', () => {
    expect(validateHeroVideoUrl('https://example.com/a.mp4').valid).toBe(true);
    expect(validateHeroVideoUrl('https://example.com/a.mp4').value).toBe(
      'https://example.com/a.mp4'
    );
  });

  it('menerima string kosong/null sebagai hapus', () => {
    expect(validateHeroVideoUrl('')).toEqual({ valid: true, value: '' });
    expect(validateHeroVideoUrl(null)).toEqual({ valid: true, value: '' });
  });

  it('menolak protocol-relative, javascript:, dan teks biasa', () => {
    expect(validateHeroVideoUrl('//evil.com/x.mp4').valid).toBe(false);
    expect(validateHeroVideoUrl('javascript:alert(1)').valid).toBe(false);
    expect(validateHeroVideoUrl('bukan url').valid).toBe(false);
  });

  it('menolak URL > 500 karakter', () => {
    const long = 'https://example.com/' + 'a'.repeat(600);
    expect(validateHeroVideoUrl(long).valid).toBe(false);
  });
});

describe('isHeroVideoSlot', () => {
  it('hanya menerima slot resmi', () => {
    for (const slot of HERO_VIDEO_SLOTS) {
      expect(isHeroVideoSlot(slot)).toBe(true);
    }
    expect(isHeroVideoSlot('bogus')).toBe(false);
    expect(isHeroVideoSlot(undefined)).toBe(false);
  });
});

describe('getHeroPreviewVideos', () => {
  it('mengembalikan peta tersimpan', async () => {
    queryMock.mockResolvedValueOnce([
      {
        value: JSON.stringify({
          videos: { 'os-desktop': 'https://example.com/hero-os.mp4' },
        }),
      },
    ]);

    await expect(getHeroPreviewVideos()).resolves.toEqual({
      'os-desktop': 'https://example.com/hero-os.mp4',
    });
  });

  it('membaca key hero_preview_videos dari platform_settings', async () => {
    queryMock.mockResolvedValueOnce([]);
    await getHeroPreviewVideos();
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('platform_settings'),
      ['hero_preview_videos']
    );
  });

  it('menyaring slot tidak dikenal & URL invalid dari peta tersimpan', async () => {
    queryMock.mockResolvedValueOnce([
      {
        value: JSON.stringify({
          videos: {
            'os-desktop': 'https://example.com/ok.mp4',
            bogus: 'https://example.com/bogus.mp4',
            'infinite-canvas': 'javascript:alert(1)',
          },
        }),
      },
    ]);

    await expect(getHeroPreviewVideos()).resolves.toEqual({
      'os-desktop': 'https://example.com/ok.mp4',
    });
  });

  it('jatuh ke {} saat tabel kosong / JSON rusak / D1 mati (tanpa melempar)', async () => {
    queryMock.mockResolvedValueOnce([]);
    await expect(getHeroPreviewVideos()).resolves.toEqual({});

    clearHeroVideosCache();
    queryMock.mockResolvedValueOnce([{ value: '{rusak' }]);
    await expect(getHeroPreviewVideos()).resolves.toEqual({});

    clearHeroVideosCache();
    queryMock.mockRejectedValueOnce(new Error('d1 down'));
    await expect(getHeroPreviewVideos()).resolves.toEqual({});
  });

  it('meng-cache hasil baca 60 detik (query sekali untuk dua baca)', async () => {
    queryMock.mockResolvedValueOnce([
      { value: JSON.stringify({ videos: { 'os-desktop': 'https://e.com/a.mp4' } }) },
    ]);

    await getHeroPreviewVideos();
    await getHeroPreviewVideos();
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});

describe('updateHeroPreviewVideo', () => {
  it('menolak slot tidak dikenal tanpa menyentuh D1', async () => {
    const res = await updateHeroPreviewVideo('bogus', 'https://e.com/a.mp4');
    expect(res.success).toBe(false);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('menolak URL invalid tanpa menyentuh D1', async () => {
    const res = await updateHeroPreviewVideo('os-desktop', 'javascript:alert(1)');
    expect(res.success).toBe(false);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('upsert slot ke peta (merge dengan yang tersimpan)', async () => {
    // Baca awal (cache kosong) → peta tersimpan.
    queryMock.mockResolvedValueOnce([
      {
        value: JSON.stringify({
          videos: { 'infinite-canvas': 'https://e.com/ic.mp4' },
        }),
      },
    ]);
    // Tulis upsert.
    queryMock.mockResolvedValueOnce([]);

    const res = await updateHeroPreviewVideo('os-desktop', 'https://e.com/os.mp4');
    expect(res.success).toBe(true);

    const writeArgs = queryMock.mock.calls[1] as unknown as [string, unknown[]];
    expect(String(writeArgs[0])).toContain('INSERT INTO platform_settings');
    const stored = JSON.parse(String(writeArgs[1][1])) as {
      videos: Record<string, string>;
    };
    expect(stored.videos).toEqual({
      'os-desktop': 'https://e.com/os.mp4',
      'infinite-canvas': 'https://e.com/ic.mp4',
    });
  });

  it('menghapus slot saat url kosong', async () => {
    queryMock.mockResolvedValueOnce([
      {
        value: JSON.stringify({
          videos: {
            'os-desktop': 'https://e.com/os.mp4',
            'infinite-canvas': 'https://e.com/ic.mp4',
          },
        }),
      },
    ]);
    queryMock.mockResolvedValueOnce([]);

    const res = await updateHeroPreviewVideo('os-desktop', '');
    expect(res.success).toBe(true);

    const writeArgs = queryMock.mock.calls[1] as unknown as [string, unknown[]];
    const stored = JSON.parse(String(writeArgs[1][1])) as {
      videos: Record<string, string>;
    };
    expect(stored.videos).toEqual({ 'infinite-canvas': 'https://e.com/ic.mp4' });
  });

  it('menyematkan ?v=updatedAt jika updatedAt ada di platform_settings', async () => {
    queryMock.mockResolvedValueOnce([
      {
        value: JSON.stringify({
          videos: { 'os-desktop': 'https://example.com/hero-os.mp4' },
          updatedAt: '2026-10-21T08:00:00.000Z',
        }),
      },
    ]);

    await expect(getHeroPreviewVideos()).resolves.toEqual({
      'os-desktop': 'https://example.com/hero-os.mp4?v=2026-10-21T08%3A00%3A00.000Z',
    });
  });

  it('membersihkan parameter ?v= saat menyimpan slot', async () => {
    queryMock.mockResolvedValueOnce([
      {
        value: JSON.stringify({
          videos: { 'os-desktop': 'https://e.com/os.mp4' },
          updatedAt: '2026-10-21T08:00:00.000Z',
        }),
      },
    ]);
    queryMock.mockResolvedValueOnce([]);

    await updateHeroPreviewVideo(
      'os-desktop',
      'https://e.com/os.mp4?v=old-version'
    );

    const writeArgs = queryMock.mock.calls[1] as unknown as [string, unknown[]];
    const stored = JSON.parse(String(writeArgs[1][1])) as {
      videos: Record<string, string>;
    };
    expect(stored.videos['os-desktop']).toBe('https://e.com/os.mp4');
  });

  it('mengembalikan error (tanpa melempar) saat D1 gagal menulis', async () => {
    queryMock.mockResolvedValueOnce([]);
    queryMock.mockRejectedValueOnce(new Error('d1 down'));

    const res = await updateHeroPreviewVideo('os-desktop', 'https://e.com/a.mp4');
    expect(res.success).toBe(false);
    expect(res.error).toBe('d1 down');
  });
});

describe('auto-poster (v1.3.57)', () => {
  it('getHeroPreviewPosters mengembalikan peta poster (+ ?v= anti-cache)', async () => {
    queryMock.mockResolvedValueOnce([
      {
        value: JSON.stringify({
          videos: { 'os-desktop': 'https://e.com/os.mp4' },
          posters: { 'os-desktop': 'https://e.com/os-poster.jpg' },
          updatedAt: '2026-10-21T09:00:00.000Z',
        }),
      },
    ]);

    await expect(getHeroPreviewPosters()).resolves.toEqual({
      'os-desktop':
        'https://e.com/os-poster.jpg?v=2026-10-21T09%3A00%3A00.000Z',
    });
    // Video tetap terbaca normal lewat getter yang sama (satu query).
    await expect(getHeroPreviewVideos()).resolves.toEqual({
      'os-desktop': 'https://e.com/os.mp4?v=2026-10-21T09%3A00%3A00.000Z',
    });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('jatuh ke {} (tanpa melempar) saat JSON rusak / D1 mati', async () => {
    queryMock.mockResolvedValueOnce([{ value: '{rusak' }]);
    await expect(getHeroPreviewPosters()).resolves.toEqual({});

    clearHeroVideosCache();
    queryMock.mockRejectedValueOnce(new Error('d1 down'));
    await expect(getHeroPreviewPosters()).resolves.toEqual({});
  });

  it('menyimpan posterUrl bersama video pada slot yang sama', async () => {
    queryMock.mockResolvedValueOnce([
      { value: JSON.stringify({ videos: {}, posters: {} }) },
    ]);
    queryMock.mockResolvedValueOnce([]);

    const res = await updateHeroPreviewVideo(
      'os-desktop',
      'https://e.com/os.mp4',
      'https://e.com/os-poster.jpg'
    );
    expect(res.success).toBe(true);

    const writeArgs = queryMock.mock.calls[1] as unknown as [string, unknown[]];
    const stored = JSON.parse(String(writeArgs[1][1])) as {
      videos: Record<string, string>;
      posters: Record<string, string>;
    };
    expect(stored.videos['os-desktop']).toBe('https://e.com/os.mp4');
    expect(stored.posters['os-desktop']).toBe('https://e.com/os-poster.jpg');
  });

  it('tanpa posterUrl (undefined) mempertahankan poster tersimpan', async () => {
    queryMock.mockResolvedValueOnce([
      {
        value: JSON.stringify({
          videos: { 'os-desktop': 'https://e.com/os.mp4' },
          posters: { 'os-desktop': 'https://e.com/old-poster.jpg' },
        }),
      },
    ]);
    queryMock.mockResolvedValueOnce([]);

    const res = await updateHeroPreviewVideo(
      'os-desktop',
      'https://e.com/os-baru.mp4'
    );
    expect(res.success).toBe(true);

    const writeArgs = queryMock.mock.calls[1] as unknown as [string, unknown[]];
    const stored = JSON.parse(String(writeArgs[1][1])) as {
      posters: Record<string, string>;
    };
    expect(stored.posters['os-desktop']).toBe('https://e.com/old-poster.jpg');
  });

  it('menghapus video slot ikut menghapus poster slot itu (slot lain utuh)', async () => {
    queryMock.mockResolvedValueOnce([
      {
        value: JSON.stringify({
          videos: {
            'os-desktop': 'https://e.com/os.mp4',
            'infinite-canvas': 'https://e.com/ic.mp4',
          },
          posters: {
            'os-desktop': 'https://e.com/os-poster.jpg',
            'infinite-canvas': 'https://e.com/ic-poster.jpg',
          },
        }),
      },
    ]);
    queryMock.mockResolvedValueOnce([]);

    const res = await updateHeroPreviewVideo('os-desktop', '');
    expect(res.success).toBe(true);

    const writeArgs = queryMock.mock.calls[1] as unknown as [string, unknown[]];
    const stored = JSON.parse(String(writeArgs[1][1])) as {
      videos: Record<string, string>;
      posters: Record<string, string>;
    };
    expect(stored.videos).toEqual({ 'infinite-canvas': 'https://e.com/ic.mp4' });
    expect(stored.posters).toEqual({
      'infinite-canvas': 'https://e.com/ic-poster.jpg',
    });
  });

  it('menolak posterUrl invalid tanpa menyentuh D1', async () => {
    const res = await updateHeroPreviewVideo(
      'os-desktop',
      'https://e.com/os.mp4',
      'javascript:alert(1)'
    );
    expect(res.success).toBe(false);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('posterUrl kosong = hapus poster tanpa menghapus video', async () => {
    queryMock.mockResolvedValueOnce([
      {
        value: JSON.stringify({
          videos: { 'os-desktop': 'https://e.com/os.mp4' },
          posters: { 'os-desktop': 'https://e.com/os-poster.jpg' },
        }),
      },
    ]);
    queryMock.mockResolvedValueOnce([]);

    const res = await updateHeroPreviewVideo('os-desktop', 'https://e.com/os.mp4', '');
    expect(res.success).toBe(true);

    const writeArgs = queryMock.mock.calls[1] as unknown as [string, unknown[]];
    const stored = JSON.parse(String(writeArgs[1][1])) as {
      videos: Record<string, string>;
      posters: Record<string, string>;
    };
    expect(stored.videos['os-desktop']).toBe('https://e.com/os.mp4');
    expect(stored.posters).toEqual({});
  });
});

