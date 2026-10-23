import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getCloudflareContextMock } = vi.hoisted(() => ({
  getCloudflareContextMock: vi.fn(),
}));

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: getCloudflareContextMock,
}));

import { queryD1 } from './cloudflareD1';

const originalAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const originalDatabaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
const originalApiToken = process.env.CLOUDFLARE_D1_API_TOKEN;

const fetchMock = vi.fn();

/**
 * Binding tiruan dengan bentuk persis yang dipanggil `queryD1`
 * (`prepare(sql).bind(...params).all()`). `bind` mengembalikan statement itu
 * sendiri supaya rantainya bisa disambung apa adanya.
 */
function makeBinding(allImpl: () => Promise<unknown>) {
  const statement = {
    bind: vi.fn(() => statement),
    all: vi.fn(allImpl),
  };
  return { prepare: vi.fn(() => statement), statement };
}

/** Respons REST sukses dengan bentuk yang dibaca `queryD1`. */
function restSuccess(rows: Array<Record<string, unknown>>) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ success: true, result: [{ success: true, results: rows }] }),
  };
}

describe('queryD1 — jalur binding D1', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acct-test';
    process.env.CLOUDFLARE_D1_DATABASE_ID = 'db-test';
    process.env.CLOUDFLARE_D1_API_TOKEN = 'token-test';
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    for (const [key, value] of [
      ['CLOUDFLARE_ACCOUNT_ID', originalAccountId],
      ['CLOUDFLARE_D1_DATABASE_ID', originalDatabaseId],
      ['CLOUDFLARE_D1_API_TOKEN', originalApiToken],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('sends the statement through the binding and never touches the REST API', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const binding = makeBinding(async () => ({ success: true, results: [{ key: 'a' }] }));
    getCloudflareContextMock.mockResolvedValue({ env: { DB: binding } });

    const rows = await queryD1<{ key: string }>('SELECT key FROM app_kv WHERE key = ?', ['a']);

    expect(rows).toEqual([{ key: 'a' }]);
    expect(binding.prepare).toHaveBeenCalledWith('SELECT key FROM app_kv WHERE key = ?');
    expect(binding.statement.bind).toHaveBeenCalledWith('a');
    // Ini inti manfaatnya: nol panggilan keluar = nol subrequest eksternal.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps using REST when no DB binding is present on the context', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    getCloudflareContextMock.mockResolvedValue({ env: { MEDIA_BUCKET: {} } });
    fetchMock.mockResolvedValue(restSuccess([{ key: 'b' }]));

    const rows = await queryD1('SELECT key FROM app_kv');

    expect(rows).toEqual([{ key: 'b' }]);
    expect(String(fetchMock.mock.calls[0][0])).toContain('api.cloudflare.com');
  });

  it('keeps using REST when the Cloudflare context cannot be resolved', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    getCloudflareContextMock.mockRejectedValue(new Error('no runtime context'));
    fetchMock.mockResolvedValue(restSuccess([]));

    await queryD1('SELECT 1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps using REST outside the production runtime', async () => {
    // Dev lokal, unit test, dan 23 script `tsx` tidak punya binding — jalur REST
    // lama harus tetap dipakai persis seperti sebelum perubahan ini.
    vi.stubEnv('NODE_ENV', 'test');
    getCloudflareContextMock.mockResolvedValue({ env: { DB: makeBinding(async () => ({})) } });
    fetchMock.mockResolvedValue(restSuccess([{ ok: 1 }]));

    await queryD1('SELECT 1');

    expect(getCloudflareContextMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // Dua test berikut mengunci aturan keselamatan paling penting di perubahan ini:
  // setelah pernyataan dilepas ke binding, kegagalan TIDAK boleh di-fallback ke
  // REST — karena pernyataan itu mungkin sudah dieksekusi, dan mengulanginya
  // berarti menulis dua kali.
  it('does not fall back to REST when the binding reports a SQL failure', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const binding = makeBinding(async () => ({
      success: false,
      error: 'UNIQUE constraint failed: app_kv.key',
    }));
    getCloudflareContextMock.mockResolvedValue({ env: { DB: binding } });

    await expect(queryD1('INSERT INTO app_kv VALUES (?)', ['x'])).rejects.toThrow(
      /Cloudflare D1 SQL failed: UNIQUE constraint failed/
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not fall back to REST when the binding itself throws', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const binding = makeBinding(async () => {
      throw new Error('subrequest gagal di tengah jalan');
    });
    getCloudflareContextMock.mockResolvedValue({ env: { DB: binding } });

    await expect(queryD1('UPDATE app_kv SET value = ?', ['v'])).rejects.toThrow(
      /Cloudflare D1 query failed: subrequest gagal di tengah jalan/
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns an empty array when the binding reports no rows', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    getCloudflareContextMock.mockResolvedValue({
      env: { DB: makeBinding(async () => ({ success: true })) },
    });

    await expect(queryD1('SELECT 1 FROM app_kv WHERE 1 = 0')).resolves.toEqual([]);
  });
});
