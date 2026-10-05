import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { accessMock, refMock } = vi.hoisted(() => ({
  accessMock: vi.fn(),
  refMock: vi.fn(),
}));

vi.mock('fs', () => ({
  promises: {
    access: accessMock,
  },
}));

vi.mock('@/lib/database', () => ({
  db: {
    ref: refMock,
  },
  getDatabaseBackend: () => 'cloudflare-d1',
}));

import { GET } from './route';
import { APP_VERSION } from '@/lib/constants';

const originalCloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const originalCfPages = process.env.CF_PAGES;

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    Reflect.deleteProperty(process.env, 'CLOUDFLARE_ACCOUNT_ID');
    Reflect.deleteProperty(process.env, 'CF_PAGES');
  });

  afterEach(() => {
    if (originalCloudflareAccountId === undefined) {
      Reflect.deleteProperty(process.env, 'CLOUDFLARE_ACCOUNT_ID');
    } else {
      process.env.CLOUDFLARE_ACCOUNT_ID = originalCloudflareAccountId;
    }

    if (originalCfPages === undefined) {
      Reflect.deleteProperty(process.env, 'CF_PAGES');
    } else {
      process.env.CF_PAGES = originalCfPages;
    }
  });

  it('returns ok when filesystem and database are healthy', async () => {
    accessMock.mockResolvedValue(undefined);
    refMock.mockReturnValue({
      once: vi.fn().mockResolvedValue({ val: () => 'ok' }),
    });

    const mockRequest = new Request('http://localhost/api/health');
    const response = await GET(mockRequest as unknown as NextRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    // Versi rilis nyata (bukan hardcode '1.0.0') — portal status board
    // membandingkan nilai ini dengan CHANGELOG untuk badge "perlu update".
    expect(body.version).toBe(APP_VERSION);
    expect(body.filesystem).toBe('accessible');
    expect(body.database).toBe('connected');
    expect(body.memory.heapUsed).toBeDefined();
    expect(body.memory.rss).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });

  it('returns degraded when filesystem is inaccessible', async () => {
    accessMock.mockRejectedValue(new Error('EACCES'));
    refMock.mockReturnValue({
      once: vi.fn().mockResolvedValue({ val: () => 'ok' }),
    });

    const mockRequest = new Request('http://localhost/api/health');
    const response = await GET(mockRequest as unknown as NextRequest);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.filesystem).toBe('inaccessible');
  });

  it('does not degrade Cloudflare runtime when filesystem is unavailable', async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account';
    accessMock.mockRejectedValue(new Error('EACCES'));
    refMock.mockReturnValue({
      once: vi.fn().mockResolvedValue({ val: () => 'ok' }),
    });

    const mockRequest = new Request('http://localhost/api/health');
    const response = await GET(mockRequest as unknown as NextRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.filesystem).toBe('not_applicable');
    expect(accessMock).not.toHaveBeenCalled();
  });

  it('returns degraded when database is disconnected', async () => {
    accessMock.mockResolvedValue(undefined);
    refMock.mockReturnValue({
      once: vi.fn().mockRejectedValue(new Error('Network error')),
    });

    const mockRequest = new Request('http://localhost/api/health');
    const response = await GET(mockRequest as unknown as NextRequest);
    const body = await response.json();

    expect(body.database).toBe('disconnected');
    expect(body.status).toBe('degraded');
  });
});
