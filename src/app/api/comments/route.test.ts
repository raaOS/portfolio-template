import { beforeEach, describe, expect, it, vi } from 'vitest';

const { refMock, enforceRequestRateLimitMock } = vi.hoisted(() => ({
  refMock: vi.fn(),
  enforceRequestRateLimitMock: vi.fn(),
}));

vi.mock('@/lib/database', () => ({
  db: {
    ref: refMock,
  },
}));

// Limit IP dipatok lolos di file ini: kuota aslinya (5/menit per IP) sengaja diuji
// lewat kasus terpisah, bukan lewat jumlah test dalam berkas ini.
vi.mock('@/lib/security/request', () => ({
  enforceRequestRateLimit: enforceRequestRateLimitMock,
}));

import { POST } from './route';
import { invalidateBannedWordsCache } from '@/lib/services/bannedWordsService';

type StoredComment = {
  id: string;
  text: string;
  name: string;
  createdAt: string;
  time?: string;
  author?: string;
};

describe('POST /api/comments', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    enforceRequestRateLimitMock.mockResolvedValue({ allowed: true, retryAfter: 0 });
    invalidateBannedWordsCache();
  });

  it('appends a single sanitized comment instead of accepting a client-side overwrite array', async () => {
    const existingComments: StoredComment[] = [
      {
        id: 'existing',
        text: 'Existing comment',
        name: 'Alice',
        createdAt: '2026-03-30T10:00:00.000Z',
        time: '2026-03-30T10:00:00.000Z',
      },
    ];

    let storedComments: StoredComment[] | undefined;

    refMock.mockImplementation((path: string) => {
      if (path === 'settings/bannedWords') {
        return {
          once: vi.fn().mockResolvedValue({
            exists: () => true,
            val: () => [],
          }),
        };
      }

      if (path === 'comments/default-site/demo-project') {
        return {
          transaction: vi.fn(
            async (updater: (current: StoredComment[] | null) => StoredComment[] | void) => {
              const next = updater(existingComments);
              storedComments = next as StoredComment[] | undefined;
              return { committed: Boolean(next) };
            }
          ),
        };
      }

      throw new Error(`Unexpected CLOUDFLARE_D1 path: ${path}`);
    });

    const response = await POST(
      new Request('http://localhost/api/comments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug: 'demo-project',
          comments: [
            { id: 'new-comment', text: 'Hello <b>team</b>', name: '<Admin>' },
            { id: 'tampered', text: 'overwrite', name: 'Mallory' },
          ],
        }),
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.comment.id).toBe('new-comment');
    expect(body.data.comment.name).toBe('&lt;Admin&gt;');
    expect(storedComments).toHaveLength(2);
    expect(storedComments?.[0].id).toBe('new-comment');
    expect(storedComments?.[1]).toEqual(existingComments[0]);
    expect(storedComments?.some((comment) => comment.id === 'tampered')).toBe(false);
  });

  it('rejects comments containing banned words', async () => {
    refMock.mockImplementation((path: string) => {
      if (path === 'settings/bannedWords') {
        return {
          once: vi.fn().mockResolvedValue({
            exists: () => true,
            val: () => ['gacor', 'slot'],
          }),
        };
      }
      throw new Error(`Unexpected CLOUDFLARE_D1 path: ${path}`);
    });

    const response = await POST(
      new Request('http://localhost/api/comments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug: 'demo-project',
          comment: { id: 'bad-comment', text: 'Info gacor bosku', name: 'Bob' },
        }),
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Comment contains restricted word: gacor');
  });

  it('rejects obfuscated banned words', async () => {
    refMock.mockImplementation((path: string) => {
      if (path === 'settings/bannedWords') {
        return {
          once: vi.fn().mockResolvedValue({
            exists: () => true,
            val: () => ['slot'],
          }),
        };
      }
      throw new Error(`Unexpected CLOUDFLARE_D1 path: ${path}`);
    });

    const response = await POST(
      new Request('http://localhost/api/comments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug: 'demo-project',
          comment: { id: 'bad-comment', text: 'promo s.l.0.t cepat', name: 'Bob' },
        }),
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Comment contains restricted word: slot');
  });

  it('rate-limits rapid repeat comments from the same author', async () => {
    const existingComments: StoredComment[] = [
      {
        id: 'existing',
        text: 'Latest comment',
        name: 'Alice',
        createdAt: new Date().toISOString(),
        time: new Date().toISOString(),
      },
    ];

    refMock.mockImplementation((path: string) => {
      if (path === 'settings/bannedWords') {
        return {
          once: vi.fn().mockResolvedValue({
            exists: () => true,
            val: () => [],
          }),
        };
      }

      if (path === 'comments/default-site/demo-project') {
        return {
          transaction: vi.fn(
            async (updater: (current: StoredComment[] | null) => StoredComment[] | void) => {
              const next = updater(existingComments);
              return { committed: Boolean(next) };
            }
          ),
        };
      }

      throw new Error(`Unexpected CLOUDFLARE_D1 path: ${path}`);
    });

    const response = await POST(
      new Request('http://localhost/api/comments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug: 'demo-project',
          comment: { id: 'new-comment', text: 'Another comment', name: 'Alice' },
        }),
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toBe('Please wait 5 seconds before posting again');
  });

  it('rejects unknown siteId namespaces (audit MEDIUM M3, 2026-10-06)', async () => {
    const response = await POST(
      new Request('http://localhost/api/comments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          siteId: 'tenant-a',
          slug: 'demo-project',
          comment: { id: 'tenant-comment', text: 'Tenant-only', name: 'Alice' },
        }),
      }) as never
    );

    // Deployment ini hanya melayani SATU site: siteId asing ditolak sebelum
    // menyentuh database (dulu diterima begitu saja → baris D1 tak terbatas).
    expect(response.status).toBe(400);
    expect(refMock).not.toHaveBeenCalled();
  });

  it('accepts the official site and the legacy default-site bucket', async () => {
    const transaction = vi.fn(async (updater: (current: StoredComment[] | null) => StoredComment[]) => {
      updater(null);
      return { committed: true };
    });
    refMock.mockImplementation((path: string) => {
      if (path === 'settings/bannedWords') {
        return { once: vi.fn().mockResolvedValue({ exists: () => true, val: () => [] }) };
      }
      if (path === 'comments/default-site/demo-project') return { transaction };
      throw new Error(`Unexpected CLOUDFLARE_D1 path: ${path}`);
    });

    const response = await POST(
      new Request('http://localhost/api/comments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          siteId: 'default-site',
          slug: 'demo-project',
          comment: { id: 'default-comment', text: 'Hello', name: 'Alice' },
        }),
      }) as never
    );

    expect(response.status).toBe(200);
    expect(refMock).toHaveBeenCalledWith('comments/default-site/demo-project');
  });
});
