import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  validateAdminRequestMock,
  validateSiteMutationRequestMock,
  aboutServiceGetMock,
  aboutServiceUpdateMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  validateAdminRequestMock: vi.fn(),
  validateSiteMutationRequestMock: vi.fn(),
  aboutServiceGetMock: vi.fn(),
  aboutServiceUpdateMock: vi.fn(),
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
    getAboutData: aboutServiceGetMock,
    updateAboutData: aboutServiceUpdateMock,
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

import { GET, POST } from './route';

const validWorkflowStep = {
  id: 'discovery',
  number: '01',
  title: 'Discovery & Research',
  subtitle: 'Memahami fondasi',
  description: 'Tahap awal',
  type: 'phase' as const,
  color: 'amber' as const,
  icon: 'Search',
  subSteps: [],
  nextSteps: [],
  loopTargets: [],
};

const validPayload = {
  heading: 'Design Thinking',
  subheading: 'My Process',
  workflowSteps: [validWorkflowStep],
};

const fallbackPhilosophy = {
  heading: 'Design Thinking',
  subheading: 'My Creative Problem-Solving Process',
};

function buildPostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/about/philosophy', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/about/philosophy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aboutServiceGetMock.mockResolvedValue({
      designPhilosophy: {
        heading: 'Custom Heading',
        subheading: 'Custom Subheading',
        workflowSteps: [validWorkflowStep],
      },
    });
  });

  it('returns design philosophy from aboutService', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.heading).toBe('Custom Heading');
    expect(body.subheading).toBe('Custom Subheading');
    expect(body.workflowSteps.length).toBe(1);
  });

  it('falls back to about.json defaults when service returns empty philosophy', async () => {
    aboutServiceGetMock.mockResolvedValue({});
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.heading).toBe(fallbackPhilosophy.heading);
    expect(body.subheading).toBe(fallbackPhilosophy.subheading);
  });

  it('falls back to defaults on service error', async () => {
    aboutServiceGetMock.mockRejectedValue(new Error('D1 down'));
    const res = await GET();
    // Does NOT return 500 — falls back to JSON defaults
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.heading).toBe(fallbackPhilosophy.heading);
    expect(body.workflowSteps.length).toBeGreaterThan(0);
  });
});

describe('POST /api/about/philosophy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateSiteMutationRequestMock.mockResolvedValue({ role: 'admin' });
    aboutServiceUpdateMock.mockResolvedValue(undefined);
    revalidatePathMock.mockResolvedValue(undefined);
  });

  it('rejects unauthenticated requests', async () => {
    validateSiteMutationRequestMock.mockResolvedValue(null);
    const res = await POST(buildPostRequest(validPayload));
    expect(res.status).toBe(401);
  });

  it('rejects invalid payload via Zod validation', async () => {
    const res = await POST(buildPostRequest({ heading: 'X' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid design philosophy payload');
    expect(body.details).toBeDefined();
  });

  it('rejects payload with extra unknown fields', async () => {
    const res = await POST(buildPostRequest({ ...validPayload, injected: true }));
    expect(res.status).toBe(400);
  });

  it('updates via aboutService and revalidates on success', async () => {
    const res = await POST(buildPostRequest(validPayload));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(validPayload);
    expect(body.message).toBe('Data berhasil disimpan');

    expect(aboutServiceUpdateMock).toHaveBeenCalledWith(
      {
        designPhilosophy: validPayload,
      },
      'default-site'
    );
    expect(revalidatePathMock).toHaveBeenCalledWith('/', 'layout');
    expect(revalidatePathMock).toHaveBeenCalledWith('/about');
  });

  it('handles save failure with 500', async () => {
    aboutServiceUpdateMock.mockRejectedValue(new Error('D1 write timeout'));
    const res = await POST(buildPostRequest(validPayload));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to update data');
  });
});
