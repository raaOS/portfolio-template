import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  validateAdminRequestMock,
  validateSiteMutationRequestMock,
  getAboutDataMock,
  updateAboutDataMock,
  invalidateAboutCacheMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  validateAdminRequestMock: vi.fn(),
  validateSiteMutationRequestMock: vi.fn(),
  getAboutDataMock: vi.fn(),
  updateAboutDataMock: vi.fn(),
  invalidateAboutCacheMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  validateAdminRequest: validateAdminRequestMock,
}));

vi.mock('@/lib/admin/siteMutationAuth', () => ({
  validateSiteMutationRequest: validateSiteMutationRequestMock,
}));

vi.mock('@/lib/services/aboutService', () => ({
  aboutService: {
    getAboutData: getAboutDataMock,
    updateAboutData: updateAboutDataMock,
  },
}));

vi.mock('@/lib/about', () => ({
  invalidateAboutCache: invalidateAboutCacheMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

import { GET, PUT } from './route';

const mockAboutData = {
  hero: { title: 'Designer', availability: { status: 'available', text: 'Open to work' } },
  professional: { title: 'Professional' },
  lastUpdated: '2025-01-01T00:00:00Z',
};

const validUpdatePayload = {
  hero: { title: 'Senior Designer' },
};

function buildGet(url: string): NextRequest {
  return new NextRequest(`http://localhost/api/about${url}`, { method: 'GET' });
}

function buildPut(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/about', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/about', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getAboutDataMock.mockResolvedValue(mockAboutData);
  });

  it('returns about data', async () => {
    const response = await GET(buildGet('') as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.hero.title).toBe('Designer');
  });

  it('passes fresh flag to service', async () => {
    await GET(buildGet('?fresh=true') as never);
    expect(getAboutDataMock).toHaveBeenCalledWith(true, true, 'default-site');
  });

  it('returns 500 on error', async () => {
    getAboutDataMock.mockRejectedValue(new Error('DB fail'));
    const response = await GET(buildGet('') as never);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to load about data');
  });
});

describe('PUT /api/about', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    validateSiteMutationRequestMock.mockResolvedValue({ role: 'admin' });
    updateAboutDataMock.mockResolvedValue({ ...mockAboutData, hero: { title: 'Senior Designer' } });
  });

  it('rejects unauthenticated updates', async () => {
    validateSiteMutationRequestMock.mockResolvedValue(null);
    const response = await PUT(buildPut(validUpdatePayload) as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized or invalid CSRF token');
  });

  it('rejects invalid payload', async () => {
    const response = await PUT(buildPut({ invalidField: true }) as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Validation failed');
  });

  it('updates about data and invalidates cache', async () => {
    const response = await PUT(buildPut(validUpdatePayload) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.hero.title).toBe('Senior Designer');
    expect(invalidateAboutCacheMock).toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith('/', 'layout');
    expect(revalidatePathMock).toHaveBeenCalledWith('/about');
  });

  it('passes updates to service', async () => {
    await PUT(buildPut(validUpdatePayload) as never);
    expect(updateAboutDataMock).toHaveBeenCalledWith(
      { hero: { title: 'Senior Designer' } },
      'default-site'
    );
  });

  it('returns 500 on update failure', async () => {
    updateAboutDataMock.mockRejectedValue(new Error('Write error'));
    const response = await PUT(buildPut(validUpdatePayload) as never);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to update about data');
  });
});
