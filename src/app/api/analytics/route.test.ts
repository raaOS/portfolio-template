import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryD1Mock, isD1ConfiguredMock, enforceRequestRateLimitMock, validateAdminRequestMock } =
  vi.hoisted(() => ({
    queryD1Mock: vi.fn(),
    isD1ConfiguredMock: vi.fn(),
    enforceRequestRateLimitMock: vi.fn(),
    validateAdminRequestMock: vi.fn(),
  }));

vi.mock('@/lib/cloudflareD1', () => ({
  queryD1: queryD1Mock,
  isD1Configured: isD1ConfiguredMock,
}));

vi.mock('@/lib/security/request', () => ({
  enforceRequestRateLimit: enforceRequestRateLimitMock,
}));

vi.mock('@/lib/auth', () => ({
  validateAdminRequest: validateAdminRequestMock,
}));

import { GET, POST } from './route';

function postRequest(body: unknown) {
  return new Request('http://localhost/api/analytics', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as never;
}

describe('POST /api/analytics', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    enforceRequestRateLimitMock.mockResolvedValue({ allowed: true, retryAfter: 0 });
    isD1ConfiguredMock.mockReturnValue(true);
    queryD1Mock.mockResolvedValue([]);
  });

  it('rejects abusive analytics writes with rate limiting', async () => {
    enforceRequestRateLimitMock.mockResolvedValue({ allowed: false, retryAfter: 30 });

    const response = await POST(postRequest({ event: 'page_view' }));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({ success: false, error: 'Too many requests' });
    expect(response.headers.get('Retry-After')).toBe('30');
  });

  it('validates analytics payloads before writing to D1', async () => {
    const response = await POST(postRequest({ event: '' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ success: false, error: 'Invalid analytics payload' });
    expect(queryD1Mock).not.toHaveBeenCalled();
  });

  it('rejects events outside the closed allowlist', async () => {
    const response = await POST(postRequest({ event: 'made_up_event', details: { path: '/' } }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ success: false, error: 'Unsupported analytics event' });
    expect(queryD1Mock).not.toHaveBeenCalled();
  });

  it('records a page view against the bucketed first path segment', async () => {
    const response = await POST(postRequest({ event: 'page_view', details: { path: '/projects/abc' } }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });

    const [sql, params] = queryD1Mock.mock.calls[0];
    expect(sql).toContain('INSERT INTO site_analytics');
    expect(sql).toContain('hit_count = hit_count + 1');
    expect(params[1]).toBe('page_view');
    expect(params[2]).toBe('/projects');
  });

  it('buckets unknown paths so a public payload cannot create unbounded rows', async () => {
    await POST(postRequest({ event: 'page_view', details: { path: '/totally-new-segment' } }));

    expect(queryD1Mock.mock.calls[0][1][2]).toBe('/lain');
  });

  it('stores non-page events under a single fixed slug', async () => {
    await POST(postRequest({ event: 'CV_PRINT', details: { path: '/cv' } }));

    expect(queryD1Mock.mock.calls[0][1][2]).toBe('main');
  });
});

describe('GET /api/analytics', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    isD1ConfiguredMock.mockReturnValue(true);
  });

  it('rejects anonymous reads', async () => {
    validateAdminRequestMock.mockResolvedValue(false);

    const response = await GET(new Request('http://localhost/api/analytics') as never);

    expect(response.status).toBe(401);
    expect(queryD1Mock).not.toHaveBeenCalled();
  });

  it('returns the aggregated summary for admins', async () => {
    validateAdminRequestMock.mockResolvedValue(true);
    queryD1Mock.mockResolvedValue([
      { event_type: 'page_view', target_slug: '/', hit_count: 10, last_active: '2026-01-01' },
      { event_type: 'page_view', target_slug: '/projects', hit_count: 5, last_active: '2026-01-02' },
      { event_type: 'CV_PRINT', target_slug: 'main', hit_count: 2, last_active: '2026-01-03' },
    ]);

    const response = await GET(new Request('http://localhost/api/analytics') as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.summary.totalViews).toBe(15);
    expect(body.summary.topPages).toEqual([
      { path: '/', views: 10 },
      { path: '/projects', views: 5 },
    ]);
    expect(body.summary.otherEvents).toEqual([{ event: 'CV_PRINT', count: 2 }]);
    expect(body.summary.lastActive).toBe('2026-01-03');
  });
});
