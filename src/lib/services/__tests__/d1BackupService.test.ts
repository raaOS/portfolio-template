import { describe, it, expect, vi } from 'vitest';

// Mock dependency berat supaya import modul tidak memicu side-effect
// (fetch D1 / binding R2) saat test hanya menyentuh fungsi murni.
vi.mock('@/lib/cloudflareD1', () => ({
  isD1Configured: vi.fn(() => false),
  queryD1: vi.fn(async () => []),
}));

vi.mock('@/lib/r2Storage', () => ({
  isR2StorageConfigured: vi.fn(() => false),
  uploadToR2: vi.fn(),
  listR2Objects: vi.fn(async () => []),
  deleteFromR2: vi.fn(),
}));

import { pickBackupKeysToDelete } from '../d1BackupService';

const KEY_PREFIX = 'sites/default-site/backups/d1/';
const key = (stamp: string) => `${KEY_PREFIX}${stamp}.json`;

describe('pickBackupKeysToDelete', () => {
  it('deletes the 3 oldest keys when 10 keys are kept down to 7', () => {
    // Key berbentuk ISO → leksikografis = kronologis.
    const keys = [
      key('2026-10-01T01-00-00-000Z'),
      key('2026-10-02T01-00-00-000Z'),
      key('2026-10-03T01-00-00-000Z'),
      key('2026-10-04T01-00-00-000Z'),
      key('2026-10-05T01-00-00-000Z'),
      key('2026-10-06T01-00-00-000Z'),
      key('2026-10-07T01-00-00-000Z'),
      key('2026-10-08T01-00-00-000Z'),
      key('2026-10-09T01-00-00-000Z'),
      key('2026-10-10T01-00-00-000Z'),
    ];

    const toDelete = pickBackupKeysToDelete(keys, 7);

    // Urutan hasil = urutan sort desc (terbaru dulu), jadi 3 terlama keluar
    // sebagai [03, 02, 01].
    expect(toDelete).toHaveLength(3);
    expect(toDelete).toEqual([
      key('2026-10-03T01-00-00-000Z'),
      key('2026-10-02T01-00-00-000Z'),
      key('2026-10-01T01-00-00-000Z'),
    ]);
    expect(keys).toHaveLength(10); // input tidak dimutasi
  });

  it('deletes nothing when there are fewer keys than the keep count', () => {
    const keys = [
      key('2026-10-08T01-00-00-000Z'),
      key('2026-10-09T01-00-00-000Z'),
      key('2026-10-10T01-00-00-000Z'),
    ];

    expect(pickBackupKeysToDelete(keys, 7)).toEqual([]);
  });

  it('picks the oldest keys correctly from unsorted input', () => {
    const keys = [
      key('2026-10-03T01-00-00-000Z'),
      key('2026-10-10T01-00-00-000Z'),
      key('2026-10-01T01-00-00-000Z'),
      key('2026-10-07T01-00-00-000Z'),
      key('2026-10-05T01-00-00-000Z'),
    ];

    const toDelete = pickBackupKeysToDelete(keys, 3);

    // 5 key, keep 3 → 2 terlama yang dibuang, tetap terurut desc.
    expect(toDelete).toEqual([key('2026-10-03T01-00-00-000Z'), key('2026-10-01T01-00-00-000Z')]);
    expect(keys[0]).toBe(key('2026-10-03T01-00-00-000Z'));
  });

  it('handles an empty list and a zero keep count', () => {
    expect(pickBackupKeysToDelete([], 7)).toEqual([]);
    expect(pickBackupKeysToDelete([key('2026-10-10T01-00-00-000Z')], 0)).toEqual([
      key('2026-10-10T01-00-00-000Z'),
    ]);
  });
});
