import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  validateSiteMutationRequestMock,
  updateFeaturedDataMock,
  enforceRequestRateLimitMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  validateSiteMutationRequestMock: vi.fn(),
  updateFeaturedDataMock: vi.fn(),
  enforceRequestRateLimitMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock('@/lib/admin/siteMutationAuth', () => ({
  validateSiteMutationRequest: validateSiteMutationRequestMock,
}));

vi.mock('@/lib/services/galleryFeaturedService', () => ({
  galleryFeaturedService: {
    getFeaturedData: vi.fn(),
    updateFeaturedData: updateFeaturedDataMock,
  },
}));

vi.mock('@/lib/security/request', () => ({
  enforceRequestRateLimit: enforceRequestRateLimitMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

import { POST } from './route';

function buildPost(body: unknown): Request {
  return new Request('http://localhost/api/gallery/featured', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/gallery/featured', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    validateSiteMutationRequestMock.mockResolvedValue({ role: 'admin' });
    enforceRequestRateLimitMock.mockResolvedValue({ allowed: true, retryAfter: 0 });
    updateFeaturedDataMock.mockResolvedValue({
      featuredProjectIds: ['a', 'b'],
      lastUpdated: '2025-01-01T00:00:00Z',
    });
  });

  it('rejects unauthenticated', async () => {
    validateSiteMutationRequestMock.mockResolvedValue(null);
    const response = await POST(buildPost({ featuredProjectIds: ['a'] }) as never);
    expect(response.status).toBe(401);
  });

  it('enforces rate limit (10 req/min)', async () => {
    enforceRequestRateLimitMock.mockResolvedValue({ allowed: false, retryAfter: 60 });
    const response = await POST(buildPost({ featuredProjectIds: ['a'] }) as never);
    expect(response.status).toBe(429);
  });

  it('rejects payload tanpa featuredProjectIds', async () => {
    const response = await POST(buildPost({}) as never);
    expect(response.status).toBe(400);
  });

  it('rejects empty string id', async () => {
    const response = await POST(buildPost({ featuredProjectIds: ['', 'valid'] }) as never);
    expect(response.status).toBe(400);
  });

  it('rejects > 100 items', async () => {
    const huge = { featuredProjectIds: Array.from({ length: 101 }, (_, i) => `id-${i}`) };
    const response = await POST(buildPost(huge) as never);
    expect(response.status).toBe(400);
  });

  it('de-duplicates IDs sebelum save', async () => {
    const response = await POST(
      buildPost({ featuredProjectIds: ['a', 'b', 'a', 'c', 'b'] }) as never
    );
    expect(response.status).toBe(200);
    expect(updateFeaturedDataMock).toHaveBeenCalledWith(['a', 'b', 'c'], 'default-site');
  });

  it('triggers revalidatePath on success', async () => {
    await POST(buildPost({ featuredProjectIds: ['a'] }) as never);
    expect(revalidatePathMock).toHaveBeenCalled();
  });
});
