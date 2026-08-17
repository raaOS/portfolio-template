import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  getClientSessionFromRequestMock,
  validateClientRequestMock,
  getSiteTestimonialsMock,
  createTestimonialMock,
  updateTestimonialMock,
  deleteTestimonialMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  getClientSessionFromRequestMock: vi.fn(),
  validateClientRequestMock: vi.fn(),
  getSiteTestimonialsMock: vi.fn(),
  createTestimonialMock: vi.fn(),
  updateTestimonialMock: vi.fn(),
  deleteTestimonialMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock('@/lib/clientAuth', () => ({
  getClientSessionFromRequest: getClientSessionFromRequestMock,
  validateClientRequest: validateClientRequestMock,
}));

vi.mock('@/lib/services/testimonialService', () => ({
  testimonialService: {
    getSiteTestimonials: getSiteTestimonialsMock,
    createTestimonial: createTestimonialMock,
    updateTestimonial: updateTestimonialMock,
    deleteTestimonial: deleteTestimonialMock,
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

import { DELETE, GET, POST, PUT } from './route';

const proSession = {
  accessId: 'access-1',
  siteId: 'site-pro',
  siteSlug: 'pro-client',
  siteName: 'Pro Client',
  email: 'client@example.com',
  plan: 'pro' as const,
  siteStatus: 'active',
};

const liteSession = {
  ...proSession,
  siteId: 'site-lite',
  siteSlug: 'lite-client',
  plan: 'lite' as const,
};

const mockTestimonial = {
  id: 'testimonial-1',
  name: 'Nadia',
  notificationText: 'Sudah sesuai, tim kami suka hasilnya.',
  isActive: true,
  company: 'Brand Studio',
  role: 'Owner',
  content: 'Bagus dan cepat.',
  messages: [{ id: 1, text: 'Sudah sesuai.', isMe: false, time: '09:00' }],
};

const validCreatePayload = {
  name: 'Raka',
  notificationText: 'Flow-nya jelas.',
  content: 'Flow-nya jelas dan mudah dipakai.',
  isActive: true,
};

function buildRequest(method = 'GET', body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/client/testimonials', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('/api/client/testimonials', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getClientSessionFromRequestMock.mockResolvedValue(proSession);
    validateClientRequestMock.mockResolvedValue(proSession);
    getSiteTestimonialsMock.mockResolvedValue({
      testimonials: [mockTestimonial],
      lastUpdated: '2026-07-01T00:00:00Z',
    });
    createTestimonialMock.mockResolvedValue({ ...validCreatePayload, id: 'testimonial-new' });
    updateTestimonialMock.mockResolvedValue({ ...mockTestimonial, name: 'Updated' });
    deleteTestimonialMock.mockResolvedValue(true);
  });

  it('rejects Lite sites before reading testimonial data', async () => {
    getClientSessionFromRequestMock.mockResolvedValue(liteSession);

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.errorCode).toBe('FEATURE_REQUIRES_PRO');
    expect(getSiteTestimonialsMock).not.toHaveBeenCalled();
  });

  it('returns only testimonials for the logged-in site', async () => {
    const response = await GET(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.testimonials).toHaveLength(1);
    expect(body.data.feature.whatsappTestimonials).toBe(true);
    expect(getSiteTestimonialsMock).toHaveBeenCalledWith('site-pro');
  });

  it('creates testimonials using session siteId, not client-provided siteId', async () => {
    getSiteTestimonialsMock.mockResolvedValueOnce({
      testimonials: [],
      lastUpdated: '2026-07-01T00:00:00Z',
    });

    const response = await POST(
      buildRequest('POST', { ...validCreatePayload, siteId: 'other-site' })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(createTestimonialMock).toHaveBeenCalledWith(validCreatePayload, 'site-pro');
    expect(revalidatePathMock).toHaveBeenCalledWith('/pro-client');
  });

  it('rejects testimonial creation over the Pro quota', async () => {
    getSiteTestimonialsMock.mockResolvedValueOnce({
      testimonials: Array.from({ length: 20 }, (_, index) => ({
        ...mockTestimonial,
        id: `testimonial-${index}`,
      })),
      lastUpdated: '2026-07-01T00:00:00Z',
    });

    const response = await POST(buildRequest('POST', validCreatePayload));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.errorCode).toBe('TESTIMONIAL_LIMIT_REACHED');
    expect(createTestimonialMock).not.toHaveBeenCalled();
  });

  it('updates testimonials using the logged-in site scope', async () => {
    const response = await PUT(buildRequest('PUT', { id: 'testimonial-1', name: 'Updated' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(updateTestimonialMock).toHaveBeenCalledWith(
      'testimonial-1',
      { name: 'Updated' },
      'site-pro'
    );
  });

  it('deletes testimonials using the logged-in site scope', async () => {
    const response = await DELETE(buildRequest('DELETE', { id: 'testimonial-1' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(deleteTestimonialMock).toHaveBeenCalledWith('testimonial-1', 'site-pro');
  });
});
