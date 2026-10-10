#!/usr/bin/env node

// Wrapper fase deploy `opennextjs-cloudflare deploy`.
//
// Kenapa ada: fase deploy menjalankan `getPlatformProxy` (miniflare/workerd).
// Sejak insiden v1.3.27 binary workerd Windows gagal membuat folder sementara
// di `%TEMP%` sistem (`kj/filesystem-disk-win32.c++:773 CreateDirectory: #5
// Access is denied`, path `miniflare-email-store`) — padahal folder yang sama
// dibuat di dalam repo selalu berhasil. Fase build sudah di-redirect lewat
// `run-opennext-cloudflare-build.js`; wrapper ini menerapkan hal yang sama
// untuk fase deploy sehingga `npm run deploy` jalan tanpa set manual.
//
// Catatan: akar pasti crash belum teridentifikasi (CFA=0, tanpa AV lain,
// `workerd --version` OK). Lihat log:
// docs/tracker/logs/deploy_owner_v1_3_30_workerd_temp_kv_2026_10_10.md

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const env = { ...process.env };

if (process.platform === 'win32') {
  const tempDir = path.join(process.cwd(), 'tmp', 'deploy-temp');
  fs.mkdirSync(tempDir, { recursive: true });
  env.TEMP = tempDir;
  env.TMP = tempDir;
  env.TMPDIR = tempDir;
}

const bin = path.join(
  process.cwd(),
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'opennextjs-cloudflare.cmd' : 'opennextjs-cloudflare'
);

const result = spawnSync(bin, ['deploy', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
