#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const results = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function add(status, label, detail) {
  results.push({ status, label, detail });
}

function pass(label, detail) {
  add('pass', label, detail);
}

function fail(label, detail) {
  add('fail', label, detail);
}

function checkFile(relativePath) {
  if (exists(relativePath)) pass(`File exists: ${relativePath}`);
  else fail(`File exists: ${relativePath}`);
}

function checkIncludes(relativePath, phrases) {
  const content = read(relativePath);
  for (const phrase of phrases) {
    if (content.includes(phrase)) pass(`${relativePath} mentions: ${phrase}`);
    else fail(`${relativePath} mentions: ${phrase}`);
  }
}

function listFiles(dir) {
  const absolute = path.join(root, dir);
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(relative);
    return [relative];
  });
}

function checkDemoDataHygiene() {
  const forbidden = [
    /telegram/i,
    /glints/i,
    /jobstreet/i,
    /firebase/i,
    /vercel/i,
    /m4keit/i,
    /bitlabs/i,
    /@gmail\.com/i,
    /api[_-]?key/i,
    /secret/i,
  ];

  const offenders = [];
  for (const file of listFiles('src/data')) {
    if (!/\.(json|ts|tsx|js|md)$/i.test(file)) continue;
    const content = read(file);
    for (const pattern of forbidden) {
      if (pattern.test(content)) offenders.push(`${file}: ${pattern}`);
    }
  }

  if (offenders.length === 0) {
    pass('Demo data has no known personal legacy markers');
  } else {
    fail('Demo data has no known personal legacy markers', offenders.join('; '));
  }
}

[
  'docs/release/BUYER_ONBOARDING.md',
  'docs/release/CLIENT_OPERATIONS.md',
  'docs/release/RELEASE_CHECKLIST.md',
  'docs/release/SALES_PRICING.md',
].forEach(checkFile);

checkIncludes('.env.example', ['NOTIFICATION_PROVIDER="resend"']);

checkIncludes('docs/release/CLIENT_OPERATIONS.md', ['NOTIFICATION_PROVIDER="resend"']);

checkIncludes('docs/release/SALES_PRICING.md', [
  'satu kali beli',
  'QRIS/transfer',
  'Add-on Quota',
  'PROJECT_LIMIT',
]);

checkIncludes('scripts/release/smoke-production.js', ['/api/health', '/api/public/sites/']);

checkDemoDataHygiene();

console.log('Sale readiness audit');
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
