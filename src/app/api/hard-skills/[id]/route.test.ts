import { beforeEach, describe, expect, it, vi } from 'vitest';

const { validateAdminRequestMock, validateSiteMutationRequestMock, updateHardSkillMock, deleteHardSkillMock, revalidatePathMock } =
  vi.hoisted(() => ({
    validateAdminRequestMock: vi.fn(),
    validateSiteMutationRequestMock: vi.fn(),
    updateHardSkillMock: vi.fn(),
    deleteHardSkillMock: vi.fn(),
    revalidatePathMock: vi.fn(),
  }));

vi.mock('@/lib/auth', () => ({
  validateAdminRequest: validateAdminRequestMock,
}));

vi.mock('@/lib/admin/siteMutationAuth', () => ({
  validateSiteMutationRequest: validateSiteMutationRequestMock,
}));

vi.mock('@/lib/services/hardSkillService', () => ({
  hardSkillService: {
    updateHardSkill: updateHardSkillMock,
    deleteHardSkill: deleteHardSkillMock,
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

import { PUT, DELETE } from './route';

function buildPut(id: string, body: unknown): Request {
  return new Request(`http://localhost/api/hard-skills/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function buildDelete(id: string): Request {
  return new Request(`http://localhost/api/hard-skills/${id}`, { method: 'DELETE' });
}

const paramsOf = (id: string) => ({ params: Promise.resolve({ id }) });

describe('PUT /api/hard-skills/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    validateSiteMutationRequestMock.mockResolvedValue({ role: 'admin' });
    updateHardSkillMock.mockResolvedValue({
      id: 'skill-1',
      name: 'Updated',
      iconUrl: 'x',
      level: 'Advanced',
      order: 1,
      createdAt: '2025-01-01',
      updatedAt: '2025-01-02',
    });
  });

  it('rejects unauthenticated', async () => {
    validateSiteMutationRequestMock.mockResolvedValue(null);
    const response = await PUT(buildPut('skill-1', { name: 'New' }) as never, paramsOf('skill-1'));
    expect(response.status).toBe(401);
  });

  it('rejects ketika body attempt override id (schema omits id)', async () => {
    const response = await PUT(
      buildPut('skill-1', { id: 'forged', name: 'X' }) as never,
      paramsOf('skill-1')
    );
    expect(response.status).toBe(400);
    expect(updateHardSkillMock).not.toHaveBeenCalled();
  });

  it('rejects empty body (minimal 1 field)', async () => {
    const response = await PUT(buildPut('skill-1', {}) as never, paramsOf('skill-1'));
    expect(response.status).toBe(400);
  });

  it('returns 404 ketika skill tidak ditemukan', async () => {
    updateHardSkillMock.mockResolvedValue(null);
    const response = await PUT(
      buildPut('skill-nonexistent', { name: 'X' }) as never,
      paramsOf('skill-nonexistent')
    );
    expect(response.status).toBe(404);
  });

  it('accepts valid update + triggers revalidate (FIX regression)', async () => {
    // REGRESSION: Sebelum fix, PUT tidak memanggil revalidatePath sama sekali.
    const response = await PUT(
      buildPut('skill-1', { name: 'Updated' }) as never,
      paramsOf('skill-1')
    );
    expect(response.status).toBe(200);
    expect(revalidatePathMock).toHaveBeenCalled();
  });
});

describe('DELETE /api/hard-skills/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    validateSiteMutationRequestMock.mockResolvedValue({ role: 'admin' });
    deleteHardSkillMock.mockResolvedValue(true);
  });

  it('rejects unauthenticated', async () => {
    validateSiteMutationRequestMock.mockResolvedValue(null);
    const response = await DELETE(buildDelete('x') as never, paramsOf('x'));
    expect(response.status).toBe(401);
  });

  it('returns 404 ketika tidak ditemukan', async () => {
    deleteHardSkillMock.mockResolvedValue(false);
    const response = await DELETE(buildDelete('missing') as never, paramsOf('missing'));
    expect(response.status).toBe(404);
  });

  it('deletes + revalidates', async () => {
    const response = await DELETE(buildDelete('skill-1') as never, paramsOf('skill-1'));
    expect(response.status).toBe(200);
    expect(revalidatePathMock).toHaveBeenCalled();
  });
});
