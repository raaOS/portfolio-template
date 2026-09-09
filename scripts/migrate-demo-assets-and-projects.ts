#!/usr/bin/env tsx
/**
 * Migration Script: Copy 21 Demo Projects and Media Assets
 * From: portfolio-shared-vercel (D1 & R2)
 * To:   portfolio-template (D1 & R2)
 * 
 * Naming: All asset filenames and R2 keys prefixed with "demo-"
 * Location: assets/demo/projects/... and assets/demo/media/...
 */

import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

// 1. Source Environment (portfolio-shared-vercel)
const sourceEnvPath = 'C:/Users/USER/Documents/portfolio-shared-vercel/.env.local';
const sourceEnv: Record<string, string> = {};
if (fs.existsSync(sourceEnvPath)) {
  const content = fs.readFileSync(sourceEnvPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      sourceEnv[key] = val;
    }
  }
}

// 2. Target Environment (portfolio-template)
const targetEnvPath = path.resolve(process.cwd(), '.env.local');
const targetEnv: Record<string, string> = {};
if (fs.existsSync(targetEnvPath)) {
  const content = fs.readFileSync(targetEnvPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      targetEnv[key] = val;
    }
  }
}

// Target D1 helper
async function queryTargetD1<T = Record<string, unknown>>(sql: string, params: any[] = []): Promise<T[]> {
  const accountId = targetEnv.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = targetEnv.CLOUDFLARE_D1_DATABASE_ID;
  const apiToken = targetEnv.CLOUDFLARE_D1_API_TOKEN;

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    }
  );

  const json = (await res.json()) as any;
  if (!res.ok || !json.success) {
    throw new Error(`Target D1 query failed: ${json.errors?.[0]?.message || res.statusText}`);
  }
  return json.result?.[0]?.results ?? [];
}

// Source D1 helper
async function querySourceD1<T = Record<string, unknown>>(sql: string, params: any[] = []): Promise<T[]> {
  const accountId = sourceEnv.CLOUDFLARE_R2_ACCOUNT_ID || sourceEnv.CLOUDFLARE_D1_ACCOUNT_ID;
  const databaseId = sourceEnv.CLOUDFLARE_D1_DATABASE_ID;
  const apiToken = sourceEnv.CLOUDFLARE_D1_API_TOKEN;

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    }
  );

  const json = (await res.json()) as any;
  if (!res.ok || !json.success) {
    throw new Error(`Source D1 query failed: ${json.errors?.[0]?.message || res.statusText}`);
  }
  return json.result?.[0]?.results ?? [];
}

// S3 Clients
const sourceS3 = new S3Client({
  region: 'auto',
  endpoint: `https://${sourceEnv.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: sourceEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: sourceEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

const targetS3 = new S3Client({
  region: 'auto',
  endpoint: `https://${targetEnv.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: targetEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: targetEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.mp4': return 'video/mp4';
    case '.webm': return 'video/webm';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.png': return 'image/png';
    case '.webp': return 'image/webp';
    case '.svg': return 'image/svg+xml';
    default: return 'application/octet-stream';
  }
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// Transform URL to point to demo assets
function transformAssetUrl(url: string): string {
  if (!url || typeof url !== 'string') return url;

  // Comparison images
  if (url.includes('/assets/projects/comparisons/')) {
    const filename = path.basename(url);
    const demoFilename = filename.startsWith('demo-') ? filename : `demo-${filename}`;
    return `/r2/assets/demo/projects/comparisons/${demoFilename}`;
  }

  // Project covers & videos
  if (url.includes('/assets/projects/')) {
    const filename = path.basename(url);
    const demoFilename = filename.startsWith('demo-') ? filename : `demo-${filename}`;
    return `/r2/assets/demo/projects/${demoFilename}`;
  }

  // Media assets (feeds webp, etc.)
  if (url.includes('/assets/media/')) {
    const filename = path.basename(url);
    const demoFilename = filename.startsWith('demo-') ? filename : `demo-${filename}`;
    return `/r2/assets/demo/media/${demoFilename}`;
  }

  return url;
}

async function main() {
  console.log('=== STARTING DEMO MIGRATION TO CLOUDFLARE D1 & R2 ===\n');

  // STEP 1: Ensure local directories exist
  const localDemoProjectsDir = path.resolve(process.cwd(), 'public/assets/demo/projects');
  const localDemoComparisonsDir = path.resolve(process.cwd(), 'public/assets/demo/projects/comparisons');
  const localDemoMediaDir = path.resolve(process.cwd(), 'public/assets/demo/media');

  fs.mkdirSync(localDemoProjectsDir, { recursive: true });
  fs.mkdirSync(localDemoComparisonsDir, { recursive: true });
  fs.mkdirSync(localDemoMediaDir, { recursive: true });

  console.log('📁 Local directories created in public/assets/demo/');

  // STEP 2: Gather files from portfolio-shared-vercel
  const sourceProjectsDir = 'C:/Users/USER/Documents/portfolio-shared-vercel/public/assets/projects';
  const targetR2Bucket = targetEnv.CLOUDFLARE_R2_BUCKET;

  const filesToProcess: Array<{
    sourcePath?: string;
    sourceR2Key?: string;
    targetLocalPath: string;
    targetR2Key: string;
    mime: string;
    description: string;
  }> = [];

  // Read local projects directory
  if (fs.existsSync(sourceProjectsDir)) {
    const entries = fs.readdirSync(sourceProjectsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const filename = entry.name;
        const demoFilename = filename.startsWith('demo-') ? filename : `demo-${filename}`;
        filesToProcess.push({
          sourcePath: path.join(sourceProjectsDir, filename),
          targetLocalPath: path.join(localDemoProjectsDir, demoFilename),
          targetR2Key: `assets/demo/projects/${demoFilename}`,
          mime: getMimeType(filename),
          description: filename,
        });
      } else if (entry.isDirectory() && entry.name === 'comparisons') {
        const compDir = path.join(sourceProjectsDir, 'comparisons');
        const compFiles = fs.readdirSync(compDir);
        for (const cf of compFiles) {
          const demoFilename = cf.startsWith('demo-') ? cf : `demo-${cf}`;
          filesToProcess.push({
            sourcePath: path.join(compDir, cf),
            targetLocalPath: path.join(localDemoComparisonsDir, demoFilename),
            targetR2Key: `assets/demo/projects/comparisons/${demoFilename}`,
            mime: getMimeType(cf),
            description: `comparisons/${cf}`,
          });
        }
      }
    }
  }

  // Add remote assets from old R2 (e.g. assets/media/1780629579622-by5a-feeds.webp)
  const specialR2Key = 'assets/media/1780629579622-by5a-feeds.webp';
  const specialFilename = '1780629579622-by5a-feeds.webp';
  const demoSpecialFilename = `demo-${specialFilename}`;
  filesToProcess.push({
    sourceR2Key: specialR2Key,
    targetLocalPath: path.join(localDemoMediaDir, demoSpecialFilename),
    targetR2Key: `assets/demo/media/${demoSpecialFilename}`,
    mime: getMimeType(specialFilename),
    description: specialR2Key,
  });

  console.log(`\n📦 Total asset files to copy & upload: ${filesToProcess.length}`);

  // STEP 3: Process copying locally and uploading to target R2
  let uploadedCount = 0;
  for (const item of filesToProcess) {
    let fileBuffer: Buffer;

    if (item.sourcePath && fs.existsSync(item.sourcePath)) {
      fileBuffer = fs.readFileSync(item.sourcePath);
    } else if (item.sourceR2Key) {
      console.log(`  Downloading from source R2: ${item.sourceR2Key}...`);
      const getRes = await sourceS3.send(
        new GetObjectCommand({
          Bucket: sourceEnv.CLOUDFLARE_R2_BUCKET,
          Key: item.sourceR2Key,
        })
      );
      fileBuffer = await streamToBuffer(getRes.Body as Readable);
    } else {
      console.warn(`  ⚠️ Source not found for ${item.description}, skipping.`);
      continue;
    }

    // Save locally with "demo-" name
    fs.writeFileSync(item.targetLocalPath, fileBuffer);

    // Upload to target Cloudflare R2
    await targetS3.send(
      new PutObjectCommand({
        Bucket: targetR2Bucket,
        Key: item.targetR2Key,
        Body: fileBuffer,
        ContentType: item.mime,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );

    uploadedCount++;
    console.log(`  ✅ [${uploadedCount}/${filesToProcess.length}] Uploaded: ${item.targetR2Key} (${(fileBuffer.length / 1024).toFixed(1)} KB)`);
  }

  console.log(`\n🎉 All ${uploadedCount} assets uploaded to target Cloudflare R2 and saved locally!\n`);

  // STEP 4: Fetch 21 Projects from Source D1
  console.log('📡 Fetching projects from source D1 app_kv...');
  const rows = await querySourceD1<{ value: string }>(
    `SELECT value FROM app_kv WHERE key = 'projects' LIMIT 1`
  );

  if (!rows[0]) {
    throw new Error('No projects found in source D1!');
  }

  const rawProjects = JSON.parse(rows[0].value) as Record<string, any>;
  const projectList = Object.values(rawProjects);
  console.log(`📋 Found ${projectList.length} projects in source D1.\n`);

  // STEP 5: Transform projects for Demo
  const transformedProjects: Record<string, any> = {};
  const targetSiteId = 'default-site';
  const now = new Date().toISOString();

  for (let i = 0; i < projectList.length; i++) {
    const orig = projectList[i];
    const demoId = orig.id.startsWith('demo-') ? orig.id : `demo-${orig.id}`;
    const demoSlug = orig.slug.startsWith('demo-') ? orig.slug : `demo-${orig.slug}`;

    const transformedCover = transformAssetUrl(orig.cover);

    let transformedComparison = orig.comparison;
    if (orig.comparison) {
      transformedComparison = {
        ...orig.comparison,
        beforeImage: transformAssetUrl(orig.comparison.beforeImage),
        afterImage: transformAssetUrl(orig.comparison.afterImage),
      };
    }

    let transformedGallery = orig.gallery || [];
    if (Array.isArray(transformedGallery)) {
      transformedGallery = transformedGallery.map((g: any) => ({
        ...g,
        url: transformAssetUrl(g.url || g.src || g),
      }));
    }

    let transformedGalleryItems = orig.galleryItems || [];
    if (Array.isArray(transformedGalleryItems)) {
      transformedGalleryItems = transformedGalleryItems.map((item: any) => ({
        ...item,
        src: transformAssetUrl(item.src),
        poster: item.poster ? transformAssetUrl(item.poster) : item.poster,
      }));
    }

    const demoProject = {
      ...orig,
      id: demoId,
      slug: demoSlug,
      cover: transformedCover,
      comparison: transformedComparison,
      gallery: transformedGallery,
      galleryItems: transformedGalleryItems,
      order: orig.order ?? (i + 1),
      status: 'published',
      updatedAt: now,
    };

    transformedProjects[demoId] = demoProject;

    // STEP 6: Insert into target D1 SQL tables
    // 6a. Table: projects
    const metadataJson = JSON.stringify({
      client: demoProject.client,
      year: demoProject.year,
      tags: demoProject.tags,
      cover: demoProject.cover,
      description: demoProject.description,
      autoplay: demoProject.autoplay,
      muted: demoProject.muted,
      loop: demoProject.loop,
      playsInline: demoProject.playsInline,
      coverWidth: demoProject.coverWidth,
      coverHeight: demoProject.coverHeight,
      likes: demoProject.likes,
      shares: demoProject.shares,
      allowComments: demoProject.allowComments,
      role: demoProject.role,
      timeline: demoProject.timeline,
      software: demoProject.software,
      team: demoProject.team,
      type: demoProject.type,
      comparison: demoProject.comparison,
      external_link: demoProject.external_link,
      gallery: demoProject.gallery,
    });

    await queryTargetD1(
      `INSERT INTO projects (id, site_id, slug, title, status, order_index, metadata_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         site_id = excluded.site_id,
         slug = excluded.slug,
         title = excluded.title,
         status = excluded.status,
         order_index = excluded.order_index,
         metadata_json = excluded.metadata_json,
         updated_at = excluded.updated_at`,
      [
        demoId,
        targetSiteId,
        demoSlug,
        demoProject.title,
        'published',
        demoProject.order,
        metadataJson,
        orig.createdAt || now,
        now,
      ]
    );

    // 6b. Table: project_narratives
    if (demoProject.narrative) {
      const nId = `narr-${demoId}`;
      await queryTargetD1(
        `INSERT INTO project_narratives (id, site_id, project_id, challenge, solution, impact, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           challenge = excluded.challenge,
           solution = excluded.solution,
           impact = excluded.impact,
           updated_at = excluded.updated_at`,
        [
          nId,
          targetSiteId,
          demoId,
          demoProject.narrative.challenge || null,
          demoProject.narrative.solution || null,
          demoProject.narrative.impact || demoProject.narrative.result || null,
          orig.createdAt || now,
          now,
        ]
      );
    }

    // 6c. Table: media_assets for cover
    const mediaId = `media-${demoId}-cover`;
    const coverR2Key = demoProject.cover.replace(/^\/r2\//, '');
    await queryTargetD1(
      `INSERT INTO media_assets (id, site_id, project_id, r2_key, public_url, alt_text, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         r2_key = excluded.r2_key,
         public_url = excluded.public_url,
         updated_at = excluded.updated_at`,
      [
        mediaId,
        targetSiteId,
        demoId,
        coverR2Key,
        demoProject.cover,
        demoProject.title,
        0,
        orig.createdAt || now,
        now,
      ]
    );

    // Update cover_media_id on projects table
    await queryTargetD1(
      `UPDATE projects SET cover_media_id = ? WHERE id = ?`,
      [mediaId, demoId]
    );

    console.log(`  💾 [${i + 1}/${projectList.length}] Saved project to SQL: ${demoProject.title} (${demoSlug})`);
  }

  // STEP 7: Save to app_kv for macOS Desktop & legacy compatibility
  console.log('\n💾 Syncing all 21 demo projects to app_kv...');
  await queryTargetD1(
    `INSERT INTO app_kv (key, value, updated_at)
     VALUES ('projects', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [JSON.stringify(transformedProjects), now]
  );

  await queryTargetD1(
    `INSERT INTO app_kv (key, value, updated_at)
     VALUES ('lastUpdated', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [JSON.stringify(now), now]
  );

  console.log('✅ app_kv updated with 21 demo projects & new lastUpdated timestamp.');

  console.log('\n========================================================');
  console.log('🎉 DEMO ASSETS & PROJECTS MIGRATION SUCCESSFULLY FINISHED!');
  console.log(`- 42 Media files copied to local: public/assets/demo/`);
  console.log(`- 42 Media files uploaded to R2: portfolio-template-media`);
  console.log(`- 21 Demo Projects written to D1: table 'projects', 'project_narratives', 'media_assets'`);
  console.log(`- 21 Demo Projects synced to D1: table 'app_kv' ('projects' key)`);
  console.log(`- All asset filenames prefixed with "demo-"`);
  console.log('========================================================\n');
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
