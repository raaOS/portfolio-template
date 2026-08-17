import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  validateAdminRequestMock,
  aboutServiceUpdateMock,
  invalidateAboutCacheMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  validateAdminRequestMock: vi.fn(),
  aboutServiceUpdateMock: vi.fn(),
  invalidateAboutCacheMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  validateAdminRequest: validateAdminRequestMock,
}));

vi.mock('@/lib/services/aboutService', () => ({
  aboutService: { updateAboutData: aboutServiceUpdateMock },
}));

vi.mock('@/lib/about', () => ({
  invalidateAboutCache: invalidateAboutCacheMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
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
    validateAdminRequestMock.mockResolvedValue(true);
    aboutServiceUpdateMock.mockResolvedValue(undefined);
  });

  it('rejects unauthenticated requests', async () => {
    validateAdminRequestMock.mockResolvedValue(false);
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
    expect(revalidatePathMock).toHaveBeenCalledWith('/', 'layout');
    expect(revalidatePathMock).toHaveBeenCalledWith('/about');
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
