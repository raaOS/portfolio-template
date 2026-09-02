import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  validateAdminRequestMock,
  validateSiteMutationRequestMock,
  getExperienceDataMock,
  updateExperienceDataMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  validateAdminRequestMock: vi.fn(),
  validateSiteMutationRequestMock: vi.fn(),
  getExperienceDataMock: vi.fn(),
  updateExperienceDataMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  validateAdminRequest: validateAdminRequestMock,
}));

vi.mock('@/lib/admin/siteMutationAuth', () => ({
  validateSiteMutationRequest: validateSiteMutationRequestMock,
}));

vi.mock('@/lib/services/experienceService', () => ({
  experienceService: {
    getExperienceData: getExperienceDataMock,
    updateExperienceData: updateExperienceDataMock,
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

import { GET, PUT } from './route';

const mockExperienceData = {
  statistics: { years: '5+', projects: '100+', designTools: '20+', clientSatisfaction: '98%' },
  workExperience: [
    {
      id: 'exp-1',
      year: '2024',
      duration: '1 year',
      company: 'Test Corp',
      position: 'Designer',
      description: ['Designed UI'],
      imageUrl: '/r2/assets/exp/test.png',
      isActive: true,
    },
  ],
  lastUpdated: '2025-01-01T00:00:00Z',
};

const validUpdatePayload = {
  statistics: { years: '6+', projects: '120+', designTools: '25+', clientSatisfaction: '99%' },
  workExperience: [
    {
      id: 'exp-2',
      year: '2025',
      duration: '6 months',
      company: 'New Corp',
      position: 'Senior Designer',
      description: ['New design work'],
      imageUrl: '/r2/assets/exp/new.png',
      isActive: true,
    },
  ],
};

function buildPut(body: unknown): Request {
  return new Request('http://localhost/api/experience', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/experience', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getExperienceDataMock.mockResolvedValue(mockExperienceData);
  });

  it('returns experience data', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.statistics.years).toBe('5+');
    expect(body.workExperience).toHaveLength(1);
  });

  it('returns 500 on error', async () => {
    getExperienceDataMock.mockRejectedValue(new Error('DB fail'));
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to read experience data');
  });
});

describe('PUT /api/experience', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    validateSiteMutationRequestMock.mockResolvedValue({ role: 'admin' });
    updateExperienceDataMock.mockResolvedValue({
      statistics: validUpdatePayload.statistics,
      workExperience: validUpdatePayload.workExperience,
      lastUpdated: new Date().toISOString(),
    });
  });

  it('rejects unauthenticated updates', async () => {
    validateSiteMutationRequestMock.mockResolvedValue(null);
    const response = await PUT(buildPut(validUpdatePayload) as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.message).toBe('Unauthorized or invalid CSRF token');
  });

  it('rejects invalid payload', async () => {
    const response = await PUT(buildPut({ invalidField: true }) as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Validation failed');
  });

  it('rejects payload where both fields are missing', async () => {
    // updateExperienceSchema.refine rejects if neither statistics nor workExperience are provided
    const response = await PUT(buildPut({}) as never);
    expect(response.status).toBe(400);
  });

  it('updates experience data and revalidates paths', async () => {
    const response = await PUT(buildPut(validUpdatePayload) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(revalidatePathMock).toHaveBeenCalledWith('/', 'layout');
    expect(revalidatePathMock).toHaveBeenCalledWith('/about');
    expect(revalidatePathMock).toHaveBeenCalledWith('/cv');
  });

  it('accepts partial update with statistics only', async () => {
    await PUT(
      buildPut({
        statistics: {
          years: '10+',
          projects: '500+',
          designTools: '50+',
          clientSatisfaction: '100%',
        },
      }) as never
    );

    expect(updateExperienceDataMock).toHaveBeenCalledWith(
      {
        statistics: expect.objectContaining({ years: '10+' }),
        workExperience: undefined,
      },
      'default-site'
    );
  });

  it('returns 500 on update failure', async () => {
    updateExperienceDataMock.mockRejectedValue(new Error('Write error'));
    const response = await PUT(buildPut(validUpdatePayload) as never);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to update experience data');
  });
});
