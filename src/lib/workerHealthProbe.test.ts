import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getCloudflareContextMock, setD1ValueMock, getD1ValueMock } = vi.hoisted(() => ({
  getCloudflareContextMock: vi.fn(),
  setD1ValueMock: vi.fn(),
  getD1ValueMock: vi.fn(),
}));

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: getCloudflareContextMock,
}));

vi.mock('@/lib/cloudflareD1', () => ({
  setD1Value: setD1ValueMock,
  getD1Value: getD1ValueMock,
}));

import {
  PROBE_DEFAULT_CONCURRENCY,
  WORKER_HEALTH_HISTORY_KEY,
  WORKER_HEALTH_HISTORY_LIMIT,
  WORKER_HEALTH_KEY,
  probeWorkerHealth,
  recordWorkerHealth,
  type WorkerHealthResult,
} from './workerHealthProbe';

/** Body persis seperti yang dikirim Cloudflare untuk Error 1102. */
const ERROR_1102_BODY = 'error code: 1102';

function fakeResponse(status: number, body = ''): Response {
  return new Response(body, { status });
}

function fetchMock(): ReturnType<typeof vi.fn> {
  return globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
}

describe('probeWorkerHealth', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    // Bukan runtime Cloudflare (dev/unit test) -> probe jatuh ke jalur fetch publik.
    getCloudflareContextMock.mockRejectedValue(new Error('getCloudflareContext is not available'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it('reports passed when every request returns 200', async () => {
    fetchMock().mockResolvedValue(fakeResponse(200, '<html>ok</html>'));

    const result = await probeWorkerHealth({ concurrency: 4 });

    expect(result.concurrency).toBe(4);
    expect(result.ok).toBe(4);
    expect(result.failed).toBe(0);
    expect(result.failed1102).toBe(0);
    expect(result.timedOut).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.transport).toBe('public-url');
    expect(fetchMock()).toHaveBeenCalledTimes(4);
  });

  it('gives every request a unique query so each one is a genuine cold render', async () => {
    fetchMock().mockResolvedValue(fakeResponse(200, 'ok'));

    await probeWorkerHealth({ concurrency: 4 });

    const urls = fetchMock().mock.calls.map((call) => String(call[0]));
    expect(new Set(urls).size).toBe(4);
    for (const url of urls) {
      expect(url).toContain('/preview/spatial-gallery?probe=');
    }
  });

  it('flags Error 1102 separately from other failures', async () => {
    fetchMock()
      .mockResolvedValueOnce(fakeResponse(200, 'ok'))
      .mockResolvedValueOnce(fakeResponse(530, ERROR_1102_BODY));

    const result = await probeWorkerHealth({ concurrency: 2 });

    expect(result.ok).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.failed1102).toBe(1);
    expect(result.passed).toBe(false);
  });

  it('does not blame 1102 for an ordinary non-200 response', async () => {
    fetchMock()
      .mockResolvedValueOnce(fakeResponse(503, 'Service Unavailable'))
      .mockResolvedValueOnce(fakeResponse(502, 'Bad Gateway'));

    const result = await probeWorkerHealth({ concurrency: 2 });

    expect(result.ok).toBe(0);
    expect(result.failed).toBe(2);
    expect(result.failed1102).toBe(0);
    expect(result.passed).toBe(false);
  });

  it('counts requests that overrun the timeout as failures', async () => {
    // Fetch yang tidak pernah menjawab sampai sinyal abort dilepas — meniru
    // isolate yang membeku karena kehabisan CPU.
    fetchMock().mockImplementation(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('The operation was aborted');
            error.name = 'AbortError';
            reject(error);
          });
        })
    );

    const result = await probeWorkerHealth({ concurrency: 2, timeoutMs: 10 });

    expect(result.ok).toBe(0);
    expect(result.failed).toBe(2);
    expect(result.timedOut).toBe(2);
    expect(result.failed1102).toBe(0);
    expect(result.passed).toBe(false);
  }, 10_000);

  it('prefers the WORKER_SELF_REFERENCE service binding when it is available', async () => {
    const bindingFetch = vi.fn().mockResolvedValue(fakeResponse(200, 'ok'));
    getCloudflareContextMock.mockResolvedValue({
      env: { WORKER_SELF_REFERENCE: { fetch: bindingFetch } },
    });

    const result = await probeWorkerHealth({ concurrency: 3 });

    expect(result.transport).toBe('service-binding');
    expect(bindingFetch).toHaveBeenCalledTimes(3);
    expect(result.ok).toBe(3);
    expect(result.passed).toBe(true);
  });

  it('defaults to 32 probes — safely below the measured break point', async () => {
    fetchMock().mockResolvedValue(fakeResponse(200, 'ok'));

    const result = await probeWorkerHealth();

    expect(result.concurrency).toBe(PROBE_DEFAULT_CONCURRENCY);
    // Ambang patah terukur 2026-10-22: 48 bersih, 64 mulai ada 1102.
    expect(PROBE_DEFAULT_CONCURRENCY).toBeLessThan(50);
  });
});

describe('recordWorkerHealth', () => {
  const RESULT: WorkerHealthResult = {
    probedAt: '2026-10-23T18:00:00.000Z',
    slug: 'spatial-gallery',
    target: 'https://makeitbetter.my.id/preview/spatial-gallery',
    transport: 'service-binding',
    concurrency: 32,
    ok: 32,
    failed: 0,
    failed1102: 0,
    timedOut: 0,
    avgTtfbMs: 180,
    durationMs: 900,
    passed: true,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    setD1ValueMock.mockResolvedValue(undefined);
    getD1ValueMock.mockResolvedValue(null);
  });

  it('writes the latest result and starts a fresh history', async () => {
    await recordWorkerHealth(RESULT);

    expect(setD1ValueMock).toHaveBeenNthCalledWith(1, WORKER_HEALTH_KEY, RESULT);
    expect(setD1ValueMock).toHaveBeenNthCalledWith(2, WORKER_HEALTH_HISTORY_KEY, [RESULT]);
  });

  it('caps the history at the retention limit and keeps the newest entry', async () => {
    const existing = Array.from({ length: WORKER_HEALTH_HISTORY_LIMIT }, (_, i) => ({
      probedAt: `2026-10-1${i}T18:00:00.000Z`,
    }));
    getD1ValueMock.mockResolvedValue(existing);

    await recordWorkerHealth(RESULT);

    const history = setD1ValueMock.mock.calls[1][1] as WorkerHealthResult[];
    expect(history).toHaveLength(WORKER_HEALTH_HISTORY_LIMIT);
    expect(history[history.length - 1]).toEqual(RESULT);
    // Entri paling lama terbuang, sisanya bergeser ke depan.
    expect(history[0]).toEqual(existing[1]);
  });

  it('tolerates a corrupted history value instead of throwing', async () => {
    getD1ValueMock.mockResolvedValue('bukan-array');

    await recordWorkerHealth(RESULT);

    expect(setD1ValueMock).toHaveBeenNthCalledWith(2, WORKER_HEALTH_HISTORY_KEY, [RESULT]);
  });
});
