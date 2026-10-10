#!/usr/bin/env node
/**
 * Cloudflare pre-deploy check.
 *
 * Verifies the template has the required Cloudflare/OpenNext deploy scaffold,
 * required product environment keys, and a non-blocking Workers compatibility
 * audit before running the real Cloudflare deployment command.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const envFile = ['.env.local', '.env'].find((file) => fs.existsSync(file));

if (envFile) {
  require('dotenv').config({ path: path.resolve(envFile) });
}

const requiredFiles = [
  'next.config.mjs',
  'open-next.config.ts',
  'wrangler.jsonc',
  'public/_headers',
  'package.json',
  'tsconfig.json',
];

const requiredScripts = ['cf:build', 'cf:preview', 'cf:deploy', 'cf:compat-audit', 'cf:doctor'];

const requiredEnvVars = [
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_DATA_BACKEND',
  'DATA_BACKEND',
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_D1_DATABASE_ID',
  'CLOUDFLARE_D1_API_TOKEN',
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
  'CLOUDFLARE_R2_BUCKET',
  'CLOUDFLARE_R2_PUBLIC_BASE_URL',
  'JWT_SECRET',
  'PASSWORD_SALT',
  'ADMIN_PASSWORD_SCRYPT',
  'REVALIDATION_TOKEN',
];

const forbiddenPersonalEnvVars = [
  'JOB_HUNTER_BOT_TOKEN',
  'JOB_HUNTER_CHAT_ID',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'GOOGLE_APPLICATION_CREDENTIALS',
];

function missingFiles(files) {
  return files.filter((file) => !fs.existsSync(file));
}

function readPackageJson() {
  const raw = fs.readFileSync('package.json', 'utf8');
  return JSON.parse(raw);
}

function assert(condition, message) {
  if (!condition) {
    console.error(`ERROR: ${message}`);
    process.exit(1);
  }
}

console.log('Running Cloudflare pre-deploy checks...\n');

console.log('Checking required files...');
const missingRequiredFiles = missingFiles(requiredFiles);
assert(
  missingRequiredFiles.length === 0,
  `Missing required files: ${missingRequiredFiles.join(', ')}`
);
console.log('OK required files present');

if (envFile) {
  console.log(`OK environment file loaded: ${envFile}`);
} else {
  console.warn('WARN no local env file found; using process.env only');
}

console.log('\nChecking package scripts...');
const packageJson = readPackageJson();
const missingScripts = requiredScripts.filter((name) => !packageJson.scripts?.[name]);
assert(missingScripts.length === 0, `Missing package scripts: ${missingScripts.join(', ')}`);
assert(
  packageJson.devDependencies?.['@opennextjs/cloudflare'],
  'Missing devDependency: @opennextjs/cloudflare'
);
assert(packageJson.devDependencies?.wrangler, 'Missing devDependency: wrangler');
console.log('OK Cloudflare scripts and dev dependencies present');

console.log('\nChecking Wrangler config...');
const wranglerConfig = fs.readFileSync('wrangler.jsonc', 'utf8');
assert(
  wranglerConfig.includes('.open-next/worker.js'),
  'wrangler.jsonc main must point to .open-next/worker.js'
);
assert(
  wranglerConfig.includes('nodejs_compat'),
  'wrangler.jsonc must enable nodejs_compat for Next.js compatibility'
);
console.log('OK Wrangler config targets OpenNext worker output');

console.log('\nChecking environment variables...');
const missingEnvVars = requiredEnvVars.filter((name) => !process.env[name]);
assert(missingEnvVars.length === 0, `Missing required env vars: ${missingEnvVars.join(', ')}`);
assert(
  process.env.PRODUCT_CLOUDFLARE_ENV_CONFIRMED === 'true',
  'PRODUCT_CLOUDFLARE_ENV_CONFIRMED must be "true" before deploy'
);
assert(
  process.env.DATA_BACKEND === 'cloudflare-d1',
  'DATA_BACKEND must be "cloudflare-d1" for product Cloudflare deploy'
);
assert(
  process.env.NEXT_PUBLIC_DATA_BACKEND === 'cloudflare-d1',
  'NEXT_PUBLIC_DATA_BACKEND must be "cloudflare-d1" for product Cloudflare deploy'
);
// Owner Mode (AGENTS.md §8): script ini HANYA dijalankan `npm run deploy`
// (site owner sendiri) — build klien memakai `npm run cf:build` langsung.
// Guard ini mencegah human error "kunci OWNER_MODE terhapus dari .env.local
// lalu deploy" yang akan menyembunyikan panel Harga Jual & Order & Pembayaran
// dari admin sendiri secara diam-diam (fail-closed by design, tanpa peringatan).
assert(
  process.env.OWNER_MODE === 'true' && process.env.NEXT_PUBLIC_OWNER_MODE === 'true',
  'OWNER_MODE & NEXT_PUBLIC_OWNER_MODE must both be "true" before deploying the owner site ' +
    '(otherwise "Harga Jual" & "Order & Pembayaran" vanish from your own admin). ' +
    'Add both keys="true" to .env.local — see .env.example "Deployment role" section.'
);
console.log('OK required environment keys are present');

console.log('\nChecking forbidden personal/legacy env keys...');
const presentForbiddenEnvVars = forbiddenPersonalEnvVars.filter((name) => Boolean(process.env[name]));
assert(
  presentForbiddenEnvVars.length === 0,
  `Remove forbidden personal/legacy env vars before deploy: ${presentForbiddenEnvVars.join(', ')}`
);
console.log('OK no known personal/legacy env keys are set');

console.log('\nRunning Workers compatibility audit...');
execSync('npm run cf:compat-audit -- --strict', { stdio: 'inherit' });

console.log('\nAll Cloudflare pre-deploy checks passed.');
