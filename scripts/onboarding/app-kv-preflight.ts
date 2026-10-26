/**
 * Preflight `app_kv` untuk onboarding (audit 2026-10-24, temuan K1).
 *
 * Database klien hasil onboarding memakai skema bersama (`id TEXT PRIMARY KEY`
 * + `key TEXT UNIQUE`), sedangkan database owner memakai bentuk runtime
 * (`key TEXT PRIMARY KEY`). Penulis aplikasi dulu hanya mengirim `key` sehingga
 * SEMUA tulis ke `app_kv` di database klien gagal — login (rate limit) dan
 * simpan konten ikut mati.
 *
 * Probe ini menulis, membaca kembali, lalu menghapus satu baris uji SEBELUM
 * deploy. Kalau gagal, provisioning berhenti lebih awal dengan pesan jelas,
 * bukan menyerahkan situs yang tidak bisa dipakai ke klien.
 */

type D1Query = (
  sql: string,
  params?: Array<string | number | null>
) => Promise<Array<Record<string, unknown>>>;

export async function verifyAppKvWritable(query: D1Query): Promise<void> {
  const probeKey = `__onboarding_probe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const columns = (await query('PRAGMA table_info(app_kv)')).map((row) => String(row.name));
    if (columns.length === 0) {
      throw new Error('tabel app_kv tidak ditemukan');
    }

    if (columns.includes('id')) {
      await query(
        `INSERT INTO app_kv (id, key, value, updated_at) VALUES (?, ?, ?, datetime('now'))`,
        [probeKey, probeKey, '{}']
      );
    } else {
      await query(
        `INSERT INTO app_kv (key, value, updated_at) VALUES (?, ?, datetime('now'))`,
        [probeKey, '{}']
      );
    }

    const rows = await query('SELECT value FROM app_kv WHERE key = ? LIMIT 1', [probeKey]);
    if (rows.length === 0) {
      throw new Error('baris uji tidak dapat dibaca kembali');
    }

    // Jalur tulis yang dipakai login & simpan konten adalah upsert.
    const hasId = columns.includes('id');
    await query(
      `INSERT INTO app_kv (${hasId ? 'id, key' : 'key'}, value, updated_at)
       VALUES (${hasId ? '?, ?' : '?'}, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      hasId ? [probeKey, probeKey, '{"updated":true}'] : [probeKey, '{"updated":true}']
    );
  } catch (err) {
    throw new Error(
      `Database klien tidak bisa menulis ke app_kv — situs akan gagal login & menyimpan konten. ` +
        `Detail: ${(err as Error).message}`
    );
  } finally {
    await query('DELETE FROM app_kv WHERE key = ?', [probeKey]).catch(() => {
      // Baris uji yatim tidak berbahaya; jangan menutupi error utama.
    });
  }
}
