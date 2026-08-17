import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  validateAdminRequestMock,
  getTestimonialsMock,
  getSiteTestimonialsMock,
  createTestimonialMock,
  updateTestimonialMock,
  deleteTestimonialMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  validateAdminRequestMock: vi.fn(),
  getTestimonialsMock: vi.fn(),
  getSiteTestimonialsMock: vi.fn(),
  createTestimonialMock: vi.fn(),
  updateTestimonialMock: vi.fn(),
  deleteTestimonialMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  validateAdminRequest: validateAdminRequestMock,
}));

vi.mock('@/lib/services/testimonialService', () => ({
  testimonialService: {
    getTestimonials: getTestimonialsMock,
    getSiteTestimonials: getSiteTestimonialsMock,
    createTestimonial: createTestimonialMock,
    updateTestimonial: updateTestimonialMock,
    deleteTestimonial: deleteTestimonialMock,
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

import { GET, POST, PUT, DELETE } from './route';

const mockTestimonial = {
  id: 'test-1',
  name: 'John Doe',
  notificationText: 'New testimonial from John',
  isActive: true,
  messages: [{ id: 1, text: 'Great work!', isMe: false, time: '12:00' }],
  projectId: 'proj-1',
  company: 'Acme Inc',
  role: 'CTO',
  content: 'Amazing portfolio and design quality.',
};

const validCreatePayload = {
  name: 'Jane Doe',
  notificationText: 'New testimonial from Jane',
  isActive: true,
  company: 'Beta Corp',
  role: 'CEO',
  content: 'Excellent work!',
};

const validUpdatePayload = {
  id: 'test-1',
  name: 'Updated Name',
};

const validDeletePayload = {
  id: 'test-1',
};

function buildPost(body: unknown): Request {
  return new Request('http://localhost/api/testimonial', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function buildPut(body: unknown): Request {
  return new Request('http://localhost/api/testimonial', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function buildDelete(body: unknown): Request {
  return new Request('http://localhost/api/testimonial', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/testimonial', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getSiteTestimonialsMock.mockResolvedValue({ testimonials: [mockTestimonial] });
  });

  it('returns testimonials list', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.testimonials).toHaveLength(1);
    expect(body.testimonials[0].name).toBe('John Doe');
  });

  it('returns 500 on error', async () => {
    getSiteTestimonialsMock.mockRejectedValue(new Error('DB fail'));
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to read testimonials');
  });
});

describe('POST /api/testimonial', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    validateAdminRequestMock.mockResolvedValue(true);
    createTestimonialMock.mockResolvedValue({ ...validCreatePayload, id: 'test-new' });
  });

  it('rejects unauthenticated creation', async () => {
    validateAdminRequestMock.mockResolvedValue(false);
    const response = await POST(buildPost(validCreatePayload) as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized or invalid CSRF token');
  });

  it('rejects invalid payload', async () => {
    const response = await POST(buildPost({}) as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Validation failed');
  });

  it('creates a testimonial and revalidates', async () => {
    const response = await POST(buildPost(validCreatePayload) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.testimonial.name).toBe('Jane Doe');
    expect(createTestimonialMock).toHaveBeenCalledWith(validCreatePayload, 'default-site');
    expect(revalidatePathMock).toHaveBeenCalledWith('/', 'layout');
    expect(revalidatePathMock).toHaveBeenCalledWith('/about');
  });

  it('returns 500 on creation failure', async () => {
    createTestimonialMock.mockRejectedValue(new Error('Write error'));
    const response = await POST(buildPost(validCreatePayload) as never);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to create testimonial');
  });
});

describe('PUT /api/testimonial', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    validateAdminRequestMock.mockResolvedValue(true);
    updateTestimonialMock.mockResolvedValue({ ...mockTestimonial, name: 'Updated Name' });
  });

  it('rejects unauthenticated updates', async () => {
    validateAdminRequestMock.mockResolvedValue(false);
    const response = await PUT(buildPut(validUpdatePayload) as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized or invalid CSRF token');
  });

  it('rejects invalid payload', async () => {
    const response = await PUT(buildPut({}) as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('updates a testimonial', async () => {
    const response = await PUT(buildPut(validUpdatePayload) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.testimonial.name).toBe('Updated Name');
    expect(updateTestimonialMock).toHaveBeenCalledWith(
      'test-1',
      { name: 'Updated Name' },
      'default-site'
    );
  });

  it('returns 404 when testimonial not found', async () => {
    updateTestimonialMock.mockResolvedValue(null);
    const response = await PUT(buildPut(validUpdatePayload) as never);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Testimonial not found');
  });

  it('returns 500 on update failure', async () => {
    updateTestimonialMock.mockRejectedValue(new Error('Crash'));
    const response = await PUT(buildPut(validUpdatePayload) as never);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to update testimonial');
  });
});

describe('DELETE /api/testimonial', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    validateAdminRequestMock.mockResolvedValue(true);
    deleteTestimonialMock.mockResolvedValue(true);
  });

  it('rejects unauthenticated deletes', async () => {
    validateAdminRequestMock.mockResolvedValue(false);
    const response = await DELETE(buildDelete(validDeletePayload) as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized or invalid CSRF token');
  });

  it('rejects invalid delete payload with empty id', async () => {
    const response = await DELETE(buildDelete({ id: '' }) as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('deletes a testimonial and revalidates', async () => {
    const response = await DELETE(buildDelete(validDeletePayload) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(deleteTestimonialMock).toHaveBeenCalledWith('test-1', 'default-site');
    expect(revalidatePathMock).toHaveBeenCalled();
  });

  it('returns 404 when testimonial not found', async () => {
    deleteTestimonialMock.mockResolvedValue(false);
    const response = await DELETE(buildDelete(validDeletePayload) as never);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Testimonial not found');
  });

  it('returns 500 on delete failure', async () => {
    deleteTestimonialMock.mockRejectedValue(new Error('Crash'));
    const response = await DELETE(buildDelete(validDeletePayload) as never);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to delete testimonial');
  });
});
