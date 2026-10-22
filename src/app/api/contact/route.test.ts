import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  validateAdminRequestMock,
  validateSiteMutationRequestMock,
  refMock,
  onceMock,
  valMock,
  setMock,
  getContactDataMock,
  updateContactDataMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  validateAdminRequestMock: vi.fn(),
  validateSiteMutationRequestMock: vi.fn(),
  refMock: vi.fn(),
  onceMock: vi.fn(),
  valMock: vi.fn(),
  setMock: vi.fn(),
  getContactDataMock: vi.fn(),
  updateContactDataMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  validateAdminRequest: validateAdminRequestMock,
}));

vi.mock('@/lib/admin/siteMutationAuth', () => ({
  validateSiteMutationRequest: validateSiteMutationRequestMock,
}));

vi.mock('@/lib/database', () => ({
  db: {
    ref: refMock,
  },
}));

vi.mock('@/lib/contact', () => ({
  getContactData: getContactDataMock,
  updateContactData: updateContactDataMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

import { GET, PUT } from './route';

const mockContactData = {
  content: { title: 'Get in Touch', subtitle: 'Contact me' },
  info: {
    email: 'test@example.com',
    whatsapp: '+6281234567890',
    linkedin: 'https://linkedin.com/in/test',
    socialMedia: { instagram: '@test' },
  },
  formSettings: { enabled: true, fields: {} },
  lastUpdated: '2025-01-01T00:00:00Z',
};

const validUpdatePayload = {
  content: { title: 'Updated Title' },
  info: { email: 'new@example.com' },
};

function buildGet(url: string): NextRequest {
  return new NextRequest(`http://localhost/api/contact${url}`, { method: 'GET' });
}

function buildPut(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/contact', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/contact', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getContactDataMock.mockResolvedValue(mockContactData);
  });

  it('returns contact data', async () => {
    const response = await GET(buildGet('') as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.content.title).toBe('Get in Touch');
  });

  it('passes fresh flag when requested', async () => {
    await GET(buildGet('?fresh=true') as never);
    expect(getContactDataMock).toHaveBeenCalledWith(true, 'default-site');
  });

  it('returns 500 on unexpected error', async () => {
    getContactDataMock.mockRejectedValue(new Error('DB fail'));
    const response = await GET(buildGet('') as never);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to load contact data');
  });
});

describe('PUT /api/contact', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    validateSiteMutationRequestMock.mockResolvedValue({ role: 'admin' });
    onceMock.mockResolvedValue({ val: valMock });
    refMock.mockReturnValue({ once: onceMock, set: setMock });
    valMock.mockReturnValue(null);
    setMock.mockResolvedValue(undefined);
    getContactDataMock.mockResolvedValue(mockContactData);
    updateContactDataMock.mockResolvedValue({
      ...mockContactData,
      content: { ...mockContactData.content, title: 'Updated Title' },
      info: { ...mockContactData.info, email: 'new@example.com' },
    });
  });

  it('rejects unauthenticated updates', async () => {
    validateSiteMutationRequestMock.mockResolvedValue(null);
    const response = await PUT(buildPut(validUpdatePayload) as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized or invalid CSRF token');
  });

  it('rejects invalid payload', async () => {
    const response = await PUT(buildPut({ invalid: true }) as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid contact payload');
  });

  it('updates contact and revalidates path', async () => {
    const response = await PUT(buildPut(validUpdatePayload) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.content.title).toBe('Updated Title');
    expect(body.data.info.email).toBe('new@example.com');
    expect(revalidatePathMock).toHaveBeenCalled();
  });

  it('accepts public contact info fields (email, phone, address, whatsapp)', async () => {
    const payload = {
      info: {
        email: 'halo@studio.id',
        phone: '+62 811-0000-1111',
        address: 'Bandung, Indonesia',
        socialMedia: { whatsapp: '6281100001111' },
      },
    };
    const response = await PUT(buildPut(payload) as never);

    expect(response.status).toBe(200);
    expect(updateContactDataMock).toHaveBeenCalledWith(payload, 'default-site');
  });

  it('accepts labels payload (Settings tab chat button)', async () => {
    const payload = { labels: { chatButtonText: 'Mulai Ngobrol' } };
    const response = await PUT(buildPut(payload) as never);

    expect(response.status).toBe(200);
    expect(updateContactDataMock).toHaveBeenCalledWith(payload, 'default-site');
  });

  it('deep merges with existing D1 data', async () => {
    updateContactDataMock.mockResolvedValue({
      content: { title: 'Old Title' },
      info: {
        email: 'old@example.com',
        whatsapp: '+6281234567890',
        linkedin: 'https://linkedin.com/in/test',
        socialMedia: {},
      },
      formSettings: { enabled: true, fields: {} },
      lastUpdated: '2025-01-01T00:00:00Z',
    });

    const response = await PUT(buildPut({ content: { title: 'New Title' } }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.info.email).toBe('old@example.com');
  });

  it('handles severe error cases explicitly', async () => {
    updateContactDataMock.mockRejectedValue(
      Object.assign(new Error('Permission denied'), { code: 'PERMISSION_DENIED' })
    );
    const response = await PUT(buildPut(validUpdatePayload) as never);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Permission denied');
  });
});
