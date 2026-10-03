#!/usr/bin/env tsx
/**
 * Seed one complete dummy project for Sprint 44 restore drill.
 *
 * This intentionally uses the existing hidden demo site (`default-site`) so the
 * known orphan key can be reattached instead of deleted.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { queryD1 } from '../../src/lib/cloudflareD1';
import { buildR2PublicUrl, headR2Object, uploadToR2 } from '../../src/lib/r2Storage';
import {
  loadProductEnv,
  requireProductCloudflareEnvConfirmed,
} from './product-env';
import { hasFlag, isR2NotFoundError } from './backup-common';

loadProductEnv();

const execFileAsync = promisify(execFile);

const SITE_ID = 'default-site';
const SITE_SLUG = 'demo-designer';
const SITE_NAME = 'Demo Designer';
const PROJECT_ID = 'project-demo-branding';
const PROJECT_SLUG = 'demo-brand-identity';
const PROJECT_TITLE = 'Restore Drill Demo Project';
const CLIENT_ACCESS_ID = 'client-access-restore-drill-default-site';
const CLIENT_EMAIL = 'restore-drill@example.invalid';
const CLIENT_PASSWORD = 'RestoreDrill2026!';
const COVER_KEY = `sites/${SITE_ID}/projects/${PROJECT_ID}/cover-demo-branding.jpg`;
const GALLERY_IMAGE_KEY = `sites/${SITE_ID}/projects/${PROJECT_ID}/restore-drill-gallery.jpg`;
const VIDEO_KEY = `sites/${SITE_ID}/projects/${PROJECT_ID}/restore-drill-video.mp4`;
const VIDEO_PREVIEW_KEY = `sites/${SITE_ID}/projects/${PROJECT_ID}/restore-drill-video-preview.mp4`;
const VIDEO_POSTER_JPG_KEY = `sites/${SITE_ID}/projects/${PROJECT_ID}/restore-drill-video.jpg`;
const VIDEO_POSTER_WEBP_KEY = `sites/${SITE_ID}/projects/${PROJECT_ID}/restore-drill-video.webp`;
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

type Options = {
  apply: boolean;
  force: boolean;
  help: boolean;
};

function parseArgs(argv: string[]): Options {
  return {
    apply: hasFlag(argv, '--apply'),
    force: hasFlag(argv, '--force'),
    help: hasFlag(argv, '--help') || hasFlag(argv, '-h'),
  };
}

function printHelp() {
  console.log(`Usage:
  npx tsx scripts/cloudflare/seed-restore-drill-project.ts [options]

Options:
  --apply    Write dummy drill rows and media to D1/R2.
  --force    Re-upload R2 media even if objects already exist.
  --help     Show this help.

Default mode is dry-run. Secret values are never printed.
`);
}

function requireSecurityEnv() {
  const salt = process.env.PASSWORD_SALT?.trim();
  if (!salt) throw new Error('PASSWORD_SALT is required to seed client access.');
  return { salt };
}

function hashClientPassword(password: string) {
  const { salt } = requireSecurityEnv();
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

async function r2Exists(key: string) {
  try {
    await headR2Object(key);
    return true;
  } catch (error) {
    if (isR2NotFoundError(error)) return false;
    throw error;
  }
}

async function createImage({
  title,
  subtitle,
  accent,
  width,
  height,
  format,
}: {
  title: string;
  subtitle: string;
  accent: string;
  width: number;
  height: number;
  format: 'jpeg' | 'webp';
}) {
  const { default: sharp } = await import('sharp');
  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#111827" />
          <stop offset="1" stop-color="#0f766e" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)" />
      <rect x="${width * 0.08}" y="${height * 0.12}" width="${width * 0.84}" height="${height * 0.76}" rx="28" fill="#f8fafc" fill-opacity="0.10" stroke="#f8fafc" stroke-opacity="0.22" />
      <rect x="${width * 0.13}" y="${height * 0.20}" width="${width * 0.22}" height="14" rx="7" fill="${accent}" />
      <text x="${width * 0.13}" y="${height * 0.42}" fill="#ffffff" font-family="Arial, sans-serif" font-size="${Math.round(width * 0.052)}" font-weight="700">${title}</text>
      <text x="${width * 0.13}" y="${height * 0.54}" fill="#d1fae5" font-family="Arial, sans-serif" font-size="${Math.round(width * 0.025)}" font-weight="500">${subtitle}</text>
      <rect x="${width * 0.13}" y="${height * 0.66}" width="${width * 0.20}" height="${height * 0.10}" rx="18" fill="${accent}" fill-opacity="0.92" />
      <rect x="${width * 0.37}" y="${height * 0.66}" width="${width * 0.20}" height="${height * 0.10}" rx="18" fill="#ffffff" fill-opacity="0.14" />
      <rect x="${width * 0.61}" y="${height * 0.66}" width="${width * 0.20}" height="${height * 0.10}" rx="18" fill="#ffffff" fill-opacity="0.14" />
    </svg>`;

  const pipeline = sharp(Buffer.from(svg));
  return format === 'webp'
    ? pipeline.webp({ quality: 82 }).toBuffer()
    : pipeline.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

async function createVideoBuffer() {
  const ffmpegModule = await import('ffmpeg-static');
  const ffmpegPath = String(ffmpegModule.default || '');
  if (!ffmpegPath) throw new Error('ffmpeg-static did not provide a binary path.');

  const tmpRoot = path.resolve(process.cwd(), 'tmp');
  await fs.promises.mkdir(tmpRoot, { recursive: true });
  const tmpDir = await fs.promises.mkdtemp(path.join(tmpRoot, 'restore-drill-video-'));
  const outFile = path.join(tmpDir, 'restore-drill-video.mp4');

  try {
    await execFileAsync(ffmpegPath, [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'color=c=0x111827:s=640x360:d=1.2',
      '-vf',
      'format=yuv420p',
      '-movflags',
      '+faststart',
      '-an',
      outFile,
    ]);
    return await fs.promises.readFile(outFile);
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  }
}

async function uploadIfNeeded({
  key,
  body,
  contentType,
  force,
}: {
  key: string;
  body: Buffer;
  contentType: string;
  force: boolean;
}) {
  const exists = await r2Exists(key);
  if (exists && !force) return 'exists';

  await uploadToR2({
    key,
    body,
    contentType,
    cacheControl: CACHE_CONTROL,
  });
  return exists ? 'reuploaded' : 'uploaded';
}

async function seedMedia(force: boolean) {
  const cover = await createImage({
    title: 'Restore Drill',
    subtitle: 'Cover media for backup restore validation',
    accent: '#22c55e',
    width: 1200,
    height: 800,
    format: 'jpeg',
  });
  const gallery = await createImage({
    title: 'Gallery Asset',
    subtitle: 'Image media restored from D1/R2 backup',
    accent: '#38bdf8',
    width: 1200,
    height: 800,
    format: 'jpeg',
  });
  const posterJpg = await createImage({
    title: 'Video Poster',
    subtitle: 'Poster sidecar for restored video',
    accent: '#f59e0b',
    width: 640,
    height: 360,
    format: 'jpeg',
  });
  const posterWebp = await createImage({
    title: 'Video Poster',
    subtitle: 'WebP poster sidecar for restored video',
    accent: '#f59e0b',
    width: 640,
    height: 360,
    format: 'webp',
  });
  const video = await createVideoBuffer();

  const results = {
    [COVER_KEY]: await uploadIfNeeded({
      key: COVER_KEY,
      body: cover,
      contentType: 'image/jpeg',
      force,
    }),
    [GALLERY_IMAGE_KEY]: await uploadIfNeeded({
      key: GALLERY_IMAGE_KEY,
      body: gallery,
      contentType: 'image/jpeg',
      force,
    }),
    [VIDEO_KEY]: await uploadIfNeeded({
      key: VIDEO_KEY,
      body: video,
      contentType: 'video/mp4',
      force,
    }),
    [VIDEO_PREVIEW_KEY]: await uploadIfNeeded({
      key: VIDEO_PREVIEW_KEY,
      body: video,
      contentType: 'video/mp4',
      force,
    }),
    [VIDEO_POSTER_JPG_KEY]: await uploadIfNeeded({
      key: VIDEO_POSTER_JPG_KEY,
      body: posterJpg,
      contentType: 'image/jpeg',
      force,
    }),
    [VIDEO_POSTER_WEBP_KEY]: await uploadIfNeeded({
      key: VIDEO_POSTER_WEBP_KEY,
      body: posterWebp,
      contentType: 'image/webp',
      force,
    }),
  };

  return results;
}

async function seedD1() {
  const now = new Date().toISOString();
  const coverUrl = buildR2PublicUrl(COVER_KEY);
  const galleryImageUrl = buildR2PublicUrl(GALLERY_IMAGE_KEY);
  const videoUrl = buildR2PublicUrl(VIDEO_KEY);
  const posterUrl = buildR2PublicUrl(VIDEO_POSTER_JPG_KEY);
  const metadata = {
    client: 'Restore Drill',
    year: 2026,
    tags: ['backup', 'restore', 'drill'],
    cover: coverUrl,
    coverWidth: 1200,
    coverHeight: 800,
    description: 'Dummy project for Sprint 44 backup and restore validation.',
    autoplay: false,
    muted: true,
    loop: true,
    playsInline: true,
    likes: 0,
    shares: 0,
    allowComments: false,
    role: 'Operational validation',
    timeline: 'Sprint 44',
    team: 'Platform',
    software: ['Cloudflare D1', 'Cloudflare R2'],
    type: 'commercial',
    gallery: [galleryImageUrl, videoUrl],
    galleryItems: [
      {
        kind: 'image',
        src: galleryImageUrl,
        alt: 'Restore drill gallery image',
        width: 1200,
        height: 800,
      },
      {
        kind: 'video',
        src: videoUrl,
        poster: posterUrl,
        alt: 'Restore drill video',
        width: 640,
        height: 360,
      },
    ],
    narrative: {
      challenge: 'Prove that D1 rows and R2 media can be restored together.',
      solution: 'Use a complete site-scoped dummy project with image and video media.',
      impact: 'Backup/restore audit can verify project, cover, gallery, and video references.',
    },
  };

  await queryD1(
    `INSERT INTO sites (id, slug, name, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       slug = excluded.slug,
       name = excluded.name,
       status = excluded.status,
       updated_at = excluded.updated_at`,
    [SITE_ID, SITE_SLUG, SITE_NAME, 'active', now, now]
  );

  await queryD1(
    `INSERT INTO client_access (id, site_id, email, password_hash, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(site_id, email) DO UPDATE SET
       password_hash = excluded.password_hash,
       status = excluded.status,
       updated_at = excluded.updated_at`,
    [
      CLIENT_ACCESS_ID,
      SITE_ID,
      CLIENT_EMAIL,
      hashClientPassword(CLIENT_PASSWORD),
      'active',
      now,
      now,
    ]
  );

  await queryD1(
    `INSERT INTO projects
       (id, site_id, slug, title, cover_media_id, status, order_index, metadata_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       slug = excluded.slug,
       title = excluded.title,
       cover_media_id = excluded.cover_media_id,
       status = excluded.status,
       order_index = excluded.order_index,
       metadata_json = excluded.metadata_json,
       updated_at = excluded.updated_at`,
    [
      PROJECT_ID,
      SITE_ID,
      PROJECT_SLUG,
      PROJECT_TITLE,
      'media-demo-branding-cover',
      'published',
      1,
      JSON.stringify(metadata),
      now,
      now,
    ]
  );

  await queryD1(
    `INSERT INTO project_narratives
       (id, site_id, project_id, challenge, solution, impact, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       challenge = excluded.challenge,
       solution = excluded.solution,
       impact = excluded.impact,
       updated_at = excluded.updated_at`,
    [
      `narrative-${PROJECT_ID}`,
      SITE_ID,
      PROJECT_ID,
      metadata.narrative.challenge,
      metadata.narrative.solution,
      metadata.narrative.impact,
      now,
      now,
    ]
  );

  const mediaRows = [
    ['media-demo-branding-cover', COVER_KEY, coverUrl, 'Restore drill cover', 0],
    ['media-restore-drill-gallery', GALLERY_IMAGE_KEY, galleryImageUrl, 'Restore drill gallery image', 1],
    ['media-restore-drill-video', VIDEO_KEY, videoUrl, 'Restore drill video', 2],
  ] as const;

  for (const [id, r2Key, publicUrl, altText, sortOrder] of mediaRows) {
    await queryD1(
      `INSERT INTO media_assets
         (id, site_id, project_id, r2_key, public_url, alt_text, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         site_id = excluded.site_id,
         project_id = excluded.project_id,
         r2_key = excluded.r2_key,
         public_url = excluded.public_url,
         alt_text = excluded.alt_text,
         sort_order = excluded.sort_order,
         updated_at = excluded.updated_at`,
      [id, SITE_ID, PROJECT_ID, r2Key, publicUrl, altText, sortOrder, now, now]
    );
  }
}

async function summarizeD1() {
  const rows = await queryD1<{ projects: number; media_assets: number; client_access: number }>(
    `SELECT
       (SELECT COUNT(*) FROM projects WHERE site_id = ?) as projects,
       (SELECT COUNT(*) FROM media_assets WHERE site_id = ?) as media_assets,
       (SELECT COUNT(*) FROM client_access WHERE site_id = ?) as client_access`,
    [SITE_ID, SITE_ID, SITE_ID]
  );

  return rows[0] || { projects: 0, media_assets: 0, client_access: 0 };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  if (!options.apply) {
    console.log('Restore drill seed dry-run');
    console.log(`Site       : ${SITE_ID} (${SITE_SLUG})`);
    console.log(`Project    : ${PROJECT_ID} (${PROJECT_SLUG})`);
    console.log('D1 rows    : site, client_access, project, narrative, 3 media_assets');
    console.log('R2 objects : cover, gallery image, video, video preview, jpg poster, webp poster');
    console.log('No writes performed. Re-run with --apply to seed.');
    return;
  }

  requireProductCloudflareEnvConfirmed('seed restore drill project data');

  const mediaResults = await seedMedia(options.force);
  await seedD1();
  const summary = await summarizeD1();

  console.log('Restore drill seed completed.');
  console.log(`Site          : ${SITE_ID} (${SITE_SLUG})`);
  console.log(`Project       : ${PROJECT_ID} (${PROJECT_SLUG})`);
  console.log(`Projects      : ${summary.projects}`);
  console.log(`Media assets  : ${summary.media_assets}`);
  console.log(`Client access : ${summary.client_access}`);
  console.log('R2 objects:');
  Object.entries(mediaResults).forEach(([key, status]) => {
    console.log(`- ${status}: ${key}`);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
