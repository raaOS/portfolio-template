#!/usr/bin/env node
/*
 * Cleanup helper for Sprint 46 load-test tenants.
 *
 * Default mode is dry-run. Live deletion requires --run-live plus host
 * confirmation for non-local targets.
 */

const fs = require('fs');
const path = require('path');
const { sign } = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local', override: false, quiet: true });
dotenv.config({ path: '.env', override: false, quiet: true });

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';
const USER_AGENT = 'portfolio-os-load-cleanup/1.0';

function parseArgs(argv) {
  const options = {
    target: process.env.LOAD_TEST_TARGET_URL || '',
    runId: process.env.LOAD_TEST_RUN_ID || '',
    slugPrefix: '',
    outDir: '.audit-reports/load',
    runLive: false,
    confirmHost: process.env.LOAD_TEST_CONFIRM_HOST || '',
    deleteMedia: true,
    maxSites: 60,
    adminToken: process.env.LOAD_TEST_ADMIN_TOKEN || '',
    adminPassword: process.env.LOAD_TEST_ADMIN_PASSWORD || '',
    timeoutMs: Number(process.env.LOAD_TEST_TIMEOUT_MS || 30000),
    requestDelayMs: Number(process.env.LOAD_TEST_REQUEST_DELAY_MS || 1500),
    maxRetries: Number(process.env.LOAD_TEST_MAX_RETRIES || 3),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--target' || arg === '--url') {
      options.target = next || '';
      index += 1;
    } else if (arg.startsWith('--target=')) {
      options.target = arg.slice('--target='.length);
    } else if (arg.startsWith('--url=')) {
      options.target = arg.slice('--url='.length);
    } else if (arg === '--run-id') {
      options.runId = next || '';
      index += 1;
    } else if (arg.startsWith('--run-id=')) {
      options.runId = arg.slice('--run-id='.length);
    } else if (arg === '--slug-prefix') {
      options.slugPrefix = next || '';
      index += 1;
    } else if (arg.startsWith('--slug-prefix=')) {
      options.slugPrefix = arg.slice('--slug-prefix='.length);
    } else if (arg === '--out-dir') {
      options.outDir = next || options.outDir;
      index += 1;
    } else if (arg.startsWith('--out-dir=')) {
      options.outDir = arg.slice('--out-dir='.length);
    } else if (arg === '--run-live') {
      options.runLive = true;
    } else if (arg === '--dry-run') {
      options.runLive = false;
    } else if (arg === '--confirm-host') {
      options.confirmHost = next || '';
      index += 1;
    } else if (arg.startsWith('--confirm-host=')) {
      options.confirmHost = arg.slice('--confirm-host='.length);
    } else if (arg === '--delete-media') {
      options.deleteMedia = true;
    } else if (arg === '--keep-media') {
      options.deleteMedia = false;
    } else if (arg === '--max-sites') {
      options.maxSites = Number(next || options.maxSites);
      index += 1;
    } else if (arg.startsWith('--max-sites=')) {
      options.maxSites = Number(arg.slice('--max-sites='.length));
    } else if (arg === '--timeout-ms') {
      options.timeoutMs = Number(next || options.timeoutMs);
      index += 1;
    } else if (arg.startsWith('--timeout-ms=')) {
      options.timeoutMs = Number(arg.slice('--timeout-ms='.length));
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg === '--request-delay-ms') {
      options.requestDelayMs = Number(next || options.requestDelayMs);
      index += 1;
    } else if (arg.startsWith('--request-delay-ms=')) {
      options.requestDelayMs = Number(arg.slice('--request-delay-ms='.length));
    } else if (arg === '--max-retries') {
      options.maxRetries = Number(next || options.maxRetries);
      index += 1;
    } else if (arg.startsWith('--max-retries=')) {
      options.maxRetries = Number(arg.slice('--max-retries='.length));
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.slugPrefix) {
    if (!options.runId) throw new Error('Missing --run-id or --slug-prefix.');
    options.slugPrefix = `lt-${options.runId}-`;
  }
  if (!Number.isFinite(options.maxSites) || options.maxSites < 1) {
    throw new Error('--max-sites must be a positive number.');
  }
  return options;
}

function printHelp() {
  console.log(`Cleanup load-test tenants

Usage:
  npm run load:cleanup -- --target https://makeitbetter.my.id --run-id lt202607142200
  npm run load:cleanup -- --target https://makeitbetter.my.id --run-id lt202607142200 --run-live --confirm-host makeitbetter.my.id

Default is dry-run. Live deletion requires --run-live.

Options:
  --request-delay-ms <ms>      Delay between requests. Default 1500.
  --max-retries <n>            Retry count for 503/429. Default 3.
`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeBaseUrl(rawUrl) {
  if (!rawUrl) throw new Error('Missing --target or LOAD_TEST_TARGET_URL.');
  const parsed = new URL(rawUrl);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Target URL must use http or https.');
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/+$/, '');
}

function isLocalTarget(baseUrl) {
  const host = new URL(baseUrl).hostname;
  return ['localhost', '127.0.0.1', '::1'].includes(host);
}

function enforceSafety(options, baseUrl) {
  if (!options.runLive) return;
  const targetHost = new URL(baseUrl).hostname;
  if (!isLocalTarget(baseUrl) && options.confirmHost !== targetHost) {
    throw new Error(`Live cleanup needs --confirm-host ${targetHost}.`);
  }
}

function joinUrl(baseUrl, target) {
  return `${baseUrl}${target.startsWith('/') ? target : `/${target}`}`;
}

function parseSetCookieHeaders(headers) {
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const raw = headers.get('set-cookie');
  if (!raw) return [];
  return raw.split(/,(?=\s*[^;,\s]+=)/g);
}

function parseJsonMaybe(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

class Session {
  constructor({ baseUrl, timeoutMs, maxRetries = 3 }) {
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
    this.cookies = new Map();
    this.csrfToken = '';
    this.authorization = '';
  }

  setCookie(name, value) {
    if (name && value !== undefined) this.cookies.set(name, value);
  }

  storeSetCookies(headers) {
    for (const cookie of parseSetCookieHeaders(headers)) {
      const pair = cookie.split(';')[0] || '';
      const eq = pair.indexOf('=');
      if (eq > 0) this.setCookie(pair.slice(0, eq).trim(), pair.slice(eq + 1));
    }
  }

  cookieHeader() {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  async refreshCsrf() {
    const response = await this.request('GET', '/api/admin/login', { expectedStatuses: [200] });
    const token = response.data?.csrfToken;
    if (!token) throw new Error('/api/admin/login did not return csrfToken.');
    this.csrfToken = token;
    this.setCookie(CSRF_COOKIE, token);
  }

  async request(method, target, options = {}) {
    const maxRetries = this.maxRetries;
    const retryableStatuses = [429, 502, 503, 504];
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      if (attempt > 0) {
        const backoffMs = Math.min(2000 * Math.pow(2, attempt - 1), 16000);
        const jitter = Math.floor(Math.random() * 500);
        console.log(`  [retry ${attempt}/${maxRetries}] waiting ${backoffMs + jitter}ms before retrying ${method} ${target}...`);
        await wait(backoffMs + jitter);
      }

      const headers = {
        'user-agent': USER_AGENT,
        ...(options.headers || {}),
      };
      const cookieHeader = this.cookieHeader();
      if (cookieHeader) headers.cookie = cookieHeader;
      if (this.authorization) headers.authorization = this.authorization;
      if (this.csrfToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        headers[CSRF_HEADER] = this.csrfToken;
      }

      let body;
      if (options.json !== undefined) {
        headers['content-type'] = 'application/json';
        body = JSON.stringify(options.json);
      }

      try {
        const response = await fetch(joinUrl(this.baseUrl, target), {
          method,
          headers,
          body,
          redirect: 'manual',
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        this.storeSetCookies(response.headers);
        const data = parseJsonMaybe(await response.text());
        const expected = options.expectedStatuses || [200];

        if (!expected.includes(response.status) && retryableStatuses.includes(response.status) && attempt < maxRetries) {
          console.log(`  [${method} ${target}] got ${response.status}, will retry (attempt ${attempt + 1}/${maxRetries})`);
          lastError = new Error(`${method} ${target} expected ${expected.join('/')} got ${response.status}`);
          continue;
        }

        if (!expected.includes(response.status)) {
          const detail = typeof data === 'string' ? data.slice(0, 180) : JSON.stringify(data).slice(0, 180);
          throw new Error(`${method} ${target} expected ${expected.join('/')} got ${response.status}: ${detail}`);
        }
        return { status: response.status, data };
      } catch (error) {
        const isRetryable = error instanceof Error && /\b(503|502|504|429|ETIMEDOUT|ECONNRESET|abort)\b/i.test(error.message);
        if (isRetryable && attempt < maxRetries) {
          console.log(`  [${method} ${target}] error: ${error.message.slice(0, 120)}, will retry`);
          lastError = error;
          continue;
        }
        throw error;
      }
    }
    throw lastError || new Error(`${method} ${target} failed after ${maxRetries} retries`);
  }
}

function buildAdminToken(options) {
  const token = options.adminToken.trim();
  if (token) return token.replace(/^Bearer\s+/i, '');
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return '';
  return sign(
    { sub: 'admin', role: 'admin', iat: Math.floor(Date.now() / 1000) },
    jwtSecret,
    {
      expiresIn: '2h',
      issuer: 'portfolio-admin',
      audience: 'admin-panel',
    }
  );
}

async function createAdminSession(baseUrl, options) {
  const admin = new Session({ baseUrl, timeoutMs: options.timeoutMs, maxRetries: options.maxRetries });
  await admin.refreshCsrf();

  const bearer = buildAdminToken(options);
  if (bearer) {
    admin.authorization = `Bearer ${bearer}`;
    return admin;
  }

  if (!options.adminPassword) {
    throw new Error('Live cleanup needs LOAD_TEST_ADMIN_TOKEN, JWT_SECRET, or LOAD_TEST_ADMIN_PASSWORD.');
  }

  await admin.request('POST', '/api/admin/login', {
    expectedStatuses: [200],
    json: { password: options.adminPassword },
  });
  return admin;
}

async function writeReport(options, report) {
  const outDir = path.resolve(process.cwd(), options.outDir);
  await fs.promises.mkdir(outDir, { recursive: true });
  const pathOut = path.join(outDir, `cleanup-${options.runId || options.slugPrefix.replace(/[^a-z0-9-]/g, '-')}.json`);
  await fs.promises.writeFile(pathOut, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return pathOut;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(options.target);
  enforceSafety(options, baseUrl);

  const admin = await createAdminSession(baseUrl, options);
  const listed = await admin.request('GET', '/api/admin/sites', { expectedStatuses: [200] });
  const sites = (listed.data?.sites || []).filter((site) => site.slug?.startsWith(options.slugPrefix));

  if (sites.length > options.maxSites) {
    throw new Error(`Matched ${sites.length} sites, above --max-sites ${options.maxSites}. Refusing cleanup.`);
  }

  const results = [];
  for (const site of sites) {
    if (!options.runLive) {
      results.push({ siteId: site.id, slug: site.slug, deleted: false, dryRun: true });
      continue;
    }
    try {
      await wait(options.requestDelayMs);
      const response = await admin.request('DELETE', '/api/admin/sites', {
        expectedStatuses: [200],
        json: {
          id: site.id,
          confirmSlug: site.slug,
          deleteMedia: options.deleteMedia,
        },
      });
      results.push({ siteId: site.id, slug: site.slug, deleted: true, response: response.data });
    } catch (error) {
      results.push({
        siteId: site.id,
        slug: site.slug,
        deleted: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const report = {
    type: 'portfolio_os_load_test_cleanup',
    generatedAt: new Date().toISOString(),
    mode: options.runLive ? 'live' : 'dry-run',
    target: baseUrl,
    runId: options.runId,
    slugPrefix: options.slugPrefix,
    matched: sites.length,
    deleted: results.filter((r) => r.deleted).length,
    failed: results.filter((r) => r.error).length,
    deleteMedia: options.deleteMedia,
    results,
  };
  const reportPath = await writeReport(options, report);

  console.log(`Matched: ${report.matched}`);
  console.log(`Deleted: ${report.deleted}`);
  console.log(`Failed: ${report.failed}`);
  console.log(`Report: ${reportPath}`);

  if (options.runLive && report.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
