import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { sweepExpiredOrdersMock } = vi.hoisted(() => ({
  sweepExpiredOrdersMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/services/orderService', () => ({
  sweepExpiredOrders: sweepExpiredOrdersMock,
}));

import { POST } from './route';

function buildRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/cron/daily', {
    method: 'POST',
    headers,
  });
}

describe('POST /api/cron/daily', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sweepExpiredOrdersMock.mockResolvedValue(undefined);
    delete (process.env as Partial<NodeJS.ProcessEnv>).CRON_SECRET;
  });

  it('returns 500 when CRON_SECRET is not configured', async () => {
    const response = await POST(buildRequest({ 'x-cron-secret': 'whatever' }) as never);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.message).toBe('Secret not configured');
    expect(sweepExpiredOrdersMock).not.toHaveBeenCalled();
  });

  it('returns 401 when the secret header is missing', async () => {
    process.env.CRON_SECRET = 'test-secret';
    const response = await POST(buildRequest() as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.message).toBe('No secret');
    expect(sweepExpiredOrdersMock).not.toHaveBeenCalled();
  });

  it('returns 401 when the secret does not match', async () => {
    process.env.CRON_SECRET = 'test-secret';
    const response = await POST(buildRequest({ 'x-cron-secret': 'wrong-secret' }) as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.message).toBe('Invalid secret');
    expect(sweepExpiredOrdersMock).not.toHaveBeenCalled();
  });

  it('returns 401 when the secret has a different length', async () => {
    process.env.CRON_SECRET = 'test-secret';
    const response = await POST(buildRequest({ 'x-cron-secret': 'test-secre' }) as never);

    expect(response.status).toBe(401);
    expect(sweepExpiredOrdersMock).not.toHaveBeenCalled();
  });

  it('runs the expired-order sweep when the secret matches', async () => {
    process.env.CRON_SECRET = 'test-secret';
    const response = await POST(buildRequest({ 'x-cron-secret': 'test-secret' }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(typeof body.ranAt).toBe('string');
    expect(sweepExpiredOrdersMock).toHaveBeenCalledTimes(1);
  });

  it('returns 500 when the sweep blows up', async () => {
    process.env.CRON_SECRET = 'test-secret';
    sweepExpiredOrdersMock.mockRejectedValueOnce(new Error('d1 down'));

    const response = await POST(buildRequest({ 'x-cron-secret': 'test-secret' }) as never);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.message).toBe('Cron run failed');
  });
});
