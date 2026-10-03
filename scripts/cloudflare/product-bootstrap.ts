import { bootstrapD1Schema, queryD1 } from '../../src/lib/cloudflareD1';
import { headR2Object, uploadToR2 } from '../../src/lib/r2Storage';
import {
  loadProductEnv,
  printProductEnvReport,
  requireProductCloudflareEnvConfirmed,
} from './product-env';

loadProductEnv();

const args = new Set(process.argv.slice(2));

function hasAnyAction() {
  return args.has('--apply-schema') || args.has('--seed-demo') || args.has('--live-check');
}

function buildPublicUrl(key: string) {
  const base = process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL?.replace(/\/+$/, '');
  return base ? `${base}/${key}` : `https://example.invalid/${key}`;
}

function isR2NotFoundError(error: unknown) {
  const candidate = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
    Code?: string;
  };

  return (
    candidate.name === 'NotFound' ||
    candidate.name === 'NoSuchKey' ||
    candidate.Code === 'NoSuchKey' ||
    candidate.$metadata?.httpStatusCode === 404
  );
}

async function r2ObjectExists(key: string) {
  try {
    await headR2Object(key);
    return true;
  } catch (error) {
    if (isR2NotFoundError(error)) return false;
    throw error;
  }
}

async function createDemoCoverJpeg({
  title,
  subtitle,
  accent,
  background,
}: {
  title: string;
  subtitle: string;
  accent: string;
  background: string;
}) {
  const { default: sharp } = await import('sharp');
  const svg = `
    <svg width="1200" height="800" viewBox="0 0 1200 800" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="${background}" />
          <stop offset="1" stop-color="#111827" />
        </linearGradient>
        <linearGradient id="accent" x1="0" x2="1">
          <stop offset="0" stop-color="${accent}" />
          <stop offset="1" stop-color="#f8fafc" stop-opacity="0.75" />
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#bg)" />
      <rect x="90" y="96" width="1020" height="608" rx="36" fill="#f8fafc" fill-opacity="0.08" stroke="#f8fafc" stroke-opacity="0.18" />
      <rect x="150" y="170" width="240" height="16" rx="8" fill="url(#accent)" />
      <rect x="150" y="238" width="680" height="52" rx="14" fill="#f8fafc" fill-opacity="0.2" />
      <rect x="150" y="326" width="900" height="18" rx="9" fill="#f8fafc" fill-opacity="0.18" />
      <rect x="150" y="374" width="720" height="18" rx="9" fill="#f8fafc" fill-opacity="0.13" />
      <rect x="150" y="512" width="250" height="96" rx="24" fill="${accent}" fill-opacity="0.9" />
      <rect x="444" y="512" width="250" height="96" rx="24" fill="#f8fafc" fill-opacity="0.12" />
      <rect x="738" y="512" width="250" height="96" rx="24" fill="#f8fafc" fill-opacity="0.12" />
      <text x="150" y="276" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="44" font-weight="700">${title}</text>
      <text x="150" y="450" fill="#e5e7eb" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="500">${subtitle}</text>
    </svg>`;

  return sharp(Buffer.from(svg)).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

async function ensureDemoCoverObject({
  key,
  title,
  subtitle,
  accent,
  background,
}: {
  key: string;
  title: string;
  subtitle: string;
  accent: string;
  background: string;
}) {
  if (await r2ObjectExists(key)) {
    console.log(`Demo cover already exists: ${key}`);
    return;
  }

  const body = await createDemoCoverJpeg({ title, subtitle, accent, background });
  await uploadToR2({
    key,
    body,
    contentType: 'image/jpeg',
    cacheControl: 'public, max-age=31536000, immutable',
  });
  console.log(`Uploaded demo cover: ${key}`);
}

async function liveCheck() {
  requireProductCloudflareEnvConfirmed('run live Cloudflare connectivity check');
  const rows = await queryD1<{ ok: number }>('SELECT 1 as ok');
  console.log(`D1 live check: ${rows[0]?.ok === 1 ? 'ok' : 'unexpected response'}`);
}

async function seedDemoData() {
  requireProductCloudflareEnvConfirmed('seed demo product data');

  const now = new Date().toISOString();
  const siteId = 'default-site';
  const projectOneId = 'project-demo-interface';
  const projectTwoId = 'project-demo-branding';
  const coverOneKey = `sites/${siteId}/projects/${projectOneId}/cover-demo-interface.jpg`;
  const coverTwoKey = `sites/${siteId}/projects/${projectTwoId}/cover-demo-branding.jpg`;

  await Promise.all([
    ensureDemoCoverObject({
      key: coverOneKey,
      title: 'Interface System',
      subtitle: 'Clean SaaS dashboard demo',
      accent: '#38bdf8',
      background: '#0f172a',
    }),
    ensureDemoCoverObject({
      key: coverTwoKey,
      title: 'Brand Identity',
      subtitle: 'Portfolio case study demo',
      accent: '#f59e0b',
      background: '#18181b',
    }),
  ]);

  await queryD1(
    `INSERT OR IGNORE INTO sites (id, slug, name, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [siteId, 'demo-designer', 'Demo Designer', 'active', now, now]
  );

  await queryD1(
    `INSERT OR IGNORE INTO media_assets
       (id, site_id, project_id, r2_key, public_url, alt_text, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'media-demo-interface-cover',
      siteId,
      projectOneId,
      coverOneKey,
      buildPublicUrl(coverOneKey),
      'Demo interface cover',
      0,
      now,
      now,
    ]
  );

  await queryD1(
    `INSERT OR IGNORE INTO media_assets
       (id, site_id, project_id, r2_key, public_url, alt_text, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'media-demo-branding-cover',
      siteId,
      projectTwoId,
      coverTwoKey,
      buildPublicUrl(coverTwoKey),
      'Demo branding cover',
      0,
      now,
      now,
    ]
  );

  await queryD1(
    `INSERT OR IGNORE INTO projects
       (id, site_id, slug, title, cover_media_id, status, order_index, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectOneId,
      siteId,
      'demo-interface-system',
      'Demo Interface System',
      'media-demo-interface-cover',
      'published',
      1,
      now,
      now,
    ]
  );

  await queryD1(
    `INSERT OR IGNORE INTO projects
       (id, site_id, slug, title, cover_media_id, status, order_index, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectTwoId,
      siteId,
      'demo-brand-identity',
      'Demo Brand Identity',
      'media-demo-branding-cover',
      'published',
      2,
      now,
      now,
    ]
  );

  await queryD1(
    `INSERT OR IGNORE INTO project_narratives
       (id, site_id, project_id, challenge, solution, impact, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'narrative-demo-interface',
      siteId,
      projectOneId,
      'Create a polished portfolio case study template without personal data.',
      'Use neutral demo copy and media paths scoped by site.',
      'The buyer can replace every placeholder from the dashboard.',
      now,
      now,
    ]
  );

  await queryD1(
    `INSERT OR IGNORE INTO project_narratives
       (id, site_id, project_id, challenge, solution, impact, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'narrative-demo-branding',
      siteId,
      projectTwoId,
      'Show a second project so layouts can be tested with realistic lists.',
      'Keep the data generic and safe.',
      'Template buyers start from clean demo content.',
      now,
      now,
    ]
  );

  console.log('Demo product data is ready.');
}

async function main() {
  const report = printProductEnvReport();

  if (!hasAnyAction()) {
    console.log('');
    console.log('No live action requested. This doctor run is safe for personal/old env files.');
    console.log('Next live steps after product env is ready:');
    console.log('- npm run cf:bootstrap');
    console.log('- npm run cf:seed-demo');
    return;
  }

  if (report.missingRequired.length > 0 || report.backendIssues.length > 0) {
    throw new Error('Product env is incomplete. Fix missing keys before running live actions.');
  }

  if (args.has('--live-check')) {
    await liveCheck();
  }

  if (args.has('--apply-schema')) {
    requireProductCloudflareEnvConfirmed('apply D1 schema');
    await bootstrapD1Schema();
    console.log('D1 product schema is ready.');
  }

  if (args.has('--seed-demo')) {
    requireProductCloudflareEnvConfirmed('apply D1 schema and seed demo product data');
    await bootstrapD1Schema();
    await seedDemoData();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
