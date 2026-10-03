#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

const WORKERS_ASSET_LIMIT_BYTES = 25 * 1024 * 1024;
const FFMPEG_R2_PROXY_BASE_URL = '/r2/ffmpeg';

function loadLocalEnvForBuildNotices() {
  try {
    const dotenv = require('dotenv');
    for (const file of ['.env.local', '.env']) {
      const envPath = path.resolve(process.cwd(), file);
      if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath, override: false, quiet: true });
      }
    }
  } catch {
    // Build notices must never fail the Worker output patch step.
  }
}

function normalizeFfmpegBaseUrl(value) {
  return String(value || '')
    .trim()
    .replace(/\/+$/, '');
}

function getFfmpegBaseUrlStatus() {
  const normalized = normalizeFfmpegBaseUrl(process.env.NEXT_PUBLIC_FFMPEG_BASE_URL);
  if (!normalized) {
    return {
      ok: false,
      detail: `NEXT_PUBLIC_FFMPEG_BASE_URL is empty. Set it to ${FFMPEG_R2_PROXY_BASE_URL}.`,
    };
  }

  if (normalized === '/ffmpeg') {
    return {
      ok: false,
      detail: `NEXT_PUBLIC_FFMPEG_BASE_URL points to /ffmpeg, but public/ffmpeg is removed from Worker assets. Use ${FFMPEG_R2_PROXY_BASE_URL}.`,
    };
  }

  return { ok: true, detail: normalized };
}

function shouldShowFfmpegBuildInfo() {
  return process.env.CLOUDFLARE_BUILD_VERBOSE_FFMPEG === 'true';
}

function walkFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function patchBrowserOnlyFfmpegWasmImports(serverDir) {
  const files = walkFiles(serverDir).filter((file) => /\.(?:mjs|js)$/.test(file));
  let patchedFiles = 0;
  let patchedImports = 0;

  for (const file of files) {
    const original = fs.readFileSync(file, 'utf8');
    let importCount = 0;
    const patched = original.replace(/import\("[^"]*ffmpeg-core\.wasm"\)/g, () => {
      importCount += 1;
      return 'Promise.reject(new Error("Browser-only FFmpeg WASM is not available in the Cloudflare Worker server bundle"))';
    });

    if (patched !== original) {
      fs.writeFileSync(file, patched);
      patchedFiles += 1;
      patchedImports += importCount;
    }
  }

  if (patchedImports > 0) {
    if (shouldShowFfmpegBuildInfo()) {
      console.log(
        `[cloudflare-build] Patched ${patchedImports} browser-only FFmpeg WASM import(s) from ${patchedFiles} server bundle file(s).`
      );
    }
  }
}

function removeBrowserOnlyFfmpegAssets(openNextDir) {
  const copiedServerFfmpeg = path.join(
    openNextDir,
    'server-functions',
    'default',
    'public',
    'ffmpeg'
  );
  const workerAssetFfmpeg = path.join(openNextDir, 'assets', 'ffmpeg');

  if (fs.existsSync(copiedServerFfmpeg)) {
    fs.rmSync(copiedServerFfmpeg, { recursive: true, force: true });
    if (shouldShowFfmpegBuildInfo()) {
      console.log('[cloudflare-build] Removed server-function copy of public/ffmpeg.');
    }
  }

  if (!fs.existsSync(workerAssetFfmpeg)) return;

  const wasmPath = path.join(workerAssetFfmpeg, 'ffmpeg-core.wasm');
  const wasmSize = fs.existsSync(wasmPath) ? fs.statSync(wasmPath).size : 0;

  if (wasmSize > WORKERS_ASSET_LIMIT_BYTES) {
    fs.rmSync(workerAssetFfmpeg, { recursive: true, force: true });
    const baseUrlStatus = getFfmpegBaseUrlStatus();
    if (!baseUrlStatus.ok) {
      console.warn(
        '[cloudflare-build] Browser FFmpeg assets were removed from Worker assets because ffmpeg-core.wasm exceeds the 25 MiB Cloudflare Workers asset limit.'
      );
      console.warn(`[cloudflare-build] ${baseUrlStatus.detail}`);
      console.warn(
        '[cloudflare-build] Run `npm run r2:upload-ffmpeg`, then `npm run cf:readiness` to verify R2 objects.'
      );
    } else if (shouldShowFfmpegBuildInfo()) {
      console.log(
        `[cloudflare-build] Browser FFmpeg assets stay external to Worker assets and use ${baseUrlStatus.detail}.`
      );
    }
  }
}

function assertWorkersAssetSizes(openNextDir) {
  const assetsDir = path.join(openNextDir, 'assets');
  const oversized = walkFiles(assetsDir)
    .map((file) => ({ file, size: fs.statSync(file).size }))
    .filter((entry) => entry.size > WORKERS_ASSET_LIMIT_BYTES);

  if (oversized.length === 0) return;

  const details = oversized
    .map((entry) => {
      const relative = path.relative(assetsDir, entry.file);
      const mb = (entry.size / 1024 / 1024).toFixed(2);
      return `- ${relative} (${mb} MiB)`;
    })
    .join('\n');

  throw new Error(
    [
      'Cloudflare Workers asset limit exceeded.',
      'Move these files to R2 or reduce their size before deploy:',
      details,
    ].join('\n')
  );
}

function minifyMiddlewareBundle(openNextDir) {
  const middlewareHandler = path.join(openNextDir, 'middleware', 'handler.mjs');

  if (!fs.existsSync(middlewareHandler)) return;

  const original = fs.readFileSync(middlewareHandler, 'utf8');
  const minified = esbuild.transformSync(original, {
    format: 'esm',
    minify: true,
    target: 'es2022',
  }).code;

  if (minified.length >= original.length) return;

  fs.writeFileSync(middlewareHandler, minified);
  const savedKb = ((original.length - minified.length) / 1024).toFixed(1);
  console.log(`[cloudflare-build] Minified middleware bundle, saved ${savedKb} KiB.`);
}

function disableNodeInstrumentationDynamicRequire(serverDir) {
  const handlerPath = path.join(serverDir, 'handler.mjs');

  if (!fs.existsSync(handlerPath)) return;

  const original = fs.readFileSync(handlerPath, 'utf8');
  const functionStart = original.indexOf('async function getInstrumentationModule(');

  if (functionStart === -1) return;

  const marker = 'var instrumentationModulePromise=';
  const markerIndex = original.indexOf(marker, functionStart);
  const signatureEnd = original.indexOf('){', functionStart);

  if (markerIndex === -1 || signatureEnd === -1 || signatureEnd > markerIndex) {
    throw new Error('Unable to patch Next.js instrumentation resolver in OpenNext output.');
  }

  const functionSignature = original.slice(functionStart, signatureEnd + 1);
  const replacement = `${functionSignature}{return void 0}`;
  const patched = original.slice(0, functionStart) + replacement + original.slice(markerIndex);

  if (patched === original) return;

  fs.writeFileSync(handlerPath, patched);
  console.log(
    '[cloudflare-build] Disabled Node-style Next.js instrumentation dynamic require for Worker runtime.'
  );
}

function patchNextCacheHandlersClosure(serverDir) {
  const handlerPath = path.join(serverDir, 'handler.mjs');

  if (!fs.existsSync(handlerPath)) return;

  const original = fs.readFileSync(handlerPath, 'utf8');
  const brokenReference =
    't&&(0,_handlers.initializeCacheHandlers)(e))for(let[e2,r]of Object.entries(t))';
  const fixedReference =
    'this.nextConfig.cacheHandlers&&(0,_handlers.initializeCacheHandlers)(this.nextConfig.cacheMaxMemorySize))for(let[e2,r]of Object.entries(this.nextConfig.cacheHandlers))';

  if (!original.includes(brokenReference)) return;

  fs.writeFileSync(handlerPath, original.replace(brokenReference, fixedReference));
  console.log(
    '[cloudflare-build] Patched Next.js cacheHandlers closure references for Worker runtime.'
  );
}

function patchKnownVendorDuplicateCase(serverDir) {
  const handlerPath = path.join(serverDir, 'handler.mjs');

  if (!fs.existsSync(handlerPath)) return;

  const original = fs.readFileSync(handlerPath, 'utf8');
  const unreachableCase = 'case 22:return Yn(t3,1,10999,Wn,3,r2);';

  if (!original.includes(unreachableCase)) return;

  fs.writeFileSync(handlerPath, original.replace(unreachableCase, ''));
  console.log(
    '[cloudflare-build] Removed unreachable duplicate vendor case from Worker server bundle.'
  );
}

function appendScheduledCronHandler(openNextDir) {
  const workerPath = path.join(openNextDir, 'worker.js');

  if (!fs.existsSync(workerPath)) {
    throw new Error('Unable to add cron handler: .open-next/worker.js not found.');
  }

  const original = fs.readFileSync(workerPath, 'utf8');
  if (original.includes('export async function scheduled(')) return;

  if (!original.includes('export default')) {
    throw new Error('Unable to add cron handler: OpenNext worker.js has no default export.');
  }

  const scheduledHandler = [
    '',
    '// Cron trigger (wrangler.jsonc `triggers.crons`). OpenNext tidak mengekspor',
    '// `scheduled`, jadi diekspor di sini lalu memanggil aplikasi Next lewat',
    '// service binding sendiri ke POST /api/cron/daily (dilindungi CRON_SECRET).',
    '// Sengaja memakai `await`, bukan `ctx.waitUntil`: kalau endpoint gagal, run cron',
    '// ikut gagal dan langsung terlihat di log/observability Cloudflare — kegagalan',
    '// sunyi lebih berbahaya daripada satu run yang berwarna merah.',
    'export async function scheduled(_event, env) {',
    '    const secret = env.CRON_SECRET;',
    '    if (!secret) {',
    '        console.warn("[cron] CRON_SECRET belum di-set; run harian dilewati.");',
    '        return;',
    '    }',
    '    if (!env.WORKER_SELF_REFERENCE) {',
    '        throw new Error("[cron] binding WORKER_SELF_REFERENCE tidak ada.");',
    '    }',
    '    const response = await env.WORKER_SELF_REFERENCE.fetch(',
    '        new Request("https://cron.internal/api/cron/daily", {',
    '            method: "POST",',
    '            headers: { "x-cron-secret": secret },',
    '        })',
    '    );',
    '    console.log("[cron] POST /api/cron/daily ->", response.status);',
    '    if (!response.ok) {',
    '        throw new Error("cron endpoint returned " + response.status);',
    '    }',
    '}',
    '',
  ].join('\n');

  fs.writeFileSync(workerPath, `${original.trimEnd()}\n${scheduledHandler}`);
  console.log('[cloudflare-build] Appended cron scheduled handler to Worker entry.');
}

function prepareOpenNextWorkerOutput() {
  loadLocalEnvForBuildNotices();

  const openNextDir = path.join(process.cwd(), '.open-next');
  const serverDir = path.join(openNextDir, 'server-functions', 'default');

  if (!fs.existsSync(openNextDir)) {
    throw new Error('.open-next output not found. Run opennextjs-cloudflare build first.');
  }

  patchBrowserOnlyFfmpegWasmImports(serverDir);
  disableNodeInstrumentationDynamicRequire(serverDir);
  patchNextCacheHandlersClosure(serverDir);
  patchKnownVendorDuplicateCase(serverDir);
  minifyMiddlewareBundle(openNextDir);
  removeBrowserOnlyFfmpegAssets(openNextDir);
  appendScheduledCronHandler(openNextDir);
  assertWorkersAssetSizes(openNextDir);
}

if (require.main === module) {
  prepareOpenNextWorkerOutput();
}

module.exports = { prepareOpenNextWorkerOutput };
