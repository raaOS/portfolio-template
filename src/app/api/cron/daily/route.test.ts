import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { sweepExpiredOrdersMock, runDailyBackupMock, probeWorkerHealthMock, recordWorkerHealthMock, isOwnerModeMock } =
  vi.hoisted(() => ({
    sweepExpiredOrdersMock: vi.fn().mockResolvedValue(undefined),
    runDailyBackupMock: vi.fn().mockResolvedValue({ ran: true, key: 'backup.json' }),
    probeWorkerHealthMock: vi.fn(),
    recordWorkerHealthMock: vi.fn().mockResolvedValue(undefined),
    isOwnerModeMock: vi.fn().mockReturnValue(false),
  }));

vi.mock('@/lib/services/orderService', () => ({
  sweepExpiredOrders: sweepExpiredOrdersMock,
}));

vi.mock('@/lib/services/d1BackupService', () => ({
  runDailyBackup: runDailyBackupMock,
}));

vi.mock('@/lib/ownerMode', () => ({
  isOwnerMode: isOwnerModeMock,
}));

vi.mock('@/lib/workerHealthProbe', () => ({
  probeWorkerHealth: probeWorkerHealthMock,
  recordWorkerHealth: recordWorkerHealthMock,
}));

import { POST } from './route';

/** Hasil probe sukses — dipakai ulang tiap kasus supaya bentuknya stabil. */
const HEALTH_RESULT = {
  probedAt: '2026-10-23T18:00:00.000Z',
  slug: 'spatial-gallery',
  target: 'https://makeitbetter.my.id/preview/spatial-gallery',
  transport: 'service-binding',
  concurrency: 32,
  ok: 32,
  failed: 0,
  failed1102: 0,
  timedOut: 0,
  cacheHit: 32,
  cacheRendered: 0,
  cacheHitRatio: 1,
  avgTtfbMs: 34,
  p95TtfbMs: 48,
  durationMs: 60,
  passed: true,
};

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
    runDailyBackupMock.mockResolvedValue({ ran: true, key: 'backup.json' });
    isOwnerModeMock.mockReturnValue(false);
    probeWorkerHealthMock.mockResolvedValue(HEALTH_RESULT);
    recordWorkerHealthMock.mockResolvedValue(undefined);
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

  it('runs the daily D1 backup exactly once when the secret matches', async () => {
    process.env.CRON_SECRET = 'test-secret';
    const response = await POST(buildRequest({ 'x-cron-secret': 'test-secret' }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(sweepExpiredOrdersMock).toHaveBeenCalledTimes(1);
    expect(runDailyBackupMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the run green when the daily backup throws', async () => {
    process.env.CRON_SECRET = 'test-secret';
    runDailyBackupMock.mockRejectedValueOnce(new Error('r2 down'));

    const response = await POST(buildRequest({ 'x-cron-secret': 'test-secret' }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(sweepExpiredOrdersMock).toHaveBeenCalledTimes(1);
    expect(runDailyBackupMock).toHaveBeenCalledTimes(1);
  });

  it('runs the worker health probe and records it when OWNER_MODE is on', async () => {
    process.env.CRON_SECRET = 'test-secret';
    isOwnerModeMock.mockReturnValue(true);

    const response = await POST(buildRequest({ 'x-cron-secret': 'test-secret' }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(probeWorkerHealthMock).toHaveBeenCalledTimes(1);
    expect(recordWorkerHealthMock).toHaveBeenCalledWith(HEALTH_RESULT);
    // Hasil ikut dibalikkan ke pemanggil supaya bisa diperiksa tanpa membuka D1.
    expect(body.workerHealth).toEqual(HEALTH_RESULT);
  });

  it('skips the worker health probe on client deployments', async () => {
    process.env.CRON_SECRET = 'test-secret';
    isOwnerModeMock.mockReturnValue(false);

    const response = await POST(buildRequest({ 'x-cron-secret': 'test-secret' }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    // Site klien tidak membebani Worker-nya sendiri, apalagi menulis ke D1 mereka.
    expect(probeWorkerHealthMock).not.toHaveBeenCalled();
    expect(recordWorkerHealthMock).not.toHaveBeenCalled();
    expect(body.workerHealth).toBeNull();
  });

  it('keeps the run green when the worker health probe itself throws', async () => {
    process.env.CRON_SECRET = 'test-secret';
    isOwnerModeMock.mockReturnValue(true);
    probeWorkerHealthMock.mockRejectedValueOnce(new Error('binding WORKER_SELF_REFERENCE tidak ada'));

    const response = await POST(buildRequest({ 'x-cron-secret': 'test-secret' }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(sweepExpiredOrdersMock).toHaveBeenCalledTimes(1);
    expect(runDailyBackupMock).toHaveBeenCalledTimes(1);
    // Kegagalan probe tidak boleh menggagalkan run — dan tidak boleh ikut tersimpan.
    expect(recordWorkerHealthMock).not.toHaveBeenCalled();
    expect(body.workerHealth).toBeNull();
  });
});
