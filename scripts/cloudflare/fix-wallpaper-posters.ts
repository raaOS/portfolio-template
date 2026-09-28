/**
 * One-time fix (2026-09-28): semua poster JPG side-car untuk 4 wallpaper video
 * isinya SAMA (foto orang) karena script upload-video-wallpapers-r2-d1.ts
 * lama menghasilkan SATU posterBuffer dari public/wallpapers/optimized-wallpaper.png
 * lalu meng-upload buffer yang sama ke 4 key berbeda.
 *
 * Script ini meng-upload ulang poster yang benar (frame 0.5 detik tiap video,
 * di-capture via canvas browser) ke key YANG SAMA, lalu menambahkan `?v=2`
 * pada posterUrl di D1 supaya cache browser `immutable, max-age=31536000`
 * tidak menyimpan poster lama selama setahun.
 *
 * Pakai:
 *   npx tsx scripts/../<file ini>            # dry-run
 *   npx tsx <file ini> --apply               # eksekusi R2 + D1
 */
import fs from 'fs';
import path from 'path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const POSTER_DIR = 'C:/Users/USER/AppData/Local/Temp/opencode/posters2';
const CACHE_BUST = '?v=2';

const POSTERS: { local: string; key: string }[] = [
  {
    local: 'poster-hunt.jpg',
    key: 'assets/wallpapers/1780744973336-hunt-showdown-veil-of-thorns-3840x2160.jpg',
  },
  {
    local: 'poster-zen.jpg',
    key: 'assets/wallpapers/1780767617527-zen-kois-wallpaper-50s-upload-safe.jpg',
  },
  {
    local: 'poster-pink.jpg',
    key: 'assets/wallpapers/1779992198762-pink-bloom-field-clear-sky-live-wallpaper-wallsflow-com.jpg',
  },
  {
    local: 'poster-sachiro.jpg',
    key: 'assets/wallpapers/1780086176924-sachiro-dark-nights-3840x2160.jpg',
  },
];

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

  // ── 1. R2: upload poster baru ke key yang sama ────────────────────────
  if (apply) {
    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${acc}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: r2Key, secretAccessKey: r2Secret },
    });
    for (const p of POSTERS) {
      const file = path.join(POSTER_DIR, p.local);
      const body = fs.readFileSync(file);
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: p.key,
          Body: body,
          ContentType: 'image/jpeg',
          CacheControl: 'public, max-age=31536000, immutable',
        })
      );
      console.log(`R2 uploaded: ${p.key} (${body.length} bytes)`);
    }
  } else {
    for (const p of POSTERS) {
      const file = path.join(POSTER_DIR, p.local);
      console.log(`[dry-run] R2 ${p.key} <= ${p.local} (${fs.existsSync(file) ? fs.statSync(file).size : 'MISSING!'} bytes)`);
    }
  }

  // ── 2. D1: tambahkan cache-buster pada posterUrl ──────────────────────
  const keyNames = POSTERS.map((p) => p.key.split('/').pop());
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
      if (typeof w?.posterUrl !== 'string') continue;
      const name = w.posterUrl.split('/').pop()?.split('?')[0];
      if (!keyNames.includes(name)) continue;
      if (w.posterUrl.endsWith(CACHE_BUST)) continue;
      const base = w.posterUrl.split('?')[0];
      w.posterUrl = `${base}${CACHE_BUST}`;
      changed++;
      console.log(`  ${row.key}: posterUrl -> ${w.posterUrl}`);
    }

    if (changed === 0) {
      console.log(`  ${row.key}: tidak ada perubahan`);
      continue;
    }

    if (apply) {
      await d1Query(`UPDATE app_kv SET value = ? WHERE key = ?`, [JSON.stringify(data), row.key]);
      console.log(`  ${row.key}: UPDATE disimpan (${changed} entry)`);
    } else {
      console.log(`  ${row.key}: [dry-run] ${changed} entry akan di-update`);
    }
  }

  console.log('\nSelesai.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
