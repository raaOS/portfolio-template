#!/usr/bin/env node

const { existsSync, readdirSync, readFileSync, statSync } = require('node:fs');
const path = require('node:path');

const strict = process.argv.includes('--strict');

const root = process.cwd();
const scanTargets = ['src/app', 'src/lib', 'src/middleware', 'src/middleware.ts'];
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

const rules = [
  {
    id: 'edge-runtime',
    severity: 'blocker',
    description: 'OpenNext Cloudflare does not support Next.js Edge Runtime routes.',
    pattern: /export\s+const\s+runtime\s*=\s*['"]edge['"]/,
  },
  {
    id: 'native-sharp',
    severity: 'blocker',
    description: 'sharp is a native Node module and cannot run inside Cloudflare Workers.',
    pattern:
      /\b(import\s*\(\s*['"]sharp['"]\s*\)|from\s+['"]sharp['"]|require\s*\(\s*['"]sharp['"]\s*\))/,
  },
  {
    id: 'child-process',
    severity: 'blocker',
    description: 'child_process cannot run inside Cloudflare Workers.',
    pattern:
      /\b(from\s+['"](?:node:)?child_process['"]|require\s*\(\s*['"](?:node:)?child_process['"]\s*\))/,
  },
  {
    id: 'ffmpeg-static',
    severity: 'blocker',
    description: 'Bundled ffmpeg binaries cannot run inside Cloudflare Workers.',
    pattern:
      /\b(from\s+['"]ffmpeg-static['"]|require\s*\(\s*['"]ffmpeg-static['"]\s*\)|ffmpeg-static)/,
  },
  {
    id: 'filesystem',
    severity: 'blocker',
    description: 'Runtime filesystem access must be removed or moved to build-time/tooling code.',
    pattern:
      /\b(from\s+['"](?:node:)?fs(?:\/promises)?['"]|require\s*\(\s*['"](?:node:)?fs(?:\/promises)?['"]\s*\))/,
  },
  {
    id: 'nodejs-runtime',
    severity: 'review',
    description: 'Explicit nodejs runtime is allowed by Next.js but must not hide native module usage.',
    pattern: /export\s+const\s+runtime\s*=\s*['"]nodejs['"]/,
  },
];

function collectFiles(target) {
  const absolute = path.join(root, target);
  if (!existsSync(absolute)) {
    return [];
  }

  const stats = statSync(absolute);
  if (stats.isFile()) {
    return extensions.has(path.extname(absolute)) ? [absolute] : [];
  }

  const files = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const child = path.join(absolute, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(path.relative(root, child)));
      continue;
    }

    if (entry.isFile() && extensions.has(path.extname(entry.name))) {
      files.push(child);
    }
  }

  return files;
}

function auditFile(file) {
  const relativeFile = path.relative(root, file).replace(/\\/g, '/');
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const findings = [];

  lines.forEach((lineText, index) => {
    for (const rule of rules) {
      if (!rule.pattern.test(lineText)) {
        continue;
      }

      findings.push({
        file: relativeFile,
        line: index + 1,
        severity: rule.severity,
        ruleId: rule.id,
        description: rule.description,
        text: lineText.trim(),
      });
    }
  });

  return findings;
}

const files = scanTargets.flatMap(collectFiles).sort();
const findings = files.flatMap(auditFile);
const blockers = findings.filter((finding) => finding.severity === 'blocker');
const reviews = findings.filter((finding) => finding.severity === 'review');

console.log('Cloudflare Workers compatibility audit');
console.log(`Scanned files: ${files.length}`);
console.log(`Blockers: ${blockers.length}`);
console.log(`Review items: ${reviews.length}`);

function printFindings(title, items) {
  if (items.length === 0) {
    return;
  }

  console.log(`\n${title}`);
  for (const finding of items) {
    console.log(
      `- ${finding.file}:${finding.line} [${finding.severity}/${finding.ruleId}] ${finding.description}`
    );
    console.log(`  ${finding.text}`);
  }
}

printFindings('Blocking findings', blockers);
printFindings('Review findings', reviews);

if (blockers.length > 0) {
  console.log(
    '\nStatus: Cloudflare deploy is scaffolded, but runtime compatibility is not clean yet.'
  );
  console.log(
    'Next step: migrate native media/cache paths to Cloudflare-native or browser-side flows.'
  );

  if (strict) {
    process.exit(1);
  }
} else {
  console.log('\nStatus: no known Worker runtime blockers found.');
}
