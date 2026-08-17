#!/usr/bin/env tsx
/**
 * Production readiness smoke check for the full Cloudflare product target.
 *
 * This script is read-only against Cloudflare. It never prints secret values.
 */

import fs from 'fs';
import path from 'path';
import { D1_SCHEMA_QUERIES } from '../../src/lib/d1-schema';
import { queryD1 } from '../../src/lib/cloudflareD1';
import { headR2Object } from '../../src/lib/r2Storage';
import {
  loadProductEnv,
  printProductEnvReport,
  requireProductCloudflareEnvConfirmed,
} from './product-env';

loadProductEnv();

type CheckStatus = 'pass' | 'fail';

type CheckResult = {
  status: CheckStatus;
  label: string;
  detail?: string;
};

type WranglerConfig = {
  r2_buckets?: Array<{
    binding?: string;
    bucket_name?: string;
  }>;
};

const REQUIRED_FFMPEG_KEYS = ['ffmpeg/ffmpeg-core.js', 'ffmpeg/ffmpeg-core.wasm'] as const;
const REQUIRED_FFMPEG_LOCAL_FILES = ['ffmpeg-core.js', 'ffmpeg-core.wasm'] as const;
const PLAN_INTEGER_KEYS = [
  'PLAN_LITE_PROJECT_LIMIT',
  'PLAN_LITE_STORAGE_MB',
  'PLAN_LITE_MEDIA_PER_PROJECT',
  'PLAN_PRO_PROJECT_LIMIT',
  'PLAN_PRO_STORAGE_MB',
  'PLAN_PRO_MEDIA_PER_PROJECT',
] as const;

const results: CheckResult[] = [];

function record(status: CheckStatus, label: string, detail?: string) {
  results.push({ status, label, detail });
}

function pass(label: string, detail?: string) {
  record('pass', label, detail);
}

function fail(label: string, detail?: string) {
  record('fail', label, detail);
}

function stripJsonComments(input: string) {
  return input
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1');
}

function readWranglerConfig(): WranglerConfig | null {
  const file = path.resolve(process.cwd(), 'wrangler.jsonc');
  if (!fs.existsSync(file)) return null;
  return JSON.parse(stripJsonComments(fs.readFileSync(file, 'utf8'))) as WranglerConfig;
}

function readPositiveInteger(name: (typeof PLAN_INTEGER_KEYS)[number]) {
  const value = Number(process.env[name]);
  if (!Number.isInteger(value) || value < 0) {
    fail(`${name} is a valid integer`, 'Set a non-negative integer in .env.local.');
    return null;
  }

  pass(`${name} is a valid integer`);
  return value;
}

function expectedD1Tables() {
  const relationalTables = D1_SCHEMA_QUERIES.flatMap((sql) => {
    const match = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([a-zA-Z0-9_]+)/i.exec(sql);
    return match?.[1] ? [match[1]] : [];
  });

  return ['app_kv', ...relationalTables];
}

function isNotFoundError(error: unknown) {
  const candidate = error as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };

  return (
    candidate.name === 'NotFound' ||
    candidate.name === 'NoSuchKey' ||
    candidate.Code === 'NoSuchKey' ||
    candidate.$metadata?.httpStatusCode === 404
  );
}

function checkPlanQuotas() {
  const values = Object.fromEntries(
    PLAN_INTEGER_KEYS.map((key) => [key, readPositiveInteger(key)])
  ) as Record<(typeof PLAN_INTEGER_KEYS)[number], number | null>;

  if (
    values.PLAN_LITE_PROJECT_LIMIT !== null &&
    values.PLAN_PRO_PROJECT_LIMIT !== null &&
    values.PLAN_PRO_PROJECT_LIMIT < values.PLAN_LITE_PROJECT_LIMIT
  ) {
    fail('Pro project quota is not lower than Lite quota');
  } else {
    pass('Pro project quota is not lower than Lite quota');
  }

  if (
    values.PLAN_LITE_STORAGE_MB !== null &&
    values.PLAN_PRO_STORAGE_MB !== null &&
    values.PLAN_PRO_STORAGE_MB < values.PLAN_LITE_STORAGE_MB
  ) {
    fail('Pro storage quota is not lower than Lite quota');
  } else {
    pass('Pro storage quota is not lower than Lite quota');
  }

  if (
    values.PLAN_LITE_MEDIA_PER_PROJECT !== null &&
    values.PLAN_PRO_MEDIA_PER_PROJECT !== null &&
    values.PLAN_PRO_MEDIA_PER_PROJECT < values.PLAN_LITE_MEDIA_PER_PROJECT
  ) {
    fail('Pro media-per-project quota is not lower than Lite quota');
  } else {
    pass('Pro media-per-project quota is not lower than Lite quota');
  }
}

function checkFfmpegLocalFiles() {
  for (const fileName of REQUIRED_FFMPEG_LOCAL_FILES) {
    const localPath = path.resolve(process.cwd(), 'public', 'ffmpeg', fileName);
    if (fs.existsSync(localPath)) {
      pass(`Local FFmpeg asset exists: ${fileName}`);
    } else {
      fail(`Local FFmpeg asset exists: ${fileName}`, 'Run npm install or restore public/ffmpeg.');
    }
  }
}

function checkFfmpegBaseUrl() {
  const value = process.env.NEXT_PUBLIC_FFMPEG_BASE_URL?.replace(/\/+$/, '');
  if (!value) {
    fail(
      'NEXT_PUBLIC_FFMPEG_BASE_URL is set',
      'Set NEXT_PUBLIC_FFMPEG_BASE_URL=/r2/ffmpeg for the Cloudflare build.'
    );
    return;
  }

  if (value === '/ffmpeg') {
    fail(
      'NEXT_PUBLIC_FFMPEG_BASE_URL points outside removed Worker assets',
      'Use /r2/ffmpeg because public/ffmpeg is removed from Worker assets.'
    );
    return;
  }

  pass('NEXT_PUBLIC_FFMPEG_BASE_URL is production-safe');
}

function checkClientPasswordReset() {
  const resetEnabled = process.env.FEATURE_CLIENT_PASSWORD_RESET !== 'false';
  if (!resetEnabled) {
    fail(
      'Client password reset is enabled',
      'Set FEATURE_CLIENT_PASSWORD_RESET=true for sale-ready production.'
    );
    return;
  }

  pass('Client password reset is enabled');

  const ttl = Number(process.env.CLIENT_PASSWORD_RESET_TOKEN_TTL_MINUTES);
  if (!Number.isInteger(ttl) || ttl < 5 || ttl > 120) {
    fail(
      'Client password reset TTL is valid',
      'Set CLIENT_PASSWORD_RESET_TOKEN_TTL_MINUTES between 5 and 120.'
    );
  } else {
    pass('Client password reset TTL is valid');
  }

  const provider = process.env.NOTIFICATION_PROVIDER?.trim().toLowerCase() || '';
  if (provider === 'resend') {
    pass('Client password reset email provider is supported');
  } else {
    fail(
      'Client password reset email provider is supported',
      'Set NOTIFICATION_PROVIDER=resend.'
    );
  }

  if (process.env.NOTIFICATION_API_KEY?.trim()) {
    pass('Client password reset email API key is configured');
  } else {
    fail('Client password reset email API key is configured');
  }

  if (process.env.NOTIFICATION_DEFAULT_FROM?.trim()) {
    pass('Client password reset email sender is configured');
  } else {
    fail('Client password reset email sender is configured');
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || '';
  if (!siteUrl) {
    fail('NEXT_PUBLIC_SITE_URL is configured for reset links');
    return;
  }

  try {
    const parsed = new URL(siteUrl);
    const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
    if (parsed.protocol !== 'https:' || isLocalhost) {
      fail(
        'NEXT_PUBLIC_SITE_URL is production-safe',
        'Use an https production URL, not localhost.'
      );
    } else {
      pass('NEXT_PUBLIC_SITE_URL is production-safe');
    }
  } catch {
    fail('NEXT_PUBLIC_SITE_URL is production-safe', 'Set a valid https URL.');
  }
}

function checkWranglerR2Binding() {
  const config = readWranglerConfig();
  if (!config) {
    fail('wrangler.jsonc exists');
    return;
  }

  pass('wrangler.jsonc exists');

  const bindingName = process.env.CLOUDFLARE_R2_BINDING || 'MEDIA_BUCKET';
  const bucket = config.r2_buckets?.find((entry) => entry.binding === bindingName);
  if (!bucket) {
    fail(
      `Wrangler R2 binding ${bindingName} exists`,
      'Add the binding to wrangler.jsonc or align CLOUDFLARE_R2_BINDING.'
    );
    return;
  }

  pass(`Wrangler R2 binding ${bindingName} exists`);

  const envBucket = process.env.CLOUDFLARE_R2_BUCKET;
  if (envBucket && bucket.bucket_name !== envBucket) {
    fail(
      'Wrangler R2 bucket matches CLOUDFLARE_R2_BUCKET',
      'Align wrangler.jsonc bucket_name with .env.local before deploy.'
    );
    return;
  }

  pass('Wrangler R2 bucket matches CLOUDFLARE_R2_BUCKET');
}

async function checkD1Schema() {
  requireProductCloudflareEnvConfirmed('run production readiness D1 schema check');

  const rows = await queryD1<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table'"
  );
  const existing = new Set(rows.map((row) => row.name));
  const missing = expectedD1Tables().filter((table) => !existing.has(table));

  if (missing.length > 0) {
    fail('D1 schema has all required product tables', `Missing: ${missing.join(', ')}`);
    return;
  }

  pass('D1 schema has all required product tables');
}

async function checkR2FfmpegObjects() {
  requireProductCloudflareEnvConfirmed('run production readiness R2 FFmpeg check');

  for (const key of REQUIRED_FFMPEG_KEYS) {
    try {
      await headR2Object(key);
      pass(`R2 FFmpeg asset exists: ${key}`);
    } catch (error) {
      if (isNotFoundError(error)) {
        fail(`R2 FFmpeg asset exists: ${key}`, 'Run npm run r2:upload-ffmpeg.');
        continue;
      }

      throw error;
    }
  }
}

function printResults() {
  console.log('');
  console.log('Production readiness checks');
  for (const result of results) {
    const prefix = result.status === 'pass' ? '[pass]' : '[fail]';
    console.log(`${prefix} ${result.label}${result.detail ? ` - ${result.detail}` : ''}`);
  }

  const failures = results.filter((result) => result.status === 'fail');
  console.log('');
  console.log(`Summary: ${results.length - failures.length}/${results.length} checks passed.`);

  if (failures.length > 0) {
    throw new Error('Production readiness check failed.');
  }
}

async function main() {
  const report = printProductEnvReport();

  if (report.missingRequired.length > 0 || report.backendIssues.length > 0) {
    fail(
      'Product env required keys are complete',
      'Run npm run cf:doctor and fill missing keys first.'
    );
  } else {
    pass('Product env required keys are complete');
  }

  if (report.d1Configured) pass('D1 env is configured');
  else fail('D1 env is configured', `Missing: ${report.d1Missing.join(', ')}`);

  if (report.r2Configured) pass('R2 env is configured');
  else fail('R2 env is configured', `Missing: ${report.r2Missing.join(', ')}`);

  if (report.confirmed) pass('Live Cloudflare write guard is confirmed');
  else fail('Live Cloudflare write guard is confirmed', 'Set PRODUCT_CLOUDFLARE_ENV_CONFIRMED=true.');

  checkPlanQuotas();
  checkFfmpegLocalFiles();
  checkFfmpegBaseUrl();
  checkClientPasswordReset();
  checkWranglerR2Binding();

  if (report.missingRequired.length === 0 && report.backendIssues.length === 0 && report.confirmed) {
    await checkD1Schema();
    await checkR2FfmpegObjects();
  }

  printResults();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
