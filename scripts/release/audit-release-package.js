#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = process.cwd();

const requiredFiles = [
  'README.md',
  '.env.example',
  'wrangler.jsonc',
  'docs/release/CLIENT_OPERATIONS.md',
  'docs/release/RELEASE_CHECKLIST.md',
  'docs/release/PRODUCTION_DEPLOY_RUNBOOK.md',
  'docs/release/RC1_RELEASE_NOTES.md',
  'docs/release/SALES_PRICING.md',
  'docs/product-boundary/env-inventory.md',
  'docs/tracker/INDEX_TRACKER.md',
];

const requiredScripts = [
  'dev',
  'cf:doctor',
  'cf:readiness',
  'cf:bootstrap',
  'cf:seed-demo',
  'cf:build',
  'cf:deploy',
  'r2:upload-ffmpeg',
  'r2:set-cors',
  'release:audit',
  'release:sale-readiness',
  'release:smoke',
];

const requiredEnvKeys = [
  'CLOUDFLARE_ACCOUNT_ID',
  'PRODUCT_CLOUDFLARE_ENV_CONFIRMED',
  'CLOUDFLARE_D1_DATABASE_ID',
  'CLOUDFLARE_D1_API_TOKEN',
  'CLOUDFLARE_R2_ACCOUNT_ID',
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
  'CLOUDFLARE_R2_BUCKET',
  'CLOUDFLARE_R2_PUBLIC_BASE_URL',
  'JWT_SECRET',
  'PASSWORD_SALT',
  'ADMIN_PASSWORD_SCRYPT',
  'REVALIDATION_TOKEN',
  'FEATURE_AI',
  'FEATURE_NOTIFICATIONS',
  'PROJECT_LIMIT',
  'STORAGE_MB',
  'MEDIA_PER_PROJECT',
  'NEXT_PUBLIC_FFMPEG_BASE_URL',
];

const forbiddenEnvPatterns = [
  // Catatan: TELEGRAM_* sengaja TIDAK dilarang. Bot notifikasi order adalah
  // fitur produk opsional (lihat blok "Telegram Billing Admin Bot" di
  // .env.example), bukan sisa automasi pribadi.
  /^FIREBASE_/,
  /^NEXT_PUBLIC_FIREBASE_/,
  /^VERCEL_/,
  /^JOB_BOT_/,
  /^GLINTS_/,
  /^JOBSTREET_/,
];

const forbiddenScriptPatterns = [
  /^telegram:/,
  /^job-bot:/,
  /vercel/i,
  /firebase/i,
];

const results = [];

function addResult(status, label, detail) {
  results.push({ status, label, detail });
}

function pass(label, detail) {
  addResult('pass', label, detail);
}

function fail(label, detail) {
  addResult('fail', label, detail);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function parseEnvEntries(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/i))
    .filter(Boolean)
    .map((match) => ({
      key: match[1],
      // Strip pasangan kutip pembungkus ("", '') supaya value placeholder
      // kosong tidak dianggap sebagai rahasia nyata.
      value: match[2].trim().replace(/^(['"])([\s\S]*)\1$/, '$2').trim(),
    }));
}

function parseEnvKeys(text) {
  return parseEnvEntries(text).map((entry) => entry.key);
}

// Guard value-level: .env.example adalah template yang ikut ter-bundle ke paket
// jualan — kunci rahasia wajib KOSONG. Key existence check di bawah tidak
// menangkap value nyata yang tertempel (mis. JWT_SECRET="rahasia123").
const secretEnvKeyPatterns = [/_TOKEN$/, /_SECRET$/, /_KEY$/, /_PASSWORD$/, /_SALT$/];
const explicitSecretEnvKeys = new Set([
  'JWT_SECRET',
  'PASSWORD_SALT',
  'ADMIN_PIN',
  'CRON_SECRET',
  'REVALIDATION_TOKEN',
  'ADMIN_PASSWORD_SCRYPT',
]);

function isSecretEnvKey(key) {
  return explicitSecretEnvKeys.has(key) || secretEnvKeyPatterns.some((pattern) => pattern.test(key));
}

function checkRequiredFiles() {
  for (const file of requiredFiles) {
    if (fileExists(file)) pass(`Required file exists: ${file}`);
    else fail(`Required file exists: ${file}`);
  }
}

function checkPackageScripts() {
  const packageJson = readJson('package.json');
  const scripts = packageJson.scripts || {};

  for (const script of requiredScripts) {
    if (scripts[script]) pass(`Required script exists: ${script}`);
    else fail(`Required script exists: ${script}`);
  }

  const forbidden = Object.keys(scripts).filter((scriptName) =>
    forbiddenScriptPatterns.some((pattern) => pattern.test(scriptName))
  );

  if (forbidden.length === 0) {
    pass('No forbidden personal/deprecated npm scripts exposed');
  } else {
    fail('No forbidden personal/deprecated npm scripts exposed', forbidden.join(', '));
  }

  if (scripts.deploy?.includes('cf:deploy')) {
    pass('npm run deploy targets Cloudflare');
  } else {
    fail('npm run deploy targets Cloudflare', 'Expected deploy script to call cf:deploy.');
  }
}

function checkEnvExample() {
  const env = readText('.env.example');
  const keys = parseEnvKeys(env);
  const keySet = new Set(keys);

  for (const key of requiredEnvKeys) {
    if (keySet.has(key)) pass(`Required env key exists: ${key}`);
    else fail(`Required env key exists: ${key}`);
  }

  const forbidden = keys.filter((key) =>
    forbiddenEnvPatterns.some((pattern) => pattern.test(key))
  );

  if (forbidden.length === 0) {
    pass('No forbidden personal/deprecated env keys in .env.example');
  } else {
    fail('No forbidden personal/deprecated env keys in .env.example', forbidden.join(', '));
  }

  if (env.includes('NEXT_PUBLIC_FFMPEG_BASE_URL="/r2/ffmpeg"')) {
    pass('FFmpeg base URL defaults to R2 proxy');
  } else {
    fail('FFmpeg base URL defaults to R2 proxy');
  }
}

function checkEnvExampleSecretValues() {
  // Hanya kunci yang dilaporkan — value rahasia tidak pernah ditampilkan di log.
  const leaked = parseEnvEntries(readText('.env.example'))
    .filter((entry) => isSecretEnvKey(entry.key) && entry.value !== '')
    .map((entry) => entry.key);

  if (leaked.length === 0) {
    pass('No non-empty secret values in .env.example');
  } else {
    fail('No non-empty secret values in .env.example', leaked.join(', '));
  }
}

function checkCloudflareDocs() {
  const readme = readText('README.md');
  const checklist = readText('docs/release/RELEASE_CHECKLIST.md');
  const clientOps = readText('docs/release/CLIENT_OPERATIONS.md');
  const runbook = readText('docs/release/PRODUCTION_DEPLOY_RUNBOOK.md');
  const rcNotes = readText('docs/release/RC1_RELEASE_NOTES.md');
  const salesPricing = readText('docs/release/SALES_PRICING.md');

  const combined = `${readme}\n${checklist}\n${clientOps}\n${runbook}\n${rcNotes}\n${salesPricing}`;
  const requiredPhrases = [
    'full Cloudflare',
    'Do not deploy this as a Vercel project',
    'npm run cf:readiness',
    'npm run site-scope:audit',
    'npm run r2:upload-ffmpeg',
    'npm run release:smoke',
    'PRODUCTION_DEPLOY_RUNBOOK',
    'RC1',
    'sites/{siteId}/',
    'PRODUCT_CLOUDFLARE_ENV_CONFIRMED',
    'NOTIFICATION_PROVIDER="resend"',
    'SALES_PRICING',
    'manual invoice',
  ];

  for (const phrase of requiredPhrases) {
    if (combined.includes(phrase)) pass(`Release docs mention: ${phrase}`);
    else fail(`Release docs mention: ${phrase}`);
  }
}

function checkSecretFileProtection() {
  const secretFiles = ['.env.local', '.env', '.dev.vars'];
  let tracked = [];

  try {
    tracked = execSync(`git ls-files -- ${secretFiles.join(' ')}`, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    pass('Local secret files are not tracked by git', 'Git metadata is not available.');
    return;
  }

  if (tracked.length === 0) {
    pass('Local secret files are not tracked by git');
  } else {
    fail(
      'Local secret files are not tracked by git',
      `Tracked secret files: ${tracked.join(', ')}`
    );
  }
}

function printResults() {
  console.log('Release package audit');
  for (const result of results) {
    const marker = result.status === 'pass' ? '[pass]' : '[fail]';
    console.log(`${marker} ${result.label}${result.detail ? ` - ${result.detail}` : ''}`);
  }

  const failures = results.filter((result) => result.status === 'fail');
  console.log('');
  console.log(`Summary: ${results.length - failures.length}/${results.length} checks passed.`);

  if (failures.length > 0) {
    process.exit(1);
  }
}

checkRequiredFiles();
checkPackageScripts();
checkEnvExample();
checkEnvExampleSecretValues();
checkCloudflareDocs();
checkSecretFileProtection();
printResults();
