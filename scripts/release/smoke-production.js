#!/usr/bin/env node

const DEFAULT_SITE_SLUG = 'demo-designer';

function parseArgs(argv) {
  const options = {
    url: process.env.PRODUCTION_SMOKE_URL || '',
    siteSlug: process.env.PRODUCTION_SMOKE_SITE_SLUG || DEFAULT_SITE_SLUG,
    allowLocalhost: false,
    skipFfmpeg: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith('--url=')) {
      options.url = arg.slice('--url='.length);
    } else if (arg === '--url') {
      options.url = argv[index + 1] || '';
      index += 1;
    } else if (arg.startsWith('--site-slug=')) {
      options.siteSlug = arg.slice('--site-slug='.length);
    } else if (arg === '--site-slug') {
      options.siteSlug = argv[index + 1] || DEFAULT_SITE_SLUG;
      index += 1;
    } else if (arg === '--allow-localhost') {
      options.allowLocalhost = true;
    } else if (arg === '--skip-ffmpeg') {
      options.skipFfmpeg = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Production smoke test

Usage:
  npm run release:smoke -- --url https://your-domain.example --site-slug demo-designer

Options:
  --url=<url>          Production base URL. Can also use PRODUCTION_SMOKE_URL.
  --site-slug=<slug>  Public site slug to verify. Default: ${DEFAULT_SITE_SLUG}.
  --skip-ffmpeg       Skip /r2/ffmpeg HEAD checks.
  --allow-localhost   Allow localhost URL for testing the smoke script itself.
`);
}

function normalizeBaseUrl(rawUrl, allowLocalhost) {
  if (!rawUrl) {
    throw new Error('Missing --url or PRODUCTION_SMOKE_URL.');
  }

  const parsed = new URL(rawUrl);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Smoke URL must use http or https.');
  }

  const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  if (isLocalhost && !allowLocalhost) {
    throw new Error('Refusing localhost smoke without --allow-localhost.');
  }

  parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/+$/, '');
}

function joinUrl(baseUrl, path) {
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

async function requestCheck({
  baseUrl,
  method = 'GET',
  path,
  expectedStatus = 200,
  expectedStatuses,
  bodyIncludes,
}) {
  const url = joinUrl(baseUrl, path);
  const started = Date.now();
  const response = await fetch(url, {
    method,
    redirect: 'manual',
    headers: {
      'user-agent': 'portfolio-os-release-smoke/1.0',
    },
  });
  const durationMs = Date.now() - started;
  const acceptableStatuses = expectedStatuses || [expectedStatus];

  if (!acceptableStatuses.includes(response.status)) {
    throw new Error(
      `${method} ${path} expected ${acceptableStatuses.join(' or ')}, got ${response.status}`
    );
  }

  if (bodyIncludes && response.status === 200) {
    const body = await response.clone().text();
    if (!body.includes(bodyIncludes)) {
      throw new Error(`${method} ${path} response did not include expected marker.`);
    }
  }

  return {
    method,
    path,
    status: response.status,
    durationMs,
    contentType: response.headers.get('content-type') || '',
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(options.url, options.allowLocalhost);
  const encodedSiteSlug = encodeURIComponent(options.siteSlug);

  const checks = [
    { path: '/api/health' },
    { path: '/' },
    { path: '/client/login' },
    {
      path: `/${encodedSiteSlug}/login`,
      expectedStatuses: [200, 307],
      bodyIncludes: `/client/login?site=${encodedSiteSlug}`,
    },
    { path: '/client/reset-password' },
    { path: '/client/dashboard' },
    { path: `/api/public/sites/${encodedSiteSlug}` },
    { path: `/api/public/sites/${encodedSiteSlug}/projects` },
  ];

  if (!options.skipFfmpeg) {
    checks.push(
      { method: 'HEAD', path: '/r2/ffmpeg/ffmpeg-core.js' },
      { method: 'HEAD', path: '/r2/ffmpeg/ffmpeg-core.wasm' }
    );
  }

  console.log(`Production smoke target: ${baseUrl}`);
  console.log(`Site slug: ${options.siteSlug}`);

  const results = [];
  for (const check of checks) {
    const result = await requestCheck({ baseUrl, ...check });
    results.push(result);
    console.log(
      `[pass] ${result.method} ${result.path} -> ${result.status} (${result.durationMs}ms)`
    );
  }

  console.log('');
  console.log(`Summary: ${results.length}/${checks.length} checks passed.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
