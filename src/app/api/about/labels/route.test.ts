import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { validateAdminRequestMock, validateSiteMutationRequestMock, revalidatePathMock, serviceGetDataMock, serviceSaveDataMock } =
  vi.hoisted(() => ({
    validateAdminRequestMock: vi.fn(),
    validateSiteMutationRequestMock: vi.fn(),
    revalidatePathMock: vi.fn(),
    serviceGetDataMock: vi.fn(),
    serviceSaveDataMock: vi.fn(),
  }));

vi.mock('@/lib/auth', () => ({
  validateAdminRequest: validateAdminRequestMock,
}));

vi.mock('@/lib/admin/siteMutationAuth', () => ({
  validateSiteMutationRequest: validateSiteMutationRequestMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock('@/lib/services/contentService', () => ({
  ContentService: vi.fn(function () {
    return {
      getData: serviceGetDataMock,
      saveData: serviceSaveDataMock,
    };
  }),
}));

import { GET, PUT } from './route';

function buildPutRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/about/labels', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const mockLabels = [
  { id: 'en', name: 'English', slug: 'english', color: 'blue' },
  { id: 'id', name: 'Indonesian', slug: 'indonesian', color: 'emerald' },
];

describe('GET /api/about/labels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceGetDataMock.mockResolvedValue(mockLabels);
  });

  it('returns labels from content service', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(mockLabels);
  });

  it('returns 500 on service error', async () => {
    serviceGetDataMock.mockRejectedValue(new Error('D1 read failed'));
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to fetch labels');
  });
});

describe('PUT /api/about/labels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateSiteMutationRequestMock.mockResolvedValue({ role: 'admin' });
    serviceSaveDataMock.mockResolvedValue(true);
    revalidatePathMock.mockResolvedValue(undefined);
  });

  it('rejects unauthenticated requests', async () => {
    validateSiteMutationRequestMock.mockResolvedValue(null);
    const res = await PUT(buildPutRequest(mockLabels));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Unauthorized');
  });

  it('saves labels and revalidates on success', async () => {
    const newLabels = [
      ...mockLabels,
      { id: 'jp', name: 'Japanese', slug: 'japanese', color: 'rose' },
    ];
    const res = await PUT(buildPutRequest(newLabels));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(newLabels);

    expect(serviceSaveDataMock).toHaveBeenCalledWith(newLabels, 'Update labels', 'default-site');
    expect(revalidatePathMock).toHaveBeenCalledWith('/', 'layout');
  });

  it('handles save failure', async () => {
    serviceSaveDataMock.mockRejectedValue(new Error('D1 write failed'));
    const res = await PUT(buildPutRequest(mockLabels));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to update labels');
  });

  it('returns 500 when saveData resolves to false', async () => {
    serviceSaveDataMock.mockResolvedValue(false);
    const res = await PUT(buildPutRequest(mockLabels));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to update labels');
  });

  it('accepts empty array', async () => {
    const res = await PUT(buildPutRequest([]));
    expect(res.status).toBe(200);
    expect(serviceSaveDataMock).toHaveBeenCalledWith([], 'Update labels', 'default-site');
  });
});
