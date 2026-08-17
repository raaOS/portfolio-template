#!/usr/bin/env node
/**
 * Runs the production synthetic monitor on a fixed interval.
 *
 * This script is intentionally simple so it can run from Windows Task Scheduler,
 * a terminal, or CI. It writes one JSON report per run and never prints secrets.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local', override: false, quiet: true });
dotenv.config({ path: '.env', override: false, quiet: true });

function parseArgs(argv) {
  const options = {
    url: process.env.MONITORING_TARGET_URL || process.env.NEXT_PUBLIC_SITE_URL || '',
    siteSlug: process.env.MONITORING_SITE_SLUG || 'urgent',
    durationMinutes: 24 * 60,
    intervalMinutes: 5,
    outDir: '.audit-reports/monitoring/24h',
    alertProvider: process.env.MONITORING_ALERT_PROVIDER || 'none',
    skipStorage: false,
    sendTestAlertFirst: false,
    maxRuns: 0,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--url') {
      options.url = next || '';
      index += 1;
    } else if (arg.startsWith('--url=')) {
      options.url = arg.slice('--url='.length);
    } else if (arg === '--site-slug') {
      options.siteSlug = next || options.siteSlug;
      index += 1;
    } else if (arg.startsWith('--site-slug=')) {
      options.siteSlug = arg.slice('--site-slug='.length);
    } else if (arg === '--duration-minutes') {
      options.durationMinutes = Number(next || options.durationMinutes);
      index += 1;
    } else if (arg.startsWith('--duration-minutes=')) {
      options.durationMinutes = Number(arg.slice('--duration-minutes='.length));
    } else if (arg === '--duration-hours') {
      options.durationMinutes = Number(next || 24) * 60;
      index += 1;
    } else if (arg.startsWith('--duration-hours=')) {
      options.durationMinutes = Number(arg.slice('--duration-hours='.length)) * 60;
    } else if (arg === '--interval-minutes') {
      options.intervalMinutes = Number(next || options.intervalMinutes);
      index += 1;
    } else if (arg.startsWith('--interval-minutes=')) {
      options.intervalMinutes = Number(arg.slice('--interval-minutes='.length));
    } else if (arg === '--out-dir') {
      options.outDir = next || options.outDir;
      index += 1;
    } else if (arg.startsWith('--out-dir=')) {
      options.outDir = arg.slice('--out-dir='.length);
    } else if (arg === '--alert-provider') {
      options.alertProvider = next || options.alertProvider;
      index += 1;
    } else if (arg.startsWith('--alert-provider=')) {
      options.alertProvider = arg.slice('--alert-provider='.length);
    } else if (arg === '--max-runs') {
      options.maxRuns = Number(next || 0);
      index += 1;
    } else if (arg.startsWith('--max-runs=')) {
      options.maxRuns = Number(arg.slice('--max-runs='.length));
    } else if (arg === '--skip-storage') {
      options.skipStorage = true;
    } else if (arg === '--send-test-alert-first') {
      options.sendTestAlertFirst = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.url) {
    throw new Error('Missing --url, MONITORING_TARGET_URL, or NEXT_PUBLIC_SITE_URL.');
  }
  if (!Number.isFinite(options.durationMinutes) || options.durationMinutes < 0) {
    throw new Error('--duration-minutes must be zero or a positive number.');
  }
  if (!Number.isFinite(options.intervalMinutes) || options.intervalMinutes <= 0) {
    throw new Error('--interval-minutes must be a positive number.');
  }
  if (!Number.isFinite(options.maxRuns) || options.maxRuns < 0) {
    throw new Error('--max-runs must be zero or a positive number.');
  }

  return options;
}

function printHelp() {
  console.log(`24h synthetic monitor loop

Usage:
  npm run monitoring:synthetic:loop -- --url https://makeitbetter.my.id --site-slug urgent --alert-provider resend

Options:
  --url <url>                  Target base URL. Defaults MONITORING_TARGET_URL/NEXT_PUBLIC_SITE_URL.
  --site-slug <slug>           Public site slug. Default MONITORING_SITE_SLUG or urgent.
  --duration-hours <hours>     Total runtime. Default 24.
  --duration-minutes <minutes> Total runtime in minutes.
  --interval-minutes <minutes> Interval between runs. Default 5.
  --out-dir <dir>              Report directory. Default .audit-reports/monitoring/24h.
  --alert-provider <name>      none, console, webhook, or resend.
  --send-test-alert-first      Send a non-failure test alert on the first run.
  --skip-storage               Skip D1/R2 quota checks.
  --max-runs <n>               Stop after n runs, useful for smoke tests.
`);
}

function timestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runSynthetic(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['scripts/monitoring/synthetic-production-check.js', ...args], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
      shell: false,
    });

    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', (error) => {
      console.error(error instanceof Error ? error.message : error);
      resolve(1);
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const outDir = path.resolve(process.cwd(), options.outDir);
  await fs.promises.mkdir(outDir, { recursive: true });

  const startedAt = Date.now();
  const endAt = startedAt + options.durationMinutes * 60 * 1000;
  const intervalMs = options.intervalMinutes * 60 * 1000;
  const plannedRunLimit =
    options.durationMinutes === 0
      ? 1
      : Math.floor(options.durationMinutes / options.intervalMinutes) + 1;
  const runLimit = options.maxRuns > 0 ? options.maxRuns : plannedRunLimit;
  let runCount = 0;
  let failureCount = 0;

  console.log(`Synthetic loop target: ${options.url}`);
  console.log(`Site slug: ${options.siteSlug}`);
  console.log(`Interval: ${options.intervalMinutes} minutes`);
  console.log(`Duration: ${options.durationMinutes} minutes`);
  console.log(`Output: ${outDir}`);

  while (runCount < runLimit) {
    runCount += 1;
    const runStartedAt = new Date();
    const outFile = path.join(outDir, `run-${timestampForFile(runStartedAt)}.json`);
    const args = [
      '--url',
      options.url,
      '--site-slug',
      options.siteSlug,
      '--alert-provider',
      options.alertProvider,
      '--out',
      outFile,
    ];

    if (options.skipStorage) args.push('--skip-storage');
    if (options.sendTestAlertFirst && runCount === 1) args.push('--send-test-alert');

    console.log('');
    console.log(`[${runStartedAt.toISOString()}] synthetic run ${runCount}`);
    const exitCode = await runSynthetic(args);
    if (exitCode !== 0) failureCount += 1;

    const nextRunAt = startedAt + runCount * intervalMs;
    const sleepMs = nextRunAt - Date.now();
    if (runCount >= runLimit) break;
    if (sleepMs > 0) await wait(sleepMs);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    targetUrl: options.url,
    siteSlug: options.siteSlug,
    intervalMinutes: options.intervalMinutes,
    durationMinutes: options.durationMinutes,
    runCount,
    failureCount,
    outDir,
  };
  await fs.promises.writeFile(
    path.join(outDir, 'loop-summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8'
  );

  console.log('');
  console.log(`Loop completed: runs=${runCount}, failedRuns=${failureCount}`);
  if (failureCount > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
