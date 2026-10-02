import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { getMissingD1EnvKeys, isD1Configured } from '../../src/lib/cloudflareD1';
import { getMissingR2EnvKeys, isR2StorageConfigured } from '../../src/lib/r2Storage';

export const PRODUCT_ENV_CONFIRM_KEY = 'PRODUCT_CLOUDFLARE_ENV_CONFIRMED';

const ENV_FILES = ['.env.local', '.env'];

const REQUIRED_PRODUCT_KEYS = [
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_D1_DATABASE_ID',
  'CLOUDFLARE_D1_API_TOKEN',
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
  'CLOUDFLARE_R2_BUCKET',
  'CLOUDFLARE_R2_PUBLIC_BASE_URL',
  'DATA_BACKEND',
  'NEXT_PUBLIC_DATA_BACKEND',
  'NEXT_PUBLIC_SITE_URL',
  'JWT_SECRET',
  'PASSWORD_SALT',
  'ADMIN_PASSWORD_SCRYPT',
  'NOTIFICATION_PROVIDER',
  'NOTIFICATION_API_KEY',
  'NOTIFICATION_DEFAULT_FROM',
] as const;

export function loadProductEnv() {
  const loaded: string[] = [];

  for (const file of ENV_FILES) {
    const resolved = path.resolve(process.cwd(), file);
    if (fs.existsSync(resolved)) {
      dotenv.config({ path: resolved, override: false, quiet: true });
      loaded.push(file);
    }
  }

  return loaded;
}

export function isProductCloudflareEnvConfirmed() {
  return process.env[PRODUCT_ENV_CONFIRM_KEY] === 'true';
}

export function requireProductCloudflareEnvConfirmed(action: string) {
  if (isProductCloudflareEnvConfirmed()) return;

  throw new Error(
    [
      `Refusing to ${action}.`,
      `${PRODUCT_ENV_CONFIRM_KEY}=true is required for live Cloudflare writes.`,
      'Set it only after .env.local points to the new product Cloudflare account.',
    ].join(' ')
  );
}

export function getProductEnvReport() {
  const keyRows = REQUIRED_PRODUCT_KEYS.map((key) => ({
    key,
    present: Boolean(process.env[key]),
  }));

  const missingRequired = keyRows.filter((row) => !row.present).map((row) => row.key);
  const backendIssues = [
    process.env.DATA_BACKEND !== 'cloudflare-d1' ? 'DATA_BACKEND=cloudflare-d1' : null,
    process.env.NEXT_PUBLIC_DATA_BACKEND !== 'cloudflare-d1'
      ? 'NEXT_PUBLIC_DATA_BACKEND=cloudflare-d1'
      : null,
  ].filter(Boolean) as string[];

  return {
    keyRows,
    missingRequired,
    backendIssues,
    d1Configured: isD1Configured(),
    r2Configured: isR2StorageConfigured(),
    d1Missing: getMissingD1EnvKeys(),
    r2Missing: getMissingR2EnvKeys(),
    confirmed: isProductCloudflareEnvConfirmed(),
  };
}

export function printProductEnvReport() {
  const report = getProductEnvReport();

  console.log('Product Cloudflare env doctor');
  console.log('Loaded values are not printed.');
  console.log('');
  console.log('Required keys:');
  for (const row of report.keyRows) {
    console.log(`- ${row.key}: ${row.present ? 'present' : 'missing'}`);
  }

  console.log('');
  console.log(`D1 configured: ${report.d1Configured ? 'yes' : 'no'}`);
  if (!report.d1Configured) console.log(`D1 missing: ${report.d1Missing.join(', ')}`);
  console.log(`R2 configured: ${report.r2Configured ? 'yes' : 'no'}`);
  if (!report.r2Configured) console.log(`R2 missing: ${report.r2Missing.join(', ')}`);
  console.log(
    `Live write guard: ${report.confirmed ? 'confirmed' : `${PRODUCT_ENV_CONFIRM_KEY} is not true`}`
  );

  if (report.backendIssues.length > 0) {
    console.log('');
    console.log(`Backend flag issues: ${report.backendIssues.join(', ')}`);
  }

  return report;
}
