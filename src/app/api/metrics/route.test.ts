import { beforeEach, describe, expect, it, vi } from 'vitest';

const { refMock, enforceRequestRateLimitMock, getProjectBySlugSqlMock } = vi.hoisted(() => ({
  refMock: vi.fn(),
  enforceRequestRateLimitMock: vi.fn(),
  getProjectBySlugSqlMock: vi.fn(),
}));

vi.mock('@/lib/database', () => ({
  db: {
    ref: refMock,
  },
}));

vi.mock('@/lib/security/request', () => ({
  enforceRequestRateLimit: enforceRequestRateLimitMock,
}));

vi.mock('@/lib/services/project/projectSqlService', () => ({
  projectSqlService: {
    getProjectBySlugSql: getProjectBySlugSqlMock,
  },
}));

import { POST } from './route';

describe('POST /api/metrics', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('blocks abusive requests with a persistent rate limiter', async () => {
    enforceRequestRateLimitMock.mockResolvedValue({ allowed: false, retryAfter: 60 });

    const response = await POST(
      new Request('http://localhost/api/metrics', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: 'demo', action: 'like' }),
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toBe('Too many requests');
    expect(response.headers.get('Retry-After')).toBe('60');
  });

  it('applies atomic like mutations on top of fallback metrics', async () => {
    enforceRequestRateLimitMock.mockResolvedValue({ allowed: true, retryAfter: 0 });
    getProjectBySlugSqlMock.mockResolvedValue({ slug: 'demo', likes: 7, shares: 2 });

    refMock.mockImplementation((path: string) => {
      if (path === 'metrics/metrics/default-site/demo') {
        return {
          transaction: vi.fn(
            async (
              updater: (current: { likes: number; shares: number } | null) => {
                likes: number;
                shares: number;
              }
            ) => {
              updater(null);
            }
          ),
        };
      }

      throw new Error(`Unexpected CLOUDFLARE_D1 path: ${path}`);
    });

    const response = await POST(
      new Request('http://localhost/api/metrics', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: 'demo', action: 'like' }),
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      metrics: {
        likes: 8,
        shares: 2,
      },
    });
  });

  it('rejects unknown siteId namespaces (audit MEDIUM M3, 2026-10-06)', async () => {
    enforceRequestRateLimitMock.mockResolvedValue({ allowed: true, retryAfter: 0 });

    const response = await POST(
      new Request('http://localhost/api/metrics', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ siteId: 'tenant-a', slug: 'demo', action: 'like' }),
      }) as never
    );

    // SiteId asing ditolak sebelum membuat baris metrics baru (audit MEDIUM M3).
    expect(response.status).toBe(400);
    expect(refMock).not.toHaveBeenCalled();
    expect(getProjectBySlugSqlMock).not.toHaveBeenCalled();
  });
});
