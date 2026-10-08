#!/usr/bin/env node
/*
 * Multi-buyer load test runner for Portfolio OS.
 *
 * Default mode is dry-run. Live writes require --run-live plus host confirmation,
 * and larger phases require explicit allow flags.
 *
 * Optional billing/order phase (--order-phase) is OFF by default: it creates
 * real orders with unique slugs, reads their status page via the order access
 * token, then cancels every order it created (cleanup runs in a finally block).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { sign } = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local', override: false, quiet: true });
dotenv.config({ path: '.env', override: false, quiet: true });

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';
const DEFAULT_OUT_DIR = '.audit-reports/load';
const USER_AGENT = 'portfolio-os-load-test/1.0';
// POST /api/billing/checkout di-rate-limit 5 request/menit per IP dengan block
// 10 menit (src/app/api/billing/checkout/route.ts). Spacing minimal ini menjaga
// fase order tetap jauh di bawah limit supaya tidak memicu 429 yang men-lock IP.
const ORDER_CHECKOUT_MIN_INTERVAL_MS = 13000;
// GET /api/billing/orders/:id di-rate-limit 30 request/menit per IP.
const ORDER_STATUS_MIN_INTERVAL_MS = 2500;
const ORDER_CANCEL_REASON = 'Load test cleanup (multi-buyer-load-test)';

function makeRunId() {
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 12);
  return `lt${stamp}`;
}

function getConfigPath(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--config') return argv[index + 1] || '';
    if (arg.startsWith('--config=')) return arg.slice('--config='.length);
  }
  return '';
}

function readConfig(argv) {
  const configPath = getConfigPath(argv);
  if (!configPath) return {};
  const resolved = path.resolve(process.cwd(), configPath);
  const raw = fs.readFileSync(resolved, 'utf8');
  return JSON.parse(raw);
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function parseArgs(argv) {
  const fileConfig = readConfig(argv);
  const options = {
    target: process.env.LOAD_TEST_TARGET_URL || '',
    tenants: Number(process.env.LOAD_TEST_TENANTS || 5),
    concurrency: Number(process.env.LOAD_TEST_CONCURRENCY || 1),
    runId: process.env.LOAD_TEST_RUN_ID || makeRunId(),
    outDir: DEFAULT_OUT_DIR,
    reportMd: '',
    runLive: parseBoolean(process.env.LOAD_TEST_RUN_LIVE, false),
    confirmHost: process.env.LOAD_TEST_CONFIRM_HOST || '',
    allow25: false,
    allow50: false,
    emailDomain: process.env.LOAD_TEST_EMAIL_DOMAIN || 'example.invalid',
    adminToken: process.env.LOAD_TEST_ADMIN_TOKEN || '',
    adminPassword: process.env.LOAD_TEST_ADMIN_PASSWORD || '',
    siteUserEmail: process.env.LOAD_TEST_SITE_USER_EMAIL || '',
    siteUserPassword: process.env.LOAD_TEST_SITE_USER_PASSWORD || '',
    timeoutMs: Number(process.env.LOAD_TEST_TIMEOUT_MS || 30000),
    requestDelayMs: Number(process.env.LOAD_TEST_REQUEST_DELAY_MS || 1500),
    maxRetries: Number(process.env.LOAD_TEST_MAX_RETRIES || 3),
    imageSizeKb: 64,
    videoSizeMb: 1,
    skipMedia: false,
    skipVideoPut: false,
    cleanupAfter: false,
    orderPhase: parseBoolean(process.env.LOAD_TEST_ORDER_PHASE, false),
    orderCount: Number(process.env.LOAD_TEST_ORDER_COUNT || 5),
  };
  Object.assign(options, fileConfig);

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--config' || arg.startsWith('--config=')) {
      if (arg === '--config') index += 1;
    } else if (arg === '--target' || arg === '--url') {
      options.target = next || '';
      index += 1;
    } else if (arg.startsWith('--target=')) {
      options.target = arg.slice('--target='.length);
    } else if (arg.startsWith('--url=')) {
      options.target = arg.slice('--url='.length);
    } else if (arg === '--tenants') {
      options.tenants = Number(next || options.tenants);
      index += 1;
    } else if (arg.startsWith('--tenants=')) {
      options.tenants = Number(arg.slice('--tenants='.length));
    } else if (arg === '--concurrency') {
      options.concurrency = Number(next || options.concurrency);
      index += 1;
    } else if (arg.startsWith('--concurrency=')) {
      options.concurrency = Number(arg.slice('--concurrency='.length));
    } else if (arg === '--run-id') {
      options.runId = next || options.runId;
      index += 1;
    } else if (arg.startsWith('--run-id=')) {
      options.runId = arg.slice('--run-id='.length);
    } else if (arg === '--out-dir') {
      options.outDir = next || options.outDir;
      index += 1;
    } else if (arg.startsWith('--out-dir=')) {
      options.outDir = arg.slice('--out-dir='.length);
    } else if (arg === '--report-md') {
      options.reportMd = next || '';
      index += 1;
    } else if (arg.startsWith('--report-md=')) {
      options.reportMd = arg.slice('--report-md='.length);
    } else if (arg === '--run-live') {
      options.runLive = true;
    } else if (arg === '--dry-run') {
      options.runLive = false;
    } else if (arg === '--confirm-host') {
      options.confirmHost = next || '';
      index += 1;
    } else if (arg.startsWith('--confirm-host=')) {
      options.confirmHost = arg.slice('--confirm-host='.length);
    } else if (arg === '--allow-25') {
      options.allow25 = true;
    } else if (arg === '--allow-50') {
      options.allow50 = true;
    } else if (arg === '--order-phase') {
      options.orderPhase = true;
    } else if (arg === '--order-count') {
      options.orderCount = Number(next || options.orderCount);
      index += 1;
    } else if (arg.startsWith('--order-count=')) {
      options.orderCount = Number(arg.slice('--order-count='.length));
    } else if (arg === '--email-domain') {
      options.emailDomain = next || options.emailDomain;
      index += 1;
    } else if (arg.startsWith('--email-domain=')) {
      options.emailDomain = arg.slice('--email-domain='.length);
    } else if (arg === '--timeout-ms') {
      options.timeoutMs = Number(next || options.timeoutMs);
      index += 1;
    } else if (arg.startsWith('--timeout-ms=')) {
      options.timeoutMs = Number(arg.slice('--timeout-ms='.length));
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
    } else if (arg === '--image-size-kb') {
      options.imageSizeKb = Number(next || options.imageSizeKb);
      index += 1;
    } else if (arg.startsWith('--image-size-kb=')) {
      options.imageSizeKb = Number(arg.slice('--image-size-kb='.length));
    } else if (arg === '--video-size-mb') {
      options.videoSizeMb = Number(next || options.videoSizeMb);
      index += 1;
    } else if (arg.startsWith('--video-size-mb=')) {
      options.videoSizeMb = Number(arg.slice('--video-size-mb='.length));
    } else if (arg === '--skip-media') {
      options.skipMedia = true;
    } else if (arg === '--skip-video-put') {
      options.skipVideoPut = true;
    } else if (arg === '--cleanup-after') {
      options.cleanupAfter = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(options.tenants) || options.tenants < 1) {
    throw new Error('--tenants must be a positive number.');
  }
  if (!Number.isFinite(options.concurrency) || options.concurrency < 1) {
    throw new Error('--concurrency must be a positive number.');
  }
  if (!Number.isFinite(options.orderCount) || options.orderCount < 1) {
    throw new Error('--order-count must be a positive number.');
  }
  if (options.orderCount > 50) {
    throw new Error('Refusing --order-count > 50.');
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 1000) {
    throw new Error('--timeout-ms must be at least 1000.');
  }
  if (!/^[a-z0-9-]+$/.test(options.runId)) {
    throw new Error('--run-id may only contain lowercase letters, numbers, and hyphens.');
  }

  options.tenants = Math.floor(options.tenants);
  options.concurrency = Math.floor(options.concurrency);
  options.orderCount = Math.floor(options.orderCount);
  return options;
}

function printHelp() {
  console.log(`Multi-buyer load test

Usage:
  npm run load:multi-buyer -- --target https://makeitbetter.my.id --tenants 5
  npm run load:multi-buyer -- --target https://makeitbetter.my.id --tenants 5 --run-live --confirm-host makeitbetter.my.id

Default is dry-run. Live writes require --run-live and --confirm-host for non-local targets.

Options:
  --config <file>              JSON config file.
  --target, --url <url>        Target base URL.
  --tenants <n>                Tenant count. Default 5.
  --concurrency <n>            Concurrent tenant flows. Default 3.
  --run-id <id>                Lowercase run id. Default timestamp.
  --out-dir <dir>              JSON report directory. Default ${DEFAULT_OUT_DIR}.
  --report-md <file>           Optional markdown report path.
  --run-live                   Execute writes. Omit for dry-run.
  --confirm-host <host>        Required for non-local live target.
  --allow-25                   Required when tenants > 5.
  --allow-50                   Required when tenants > 25.
  --email-domain <domain>      Test client email domain. Default example.invalid.
  --image-size-kb <n>          Cover/gallery payload size. Default 64.
  --video-size-mb <n>          Video direct-upload payload size. Default 1.
  --skip-media                 Skip cover/gallery/video upload.
  --skip-video-put             Presign video but skip PUT body upload.
  --cleanup-after              Delete created sites after run.
  --order-phase                Also run the billing/order phase (live only). Off by default.
  --order-count <n>            Orders for the order phase. Default 5 (>5 needs --allow-25).
  --request-delay-ms <ms>      Delay between requests per tenant. Default 1500.
  --max-retries <n>            Retry count for 503/429 errors. Default 3.
`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestDelay(ms) {
  if (ms > 0) return wait(ms);
  return Promise.resolve();
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
  if (options.tenants > 50) throw new Error('Refusing tenants > 50.');

  if (!options.runLive) return;

  const targetHost = new URL(baseUrl).hostname;
  if (!isLocalTarget(baseUrl) && options.confirmHost !== targetHost) {
    throw new Error(`Live run needs --confirm-host ${targetHost}.`);
  }
  if (options.tenants > 5 && !options.allow25) {
    throw new Error('Live run with tenants > 5 needs --allow-25.');
  }
  if (options.tenants > 25 && !options.allow50) {
    throw new Error('Live run with tenants > 25 needs --allow-50.');
  }
  if (options.orderPhase) {
    if (options.orderCount > 5 && !options.allow25) {
      throw new Error('Live order phase with --order-count > 5 needs --allow-25.');
    }
    if (options.orderCount > 25 && !options.allow50) {
      throw new Error('Live order phase with --order-count > 25 needs --allow-50.');
    }
  }
}

function joinUrl(baseUrl, target) {
  if (/^https?:\/\//i.test(target)) return target;
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

function sanitizeReportPath(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/([?&]token=)[^&\s"]+/gi, '$1<redacted>');
}

function percentile(values, percentileValue) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1)
  );
  return sorted[index];
}

class Metrics {
  constructor() {
    this.requests = [];
    this.notes = [];
  }

  record(entry) {
    this.requests.push({
      timestamp: new Date().toISOString(),
      ...entry,
    });
  }

  note(message, metadata = {}) {
    this.notes.push({ timestamp: new Date().toISOString(), message, metadata });
  }

  summary() {
    const durations = this.requests.filter((r) => r.durationMs >= 0).map((r) => r.durationMs);
    const failed = this.requests.filter((r) => !r.ok).length;
    return {
      totalRequests: this.requests.length,
      failedRequests: failed,
      errorRate: this.requests.length ? failed / this.requests.length : 0,
      p50Ms: percentile(durations, 50),
      p95Ms: percentile(durations, 95),
      p99Ms: percentile(durations, 99),
    };
  }
}

class Session {
  constructor({ baseUrl, metrics, label, timeoutMs, maxRetries = 3 }) {
    this.baseUrl = baseUrl;
    this.metrics = metrics;
    this.label = label;
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

  async refreshCsrf(pathname) {
    const response = await this.request('GET', pathname, {
      name: `${this.label}.csrf`,
      expectedStatuses: [200],
    });
    const token = response.data?.csrfToken;
    if (!token) throw new Error(`${pathname} did not return csrfToken.`);
    this.csrfToken = token;
    this.setCookie(CSRF_COOKIE, token);
    return token;
  }

  async request(method, target, options = {}) {
    const maxRetries = options.maxRetries ?? this.maxRetries;
    const retryableStatuses = [429, 502, 503, 504];
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      if (attempt > 0) {
        const backoffMs = Math.min(2000 * Math.pow(2, attempt - 1), 16000);
        const jitter = Math.floor(Math.random() * 500);
        console.log(`  [retry ${attempt}/${maxRetries}] waiting ${backoffMs + jitter}ms before retrying ${options.name || target}...`);
        await wait(backoffMs + jitter);
      }

      const url = joinUrl(this.baseUrl, target);
      const headers = {
        'user-agent': options.userAgent || `${USER_AGENT} (${this.label})`,
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
      } else if (options.form) {
        body = options.form;
      } else if (options.body !== undefined) {
        body = options.body;
      }

      const started = Date.now();
      const name = options.name || `${method} ${target}`;
      const expected = options.expectedStatuses || [200];
      try {
        const response = await fetch(url, {
          method,
          headers,
          body,
          redirect: 'manual',
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        this.storeSetCookies(response.headers);
        const text = await response.text();
        const data = parseJsonMaybe(text);
        const durationMs = Date.now() - started;
        const ok = expected.includes(response.status);

        if (!ok && retryableStatuses.includes(response.status) && attempt < maxRetries) {
          console.log(`  [${name}] got ${response.status}, will retry (attempt ${attempt + 1}/${maxRetries})`);
          lastError = new Error(`${name} expected ${expected.join('/')} got ${response.status}`);
          continue;
        }

        this.metrics.record({
        tenant: options.tenant || null,
        name,
        method,
        path: sanitizeReportPath(target),
        status: response.status,
        ok,
        durationMs,
          ...(attempt > 0 ? { retries: attempt } : {}),
        });
        if (!ok) {
          const detail = typeof data === 'string' ? data.slice(0, 180) : JSON.stringify(data).slice(0, 180);
          throw new Error(`${name} expected ${expected.join('/')} got ${response.status}: ${detail}`);
        }
        return { status: response.status, data, headers: response.headers, durationMs };
      } catch (error) {
        const durationMs = Date.now() - started;
        const isRetryable = error instanceof Error && /\b(503|502|504|429|ETIMEDOUT|ECONNRESET|abort)\b/i.test(error.message);
        if (isRetryable && attempt < maxRetries) {
          console.log(`  [${name}] error: ${error.message.slice(0, 120)}, will retry`);
          lastError = error;
          continue;
        }
        this.metrics.record({
          tenant: options.tenant || null,
          name,
          method,
          path: sanitizeReportPath(target),
          status: 0,
          ok: false,
          durationMs,
          error: error instanceof Error ? error.message : String(error),
          ...(attempt > 0 ? { retries: attempt } : {}),
        });
        throw error;
      }
    }
    // All retries exhausted
    throw lastError || new Error(`${options.name || target} failed after ${maxRetries} retries`);
  }
}

function buildAdminToken(options) {
  const token = options.adminToken.trim();
  if (token) return token.replace(/^Bearer\s+/i, '');
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return '';
  return sign(
    { sub: 'admin', role: 'admin', siteId: process.env.CUSTOMER_SITE_ID || 'default-site', iat: Math.floor(Date.now() / 1000) },
    jwtSecret,
    {
      expiresIn: '2h',
      issuer: 'portfolio-admin',
      audience: 'admin-panel',
    }
  );
}

async function createAdminSession(baseUrl, options, metrics) {
  const admin = new Session({ baseUrl, metrics, label: 'admin', timeoutMs: options.timeoutMs, maxRetries: options.maxRetries });
  await admin.refreshCsrf('/api/admin/login');

  const bearer = buildAdminToken(options);
  if (bearer) {
    admin.authorization = `Bearer ${bearer}`;
    return admin;
  }

  if (!options.adminPassword) {
    throw new Error('Live run needs LOAD_TEST_ADMIN_TOKEN, JWT_SECRET, or LOAD_TEST_ADMIN_PASSWORD.');
  }

  await admin.request('POST', '/api/admin/login', {
    name: 'admin.login',
    expectedStatuses: [200],
    json: { password: options.adminPassword },
  });
  return admin;
}

/**
 * Sesi pembeli untuk mutasi konten (project + upload).
 *
 * Sejak sistem login client dihapus, mutasi lewat `validateSiteMutationRequest`
 * hanya menerima session `site_user_token` dari `POST /api/auth/login`
 * (satu akun `site_users` per deployment). Endpoint `/api/client/*` sudah tidak ada.
 */
async function createSiteUserSession(baseUrl, options, metrics) {
  const session = new Session({
    baseUrl,
    metrics,
    label: 'site_user',
    timeoutMs: options.timeoutMs,
    maxRetries: options.maxRetries,
  });
  await session.refreshCsrf('/api/admin/login');

  if (!options.siteUserEmail || !options.siteUserPassword) {
    throw new Error(
      'Live run needs LOAD_TEST_SITE_USER_EMAIL and LOAD_TEST_SITE_USER_PASSWORD (panel account from /setup or reset-customer-password.ts).'
    );
  }

  await session.request('POST', '/api/auth/login', {
    name: 'site_user.login',
    expectedStatuses: [200],
    json: { email: options.siteUserEmail, password: options.siteUserPassword },
  });
  return session;
}

function makeImagePayload(kb) {
  const pngHeader = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000150a0f53a0000000049454e44ae426082',
    'hex'
  );
  const size = Math.max(pngHeader.length, Math.floor(kb * 1024));
  return Buffer.concat([pngHeader, Buffer.alloc(size - pngHeader.length)]);
}

function makeTenantPlan(options) {
  return Array.from({ length: options.tenants }, (_, index) => {
    const n = String(index + 1).padStart(3, '0');
    const slug = `lt-${options.runId}-${n}`.slice(0, 64).replace(/-+$/g, '');
    return {
      index: index + 1,
      slug,
      name: `Load Test ${options.runId} ${n}`,
      email: `loadtest+${options.runId}-${n}@${options.emailDomain}`,
      password: `LoadTest-${options.runId}-${n}!`,
    };
  });
}

/**
 * Rencana buyer untuk fase order.
 *
 * Slug diawali nomor urut (bukan diakhiri) supaya tetap unik walau runId panjang
 * terpotong oleh batas slug 30 karakter di validateSlugFormat. Email memakai
 * LOAD_TEST_EMAIL_DOMAIN (default example.invalid) — satu email per order agar
 * tidak kena rate limit 5 order/jam per email dan tidak pernah meng inbox
 * pembeli nyata.
 */
function makeOrderPlan(options) {
  return Array.from({ length: options.orderCount }, (_, index) => {
    const n = String(index + 1).padStart(2, '0');
    const slug = `o${n}-${options.runId}`
      .replace(/-+/g, '-')
      .slice(0, 30)
      .replace(/-+$/g, '');
    return {
      index: index + 1,
      slug,
      name: `Load Test Order ${options.runId} ${n}`,
      email: `order+${options.runId}-${n}@${options.emailDomain}`,
      whatsapp: `6280000000${String(index + 1).padStart(4, '0')}`,
    };
  });
}

function projectPayload({ tenant, siteId, coverUrl, galleryItems, status, suffix }) {
  return {
    siteId,
    title: `Load Test Project ${tenant.index}${suffix ? ` ${suffix}` : ''}`,
    client: `Load Tenant ${tenant.index}`,
    year: new Date().getFullYear(),
    tags: ['load-test', tenant.slug],
    description: 'Synthetic project generated for Portfolio OS multi-buyer load testing.',
    cover: coverUrl,
    coverWidth: 800,
    coverHeight: 600,
    status,
    role: 'QA',
    timeline: 'Synthetic',
    team: 'Automation',
    software: ['Portfolio OS'],
    type: 'commercial',
    galleryItems,
    narrative: {
      context: 'Load test',
      challenge: 'Concurrent tenant workflow',
      solution: 'Automated synthetic buyer flow',
      impact: 'Operational confidence',
    },
  };
}

async function uploadImage(session, tenant, siteId, endpoint, filename, name, options, metrics) {
  const form = new FormData();
  const payload = makeImagePayload(options.imageSizeKb);
  form.append('file', new Blob([payload], { type: 'image/png' }), filename);
  const response = await session.request('POST', endpoint, {
    tenant: tenant.slug,
    name,
    form,
    expectedStatuses: [200],
  });
  metrics.note(`${name} stored`, { tenant: tenant.slug, key: response.data?.key });
  if (!response.data?.publicUrl) throw new Error(`${name} response missing publicUrl.`);
  return response.data;
}

async function uploadVideo(session, tenant, siteId, options, metrics) {
  const videoBytes = Math.max(1, Math.floor(options.videoSizeMb * 1024 * 1024));
  const presign = await session.request('POST', `/api/admin/sites/${siteId}/project-video/presign`, {
    tenant: tenant.slug,
    name: 'video.presign',
    json: {
      fileName: `${tenant.slug}.mp4`,
      contentType: 'video/mp4',
      size: videoBytes,
    },
    expectedStatuses: [200],
  });

  if (!options.skipVideoPut) {
    const isWorkerUpload = !/^https?:\/\//i.test(presign.data.uploadUrl);
    const uploadUrl = joinUrl(session.baseUrl, presign.data.uploadUrl);
    const headers = {
      'user-agent': USER_AGENT,
      'content-type': 'video/mp4',
    };
    if (isWorkerUpload) {
      headers[CSRF_HEADER] = session.csrfToken;
      headers.cookie = session.cookieHeader();
    }
    const started = Date.now();
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers,
      body: Buffer.alloc(videoBytes),
      signal: AbortSignal.timeout(options.timeoutMs),
    });
    const durationMs = Date.now() - started;
    const ok = response.status >= 200 && response.status < 300;
    metrics.record({
      tenant: tenant.slug,
      name: 'video.put',
      method: 'PUT',
      path: sanitizeReportPath(presign.data.uploadUrl),
      status: response.status,
      ok,
      durationMs,
    });
    if (!ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`video.put expected 2xx got ${response.status}: ${text.slice(0, 180)}`);
    }
  }

  return presign.data;
}

async function tenantFlow(tenant, admin, siteUser, options, metrics) {
  const result = {
    tenant: tenant.slug,
    siteId: null,
    projectId: null,
    ok: false,
    skipped: [],
    error: null,
  };
  // Sesi anonim khusus untuk request public (tanpa cookie login).
  const visitor = new Session({
    baseUrl: admin.baseUrl,
    metrics,
    label: `visitor.${tenant.slug}`,
    timeoutMs: options.timeoutMs,
    maxRetries: options.maxRetries,
  });
  const delay = options.requestDelayMs;

  try {
    let site;
    try {
      const createdSite = await admin.request('POST', '/api/admin/sites', {
        tenant: tenant.slug,
        name: 'site.create',
        expectedStatuses: [201],
        json: {
          name: tenant.name,
          slug: tenant.slug,
          status: 'active',
        },
      });
      site = createdSite.data?.site;
    } catch (createErr) {
      const errMsg = createErr instanceof Error ? createErr.message : String(createErr);
      if (errMsg.includes('409') || errMsg.includes('already used')) {
        const listRes = await admin.request('GET', '/api/admin/sites', {
          tenant: tenant.slug,
          name: 'site.fetch_existing',
          expectedStatuses: [200],
        });
        site = (listRes.data?.sites || []).find((s) => s.slug === tenant.slug);
      }
      if (!site) throw createErr;
    }
    if (!site?.id) throw new Error('site.create response missing site.id.');
    result.siteId = site.id;

    await requestDelay(delay);
    await visitor.request('GET', '/projects', {
      tenant: tenant.slug,
      name: 'public.visit',
      expectedStatuses: [200, 307, 308],
    });
    await requestDelay(delay);

    let coverUrl = 'https://example.invalid/portfolio-os-load-test-cover.png';
    const galleryItems = [];
    if (!options.skipMedia) {
      await requestDelay(delay);
      const cover = await uploadImage(
        siteUser,
        tenant,
        site.id,
        `/api/admin/sites/${site.id}/project-cover`,
        `${tenant.slug}-cover.png`,
        'cover.upload',
        options,
        metrics
      );
      await requestDelay(delay);
      const gallery = await uploadImage(
        siteUser,
        tenant,
        site.id,
        `/api/admin/sites/${site.id}/project-media`,
        `${tenant.slug}-gallery.png`,
        'gallery.upload',
        options,
        metrics
      );
      await requestDelay(delay);
      const video = await uploadVideo(siteUser, tenant, site.id, options, metrics);
      coverUrl = cover.publicUrl;
      galleryItems.push({
        kind: 'image',
        src: gallery.publicUrl,
        alt: `${tenant.slug} gallery`,
        isActive: true,
      });
      galleryItems.push({
        kind: 'video',
        src: video.publicUrl,
        poster: video.posterUrl,
        alt: `${tenant.slug} video`,
        isActive: true,
      });
    } else {
      result.skipped.push('media');
    }

    await requestDelay(delay);
    const draftProject = await siteUser.request('POST', '/api/projects', {
      tenant: tenant.slug,
      name: 'project.create_draft',
      expectedStatuses: [201],
      json: projectPayload({
        tenant,
        siteId: site.id,
        coverUrl,
        galleryItems,
        status: 'draft',
        suffix: 'Draft',
      }),
    });
    const project = draftProject.data?.data;
    if (!project?.id) throw new Error('project.create_draft response missing data.id.');
    result.projectId = project.id;

    await requestDelay(delay);
    await siteUser.request('PUT', `/api/projects/${project.id}`, {
      tenant: tenant.slug,
      name: 'project.publish',
      expectedStatuses: [200],
      json: {
        ...projectPayload({
          tenant,
          siteId: site.id,
          coverUrl,
          galleryItems,
          status: 'published',
          suffix: 'Published',
        }),
      },
    });

    result.ok = true;
    result.client = visitor;
    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    result.client = visitor;
    return result;
  }
}

async function runIsolationChecks() {
  // Check isolation lintas-tenant sengaja di-retire (v1.3.16).
  // Dulu check ini memakai dua sesi login client yang berbeda (satu per tenant)
  // untuk membuktikan site A tidak bisa menulis/membaca site B. Sistem login
  // client dihapus (v1.3.14) dan sekarang hanya ada satu akun panel per
  // deployment, jadi tidak ada lagi sesi per tenant untuk dibandingkan;
  // check-nya justru akan selalu lolos secara palsu.
  // Kalau kelak ada isolation test baru, bangun di atas session site_user yang
  // benar-benar berbeda per tenant, bukan dari sesi yang sama.
  return {
    skipped: true,
    passed: [],
    failed: [],
    reason: "Per-tenant client sessions no longer exist; the client login system was removed.",
  };
}

async function cleanupSites(admin, results, options, metrics) {
  const cleanup = [];
  const delay = options.requestDelayMs;
  for (const result of results.filter((item) => item.siteId)) {
    try {
      await requestDelay(delay);
      const response = await admin.request('DELETE', '/api/admin/sites', {
        tenant: result.tenant,
        name: 'cleanup.site_delete',
        expectedStatuses: [200],
        json: {
          id: result.siteId,
          confirmSlug: result.tenant,
          deleteMedia: true,
        },
      });
      cleanup.push({ tenant: result.tenant, siteId: result.siteId, ok: true, data: response.data });
    } catch (error) {
      cleanup.push({
        tenant: result.tenant,
        siteId: result.siteId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
      metrics.record({
        tenant: result.tenant,
        name: 'cleanup.failure',
        method: 'DELETE',
        path: '/api/admin/sites',
        status: 0,
        ok: false,
        durationMs: 0,
      });
    }
  }
  return cleanup;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Fase order/billing (opsional — default MATI, butuh --order-phase + --run-live).
 *
 * Kontrak API dibaca dari kode, bukan ditebak (READ-ONLY):
 * - POST /api/billing/checkout — publik, guard same-origin (header Origin harus
 *   cocok dengan host), rate limit 5/menit per IP + 5/jam per email. Amount TIDAK
 *   boleh dikontrol klien: route tidak meneruskan amount, server menarik nominal
 *   unik dari pool (idx_orders_amount_active), jadi amount tiap order selalu unik.
 * - GET /api/billing/orders/:id?token= — halaman status order (token akses per-order).
 * - POST /api/admin/orders { action: 'cancel' } — cleanup memakai sesi admin yang
 *   sama dengan fase lain (auth Bearer + CSRF double-submit).
 *
 * Notifikasi: checkout mengirim pesan Telegram ke bot ADMIN (bukan pembeli) dan
 * struk email hanya dikirim bila NOTIFICATION_PROVIDER=resend — alamat tiap order
 * memakai LOAD_TEST_EMAIL_DOMAIN (default example.invalid) sehingga tidak pernah
 * mengganggu pembeli nyata.
 *
 * Cleanup berjalan di blok finally: order yang sudah dibuat tetap dibatalkan
 * walau phase gagal di tengah. Kalau proses mati sebelum cleanup, order sisa
 * tetap pending_payment dan otomatis expire 24 jam (sweeper harian) sehingga
 * nominal unik + slug dilepas kembali; manual cleanup: POST /api/admin/orders
 * dengan action "cancel" (atau tombol batalkan di panel Orders admin).
 */
async function runOrderPhase(baseUrl, admin, options, metrics) {
  const plan = makeOrderPlan(options);
  const result = {
    enabled: true,
    requested: plan.length,
    skipped: null,
    basePrice: null,
    created: 0,
    readOk: 0,
    canceled: 0,
    failures: [],
    remaining: [],
  };
  const delay = options.requestDelayMs;
  // Sesi anonim khusus jalur publik checkout/status (tanpa cookie login),
  // meniru pembeli asli yang membuka halaman order.
  const buyer = new Session({
    baseUrl,
    metrics,
    label: 'order.buyer',
    timeoutMs: options.timeoutMs,
    maxRetries: options.maxRetries,
  });

  // Preflight: baca info pembayaran publik. Kalau penerimaan pembayaran mati,
  // checkout selalu membalas 400 "Pembayaran sedang tidak aktif" — phase
  // dilewati dengan alasan jelas, bukan dihitung sebagai error.
  try {
    const paymentInfo = await buyer.request('GET', '/api/billing/payment-info', {
      name: 'order.payment_info',
      expectedStatuses: [200],
    });
    result.basePrice = paymentInfo.data?.basePrice ?? null;
    if (paymentInfo.data && paymentInfo.data.isActive !== true) {
      result.skipped = 'payment reception inactive (payment_config.isActive=false)';
      metrics.note('Order phase skipped: payment reception inactive.', {
        basePrice: result.basePrice,
      });
      return result;
    }
  } catch (error) {
    result.failures.push({ step: 'payment_info', error: errorMessage(error) });
    return result;
  }

  const created = [];
  try {
    for (const item of plan) {
      await requestDelay(Math.max(delay, ORDER_CHECKOUT_MIN_INTERVAL_MS));
      try {
        const response = await buyer.request('POST', '/api/billing/checkout', {
          tenant: item.slug,
          name: 'order.checkout',
          expectedStatuses: [200],
          // Same-origin guard di route & middleware: kirim Origin seperti browser.
          headers: { origin: baseUrl },
          json: {
            buyerName: item.name,
            buyerEmail: item.email,
            buyerWhatsapp: item.whatsapp,
            desiredSlug: item.slug,
          },
        });
        const orderId = response.data?.order?.id;
        const accessToken = response.data?.accessToken;
        if (!orderId || !accessToken) {
          throw new Error('checkout response missing order.id/accessToken.');
        }
        created.push({ ...item, orderId, accessToken });
        result.created += 1;
        metrics.note('order.checkout created', { slug: item.slug, orderId, amount: response.data?.order?.amount });
      } catch (error) {
        // Order gagal dibuat tidak menyisakan sampah — lanjut ke order berikutnya.
        result.failures.push({ step: 'checkout', slug: item.slug, error: errorMessage(error) });
      }
    }

    // Halaman status order dibaca memakai token akses per-order (bukan sesi admin).
    for (const order of created) {
      await requestDelay(Math.max(delay, ORDER_STATUS_MIN_INTERVAL_MS));
      try {
        const response = await buyer.request(
          'GET',
          `/api/billing/orders/${order.orderId}?token=${order.accessToken}`,
          {
            tenant: order.slug,
            name: 'order.status_read',
            expectedStatuses: [200],
          }
        );
        if (response.data?.order?.id !== order.orderId) {
          throw new Error('status response mismatched order id.');
        }
        result.readOk += 1;
      } catch (error) {
        result.failures.push({
          step: 'status_read',
          orderId: order.orderId,
          error: errorMessage(error),
        });
      }
    }
  } finally {
    // Cleanup SELALU jalan, termasuk saat phase melempar error di tengah jalan.
    for (const order of created) {
      await requestDelay(delay);
      try {
        const response = await admin.request('POST', '/api/admin/orders', {
          tenant: order.slug,
          name: 'order.cleanup_cancel',
          expectedStatuses: [200],
          json: {
            orderId: order.orderId,
            action: 'cancel',
            cancelReason: ORDER_CANCEL_REASON,
          },
        });
        if (response.data?.success !== true || response.data?.order?.status !== 'canceled') {
          throw new Error('cancel response did not confirm canceled status.');
        }
        result.canceled += 1;
      } catch (error) {
        result.failures.push({
          step: 'cleanup_cancel',
          orderId: order.orderId,
          error: errorMessage(error),
        });
        result.remaining.push(order.orderId);
      }
    }

    if (result.remaining.length > 0) {
      metrics.note('MANUAL CLEANUP REQUIRED: order ids below are still open.', {
        orderIds: result.remaining,
        howTo: 'POST /api/admin/orders {"orderId":"<id>","action":"cancel"} with admin session, or wait for the 24h pending_payment sweeper.',
      });
    }
  }

  return result;
}

async function runPool(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await worker(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

function buildReport({ options, baseUrl, dryRunPlan, tenantResults, isolation, cleanup, orders, metrics, startedAt, finishedAt }) {
  const summary = metrics.summary();
  const tenantOk = tenantResults.filter((r) => r.ok).length;
  const tenantFailed = tenantResults.length - tenantOk;
  const cleanupOk = cleanup ? cleanup.filter((r) => r.ok).length : 0;
  const cleanupFailed = cleanup ? cleanup.length - cleanupOk : 0;
  const ordersOk = !orders || (orders.failures.length === 0 && orders.remaining.length === 0);
  const pass =
    options.runLive &&
    tenantFailed === 0 &&
    (!isolation || isolation.failed.length === 0) &&
    (!cleanup || cleanupFailed === 0) &&
    ordersOk &&
    summary.errorRate < 0.01;

  return {
    type: 'portfolio_os_multi_buyer_load_test',
    generatedAt: finishedAt,
    startedAt,
    finishedAt,
    mode: options.runLive ? 'live' : 'dry-run',
    target: baseUrl,
    runId: options.runId,
    tenantsRequested: options.tenants,
    concurrency: options.concurrency,
    pass,
    summary: {
      ...summary,
      tenantsPassed: tenantOk,
      tenantsFailed: tenantFailed,
      cleanupPassed: cleanupOk,
      cleanupFailed,
    },
    safety: {
      runLive: options.runLive,
      confirmHost: options.confirmHost,
      allow25: options.allow25,
      allow50: options.allow50,
      cleanupAfter: options.cleanupAfter,
    },
    dryRunPlan,
    tenantResults: tenantResults.map(({ client, ...result }) => result),
    isolation,
    cleanup,
    orders,
    requests: metrics.requests,
    notes: metrics.notes,
  };
}

function orderPhaseSummary(orders) {
  if (!orders) return null;
  if (orders.skipped) return `skipped (${orders.skipped})`;
  return `${orders.created}/${orders.requested} created, ${orders.readOk}/${orders.created} status reads, ${orders.canceled}/${orders.created} canceled, ${orders.failures.length} failures`;
}

function markdownReport(report) {
  const orderLine = orderPhaseSummary(report.orders);
  const lines = [
    `# Multi Buyer Load Test - ${report.runId}`,
    '',
    `- Status: ${report.pass ? 'PASS' : report.mode === 'dry-run' ? 'DRY-RUN ONLY' : 'FAIL'}`,
    `- Mode: ${report.mode}`,
    `- Target: ${report.target}`,
    `- Started: ${report.startedAt}`,
    `- Finished: ${report.finishedAt}`,
    `- Tenants: ${report.summary.tenantsPassed}/${report.tenantsRequested} passed`,
    `- Requests: ${report.summary.totalRequests}, failed ${report.summary.failedRequests}, error rate ${(report.summary.errorRate * 100).toFixed(2)}%`,
    `- Latency: p50 ${report.summary.p50Ms}ms, p95 ${report.summary.p95Ms}ms, p99 ${report.summary.p99Ms}ms`,
    `- Isolation failures: ${report.isolation?.failed?.length ?? 0}`,
    `- Cleanup failures: ${report.summary.cleanupFailed}`,
    ...(orderLine ? [`- Orders: ${orderLine}`] : []),
    '',
  ];

  if (report.mode === 'dry-run') {
    lines.push('Live traffic was not executed. Use `--run-live` with host confirmation after Sprint 45 full-pass.');
    lines.push('');
  }

  const failedTenants = report.tenantResults.filter((tenant) => !tenant.ok);
  if (failedTenants.length > 0) {
    lines.push('## Failed Tenants', '');
    for (const tenant of failedTenants) {
      lines.push(`- ${tenant.tenant}: ${tenant.error}`);
    }
    lines.push('');
  }

  if (report.isolation?.failed?.length) {
    lines.push('## Isolation Failures', '');
    for (const failure of report.isolation.failed) {
      lines.push(`- ${failure.check}: ${failure.error}`);
    }
    lines.push('');
  }

  if (report.orders?.failures?.length) {
    lines.push('## Order Phase Failures', '');
    for (const failure of report.orders.failures) {
      const subject = failure.orderId || failure.slug || '';
      lines.push(`- ${failure.step}${subject ? ` ${subject}` : ''}: ${failure.error}`);
    }
    lines.push('');
  }

  if (report.orders?.remaining?.length) {
    lines.push('## Orders Needing Manual Cleanup', '');
    for (const orderId of report.orders.remaining) {
      lines.push(`- ${orderId} (POST /api/admin/orders action "cancel", or wait for the 24h sweeper)`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

async function writeReports(report, options) {
  const outDir = path.resolve(process.cwd(), options.outDir);
  await fs.promises.mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, `multi-buyer-${options.runId}.json`);
  const mdPath = options.reportMd
    ? path.resolve(process.cwd(), options.reportMd)
    : path.join(outDir, `multi-buyer-${options.runId}.md`);

  await fs.promises.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await fs.promises.mkdir(path.dirname(mdPath), { recursive: true });
  await fs.promises.writeFile(mdPath, markdownReport(report), 'utf8');
  return { jsonPath, mdPath };
}

async function main() {
  const startedAt = new Date().toISOString();
  const options = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(options.target);
  enforceSafety(options, baseUrl);
  const metrics = new Metrics();
  const tenants = makeTenantPlan(options);

  console.log(`Multi-buyer load target: ${baseUrl}`);
  console.log(`Run id: ${options.runId}`);
  console.log(`Mode: ${options.runLive ? 'live' : 'dry-run'}`);
  console.log(`Tenants: ${options.tenants}, concurrency: ${options.concurrency}`);

  let tenantResults = [];
  let isolation = null;
  let cleanup = null;
  let orders = null;

  if (!options.runLive) {
    tenantResults = tenants.map((tenant) => ({
      tenant: tenant.slug,
      siteId: null,
      projectId: null,
      ok: true,
      skipped: ['live_write'],
      error: null,
    }));
    metrics.note('Dry-run only. No HTTP writes executed.', {
      blocker: 'Sprint 45 full-pass required before Sprint 46 live load test.',
    });
    if (options.orderPhase) {
      orders = {
        enabled: true,
        requested: options.orderCount,
        skipped: 'dry-run',
        basePrice: null,
        created: 0,
        readOk: 0,
        canceled: 0,
        failures: [],
        remaining: [],
      };
      metrics.note('Order phase planned but skipped (dry-run).', {
        count: options.orderCount,
        plan: makeOrderPlan(options),
      });
    }
  } else {
    const admin = await createAdminSession(baseUrl, options, metrics);
    const siteUser = await createSiteUserSession(baseUrl, options, metrics);
    tenantResults = await runPool(tenants, options.concurrency, (tenant) =>
      tenantFlow(tenant, admin, siteUser, options, metrics)
    );
    isolation = await runIsolationChecks();
    if (options.cleanupAfter) cleanup = await cleanupSites(admin, tenantResults, options, metrics);
    if (options.orderPhase) orders = await runOrderPhase(baseUrl, admin, options, metrics);
  }

  const finishedAt = new Date().toISOString();
  const report = buildReport({
    options,
    baseUrl,
    dryRunPlan: options.runLive ? null : tenants,
    tenantResults,
    isolation,
    cleanup,
    orders,
    metrics,
    startedAt,
    finishedAt,
  });
  const paths = await writeReports(report, options);

  console.log(`Report JSON: ${paths.jsonPath}`);
  console.log(`Report MD: ${paths.mdPath}`);
  console.log(
    `Summary: tenants ${report.summary.tenantsPassed}/${report.tenantsRequested}, requests ${report.summary.totalRequests}, failed ${report.summary.failedRequests}, error ${(report.summary.errorRate * 100).toFixed(2)}%, p95 ${report.summary.p95Ms}ms`
  );
  if (orders) {
    const orderSummary = orderPhaseSummary(orders);
    console.log(`Orders: ${orderSummary}`);
    if (orders.remaining.length > 0) {
      console.warn(`MANUAL CLEANUP REQUIRED for orders: ${orders.remaining.join(', ')}`);
    }
  }

  if (options.runLive && !report.pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
