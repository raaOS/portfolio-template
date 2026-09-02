import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  validateAdminRequestMock,
  validateSiteMutationRequestMock,
  updateTestimonialMock,
  deleteTestimonialMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  validateAdminRequestMock: vi.fn(),
  validateSiteMutationRequestMock: vi.fn(),
  updateTestimonialMock: vi.fn(),
  deleteTestimonialMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  validateAdminRequest: validateAdminRequestMock,
}));

vi.mock('@/lib/admin/siteMutationAuth', () => ({
  validateSiteMutationRequest: validateSiteMutationRequestMock,
}));

vi.mock('@/lib/services/testimonialService', () => ({
  testimonialService: {
    updateTestimonial: updateTestimonialMock,
    deleteTestimonial: deleteTestimonialMock,
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

import { PUT, DELETE } from './route';

const mockTestimonial = {
  id: 'test-1',
  name: 'John Doe',
  notificationText: 'New testimonial from John',
  isActive: true,
  company: 'Acme Inc',
  role: 'CTO',
};

const validUpdateBody = {
  name: 'Updated Name',
  company: 'New Corp',
};

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function buildPut(body: unknown): Request {
  return new Request('http://localhost/api/testimonial/test-1', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function buildDelete(): Request {
  return new Request('http://localhost/api/testimonial/test-1', {
    method: 'DELETE',
  });
}

describe('PUT /api/testimonial/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    validateSiteMutationRequestMock.mockResolvedValue({ role: 'admin' });
    updateTestimonialMock.mockResolvedValue({
      ...mockTestimonial,
      ...validUpdateBody,
    });
  });

  it('rejects unauthenticated requests', async () => {
    validateSiteMutationRequestMock.mockResolvedValue(null);
    const response = await PUT(buildPut(validUpdateBody) as never, params('test-1'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized or invalid CSRF token');
  });

  it('rejects invalid payload', async () => {
    const response = await PUT(buildPut({}) as never, params('test-1'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Validation failed');
  });

  it('updates a testimonial by id', async () => {
    const response = await PUT(buildPut(validUpdateBody) as never, params('test-1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.testimonial.name).toBe('Updated Name');
    expect(body.testimonial.company).toBe('New Corp');
    expect(updateTestimonialMock).toHaveBeenCalledWith(
      'test-1',
      {
        name: 'Updated Name',
        company: 'New Corp',
      },
      'default-site'
    );
    expect(revalidatePathMock).toHaveBeenCalled();
  });

  it('merges id from URL params into validation', async () => {
    updateTestimonialMock.mockResolvedValue(mockTestimonial);

    const response = await PUT(buildPut({ name: 'From Params' }) as never, params('test-1'));
    expect(response.status).toBe(200);
    expect(updateTestimonialMock).toHaveBeenCalledWith(
      'test-1',
      {
        name: 'From Params',
      },
      'default-site'
    );
  });

  it('returns 404 when testimonial not found', async () => {
    updateTestimonialMock.mockResolvedValue(null);
    const response = await PUT(buildPut(validUpdateBody) as never, params('test-1'));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Testimonial not found');
  });

  it('returns 500 on update error', async () => {
    updateTestimonialMock.mockRejectedValue(new Error('Crash'));
    const response = await PUT(buildPut(validUpdateBody) as never, params('test-1'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to update testimonial');
  });
});

describe('DELETE /api/testimonial/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    validateSiteMutationRequestMock.mockResolvedValue({ role: 'admin' });
    deleteTestimonialMock.mockResolvedValue(true);
  });

  it('rejects unauthenticated requests', async () => {
    validateSiteMutationRequestMock.mockResolvedValue(null);
    const response = await DELETE(buildDelete() as never, params('test-1'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized or invalid CSRF token');
  });

  it('deletes a testimonial by id', async () => {
    const response = await DELETE(buildDelete() as never, params('test-1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(deleteTestimonialMock).toHaveBeenCalledWith('test-1', 'default-site');
    expect(revalidatePathMock).toHaveBeenCalled();
  });

  it('returns 404 when testimonial not found', async () => {
    deleteTestimonialMock.mockResolvedValue(false);
    const response = await DELETE(buildDelete() as never, params('test-1'));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Testimonial not found');
  });

  it('returns 500 on delete error', async () => {
    deleteTestimonialMock.mockRejectedValue(new Error('Crash'));
    const response = await DELETE(buildDelete() as never, params('test-1'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to delete testimonial');
  });
});
