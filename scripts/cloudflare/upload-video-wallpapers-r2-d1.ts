import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
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
  console.log('--- 1. Generating poster image ---');
  const posterBuffer = await sharp('public/wallpapers/optimized-wallpaper.png')
    .resize(1920, 1080, { fit: 'cover' })
    .jpeg({ quality: 80 })
    .toBuffer();

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${acc}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: r2Key,
      secretAccessKey: r2Secret,
    },
  });

  const videosToUpload = [
    {
      source: 'C:\\Users\\USER\\Downloads\\hunt-showdown-veil-of-thorns.3840x2160.mp4',
      key: 'assets/wallpapers/1780744973336-hunt-showdown-veil-of-thorns-3840x2160.mp4',
      posterKey: 'assets/wallpapers/1780744973336-hunt-showdown-veil-of-thorns-3840x2160.jpg',
    },
    {
      source: 'C:\\Users\\USER\\Downloads\\Zen-Kois-wallpaper-50s-upload-safe.mp4',
      key: 'assets/wallpapers/1780767617527-zen-kois-wallpaper-50s-upload-safe.mp4',
      posterKey: 'assets/wallpapers/1780767617527-zen-kois-wallpaper-50s-upload-safe.jpg',
    },
    {
      source: 'C:\\Users\\USER\\Downloads\\UNDUH\\pink-bloom-field-clear-sky-live-wallpaper-wallsflow-com.mp4',
      key: 'assets/wallpapers/1779992198762-pink-bloom-field-clear-sky-live-wallpaper-wallsflow-com.mp4',
      posterKey: 'assets/wallpapers/1779992198762-pink-bloom-field-clear-sky-live-wallpaper-wallsflow-com.jpg',
    },
    {
      source: 'C:\\Users\\USER\\Downloads\\UNDUH\\sachiro-dark-nights.3840x2160.mp4',
      key: 'assets/wallpapers/1780086176924-sachiro-dark-nights-3840x2160.mp4',
      posterKey: 'assets/wallpapers/1780086176924-sachiro-dark-nights-3840x2160.jpg',
    }
  ];

  for (const item of videosToUpload) {
    if (fs.existsSync(item.source)) {
      console.log(`Reading ${item.source} ...`);
      const body = fs.readFileSync(item.source);
      console.log(`Uploading ${item.key} (${(body.length / (1024 * 1024)).toFixed(2)} MB) to R2...`);
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: item.key,
          Body: body,
          ContentType: 'video/mp4',
          CacheControl: 'public, max-age=31536000, immutable',
        })
      );
      console.log(`Uploaded ${item.key}`);

      // Also upload poster
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: item.posterKey,
          Body: posterBuffer,
          ContentType: 'image/jpeg',
          CacheControl: 'public, max-age=31536000, immutable',
        })
      );
      console.log(`Uploaded poster ${item.posterKey}`);
    } else {
      console.warn(`File not found: ${item.source}`);
    }
  }

  console.log('--- 2. Updating D1 database with active video wallpaper ---');
  const d1Query = async (sql: string, params: any[] = []) => {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acc}/d1/database/${db}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql, params })
    });
    return res.json();
  };

  const rows = ['content_default-site', 'content'];
  for (const rowKey of rows) {
    const fetchRes = await d1Query(`SELECT value FROM app_kv WHERE key = ?`, [rowKey]);
    if (fetchRes.result?.[0]?.results?.[0]?.value) {
      const data = JSON.parse(fetchRes.result[0].results[0].value);
      if (!data.about) data.about = {};
      
      const newCollection = [
        {
          id: 'w-1780744973336-veil-thorns',
          url: '/r2/assets/wallpapers/1780744973336-hunt-showdown-veil-of-thorns-3840x2160.mp4',
          name: 'Hunt Showdown Veil of Thorns',
          type: 'video',
          posterUrl: '/r2/assets/wallpapers/1780744973336-hunt-showdown-veil-of-thorns-3840x2160.jpg'
        },
        {
          id: 'w-1780767617527-zen-kois',
          url: '/r2/assets/wallpapers/1780767617527-zen-kois-wallpaper-50s-upload-safe.mp4',
          name: 'Zen Kois Live Wallpaper',
          type: 'video',
          posterUrl: '/r2/assets/wallpapers/1780767617527-zen-kois-wallpaper-50s-upload-safe.jpg'
        },
        {
          id: 'w-1779992198762-pink-bloom',
          url: '/r2/assets/wallpapers/1779992198762-pink-bloom-field-clear-sky-live-wallpaper-wallsflow-com.mp4',
          name: 'Pink Bloom Field Clear Sky',
          type: 'video',
          posterUrl: '/r2/assets/wallpapers/1779992198762-pink-bloom-field-clear-sky-live-wallpaper-wallsflow-com.jpg'
        },
        {
          id: 'w-1780086176924-sachiro',
          url: '/r2/assets/wallpapers/1780086176924-sachiro-dark-nights-3840x2160.mp4',
          name: 'Sachiro Dark Nights',
          type: 'video',
          posterUrl: '/r2/assets/wallpapers/1780086176924-sachiro-dark-nights-3840x2160.jpg'
        },
        {
          id: 'w-default-optimized-wallpaper-webp',
          name: 'macOS Monterey Gradient',
          url: '/r2/assets/wallpapers/optimized-wallpaper.webp',
          type: 'image'
        },
        {
          id: 'w-default-optimized-wallpaper-png',
          name: 'macOS Monterey High-Res',
          url: '/r2/assets/wallpapers/optimized-wallpaper.png',
          type: 'image'
        }
      ];

      data.about.wallpaperConfig = {
        activeWallpaperId: 'w-1780744973336-veil-thorns',
        collection: newCollection,
        blur: data.about.wallpaperConfig?.blur ?? 0
      };

      await d1Query(`UPDATE app_kv SET value = ? WHERE key = ?`, [JSON.stringify(data), rowKey]);
      console.log(`Updated ${rowKey} in D1 with active wallpaper: w-1780744973336-veil-thorns`);
    }
  }

  console.log('--- Done ---');
}

main().catch(console.error);
