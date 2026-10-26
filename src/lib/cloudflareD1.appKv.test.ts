import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regresi audit 2026-10-24 (K1): penulis `app_kv` harus melayani DUA bentuk
 * tabel yang hidup di lapangan.
 *
 * - Runtime/`cf:bootstrap`: `key TEXT PRIMARY KEY`
 * - Portal onboarding (`SHARED_SCHEMA_QUERIES`): `id TEXT PRIMARY KEY` + `key UNIQUE`
 *
 * Sebelum perbaikan, tulis ke database klien hasil onboarding selalu gagal
 * `NOT NULL constraint failed: app_kv.id`, yang membuat login (rate limit) dan
 * seluruh simpan konten ikut gagal.
 */

const fetchMock = vi.fn();

function restSuccess(rows: Array<Record<string, unknown>> = []) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ success: true, result: [{ success: true, results: rows }] }),
  };
}

function sentQueries() {
  return fetchMock.mock.calls.map(([, init]) => {
    const body = JSON.parse(String((init as RequestInit).body)) as {
      sql: string;
      params: unknown[];
    };
    return body;
  });
}

function mockAppKvColumns(columns: string[]) {
  fetchMock.mockImplementation(async (_url, init) => {
    const { sql } = JSON.parse(String((init as RequestInit).body)) as { sql: string };
    if (sql.startsWith('PRAGMA table_info(app_kv)')) {
      return restSuccess(columns.map((name) => ({ name })));
    }
    if (sql.includes('RETURNING key')) {
      return restSuccess([{ key: 'row' }]);
    }
    return restSuccess();
  });
}

const SHARED_SCHEMA_COLUMNS = ['id', 'key', 'value', 'created_at', 'updated_at'];
const RUNTIME_COLUMNS = ['key', 'value', 'updated_at'];

describe('setD1Value — kompatibilitas dua bentuk tabel app_kv', () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'acct-test');
    vi.stubEnv('CLOUDFLARE_D1_DATABASE_ID', 'db-test');
    vi.stubEnv('CLOUDFLARE_D1_API_TOKEN', 'token-test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('mengisi kolom id saat tabel memakai skema bersama (portal onboarding)', async () => {
    mockAppKvColumns(SHARED_SCHEMA_COLUMNS);
    const { setD1Value } = await import('./cloudflareD1');

    await setD1Value('about', { headline: 'halo' });

    const insert = sentQueries().find((query) => query.sql.includes('INSERT INTO app_kv'));
    expect(insert).toBeDefined();
    expect(insert?.sql).toContain('(id, key, value, updated_at)');
    expect(insert?.params[0]).toBe('about');
    expect(insert?.params[1]).toBe('about');
  });

  it('tetap mengirim bentuk lama saat tabel tidak punya kolom id', async () => {
    mockAppKvColumns(RUNTIME_COLUMNS);
    const { setD1Value } = await import('./cloudflareD1');

    await setD1Value('about', { headline: 'halo' });

    const insert = sentQueries().find((query) => query.sql.includes('INSERT INTO app_kv'));
    expect(insert).toBeDefined();
    expect(insert?.sql).toContain('(key, value, updated_at)');
    expect(insert?.sql).not.toContain('(id, key');
    expect(insert?.params[0]).toBe('about');
  });

  it('compareAndSetD1Value ikut mengisi id pada insert pertama (jalur CAS login/rate limit)', async () => {
    mockAppKvColumns(SHARED_SCHEMA_COLUMNS);
    const { compareAndSetD1Value } = await import('./cloudflareD1');

    await compareAndSetD1Value('rateLimits', null, { a: 1 });

    const insert = sentQueries().find((query) => query.sql.includes('INSERT INTO app_kv'));
    expect(insert).toBeDefined();
    expect(insert?.sql).toContain('(id, key, value, updated_at)');
    expect(insert?.params[0]).toBe('rateLimits');
    expect(insert?.params[1]).toBe('rateLimits');
  });
});
