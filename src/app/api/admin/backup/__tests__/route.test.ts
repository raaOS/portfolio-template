import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ────────────────────────────────────────────────────────────
//
// Route bergantung pada:
//   - validateAdminRequest (auth + csrf)
//   - d1BackupService      (list/create backup)
//   - cloudflareD1         (isD1Configured)
//   - r2Storage            (isR2StorageConfigured + getR2Object)
//
// Semua di-mock supaya test hanya menguji branching tanpa menyentuh
// jaringan, D1, maupun R2.

vi.mock('@/lib/auth', () => ({
  validateAdminRequest: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/cloudflareD1', () => ({
  isD1Configured: vi.fn(() => true),
  queryD1: vi.fn(async () => []),
}));

const isR2StorageConfigured = vi.fn(() => true);
const getR2Object = vi.fn();

vi.mock('@/lib/r2Storage', () => ({
  isR2StorageConfigured: () => isR2StorageConfigured(),
  getR2Object: (...args: unknown[]) => getR2Object(...args),
  uploadToR2: vi.fn(),
  listR2Objects: vi.fn(async () => []),
  deleteFromR2: vi.fn(),
}));

const listD1Backups = vi.fn();
const createD1Backup = vi.fn();

vi.mock('@/lib/services/d1BackupService', () => ({
  BACKUP_KEEP_COUNT: 7,
  listD1Backups: (...args: unknown[]) => listD1Backups(...args),
  createD1Backup: (...args: unknown[]) => createD1Backup(...args),
  runDailyBackup: vi.fn(async () => ({ ran: true })),
  pickBackupKeysToDelete: vi.fn(() => []),
}));

import { GET, POST } from '../route';
import { GET as DOWNLOAD } from '../download/route';
import { validateAdminRequest } from '@/lib/auth';
import { SITE_ID } from '@/crud/shared/config';

const VALID_KEY = `sites/${SITE_ID}/backups/d1/2026-10-05T01-00-00-000Z.json`;

function buildRequest(url: string, method: 'GET' | 'POST'): NextRequest {
  return new NextRequest(url, method === 'POST' ? { method, body: '{}' } : { method });
}

function authMock() {
  return validateAdminRequest as ReturnType<typeof vi.fn>;
}

describe('GET /api/admin/backup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock().mockResolvedValue(true);
    listD1Backups.mockResolvedValue([{ key: VALID_KEY, size: 1024 }]);
  });

  it('rejects unauthenticated requests', async () => {
    authMock().mockResolvedValue(false);
    const res = await GET(buildRequest('http://localhost/api/admin/backup', 'GET'));
    expect(res.status).toBe(401);
    expect(listD1Backups).not.toHaveBeenCalled();
  });

  it('lists backups with the retention count and env flags', async () => {
    const res = await GET(buildRequest('http://localhost/api/admin/backup', 'GET'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.backups).toHaveLength(1);
    expect(body.backups[0].key).toBe(VALID_KEY);
    expect(body.keepCount).toBe(7);
    expect(body.d1Configured).toBe(true);
    expect(body.r2Configured).toBe(true);
  });
});

describe('POST /api/admin/backup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock().mockResolvedValue(true);
    createD1Backup.mockResolvedValue({
      key: VALID_KEY,
      size: 2048,
      totalRows: 12,
      tableCount: 3,
    });
  });

  it('rejects unauthenticated requests', async () => {
    authMock().mockResolvedValue(false);
    const res = await POST(buildRequest('http://localhost/api/admin/backup', 'POST'));
    expect(res.status).toBe(401);
    expect(createD1Backup).not.toHaveBeenCalled();
  });

  it('creates a backup and returns its key', async () => {
    const res = await POST(buildRequest('http://localhost/api/admin/backup', 'POST'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.key).toBe(VALID_KEY);
    expect(body.tableCount).toBe(3);
    expect(createD1Backup).toHaveBeenCalledTimes(1);
  });

  it('returns 500 when the backup blows up', async () => {
    createD1Backup.mockRejectedValueOnce(new Error('d1 down'));
    const res = await POST(buildRequest('http://localhost/api/admin/backup', 'POST'));
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error).toBe('d1 down');
  });
});

describe('GET /api/admin/backup/download', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock().mockResolvedValue(true);
    getR2Object.mockResolvedValue({ Body: '{"kind":"portfolio-os-d1-backup"}' });
  });

  it('rejects unauthenticated requests', async () => {
    authMock().mockResolvedValue(false);
    const res = await DOWNLOAD(
      buildRequest(
        `http://localhost/api/admin/backup/download?key=${encodeURIComponent(VALID_KEY)}`,
        'GET'
      )
    );
    expect(res.status).toBe(401);
    expect(getR2Object).not.toHaveBeenCalled();
  });

  it('rejects a missing key', async () => {
    const res = await DOWNLOAD(buildRequest('http://localhost/api/admin/backup/download', 'GET'));
    expect(res.status).toBe(400);
  });

  it('rejects path traversal in the key', async () => {
    const res = await DOWNLOAD(
      buildRequest(
        'http://localhost/api/admin/backup/download?key=' + encodeURIComponent('../../etc/passwd'),
        'GET'
      )
    );
    expect(res.status).toBe(400);
    expect(getR2Object).not.toHaveBeenCalled();
  });

  it('rejects a key outside the backup prefix', async () => {
    const res = await DOWNLOAD(
      buildRequest(
        'http://localhost/api/admin/backup/download?key=' +
          encodeURIComponent('sites/other/backups/d1/x.json'),
        'GET'
      )
    );
    expect(res.status).toBe(400);
    expect(getR2Object).not.toHaveBeenCalled();
  });

  it('rejects a key that is not a .json backup file', async () => {
    const res = await DOWNLOAD(
      buildRequest(
        `http://localhost/api/admin/backup/download?key=${encodeURIComponent(
          `sites/${SITE_ID}/backups/d1/evil.txt`
        )}`,
        'GET'
      )
    );
    expect(res.status).toBe(400);
    expect(getR2Object).not.toHaveBeenCalled();
  });

  it('streams the backup as an attachment for a valid key', async () => {
    const res = await DOWNLOAD(
      buildRequest(
        `http://localhost/api/admin/backup/download?key=${encodeURIComponent(VALID_KEY)}`,
        'GET'
      )
    );

    expect(res.status).toBe(200);
    expect(getR2Object).toHaveBeenCalledWith(VALID_KEY);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="2026-10-05T01-00-00-000Z.json"'
    );
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ kind: 'portfolio-os-d1-backup' });
  });

  it('returns 404 when the object is missing in R2', async () => {
    const missing = new Error('NotFound') as Error & {
      name: string;
      $metadata: { httpStatusCode: number };
    };
    missing.name = 'NotFound';
    missing.$metadata = { httpStatusCode: 404 };
    getR2Object.mockRejectedValueOnce(missing);

    const res = await DOWNLOAD(
      buildRequest(
        `http://localhost/api/admin/backup/download?key=${encodeURIComponent(VALID_KEY)}`,
        'GET'
      )
    );
    expect(res.status).toBe(404);
  });
});
