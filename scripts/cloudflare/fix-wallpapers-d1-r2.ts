import fs from 'fs';
import path from 'path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

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

async function main() {
  console.log('--- 1. Uploading wallpapers to R2 ---');
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${acc}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: r2Key,
      secretAccessKey: r2Secret,
    },
  });

  // Catatan (2026-09-28): `1771963001387…` & `1771963212220…` dibuang dari daftar —
  // file lokalnya sudah dihapus dan objek R2-nya (foto orang) sudah dihapus oleh
  // `fix-wallpaper-statics.ts`. Isi wallpaper statis kini frame "Veil of Thorns".
  const wallpapersToUpload = [
    { file: 'optimized-wallpaper.webp', key: 'assets/wallpapers/optimized-wallpaper.webp', mime: 'image/webp' },
    { file: 'optimized-wallpaper.png', key: 'assets/wallpapers/optimized-wallpaper.png', mime: 'image/png' },
  ];

  for (const item of wallpapersToUpload) {
    const localPath = path.join('public/wallpapers', item.file);
    if (fs.existsSync(localPath)) {
      const body = fs.readFileSync(localPath);
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: item.key,
          Body: body,
          ContentType: item.mime,
          CacheControl: 'public, max-age=31536000, immutable',
        })
      );
      console.log(`Uploaded ${item.key} (${body.length} bytes)`);
    }
  }

  console.log('--- 2. Updating D1 app_kv wallpaperConfig ---');
  const d1Query = async (sql: string, params: any[] = []) => {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acc}/d1/database/${db}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql, params })
    });
    return res.json() as Promise<any>;
  };

  const getRes = await d1Query("SELECT key, value FROM app_kv WHERE key IN ('content_default-site', 'content')");
  for (const row of getRes.result[0].results) {
    const content = JSON.parse(row.value);
    const existingCollection = content.about?.wallpaperConfig?.collection || [];

    // Nama + url mengikuti kondisi D1 (lihat `fix-wallpaper-statics.ts`):
    // isinya frame video "Veil of Thorns", `?v=2` untuk bust cache immutable R2.
    const defaultWallpapers = [
      {
        id: 'w-default-optimized-wallpaper-webp',
        name: 'Veil of Thorns (Statis)',
        url: '/r2/assets/wallpapers/optimized-wallpaper.webp?v=2',
        type: 'image'
      },
      {
        id: 'w-default-optimized-wallpaper-png',
        name: 'Veil of Thorns (Statis, PNG)',
        url: '/r2/assets/wallpapers/optimized-wallpaper.png?v=2',
        type: 'image'
      }
    ];

    const filteredCollection = existingCollection.filter(
      (w: any) => !defaultWallpapers.some((dw) => dw.id === w.id)
    );

    const newCollection = [...defaultWallpapers, ...filteredCollection];

    // Guard rerun (2026-09-28): jangan reset pilihan wallpaper aktif & blur
    // customer — hanya isi default kalau belum ada. (Sebelumnya hardcode
    // activeWallpaperId → wallpaper aktif balik ke gambar statis saat rerun.)
    const prevConfig = content.about.wallpaperConfig || {};
    content.about = content.about || {};
    content.about.wallpaperConfig = {
      ...prevConfig,
      activeWallpaperId: prevConfig.activeWallpaperId || 'w-default-optimized-wallpaper-webp',
      collection: newCollection,
      blur: prevConfig.blur ?? 0
    };

    const updateRes = await d1Query(
      "UPDATE app_kv SET value = ? WHERE key = ?",
      [JSON.stringify(content), row.key]
    );
    console.log(`Updated ${row.key}:`, updateRes.success ? 'SUCCESS' : 'FAILED');
  }

  console.log('All Done!');
}

main().catch(console.error);
