#!/usr/bin/env node
/**
 * Audit wallpaper video di Cloudflare D1: cek apakah ada wallpaper video
 * yang resolusinya di bawah 1920x1080. Wallpaper di bawah resolusi itu akan
 * pecah saat di-fullscreen via object-cover di DesktopBackground.
 *
 * Run:
 *   node scripts/media/audit-wallpaper-videos.mjs
 *   node scripts/media/audit-wallpaper-videos.mjs --json
 *
 * Behavior:
 *  - Read content/about dari D1 (kalau ada). Kalau tidak ada, pakai
 *    src/data/about.json sebagai fallback.
 *  - Untuk setiap entry collection yang URL-nya video, probe via ffprobe
 *    (lewat fluent-ffmpeg + ffmpeg-static). Resolusi video yang di-fetch
 *    via HTTP GET sehingga harus accessible publik.
 *  - Output table: id, name, url, width x height, status (OK/SUB-1080p).
 */
import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import { readFile } from 'node:fs/promises';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';

loadEnv({ path: '.env.local' });

ffmpeg.setFfmpegPath(ffmpegStatic);

const VIDEO_EXT = /\.(mp4|webm|ogg|mov)(\?.*)?$/i;
const MIN_WIDTH = 1920;
const MIN_HEIGHT = 1080;

function isVideo(url) {
  return VIDEO_EXT.test(url || '');
}

async function loadAboutFromD1() {
  const accountId =
    process.env.CLOUDFLARE_ACCOUNT_ID ||
    process.env.CLOUDFLARE_D1_ACCOUNT_ID ||
    process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const apiToken = process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !databaseId || !apiToken) return null;

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql: 'SELECT value FROM app_kv WHERE key = ? LIMIT 1',
        params: ['content/about'],
      }),
    }
  );
  if (!res.ok) return null;
  const json = await res.json();
  const row = json?.result?.[0]?.results?.[0];
  if (!row?.value) return null;
  return JSON.parse(row.value);
}

async function loadAboutFromFile() {
  try {
    const txt = await readFile('src/data/about.json', 'utf-8');
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

function probeUrl(url) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(url, (err, data) => {
      if (err) {
        resolve({ error: err.message || 'probe failed' });
        return;
      }
      const stream = (data?.streams || []).find((s) => s.codec_type === 'video');
      if (!stream) {
        resolve({ error: 'no video stream' });
        return;
      }
      resolve({
        width: stream.width || 0,
        height: stream.height || 0,
        duration: data?.format?.duration || 0,
      });
    });
  });
}

function resolveAbsoluteUrl(url) {
  if (!url) return url;
  if (url.startsWith('http')) return url;
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || '').replace(
    /\/$/,
    ''
  );
  if (base) return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  // Fallback: kalau path mulai dengan /r2/, gabungkan dengan public R2 base
  if (url.startsWith('/r2/')) {
    const r2Base = (process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL || '').replace(/\/$/, '');
    if (r2Base && !r2Base.startsWith('/')) {
      return `${r2Base}${url.replace(/^\/r2/, '')}`;
    }
  }
  return null;
}

async function main() {
  const wantJson = process.argv.includes('--json');
  const fromD1 = await loadAboutFromD1();
  const about = fromD1 || (await loadAboutFromFile());

  if (!about) {
    console.error('Tidak bisa membaca about data dari D1 maupun file lokal.');
    process.exit(1);
  }

  const collection = about?.wallpaperConfig?.collection || [];
  const videos = collection.filter((w) => isVideo(w.url));

  if (videos.length === 0) {
    console.log('Tidak ada wallpaper video di collection. Audit selesai.');
    return;
  }

  console.log(`Probing ${videos.length} wallpaper video(s)...\n`);
  const rows = [];
  for (const w of videos) {
    const absoluteUrl = resolveAbsoluteUrl(w.url);
    if (!absoluteUrl) {
      rows.push({
        id: w.id,
        name: w.name || '-',
        url: w.url,
        status: 'SKIP',
        reason: 'URL tidak bisa diresolve. Set NEXT_PUBLIC_APP_URL untuk audit lokal.',
      });
      continue;
    }
    const probe = await probeUrl(absoluteUrl);
    if (probe.error) {
      rows.push({
        id: w.id,
        name: w.name || '-',
        url: w.url,
        status: 'ERROR',
        reason: probe.error,
      });
      continue;
    }
    const ok = probe.width >= MIN_WIDTH && probe.height >= MIN_HEIGHT;
    rows.push({
      id: w.id,
      name: w.name || '-',
      url: w.url,
      width: probe.width,
      height: probe.height,
      status: ok ? 'OK' : 'SUB-1080p',
    });
  }

  if (wantJson) {
    console.log(JSON.stringify(rows, null, 2));
  } else {
    for (const r of rows) {
      const dim = r.width ? `${r.width}x${r.height}` : '-';
      const tag = r.status.padEnd(10);
      console.log(`${tag} ${dim.padEnd(11)} ${r.name} -> ${r.url}`);
      if (r.reason) console.log(`           reason: ${r.reason}`);
    }
    const bad = rows.filter((r) => r.status === 'SUB-1080p').length;
    const errors = rows.filter((r) => r.status === 'ERROR').length;
    console.log(`\nSummary: ${rows.length - bad - errors} OK, ${bad} sub-1080p, ${errors} error`);
    if (bad > 0) {
      console.log(
        '\nWallpaper di bawah 1920x1080 akan ke-upsample dan pecah. Replace via admin panel.'
      );
      process.exitCode = 1;
    }
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
