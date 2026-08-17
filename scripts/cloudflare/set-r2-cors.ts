#!/usr/bin/env tsx
/**
 * Apply the CORS rules required for direct browser → R2 uploads.
 *
 * The admin "Upload video wallpaper" flow now signs a PUT URL via
 * `/api/upload/presign` and the browser uploads the file straight to R2.
 * That request must be allow-listed by the bucket's CORS policy or the
 * browser will refuse to send it (and the upload will appear to "hang"
 * before failing with a network error).
 *
 * Run:
 *   npx tsx scripts/cloudflare/set-r2-cors.ts
 *   npx tsx scripts/cloudflare/set-r2-cors.ts --origins=https://example.com,https://admin.example.com
 *
 * Reads credentials from .env.local (Next.js convention) with .env as fallback.
 */

import { config as loadEnv } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { PutBucketCorsCommand, GetBucketCorsCommand, S3Client } from '@aws-sdk/client-s3';
import { requireProductCloudflareEnvConfirmed } from './product-env';

// Match Next.js loading order: .env.local overrides .env. Both are optional.
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

function parseOriginsArg(): string[] {
  const arg = process.argv.find((a) => a.startsWith('--origins='));
  if (!arg) return [];
  return arg
    .slice('--origins='.length)
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

async function main() {
  requireProductCloudflareEnvConfirmed('apply R2 CORS policy');

  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (!process.env.CLOUDFLARE_R2_ACCOUNT_ID && !process.env.CLOUDFLARE_ACCOUNT_ID) {
    missing.unshift('CLOUDFLARE_ACCOUNT_ID');
  }
  if (missing.length > 0) {
    console.error(`Missing env: ${missing.join(', ')}`);
    process.exit(1);
  }

  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID!;
  const bucket = process.env.CLOUDFLARE_R2_BUCKET!;
  const customOrigins = parseOriginsArg();

  const allowedOrigins =
    customOrigins.length > 0
      ? customOrigins
      : [
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'http://localhost:3100',
          // Add the configured app/site origin when available.
          ...(process.env.NEXT_PUBLIC_APP_URL ? [process.env.NEXT_PUBLIC_APP_URL] : []),
          ...(process.env.NEXT_PUBLIC_SITE_URL ? [process.env.NEXT_PUBLIC_SITE_URL] : []),
        ];

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
    },
  });

  console.log(`Setting CORS on bucket "${bucket}"...`);
  console.log(`Allowed origins:`);
  allowedOrigins.forEach((o) => console.log(`  - ${o}`));

  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: allowedOrigins,
            AllowedMethods: ['PUT', 'GET', 'HEAD'],
            AllowedHeaders: [
              'Content-Type',
              'Cache-Control',
              'x-amz-acl',
              'x-amz-content-sha256',
              'x-amz-date',
              'authorization',
            ],
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    })
  );

  console.log('CORS applied. Verifying...');
  const verify = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
  console.log(JSON.stringify(verify.CORSRules, null, 2));
  console.log('Done. Direct browser uploads should now work.');
}

main().catch((err) => {
  console.error('Failed to set CORS:', err);
  process.exit(1);
});
