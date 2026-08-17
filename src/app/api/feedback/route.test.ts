import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';
import { invalidateBannedWordsCache } from '@/lib/services/bannedWordsService';

const mocks = vi.hoisted(() => ({
  enforceRequestRateLimit: vi.fn(),
  getClientIP: vi.fn(),
  validateAdminRequest: vi.fn(),
  dbRef: vi.fn(),
}));

vi.mock('@/lib/database', () => ({
  db: {
    ref: mocks.dbRef,
  },
}));

vi.mock('@/lib/security/request', () => ({
  enforceRequestRateLimit: mocks.enforceRequestRateLimit,
  getClientIP: mocks.getClientIP,
}));

vi.mock('@/lib/auth', () => ({
  validateAdminRequest: mocks.validateAdminRequest,
}));

describe('/api/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceRequestRateLimit.mockResolvedValue({ allowed: true });
    mocks.getClientIP.mockReturnValue('127.0.0.1');
    mocks.validateAdminRequest.mockResolvedValue(false);
  });

  it('silently accepts honeypot submissions before touching storage', async () => {
    const request = new NextRequest('http://localhost/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        rating: 5,
        website_url: 'https://spam.example',
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ received: true });
    expect(mocks.dbRef).not.toHaveBeenCalled();
  });

  it('keeps feedback listing admin-only', async () => {
    const request = new NextRequest('http://localhost/api/feedback?status=all');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('UNAUTHORIZED');
  });

  it('silently discards feedback containing banned words', async () => {
    invalidateBannedWordsCache();
    mocks.dbRef.mockImplementation((path: string) => {
      if (path === 'settings/bannedWords') {
        return {
          once: vi.fn().mockResolvedValue({
            exists: () => true,
            val: () => ['slot', 'gacor'],
          }),
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    const request = new NextRequest('http://localhost/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        rating: 5,
        name: 'Bob Slot',
        message: 'This is great',
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ received: true });
    // Verify it only checked bannedWords and did not write to db
    expect(mocks.dbRef).toHaveBeenCalledTimes(1);
  });

  it('silently discards feedback containing obfuscated banned words', async () => {
    invalidateBannedWordsCache();
    mocks.dbRef.mockImplementation((path: string) => {
      if (path === 'settings/bannedWords') {
        return {
          once: vi.fn().mockResolvedValue({
            exists: () => true,
            val: () => ['gacor'],
          }),
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    const request = new NextRequest('http://localhost/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        rating: 5,
        name: 'Bob',
        message: 'Promo g@c0r hari ini',
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ received: true });
    expect(mocks.dbRef).toHaveBeenCalledTimes(1);
  });
});
