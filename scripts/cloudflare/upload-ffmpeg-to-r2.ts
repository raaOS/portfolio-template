#!/usr/bin/env tsx
/**
 * Upload local FFmpeg WASM assets to R2 bucket keys `ffmpeg/*`.
 *
 * Run:
 *   npm run r2:upload-ffmpeg
 */

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

const envFiles = ['.env.local', '.env'];
for (const file of envFiles) {
  const p = path.resolve(process.cwd(), file);
  if (fs.existsSync(p)) {
    loadEnv({ path: p, override: false });
  }
}

const REQUIRED_ENV = [
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
  'CLOUDFLARE_R2_BUCKET',
] as const;

async function main() {
  const missing: string[] = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (!process.env.CLOUDFLARE_R2_ACCOUNT_ID && !process.env.CLOUDFLARE_ACCOUNT_ID) {
    missing.unshift('CLOUDFLARE_ACCOUNT_ID');
  }

  if (missing.length > 0) {
    console.error(`Missing env: ${missing.join(', ')}`);
    process.exit(1);
  }

  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID!;
  const bucket = process.env.CLOUDFLARE_R2_BUCKET!;
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
    },
  });

  const filesToUpload = [
    { name: 'ffmpeg-core.js', mime: 'application/javascript' },
    { name: 'ffmpeg-core.wasm', mime: 'application/wasm' },
  ];

  console.log(`Starting upload of FFmpeg assets to R2 bucket "${bucket}"...`);

  for (const file of filesToUpload) {
    const localPath = path.resolve(process.cwd(), 'public/ffmpeg', file.name);
    if (!fs.existsSync(localPath)) {
      throw new Error(`Local file not found: ${localPath}`);
    }

    const key = `ffmpeg/${file.name}`;
    console.log(`Uploading ${file.name} to ${key} (${file.mime})...`);

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fs.createReadStream(localPath),
        ContentType: file.mime,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );

    console.log(`Uploaded ${file.name} successfully.`);
  }

  console.log('All FFmpeg assets uploaded successfully to Cloudflare R2 keys ffmpeg/*.');
}

main().catch((error) => {
  console.error('Failed to upload FFmpeg to R2:', error);
  process.exit(1);
});
