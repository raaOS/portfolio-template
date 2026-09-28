/**
 * One-time fix (2026-09-28, lanjutan fix poster): dua entry wallpaper statis
 * di D1 ("macOS Monterey Gradient" / "macOS Monterey High-Res") menunjuk
 * objek R2 `optimized-wallpaper.{webp,png}` yang isinya foto orang, sama
 * seperti kasus poster di `fix-wallpaper-posters.ts`.
 *
 * Script ini:
 *   1. Upload ulang `public/wallpapers/optimized-wallpaper.{webp,png}`
 *      (kini berisi frame video "Veil of Thorns" — wallpaper aktif) ke
 *      key R2 YANG SAMA.
 *   2. Rename kedua entry di D1 agar sesuai isi + menambahkan `?v=2`
 *      pada `url` supaya cache `immutable, max-age=31536000` tidak
 *      menyajikan foto orang selama setahun.
 *   3. Menghapus 2 objek orphan di R2 (`1771963001387…`, `1771963212220…`)
 *      yang sudah tidak direferensi D1 mana pun (file lokalnya juga sudah
 *      dihapus) — takutnya jadi foto orang yang tersisa di storage.
 *
 * Pakai:
 *   npx tsx scripts/cloudflare/fix-wallpaper-statics.ts          # dry-run
 *   npx tsx scripts/cloudflare/fix-wallpaper-statics.ts --apply  # eksekusi
 */
import fs from 'fs';
import path from 'path';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const STATIC_UPLOADS: { local: string; key: string; mime: string }[] = [
  { local: 'optimized-wallpaper.webp', key: 'assets/wallpapers/optimized-wallpaper.webp', mime: 'image/webp' },
  { local: 'optimized-wallpaper.png', key: 'assets/wallpapers/optimized-wallpaper.png', mime: 'image/png' },
];

/** Objek R2 foto orang yang sudah tidak direferensi D1 / file lokal. */
const ORPHAN_KEYS = [
  'assets/wallpapers/1771963001387-yfwye4hggmcu-wallaper.webp',
  'assets/wallpapers/1771963212220-fy3vb66wba5k-wallaper.webp',
];

/** id entry -> nama baru (isi: frame Veil of Thorns, wallpaper aktif). */
const RENAMES: Record<string, string> = {
  'w-default-optimized-wallpaper-webp': 'Veil of Thorns (Statis)',
  'w-default-optimized-wallpaper-png': 'Veil of Thorns (Statis, PNG)',
};

const CACHE_BUST = '?v=2';

const envContent = fs.readFileSync('.env.local', 'utf8');
const parseEnv = (key: string) => {
  const m = envContent.match(new RegExp(`^${key}=["']?([^"'\r\n]+)["']?`, 'm'));
  return m ? m[1] : '';
};

const acc = parseEnv('CLOUDFLARE_ACCOUNT_ID');
const db = parseEnv('CLOUDFLARE_D1_DATABASE_ID');
const token = parseEnv('CLOUDFLARE_D1_API_TOKEN');
const r2Key = parseEnv('CLOUDFLARE_R2_ACCESS_KEY_ID');
const r2Secret = parseEnv('CLOUDFLARE_R2_SECRET_ACCESS_KEY');
const bucket = parseEnv('CLOUDFLARE_R2_BUCKET');

const apply = process.argv.includes('--apply');

const d1Query = async (sql: string, params: unknown[] = []) => {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${acc}/d1/database/${db}/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params }),
    }
  );
  const json = (await res.json()) as { success?: boolean; errors?: unknown; result?: any };
  if (!json.success) throw new Error(`D1 query gagal: ${JSON.stringify(json.errors)}`);
  return json;
};

async function main() {
  console.log(`Mode: ${apply ? 'APPLY' : 'dry-run'}`);
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${acc}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: r2Key, secretAccessKey: r2Secret },
  });

  // ── 1. R2: upload ulang isi baru ke key yang sama ──────────────────────
  for (const u of STATIC_UPLOADS) {
    const file = path.join('public/wallpapers', u.local);
    const body = fs.readFileSync(file);
    if (apply) {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: u.key,
          Body: body,
          ContentType: u.mime,
          CacheControl: 'public, max-age=31536000, immutable',
        })
      );
      console.log(`R2 uploaded: ${u.key} (${body.length} bytes)`);
    } else {
      console.log(`[dry-run] R2 ${u.key} <= ${u.local} (${body.length} bytes)`);
    }
  }

  // ── 2. R2: hapus objek orphan foto orang ───────────────────────────────
  for (const key of ORPHAN_KEYS) {
    if (apply) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      console.log(`R2 deleted (orphan): ${key}`);
    } else {
      console.log(`[dry-run] R2 hapus ${key}`);
    }
  }

  // ── 3. D1: rename entry + cache-buster pada url ────────────────────────
  const rowsRes = await d1Query(`SELECT key, value FROM app_kv WHERE value LIKE ?`, [
    '%wallpaperConfig%',
  ]);
  const rows: { key: string; value: string }[] = rowsRes.result?.[0]?.results ?? [];
  console.log(`\nBaris app_kv berisi wallpaperConfig: ${rows.map((r) => r.key).join(', ') || '(tidak ada)'}`);

  for (const row of rows) {
    const data = JSON.parse(row.value);
    const collection = data?.about?.wallpaperConfig?.collection;
    if (!Array.isArray(collection)) continue;

    let changed = 0;
    for (const w of collection) {
      const newName = RENAMES[w.id];
      if (newName && w.name !== newName) {
        console.log(`  ${row.key}: [${w.id}] name "${w.name}" -> "${newName}"`);
        w.name = newName;
        changed++;
      }
      if (newName && typeof w.url === 'string' && !w.url.endsWith(CACHE_BUST)) {
        const base = w.url.split('?')[0];
        console.log(`  ${row.key}: [${w.id}] url -> ${base}${CACHE_BUST}`);
        w.url = `${base}${CACHE_BUST}`;
        changed++;
      }
    }

    if (changed === 0) {
      console.log(`  ${row.key}: tidak ada perubahan`);
      continue;
    }

    if (apply) {
      await d1Query(`UPDATE app_kv SET value = ? WHERE key = ?`, [JSON.stringify(data), row.key]);
      console.log(`  ${row.key}: UPDATE disimpan (${changed} perubahan)`);
    } else {
      console.log(`  ${row.key}: [dry-run] ${changed} perubahan akan disimpan`);
    }
  }

  console.log('\nSelesai.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
