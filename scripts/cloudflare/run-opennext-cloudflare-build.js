#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { patchOpenNextWindowsTurbopackPlugin } = require('./patch-opennext-windows-turbopack.js');

const env = { ...process.env };
env.CLOUDFLARE_OPENNEXT_BUILD = 'true';
env.NO_UPDATE_NOTIFIER = '1';
env.npm_config_update_notifier = 'false';
env.npm_config_fund = 'false';
env.npm_config_audit = 'false';

const nextFetchCacheDir = path.join(process.cwd(), '.next', 'cache', 'fetch-cache');
fs.rmSync(nextFetchCacheDir, { recursive: true, force: true });

if (process.platform === 'win32') {
  const tempDir = path.join(process.cwd(), 'tmp', 'opennext-temp');
  const symlinkFallback = path.join(
    process.cwd(),
    'scripts',
    'cloudflare',
    'windows-symlink-fallback.cjs'
  );
  fs.mkdirSync(tempDir, { recursive: true });
  env.TEMP = tempDir;
  env.TMP = tempDir;
  env.NODE_OPTIONS = [env.NODE_OPTIONS, `--require=${symlinkFallback}`].filter(Boolean).join(' ');
}

patchOpenNextWindowsTurbopackPlugin();

const bin = path.join(
  process.cwd(),
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'opennextjs-cloudflare.cmd' : 'opennextjs-cloudflare'
);

const result = spawnSync(bin, ['build'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  env,
  encoding: 'utf8',
  shell: process.platform === 'win32',
});

function isKnownOpenNextWindowsNotice(line) {
  return (
    line === 'WARN OpenNext is not fully compatible with Windows.' ||
    line === 'WARN For optimal performance, it is recommended to use Windows Subsystem for Linux (WSL).' ||
    line === 'WARN While OpenNext may function on Windows, it could encounter unpredictable failures during runtime.'
  );
}

function isKnownNextMiddlewareNotice(line) {
  return (
    line.includes('The "middleware" file convention is deprecated. Please use "proxy" instead.') ||
    line.includes('https://nextjs.org/docs/messages/middleware-to-proxy')
  );
}

function filterKnownToolNotices(output) {
  if (!output || process.env.CLOUDFLARE_BUILD_SHOW_KNOWN_WARNINGS === 'true') {
    return output || '';
  }

  const lines = output.replace(/\r\n/g, '\n').split('\n');
  const filtered = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (isKnownOpenNextWindowsNotice(line) || isKnownNextMiddlewareNotice(line)) {
      continue;
    }

    const isDuplicateCaseVendorWarning =
      line.includes('[WARNING] This case clause will never be evaluated because it duplicates an earlier case clause');
    const isSuspiciousNullishVendorWarning =
      line.includes('[WARNING] The "??" operator here will always return the left operand');

    if (isDuplicateCaseVendorWarning || isSuspiciousNullishVendorWarning) {
      while (
        index + 1 < lines.length &&
        !lines[index + 1].includes('[WARNING]') &&
        !lines[index + 1].startsWith('npm notice') &&
        !lines[index + 1].startsWith('npm error')
      ) {
        index += 1;
      }
      continue;
    }

    filtered.push(line);
  }

  return filtered.join('\n');
}

const stdout = filterKnownToolNotices(result.stdout);
const stderr = filterKnownToolNotices(result.stderr);
if (stdout) process.stdout.write(stdout.endsWith('\n') ? stdout : `${stdout}\n`);
if (stderr) process.stderr.write(stderr.endsWith('\n') ? stderr : `${stderr}\n`);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

const status = result.status ?? 1;
if (status !== 0) {
  process.exit(status);
}

try {
  const { prepareOpenNextWorkerOutput } = require('./prepare-opennext-worker-output.js');
  prepareOpenNextWorkerOutput();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

process.exit(0);
