#!/usr/bin/env tsx
/**
 * Inventory or download important Cloudflare R2 media prefixes.
 *
 * Default mode is metadata-only to avoid accidental huge downloads. Use
 * --download for an actual local object copy.
 */

import fs from 'fs';
import path from 'path';
import { queryD1 } from '../../src/lib/cloudflareD1';
import { getR2Object, listR2Objects } from '../../src/lib/r2Storage';
import {
  ensureDir,
  formatBytes,
  hasFlag,
  loadBackupEnv,
  readArgValue,
  resolveOutputDir,
  safeTimestamp,
  writeJson,
} from './backup-common';

loadBackupEnv();

type SiteRow = { id: string; slug: string };

type Options = {
  outDir: string;
  siteId?: string;
  download: boolean;
  includeFfmpeg: boolean;
  includeLegacyWallpapers: boolean;
  json: boolean;
  help: boolean;
};

type R2Manifest = {
  kind: 'portfolio-os-r2-media-backup';
  version: 1;
  generatedAt: string;
  mode: 'metadata-only' | 'download';
  prefixes: string[];
  totals: {
    objects: number;
    bytes: number;
    downloaded: number;
    failed: number;
  };
  objects: Array<{
    key: string;
    size: number;
    uploaded?: string;
    localPath?: string;
    error?: string;
  }>;
};

function printHelp() {
  console.log(`Usage:
  npx tsx scripts/cloudflare/backup-r2-site-media.ts [options]

Options:
  --out <dir>                    Output directory. Default: backups/r2/<timestamp>
  --site-id <id>                 Backup one site only. Default: all sites.
  --download                     Download object bodies. Default: metadata-only inventory.
  --skip-ffmpeg                  Do not include ffmpeg/ prefix.
  --include-legacy-wallpapers    Include legacy assets/wallpapers/ prefix.
  --json                         Print machine-readable summary.
  --help, -h                     Show this help.

Examples:
  npm run backup:r2
  npm run backup:r2 -- --download --out backups/drills/2026-07-07/r2
`);
}

function parseArgs(argv: string[]): Options {
  return {
    outDir: resolveOutputDir(readArgValue(argv, '--out'), ['backups', 'r2', safeTimestamp()]),
    siteId: readArgValue(argv, '--site-id'),
    download: hasFlag(argv, '--download'),
    includeFfmpeg: !hasFlag(argv, '--skip-ffmpeg'),
    includeLegacyWallpapers: hasFlag(argv, '--include-legacy-wallpapers'),
    json: hasFlag(argv, '--json'),
    help: hasFlag(argv, '--help') || hasFlag(argv, '-h'),
  };
}

async function loadSites(siteId?: string) {
  if (siteId) {
    return queryD1<SiteRow>('SELECT id, slug FROM sites WHERE id = ? ORDER BY created_at ASC', [
      siteId,
    ]);
  }

  return queryD1<SiteRow>('SELECT id, slug FROM sites ORDER BY created_at ASC');
}

function buildPrefixes(sites: SiteRow[], options: Options) {
  const prefixes = new Set<string>();
  sites.forEach((site) => {
    prefixes.add(`sites/${site.id}/projects/`);
    prefixes.add(`sites/${site.id}/wallpapers/`);
  });

  if (options.includeFfmpeg) prefixes.add('ffmpeg/');
  if (options.includeLegacyWallpapers) prefixes.add('assets/wallpapers/');

  return [...prefixes];
}

function objectPathForKey(outDir: string, key: string) {
  const objectRoot = path.resolve(outDir, 'objects');
  const relative = key
    .split('/')
    .filter(Boolean)
    .map((part) => part.replace(/[<>:"\\|?*\x00-\x1f]/g, '_'))
    .join(path.sep);
  const resolved = path.resolve(objectRoot, relative);

  if (!resolved.startsWith(`${objectRoot}${path.sep}`)) {
    throw new Error(`Unsafe R2 key path: ${key}`);
  }

  return resolved;
}

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);

  const withTransform = body as { transformToByteArray?: () => Promise<Uint8Array> };
  if (typeof withTransform.transformToByteArray === 'function') {
    return Buffer.from(await withTransform.transformToByteArray());
  }

  const webStream = body as ReadableStream<Uint8Array>;
  if (typeof webStream.getReader === 'function') {
    const reader = webStream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      chunks.push(chunk.value);
    }
    return Buffer.concat(chunks);
  }

  const nodeStream = body as NodeJS.ReadableStream;
  if (typeof nodeStream.on === 'function') {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      nodeStream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      nodeStream.on('error', reject);
      nodeStream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  throw new Error('Unsupported R2 object body stream');
}

async function backup(options: Options) {
  const sites = await loadSites(options.siteId);
  if (options.siteId && sites.length === 0) {
    throw new Error(`Site not found: ${options.siteId}`);
  }

  const prefixes = buildPrefixes(sites, options);
  const manifest: R2Manifest = {
    kind: 'portfolio-os-r2-media-backup',
    version: 1,
    generatedAt: new Date().toISOString(),
    mode: options.download ? 'download' : 'metadata-only',
    prefixes,
    totals: {
      objects: 0,
      bytes: 0,
      downloaded: 0,
      failed: 0,
    },
    objects: [],
  };

  await ensureDir(options.outDir);

  for (const prefix of prefixes) {
    const objects = await listR2Objects({ prefix });
    for (const object of objects) {
      const row: R2Manifest['objects'][number] = {
        key: object.key,
        size: object.size,
        uploaded: object.uploaded?.toISOString(),
      };
      manifest.objects.push(row);
      manifest.totals.objects += 1;
      manifest.totals.bytes += object.size;

      if (!options.download) continue;

      try {
        const r2Object = await getR2Object(object.key);
        const buffer = await bodyToBuffer(r2Object.Body);
        const objectPath = objectPathForKey(options.outDir, object.key);
        await ensureDir(path.dirname(objectPath));
        await fs.promises.writeFile(objectPath, buffer);
        row.localPath = path.relative(options.outDir, objectPath).replace(/\\/g, '/');
        manifest.totals.downloaded += 1;
      } catch (error) {
        row.error = error instanceof Error ? error.message : String(error);
        manifest.totals.failed += 1;
      }
    }
  }

  const manifestFile = path.join(options.outDir, 'r2-manifest.json');
  await writeJson(manifestFile, manifest);

  return {
    outDir: options.outDir,
    manifestFile,
    mode: manifest.mode,
    prefixes,
    totals: manifest.totals,
  };
}

function printHumanSummary(result: Awaited<ReturnType<typeof backup>>) {
  console.log('R2 media backup summary');
  console.log(`Mode       : ${result.mode}`);
  console.log(`Prefixes   : ${result.prefixes.length}`);
  console.log(`Objects    : ${result.totals.objects}`);
  console.log(`Bytes      : ${formatBytes(result.totals.bytes)}`);
  console.log(`Downloaded : ${result.totals.downloaded}`);
  console.log(`Failed     : ${result.totals.failed}`);
  console.log(`Output dir : ${result.outDir}`);
  console.log(`Manifest   : ${result.manifestFile}`);
  console.log('');
  result.prefixes.forEach((prefix) => console.log(`- ${prefix}`));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const result = await backup(options);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHumanSummary(result);
  }

  if (result.totals.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
