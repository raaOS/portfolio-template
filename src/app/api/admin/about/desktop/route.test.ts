import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  validateSiteMutationRequestMock,
  aboutServiceUpdateMock,
  invalidateAboutCacheMock,
  resolveRequestSiteIdMock,
  revalidateSiteContentPathsMock,
} = vi.hoisted(() => ({
  validateSiteMutationRequestMock: vi.fn(),
  aboutServiceUpdateMock: vi.fn(),
  invalidateAboutCacheMock: vi.fn(),
  resolveRequestSiteIdMock: vi.fn(),
  revalidateSiteContentPathsMock: vi.fn(),
}));

vi.mock('@/lib/admin/siteMutationAuth', () => ({
  validateSiteMutationRequest: validateSiteMutationRequestMock,
}));

vi.mock('@/lib/admin/siteRequestContext', () => ({
  resolveRequestSiteId: resolveRequestSiteIdMock,
  assertKnownSite: vi.fn().mockResolvedValue({ id: 'default-site', slug: null }),
  revalidateSiteContentPaths: revalidateSiteContentPathsMock,
  SiteContextError: class SiteContextError extends Error {
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock('@/lib/services/aboutService', () => ({
  aboutService: { updateAboutData: aboutServiceUpdateMock },
}));

vi.mock('@/lib/about', () => ({
  invalidateAboutCache: invalidateAboutCacheMock,
}));

import { POST } from './route';

function buildPostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/about/desktop', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/about/desktop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveRequestSiteIdMock.mockResolvedValue('default-site');
    validateSiteMutationRequestMock.mockResolvedValue({ role: 'admin' });
    aboutServiceUpdateMock.mockResolvedValue(undefined);
  });

  it('rejects unauthenticated requests', async () => {
    validateSiteMutationRequestMock.mockResolvedValue(null);
    const res = await POST(
      buildPostRequest({
        desktopPreferences: { iconSize: 64 },
      })
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when desktopPreferences is missing', async () => {
    const res = await POST(buildPostRequest({ otherField: true }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('desktopPreferences is required');
  });

  it('updates aboutService, invalidates cache, and revalidates paths on success', async () => {
    const prefs = { iconSize: 64, theme: 'dark' };
    const res = await POST(buildPostRequest({ desktopPreferences: prefs }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toBe('Desktop preferences saved');

    expect(aboutServiceUpdateMock).toHaveBeenCalledWith(
      { desktopPreferences: prefs },
      'default-site'
    );
    expect(invalidateAboutCacheMock).toHaveBeenCalled();
    expect(revalidateSiteContentPathsMock).toHaveBeenCalledWith('default-site', ['/', '/about']);
  });

  it('handles aboutService failure with 500', async () => {
    aboutServiceUpdateMock.mockRejectedValue(new Error('D1 write failed'));

    const res = await POST(
      buildPostRequest({
        desktopPreferences: { iconSize: 64 },
      })
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to save desktop preferences');
  });

  it('passes empty desktopPreferences values', async () => {
    const res = await POST(buildPostRequest({ desktopPreferences: {} }));
    expect(res.status).toBe(200);
    expect(aboutServiceUpdateMock).toHaveBeenCalledWith(
      { desktopPreferences: {} },
      'default-site'
    );
  });
});
