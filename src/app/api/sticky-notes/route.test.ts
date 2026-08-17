import { beforeEach, describe, expect, it, vi } from 'vitest';

const { validateAdminRequestMock, saveNotesMock, enforceRequestRateLimitMock, revalidatePathMock } =
  vi.hoisted(() => ({
    validateAdminRequestMock: vi.fn(),
    saveNotesMock: vi.fn(),
    enforceRequestRateLimitMock: vi.fn(),
    revalidatePathMock: vi.fn(),
  }));

vi.mock('@/lib/auth', () => ({
  validateAdminRequest: validateAdminRequestMock,
}));

vi.mock('@/lib/services/stickyNotesService', () => ({
  stickyNotesService: {
    saveNotes: saveNotesMock,
    getNotes: vi.fn(),
  },
}));

vi.mock('@/lib/security/request', () => ({
  enforceRequestRateLimit: enforceRequestRateLimitMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

import { PUT } from './route';

function buildPut(body: unknown): Request {
  return new Request('http://localhost/api/sticky-notes', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validNote = {
  id: 'note-1',
  text: 'Hello',
  date: '2025-01-01T00:00:00Z',
  color: '#fef08a',
  isStarred: false,
  isDeleted: false,
};

describe('PUT /api/sticky-notes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    validateAdminRequestMock.mockResolvedValue(true);
    enforceRequestRateLimitMock.mockResolvedValue({ allowed: true, retryAfter: 0 });
    saveNotesMock.mockResolvedValue([validNote]);
  });

  it('rejects unauthenticated requests', async () => {
    validateAdminRequestMock.mockResolvedValue(false);

    const response = await PUT(buildPut([validNote]) as never);
    expect(response.status).toBe(401);
  });

  it('rejects ketika rate limit tercapai', async () => {
    enforceRequestRateLimitMock.mockResolvedValue({ allowed: false, retryAfter: 60 });

    const response = await PUT(buildPut([validNote]) as never);
    expect(response.status).toBe(429);
  });

  it('rejects non-array body', async () => {
    const response = await PUT(buildPut({ notes: [] }) as never);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid sticky notes payload');
    expect(saveNotesMock).not.toHaveBeenCalled();
  });

  it('rejects note dengan field tidak dikenal', async () => {
    const response = await PUT(buildPut([{ ...validNote, injected: 'xss' }]) as never);
    expect(response.status).toBe(400);
  });

  it('rejects note dengan text > 5000 chars', async () => {
    const response = await PUT(buildPut([{ ...validNote, text: 'x'.repeat(5001) }]) as never);
    expect(response.status).toBe(400);
  });

  it('rejects bulk > 200 notes', async () => {
    const huge = Array.from({ length: 201 }, (_, i) => ({
      ...validNote,
      id: `note-${i}`,
    }));
    const response = await PUT(buildPut(huge) as never);
    expect(response.status).toBe(400);
  });

  it('accepts valid payload and triggers revalidate', async () => {
    const response = await PUT(buildPut([validNote]) as never);
    expect(response.status).toBe(200);

    expect(saveNotesMock).toHaveBeenCalledWith([validNote], 'default-site');
    expect(revalidatePathMock).toHaveBeenCalled();
  });
});
