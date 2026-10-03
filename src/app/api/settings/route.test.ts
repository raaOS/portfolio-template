import { beforeEach, describe, expect, it, vi } from 'vitest';

const { validateAdminRequestMock, refMock, updateMock } = vi.hoisted(() => ({
  validateAdminRequestMock: vi.fn(),
  refMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  validateAdminRequest: validateAdminRequestMock,
}));

vi.mock('@/lib/database', () => ({
  db: {
    ref: refMock,
  },
}));

import { GET, POST } from './route';

function buildPost(body: unknown): Request {
  return new Request('http://localhost/api/settings', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/settings', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    validateAdminRequestMock.mockResolvedValue(true);
    refMock.mockReturnValue({ update: updateMock });
    updateMock.mockResolvedValue(undefined);
  });

  it('rejects unauthenticated', async () => {
    validateAdminRequestMock.mockResolvedValue(false);
    const response = await POST(buildPost({ bannedWords: [] }) as never);
    expect(response.status).toBe(401);
  });

  it('rejects bannedWords non-array', async () => {
    // updateSettingsSchema kini strict: hanya bannedWords (array) + flag boolean
    const response = await POST(buildPost({ bannedWords: 'word' }) as never);
    expect(response.status).toBe(400);
  });

  it('rejects banned word > 50 chars', async () => {
    const response = await POST(buildPost({ bannedWords: ['x'.repeat(51)] }) as never);
    expect(response.status).toBe(400);
  });

  it('accepts valid payload', async () => {
    const response = await POST(buildPost({ bannedWords: ['judol', 'slot'] }) as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.settings.bannedWords).toEqual(['judol', 'slot']);
    expect(updateMock).toHaveBeenCalled();
  });

  it('normalizes bannedWords before saving', async () => {
    const response = await POST(
      buildPost({ bannedWords: [' Slot ', 'slot', '', 'GACOR'] }) as never
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.settings.bannedWords).toEqual(['slot', 'gacor']);
    expect(updateMock).toHaveBeenCalledWith({ bannedWords: ['slot', 'gacor'] });
  });

  it('passes through flag fields (maintenanceMode, allowComments)', async () => {
    const response = await POST(
      buildPost({
        bannedWords: [],
        maintenanceMode: true,
        allowComments: false,
      }) as never
    );
    expect(response.status).toBe(200);
  });
});

describe('GET /api/settings', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('keeps bannedWords hidden from public settings response', async () => {
    validateAdminRequestMock.mockResolvedValue(false);
    refMock.mockReturnValue({
      once: vi.fn().mockResolvedValue({
        val: () => ({
          bannedWords: ['slot'],
          maintenanceMode: true,
        }),
      }),
    });

    const response = await GET(new Request('http://localhost/api/settings') as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ maintenanceMode: true });
  });

  it('includes normalized bannedWords for authenticated admin requests', async () => {
    validateAdminRequestMock.mockResolvedValue(true);
    refMock.mockReturnValue({
      once: vi.fn().mockResolvedValue({
        val: () => ({
          bannedWords: [' Slot ', 'slot', 'GACOR'],
          allowComments: true,
        }),
      }),
    });

    const response = await GET(new Request('http://localhost/api/settings') as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.bannedWords).toEqual(['slot', 'gacor']);
    expect(body.allowComments).toBe(true);
    expect(validateAdminRequestMock).toHaveBeenCalledWith(expect.any(Request), {
      checkCsrf: false,
    });
  });
});
