import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  validateAdminRequestMock,
  saveHardSkillsMock,
  enforceRequestRateLimitMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  validateAdminRequestMock: vi.fn(),
  saveHardSkillsMock: vi.fn(),
  enforceRequestRateLimitMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  validateAdminRequest: validateAdminRequestMock,
}));

vi.mock('@/lib/services/hardSkillService', () => ({
  hardSkillService: {
    getHardSkills: vi.fn(),
    saveHardSkills: saveHardSkillsMock,
  },
}));

vi.mock('@/lib/security/request', () => ({
  enforceRequestRateLimit: enforceRequestRateLimitMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

import { POST } from './route';

const validSkill = {
  id: 'skill-1',
  name: 'Figma',
  iconUrl: 'https://example.com/figma.png',
  level: 'Advanced' as const,
  order: 1,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

function buildPost(body: unknown): Request {
  return new Request('http://localhost/api/hard-skills', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/hard-skills (bulk)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    validateAdminRequestMock.mockResolvedValue(true);
    enforceRequestRateLimitMock.mockResolvedValue({ allowed: true, retryAfter: 0 });
    saveHardSkillsMock.mockResolvedValue(true);
  });

  it('rejects unauthenticated BEFORE checking rate limit', async () => {
    validateAdminRequestMock.mockResolvedValue(false);

    const response = await POST(buildPost([validSkill]) as never);
    expect(response.status).toBe(401);
    expect(enforceRequestRateLimitMock).not.toHaveBeenCalled();
  });

  it('enforces rate limit 5 req/min', async () => {
    enforceRequestRateLimitMock.mockResolvedValue({ allowed: false, retryAfter: 60 });
    const response = await POST(buildPost([validSkill]) as never);
    expect(response.status).toBe(429);
  });

  it('rejects non-array body', async () => {
    const response = await POST(buildPost({ skills: [validSkill] }) as never);
    expect(response.status).toBe(400);
  });

  it('rejects skill dengan level enum invalid', async () => {
    const response = await POST(buildPost([{ ...validSkill, level: 'Ninja' }]) as never);
    expect(response.status).toBe(400);
  });

  it('accepts valid bulk + triggers revalidate', async () => {
    const response = await POST(buildPost([validSkill]) as never);
    expect(response.status).toBe(200);

    expect(saveHardSkillsMock).toHaveBeenCalledWith(
      [validSkill],
      expect.stringContaining('Bulk update'),
      'default-site'
    );
    expect(revalidatePathMock).toHaveBeenCalled();
  });

  it('caps bulk di 200 items', async () => {
    const huge = Array.from({ length: 201 }, (_, i) => ({
      ...validSkill,
      id: `skill-${i}`,
    }));
    const response = await POST(buildPost(huge) as never);
    expect(response.status).toBe(400);
  });
});
