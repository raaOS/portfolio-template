import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { accessMock, refMock, isOwnerModeMock, getD1ValueMock, isWorkerHealthStaleMock } = vi.hoisted(() => ({
  accessMock: vi.fn(),
  refMock: vi.fn(),
  isOwnerModeMock: vi.fn(),
  getD1ValueMock: vi.fn(),
  isWorkerHealthStaleMock: vi.fn(),
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

vi.mock('@/lib/ownerMode', () => ({
  isOwnerMode: isOwnerModeMock,
}));

// Modul asli disebar dulu: `@/lib/cloudflareD1` juga dipakai jalur rate-limit
// `/api/health`, jadi mengganti seluruh modul akan mematikan route-nya.
vi.mock('@/lib/cloudflareD1', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cloudflareD1')>()),
  getD1Value: getD1ValueMock,
}));

vi.mock('@/lib/workerHealthProbe', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/workerHealthProbe')>()),
  isWorkerHealthStale: isWorkerHealthStaleMock,
}));

import { GET } from './route';
import { APP_VERSION } from '@/lib/constants';

const originalCloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const originalCfPages = process.env.CF_PAGES;

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    isOwnerModeMock.mockReturnValue(false);
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

/**
 * Penanda usia bacaan probe. Latar belakangnya temuan 2026-10-23: tulisan probe
 * gagal masuk D1 diam-diam sehingga portal memajang angka lama sebagai angka
 * hari ini. Tanpa penanda `stale`, angka lama tidak bisa dibedakan dari segar.
 */
describe('GET /api/health — penanda usia workerHealth', () => {
  const PROBE = {
    probedAt: '2026-10-21T18:00:00.000Z',
    concurrency: 32,
    ok: 32,
    cacheHit: 32,
    cacheHitRatio: 1,
    passed: true,
  };

  beforeEach(() => {
    // Desk ini saudara dari desk lama, jadi `beforeEach` di atas tidak
    // menjangkaunya — reset diulang di sini supaya mock tidak menumpuk antar kasus.
    vi.resetAllMocks();
    isOwnerModeMock.mockReturnValue(false);
    accessMock.mockResolvedValue(undefined);
    refMock.mockReturnValue({
      once: vi.fn().mockResolvedValue({ val: () => 'ok' }),
    });
  });

  it('marks a stale reading without degrading the site status', async () => {
    isOwnerModeMock.mockReturnValue(true);
    getD1ValueMock.mockResolvedValue(PROBE);
    isWorkerHealthStaleMock.mockReturnValue(true);

    const response = await GET(new Request('http://localhost/api/health') as unknown as NextRequest);
    const body = await response.json();

    // Probe yang berhenti menyimpan bukan "site sakit" — situsnya sendiri masih
    // melayani request. Tapi angkanya tidak boleh dipajang tanpa penanda.
    expect(body.status).toBe('ok');
    expect(response.status).toBe(200);
    expect(body.workerHealth.stale).toBe(true);
    expect(body.workerHealth.cacheHitRatio).toBe(1);
  });

  it('leaves a fresh reading unmarked', async () => {
    isOwnerModeMock.mockReturnValue(true);
    getD1ValueMock.mockResolvedValue(PROBE);
    isWorkerHealthStaleMock.mockReturnValue(false);

    const body = await (await GET(new Request('http://localhost/api/health') as unknown as NextRequest)).json();

    expect(body.workerHealth.stale).toBe(false);
  });

  it('keeps the health check green when reading the probe result fails', async () => {
    isOwnerModeMock.mockReturnValue(true);
    getD1ValueMock.mockRejectedValue(new Error('d1 down'));

    const response = await GET(new Request('http://localhost/api/health') as unknown as NextRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.workerHealth).toBeUndefined();
  });

  it('never reads probe data on client deployments', async () => {
    isOwnerModeMock.mockReturnValue(false);

    const body = await (await GET(new Request('http://localhost/api/health') as unknown as NextRequest)).json();

    // `getD1Value` tetap dipanggil jalur rate-limit — yang dilarang hanya
    // pembacaan kunci probe, karena site klien tidak boleh mengetahuinya.
    expect(getD1ValueMock).not.toHaveBeenCalledWith('worker-health/latest');
    expect(body.workerHealth).toBeUndefined();
  });
});
