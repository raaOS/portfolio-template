import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { validateAdminRequestMock, dbRefOnceMock } = vi.hoisted(() => ({
  validateAdminRequestMock: vi.fn(),
  dbRefOnceMock: vi.fn(),
}));

const mockRef = {
  orderByChild: vi.fn().mockReturnThis(),
  limitToLast: vi.fn().mockReturnThis(),
  once: dbRefOnceMock,
};

vi.mock('@/lib/auth', () => ({
  validateAdminRequest: validateAdminRequestMock,
  checkAdminAuth: vi.fn(() => false),
}));

vi.mock('@/lib/database', () => ({
  db: {
    ref: vi.fn(() => mockRef),
  },
}));

import { GET } from './route';

function buildGetRequest(): NextRequest {
  return new NextRequest('http://localhost/api/admin/audit-logs', { method: 'GET' });
}

describe('GET /api/admin/audit-logs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateAdminRequestMock.mockResolvedValue(true);
    // Reset the chain mock
    mockRef.orderByChild.mockReturnValue(mockRef);
    mockRef.limitToLast.mockReturnValue(mockRef);
  });

  it('rejects unauthenticated requests', async () => {
    validateAdminRequestMock.mockResolvedValue(false);
    const res = await GET(buildGetRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toBe('Unauthorized');
  });

  // Guard regresi 2026-10-08: wajib validateAdminRequest (mengenali sesi
  // customer site_user_token), BUKAN checkAdminAuth polos yang 401.
  it('authenticates via validateAdminRequest without CSRF (customer session friendly)', async () => {
    dbRefOnceMock.mockResolvedValue({ val: () => null });
    await GET(buildGetRequest());
    expect(validateAdminRequestMock).toHaveBeenCalledWith(expect.anything(), {
      checkCsrf: false,
    });
  });

  it('returns empty logs when no data exists', async () => {
    dbRefOnceMock.mockResolvedValue({
      val: () => null,
    });

    const res = await GET(buildGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.logs).toEqual([]);
  });

  it('transforms D1 object to sorted array', async () => {
    const now = Date.now();
    dbRefOnceMock.mockResolvedValue({
      val: () => ({
        'log-1': { action: 'login', timestamp: new Date(now - 1000).toISOString(), userId: 'u1' },
        'log-2': { action: 'delete', timestamp: new Date(now).toISOString(), userId: 'u2' },
        'log-3': { action: 'create', timestamp: new Date(now - 5000).toISOString(), userId: 'u1' },
      }),
    });

    const res = await GET(buildGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.logs.length).toBe(3);
    // Should be sorted descending by timestamp
    expect(body.logs[0].id).toBe('log-2');
    expect(body.logs[0].action).toBe('delete');
    expect(body.logs[2].id).toBe('log-3');
    expect(body.logs[2].action).toBe('create');
  });

  it('queries with the correct database chain', async () => {
    dbRefOnceMock.mockResolvedValue({ val: () => null });

    await GET(buildGetRequest());

    expect(mockRef.orderByChild).toHaveBeenCalledWith('timestamp');
    expect(mockRef.limitToLast).toHaveBeenCalledWith(50);
    expect(dbRefOnceMock).toHaveBeenCalledWith('value');
  });

  it('handles database errors gracefully', async () => {
    dbRefOnceMock.mockRejectedValue(new Error('D1 connection lost'));

    const res = await GET(buildGetRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.message).toBe('Terjadi kesalahan internal');
  });
});
