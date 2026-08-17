#!/usr/bin/env node
/**
 * Production synthetic monitor for Portfolio OS Template.
 *
 * Safe defaults:
 * - reads .env.local/.env but never prints secret values
 * - checks public endpoints only
 * - optional generic alert providers: console, webhook, resend
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local', override: false, quiet: true });
dotenv.config({ path: '.env', override: false, quiet: true });

const DEFAULT_ENDPOINTS = [
  { name: 'health', path: '/api/health', expectedStatuses: [200] },
  { name: 'home', path: '/', expectedStatuses: [200] },
  { name: 'client_login', path: '/client/login', expectedStatuses: [200] },
  { name: 'client_reset_password', path: '/client/reset-password', expectedStatuses: [200] },
  { name: 'public_site', path: '/api/public/sites/{siteSlug}', expectedStatuses: [200] },
  { name: 'public_projects', path: '/api/public/sites/{siteSlug}/projects', expectedStatuses: [200] },
];

function parseArgs(argv) {
  const options = {
    url: process.env.MONITORING_TARGET_URL || process.env.NEXT_PUBLIC_SITE_URL || '',
    siteSlug: process.env.MONITORING_SITE_SLUG || 'urgent',
    timeoutMs: Number(process.env.MONITORING_HTTP_TIMEOUT_MS || 10000),
    storageWarnRatio: Number(process.env.MONITORING_STORAGE_WARN_RATIO || 0.8),
    json: false,
    skipStorage: false,
    simulateFailure: false,
    sendTestAlert: false,
    expectFailure: false,
    alertProvider: process.env.MONITORING_ALERT_PROVIDER || 'none',
    out: '',
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
    } else if (arg === '--timeout-ms') {
      options.timeoutMs = Number(next || options.timeoutMs);
      index += 1;
    } else if (arg.startsWith('--timeout-ms=')) {
      options.timeoutMs = Number(arg.slice('--timeout-ms='.length));
    } else if (arg === '--storage-warn-ratio') {
      options.storageWarnRatio = Number(next || options.storageWarnRatio);
      index += 1;
    } else if (arg.startsWith('--storage-warn-ratio=')) {
      options.storageWarnRatio = Number(arg.slice('--storage-warn-ratio='.length));
    } else if (arg === '--alert-provider') {
      options.alertProvider = next || options.alertProvider;
      index += 1;
    } else if (arg.startsWith('--alert-provider=')) {
      options.alertProvider = arg.slice('--alert-provider='.length);
    } else if (arg === '--out') {
      options.out = next || '';
      index += 1;
    } else if (arg.startsWith('--out=')) {
      options.out = arg.slice('--out='.length);
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--skip-storage') {
      options.skipStorage = true;
    } else if (arg === '--simulate-failure') {
      options.simulateFailure = true;
    } else if (arg === '--send-test-alert') {
      options.sendTestAlert = true;
    } else if (arg === '--expect-failure') {
      options.expectFailure = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive number');
  }

  if (
    !Number.isFinite(options.storageWarnRatio) ||
    options.storageWarnRatio <= 0 ||
    options.storageWarnRatio > 1
  ) {
    throw new Error('--storage-warn-ratio must be between 0 and 1');
  }

  return options;
}

function printHelp() {
  console.log(`Synthetic production monitor

Usage:
  npm run monitoring:synthetic -- --url https://makeitbetter.my.id --site-slug urgent

Options:
  --url <url>                Target base URL. Defaults MONITORING_TARGET_URL/NEXT_PUBLIC_SITE_URL.
  --site-slug <slug>         Public site slug. Default MONITORING_SITE_SLUG or urgent.
  --timeout-ms <ms>          Per-request timeout. Default 10000.
  --storage-warn-ratio <n>   Storage alert threshold. Default 0.8.
  --skip-storage             Skip D1/R2 quota checks.
  --alert-provider <name>    none, console, webhook, or resend.
  --simulate-failure         Add one intentional failing check.
  --send-test-alert          Send alert even when all checks pass.
  --expect-failure           Exit 0 when failure is intentional and alert path is tested.
  --out <file>               Write JSON report.
  --json                     Print JSON report.
`);
}

function normalizeBaseUrl(rawUrl) {
  if (!rawUrl) throw new Error('Missing --url, MONITORING_TARGET_URL, or NEXT_PUBLIC_SITE_URL.');
  const parsed = new URL(rawUrl);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Monitoring URL must use http or https.');
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/+$/, '');
}

function buildUrl(baseUrl, pathName) {
  return `${baseUrl}${pathName.startsWith('/') ? pathName : `/${pathName}`}`;
}

function endpointPath(template, siteSlug) {
  return template.replace('{siteSlug}', encodeURIComponent(siteSlug));
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'portfolio-os-synthetic-monitor/1.0',
      },
      redirect: 'manual',
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function runHttpCheck(baseUrl, check, options) {
  const pathName = endpointPath(check.path, options.siteSlug);
  const url = buildUrl(baseUrl, pathName);
  const started = Date.now();

  try {
    const response = await fetchWithTimeout(url, options.timeoutMs);
    const durationMs = Date.now() - started;
    const expected = check.expectedStatuses || [200];
    const ok = expected.includes(response.status);

    let healthStatus = null;
    if (check.name === 'health' && response.status === 200) {
      const payload = await response.clone().json().catch(() => null);
      healthStatus = payload?.status || null;
      if (healthStatus && healthStatus !== 'ok') {
        return {
          ok: false,
          name: check.name,
          path: pathName,
          status: response.status,
          durationMs,
          error: `health status is ${healthStatus}`,
        };
      }
    }

    return {
      ok,
      name: check.name,
      path: pathName,
      status: response.status,
      durationMs,
      contentType: response.headers.get('content-type') || '',
      healthStatus,
      error: ok ? undefined : `expected ${expected.join(' or ')}, got ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      name: check.name,
      path: pathName,
      status: 0,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function d1Config() {
  const accountId =
    process.env.CLOUDFLARE_ACCOUNT_ID ||
    process.env.CLOUDFLARE_D1_ACCOUNT_ID ||
    process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const apiToken = process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !databaseId || !apiToken) return null;
  return { accountId, databaseId, apiToken };
}

async function queryD1(sql, params = []) {
  const config = d1Config();
  if (!config) throw new Error('D1 env is incomplete');

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    }
  );

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    const message =
      payload?.errors?.map((error) => error.message).filter(Boolean).join('; ') ||
      response.statusText;
    throw new Error(`D1 query failed: ${message}`);
  }

  const first = payload.result?.[0];
  if (first?.success === false) throw new Error(`D1 SQL failed: ${first.error || 'unknown'}`);
  return first?.results || [];
}

function readPositiveInt(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function planStorageMb(plan) {
  if (plan === 'pro') return readPositiveInt('PLAN_PRO_STORAGE_MB', 5000);
  return readPositiveInt('PLAN_LITE_STORAGE_MB', 250);
}

async function loadSiteRows() {
  const sites = await queryD1('SELECT id, slug, name, plan, status FROM sites ORDER BY created_at ASC');
  const overrides = await queryD1('SELECT site_id, storage_mb FROM site_quota_overrides');
  const overrideBySiteId = new Map(overrides.map((row) => [row.site_id, row.storage_mb]));

  return sites.map((site) => {
    const baseStorageMb = planStorageMb(site.plan === 'pro' ? 'pro' : 'lite');
    const overrideStorageMb = Number(overrideBySiteId.get(site.id) || 0);
    return {
      id: site.id,
      slug: site.slug,
      name: site.name,
      plan: site.plan === 'pro' ? 'pro' : 'lite',
      status: site.status,
      storageLimitMb:
        Number.isFinite(overrideStorageMb) && overrideStorageMb > baseStorageMb
          ? overrideStorageMb
          : baseStorageMb,
    };
  });
}

function r2Config() {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucket = process.env.CLOUDFLARE_R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

async function listR2PrefixBytes(prefix) {
  const config = r2Config();
  if (!config) throw new Error('R2 env is incomplete');

  const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  let bytes = 0;
  let objects = 0;
  let continuationToken;
  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: config.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    for (const item of response.Contents || []) {
      bytes += Number(item.Size || 0);
      objects += item.Key ? 1 : 0;
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return { bytes, objects };
}

async function runStorageChecks(options) {
  if (options.skipStorage) {
    return { skipped: true, reason: 'skip-storage' };
  }

  if (!d1Config() || !r2Config()) {
    return { skipped: true, reason: 'd1-or-r2-env-incomplete' };
  }

  const sites = await loadSiteRows();
  const checks = [];
  for (const site of sites) {
    const usage = await listR2PrefixBytes(`sites/${site.id}/`);
    const limitBytes = site.storageLimitMb * 1024 * 1024;
    const ratio = limitBytes > 0 ? usage.bytes / limitBytes : 0;
    checks.push({
      ok: ratio < options.storageWarnRatio,
      siteId: site.id,
      siteSlug: site.slug,
      plan: site.plan,
      status: site.status,
      bytes: usage.bytes,
      objects: usage.objects,
      limitMb: site.storageLimitMb,
      ratio,
      warnRatio: options.storageWarnRatio,
      error:
        ratio >= options.storageWarnRatio
          ? `storage ratio ${(ratio * 100).toFixed(1)}% exceeds threshold`
          : undefined,
    });
  }

  return { skipped: false, checks };
}

async function sendWebhookAlert(payload) {
  const url = process.env.MONITORING_ALERT_WEBHOOK_URL;
  if (!url) return { sent: false, provider: 'webhook', reason: 'missing-webhook-url' };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return {
    sent: response.ok,
    provider: 'webhook',
    status: response.status,
    reason: response.ok ? undefined : response.statusText,
  };
}

async function sendResendAlert(payload) {
  const apiKey = process.env.MONITORING_ALERT_RESEND_API_KEY || process.env.NOTIFICATION_API_KEY;
  const from = process.env.MONITORING_ALERT_FROM || process.env.NOTIFICATION_DEFAULT_FROM;
  const to = process.env.MONITORING_ALERT_TO;
  if (!apiKey || !from || !to) {
    return { sent: false, provider: 'resend', reason: 'missing-resend-alert-env' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: to.split(',').map((item) => item.trim()).filter(Boolean),
      subject: payload.subject,
      text: payload.text,
    }),
  });

  return {
    sent: response.ok,
    provider: 'resend',
    status: response.status,
    reason: response.ok ? undefined : response.statusText,
  };
}

async function sendAlert(report, options) {
  const provider = String(options.alertProvider || 'none').toLowerCase();
  const failures = [
    ...report.httpChecks.filter((check) => !check.ok).map((check) => `${check.name}: ${check.error}`),
    ...((report.storage?.checks || [])
      .filter((check) => !check.ok)
      .map((check) => `storage ${check.siteSlug}: ${check.error}`)),
  ];

  const payload = {
    kind: 'portfolio-os-monitoring-alert',
    generatedAt: report.generatedAt,
    targetUrl: report.targetUrl,
    siteSlug: report.siteSlug,
    status: report.status,
    subject: `[Portfolio OS] ${report.status.toUpperCase()} synthetic monitor ${report.siteSlug}`,
    text: [
      `Status: ${report.status}`,
      `Target: ${report.targetUrl}`,
      `Site: ${report.siteSlug}`,
      `HTTP: ${report.summary.httpPassed}/${report.summary.httpTotal}`,
      `Storage: ${report.summary.storagePassed}/${report.summary.storageTotal}`,
      '',
      'Failures:',
      failures.length > 0 ? failures.map((failure) => `- ${failure}`).join('\n') : '- none',
    ].join('\n'),
    failures,
  };

  if (provider === 'none') return { sent: false, provider, reason: 'disabled' };
  if (provider === 'console') {
    console.warn(JSON.stringify({ type: 'portfolio_os_monitoring_alert', ...payload }));
    return { sent: true, provider };
  }
  if (provider === 'webhook') return sendWebhookAlert(payload);
  if (provider === 'resend') return sendResendAlert(payload);
  return { sent: false, provider, reason: 'unsupported-provider' };
}

async function writeReport(file, report) {
  if (!file) return;
  const resolved = path.resolve(process.cwd(), file);
  await fs.promises.mkdir(path.dirname(resolved), { recursive: true });
  await fs.promises.writeFile(resolved, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(options.url);
  const checks = [...DEFAULT_ENDPOINTS];
  if (options.simulateFailure) {
    checks.push({
      name: 'simulated_failure',
      path: '/api/__portfolio-os-monitoring-failure-probe__',
      expectedStatuses: [200],
    });
  }

  const httpChecks = [];
  for (const check of checks) {
    httpChecks.push(await runHttpCheck(baseUrl, check, options));
  }

  const storage = await runStorageChecks(options).catch((error) => ({
    skipped: true,
    reason: error instanceof Error ? error.message : String(error),
  }));

  const storageChecks = storage.checks || [];
  const httpPassed = httpChecks.filter((check) => check.ok).length;
  const storagePassed = storageChecks.filter((check) => check.ok).length;
  const hasFailures =
    httpPassed !== httpChecks.length || storageChecks.some((check) => !check.ok);

  const report = {
    generatedAt: new Date().toISOString(),
    targetUrl: baseUrl,
    siteSlug: options.siteSlug,
    status: hasFailures ? 'fail' : 'pass',
    summary: {
      httpPassed,
      httpTotal: httpChecks.length,
      storagePassed,
      storageTotal: storageChecks.length,
      storageSkipped: Boolean(storage.skipped),
    },
    httpChecks,
    storage,
    alert: null,
  };

  if (hasFailures || options.sendTestAlert) {
    report.alert = await sendAlert(report, options);
  }

  await writeReport(options.out, report);

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Synthetic monitor target: ${baseUrl}`);
    console.log(`Site slug: ${options.siteSlug}`);
    for (const check of httpChecks) {
      console.log(
        `[${check.ok ? 'pass' : 'fail'}] ${check.path} -> ${check.status} (${check.durationMs}ms)${
          check.error ? ` ${check.error}` : ''
        }`
      );
    }
    if (storage.skipped) {
      console.log(`[skip] storage quota check: ${storage.reason}`);
    } else {
      for (const check of storageChecks) {
        console.log(
          `[${check.ok ? 'pass' : 'warn'}] storage ${check.siteSlug}: ${(
            check.ratio * 100
          ).toFixed(1)}% (${check.objects} objects)`
        );
      }
    }
    if (report.alert) {
      console.log(
        `Alert provider: ${report.alert.provider}, sent=${report.alert.sent}${
          report.alert.reason ? `, reason=${report.alert.reason}` : ''
        }`
      );
    }
    console.log('');
    console.log(
      `Summary: HTTP ${httpPassed}/${httpChecks.length}, storage ${storagePassed}/${storageChecks.length}, status=${report.status}`
    );
  }

  const alertFailed =
    report.alert && report.alert.provider !== 'none' && report.alert.sent !== true;

  if (alertFailed) {
    process.exitCode = 1;
  } else if (hasFailures && !options.expectFailure) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
