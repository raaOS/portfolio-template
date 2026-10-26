import { describe, expect, it, vi } from 'vitest';
import { verifyAppKvWritable } from './app-kv-preflight';

function makeQuery(columns: string[], options: { failInsert?: boolean } = {}) {
  const calls: Array<{ sql: string; params?: Array<string | number | null> }> = [];
  const query = vi.fn(async (sql: string, params?: Array<string | number | null>) => {
    calls.push({ sql, params });
    if (sql.startsWith('PRAGMA table_info(app_kv)')) {
      return columns.map((name) => ({ name }));
    }
    if (sql.includes('INSERT INTO app_kv') && options.failInsert) {
      throw new Error('NOT NULL constraint failed: app_kv.id');
    }
    if (sql.startsWith('SELECT value FROM app_kv')) {
      return [{ value: '{}' }];
    }
    return [];
  });
  return { query, calls };
}

describe('verifyAppKvWritable', () => {
  it('menulis dengan kolom id saat tabel memakai skema bersama', async () => {
    const { query, calls } = makeQuery(['id', 'key', 'value', 'created_at', 'updated_at']);

    await verifyAppKvWritable(query);

    const inserts = calls.filter((call) => call.sql.includes('INSERT INTO app_kv'));
    expect(inserts).toHaveLength(2);
    expect(inserts[0]?.sql).toContain('(id, key, value, updated_at)');
    expect(inserts[1]?.sql).toContain('(id, key, value, updated_at)');
    expect(calls.some((call) => call.sql.startsWith('DELETE FROM app_kv'))).toBe(true);
  });

  it('memakai bentuk runtime saat tidak ada kolom id', async () => {
    const { query, calls } = makeQuery(['key', 'value', 'updated_at']);

    await verifyAppKvWritable(query);

    const inserts = calls.filter((call) => call.sql.includes('INSERT INTO app_kv'));
    expect(inserts[0]?.sql).toContain('(key, value, updated_at)');
    expect(inserts[0]?.sql).not.toContain('(id, key');
  });

  it('melempar pesan jelas dan tetap membersihkan baris uji saat tulis gagal', async () => {
    const { query, calls } = makeQuery(['id', 'key', 'value', 'updated_at'], {
      failInsert: true,
    });

    await expect(verifyAppKvWritable(query)).rejects.toThrow(/tidak bisa menulis ke app_kv/i);
    expect(calls.some((call) => call.sql.startsWith('DELETE FROM app_kv'))).toBe(true);
  });

  it('melempar error saat tabel app_kv tidak ada', async () => {
    const { query } = makeQuery([]);

    await expect(verifyAppKvWritable(query)).rejects.toThrow(/tabel app_kv tidak ditemukan/i);
  });
});
