import { describe, it, expect, vi } from 'vitest';
import { probeClientHealth, HEALTH_PROBE_TIMEOUT_MS } from './portal-status';

function okResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

function errorResponse(status: number): Response {
  return { ok: false, status, json: async () => ({}) } as unknown as Response;
}

describe('probeClientHealth', () => {
  it('memakai alamat pertama bila sehat (tanpa fallback)', async () => {
    const fetchImpl = vi.fn(async () =>
      okResponse({ version: '1.3.72', database: 'connected' })
    ) as unknown as typeof fetch;

    const result = await probeClientHealth(
      ['https://makeitbatter.my.id', 'https://gladi.anaak-setaan.workers.dev'],
      { fetchImpl }
    );

    expect(result.online).toBe(true);
    expect(result.httpStatus).toBe(200);
    expect(result.deployedVersion).toBe('1.3.72');
    expect(result.database).toBe('connected');
    expect(result.answeredBy).toBe('makeitbatter.my.id');
    expect(result.viaFallback).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://makeitbatter.my.id/api/health',
      expect.objectContaining({ signal: expect.anything() })
    );
  });

  it('jatuh ke workers.dev saat domain utama gagal di DNS, lalu menandai viaFallback', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND makeitbatter.my.id'))
      .mockResolvedValueOnce(okResponse({ version: '1.3.72', database: 'connected' }));

    const result = await probeClientHealth(
      ['https://makeitbatter.my.id', 'https://gladi-2026-10-24.anaak-setaan.workers.dev'],
      { fetchImpl: fetchImpl as unknown as typeof fetch }
    );

    expect(result.online).toBe(true);
    expect(result.viaFallback).toBe(true);
    expect(result.answeredBy).toBe('gladi-2026-10-24.anaak-setaan.workers.dev');
    expect(result.deployedVersion).toBe('1.3.72');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('offline hanya bila semua alamat gagal', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('getaddrinfo ENOTFOUND');
    });

    const result = await probeClientHealth(
      ['https://a.test', 'https://b.test'],
      { fetchImpl: fetchImpl as unknown as typeof fetch }
    );

    expect(result.online).toBe(false);
    expect(result.httpStatus).toBeNull();
    expect(result.latencyMs).toBeNull();
    expect(result.answeredBy).toBeNull();
    expect(result.deployedVersion).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('tidak menembak alamat yang sama dua kali', async () => {
    const fetchImpl = vi.fn(async () => okResponse({ version: '1.3.72' }));

    await probeClientHealth(
      ['https://sama.test', 'https://sama.test/', ''],
      { fetchImpl: fetchImpl as unknown as typeof fetch }
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('tetap online bila balasan bukan JSON', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('bukan JSON');
      },
    } as unknown as Response));

    const result = await probeClientHealth(['https://a.test'], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.online).toBe(true);
    expect(result.deployedVersion).toBeNull();
    expect(result.database).toBeNull();
  });

  it('membatalkan percobaan yang menggantung sesuai batas waktu', async () => {
    const slowFetch = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as unknown as typeof fetch;

    const result = await probeClientHealth(['https://lambat.test'], {
      fetchImpl: slowFetch,
      timeoutMs: 5,
    });

    expect(result.online).toBe(false);
    expect(result.answeredBy).toBeNull();
    expect(HEALTH_PROBE_TIMEOUT_MS).toBe(12_000);
  });
});
