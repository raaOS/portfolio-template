import fs from 'fs';
import path from 'path';

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

// Helpers
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

function transformAssetUrl(url: string): string {
  if (!url || typeof url !== 'string') return url;

  if (url.includes('/assets/projects/comparisons/')) {
    const filename = path.basename(url);
    const demoFilename = filename.startsWith('demo-') ? filename : `demo-${filename}`;
    return `/r2/assets/demo/projects/comparisons/${demoFilename}`;
  }

  if (url.includes('/assets/projects/')) {
    const filename = path.basename(url);
    const demoFilename = filename.startsWith('demo-') ? filename : `demo-${filename}`;
    return `/r2/assets/demo/projects/${demoFilename}`;
  }

  if (url.includes('/assets/media/')) {
    const filename = path.basename(url);
    const demoFilename = filename.startsWith('demo-') ? filename : `demo-${filename}`;
    return `/r2/assets/demo/media/${demoFilename}`;
  }

  return url;
}

async function main() {
  console.log('=== SYNCHRONIZING 21 MACOS PROJECTS WITH COMPLETE NARRATIVE & RINGKASAN ===\n');

  // 1. Fetch from source D1
  const projectRows = await querySourceD1<{ value: string }>(
    `SELECT value FROM app_kv WHERE key = 'projects' LIMIT 1`
  );
  if (!projectRows[0]) throw new Error('No projects found in source D1!');

  const rawProjects = JSON.parse(projectRows[0].value) as Record<string, any>;
  const projectList = Object.values(rawProjects);
  console.log(`📡 Loaded ${projectList.length} projects from source D1.\n`);

  // Fetch content row from source D1 for about/experience/skills
  const contentRows = await querySourceD1<{ value: string }>(
    `SELECT value FROM app_kv WHERE key = 'content' LIMIT 1`
  );
  const rawContent = contentRows[0] ? JSON.parse(contentRows[0].value) : null;

  const targetSiteId = 'default-site';
  const now = new Date().toISOString();

  // Clear previous demo-gen- rows from projects, project_narratives, media_assets for default-site
  console.log('🧹 Cleaning up previous partial migration records for default-site...');
  await queryTargetD1(`DELETE FROM project_narratives WHERE site_id = ?`, [targetSiteId]);
  await queryTargetD1(`DELETE FROM media_assets WHERE site_id = ?`, [targetSiteId]);
  await queryTargetD1(`DELETE FROM projects WHERE site_id = ?`, [targetSiteId]);

  const syncedProjectsMap: Record<string, any> = {};

  for (let i = 0; i < projectList.length; i++) {
    const orig = projectList[i];
    const projectId = orig.id;
    const projectSlug = orig.slug;

    // Ensure narrative is full
    let narrative = orig.narrative || {};
    // If project is "Manipulasi Foto Musik Alam" which had empty narrative strings
    if (orig.title.includes('Manipulasi Foto Musik Alam') && (!narrative.concept && !narrative.challenge)) {
      narrative = {
        concept: "Eksperimen surealis menggabungkan piringan hitam vinyl dengan elemen alam liar. Konsepnya visualisasi 'suara alam' secara harfiah.",
        process: "Manipulasi foto digital dan motion graphic blending untuk menganimasikan tekstur piringan hitam dan dedaunan liar.",
        detail: "Detail alur piringan hitam vinyl yang membiaskan cahaya secara dinamis mengikuti ritme audio alam liar."
      };
    }

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

    let transformedGalleryGroups = orig.galleryGroups || [];
    if (Array.isArray(transformedGalleryGroups)) {
      transformedGalleryGroups = transformedGalleryGroups.map((group: any) => ({
        ...group,
        items: (group.items || []).map((item: any) => ({
          ...item,
          src: transformAssetUrl(item.src),
          poster: item.poster ? transformAssetUrl(item.poster) : item.poster,
        })),
      }));
    }

    const cleanProject = {
      ...orig,
      id: projectId,
      slug: projectSlug,
      title: orig.title,
      description: orig.description || '',
      cover: transformedCover,
      comparison: transformedComparison,
      gallery: transformedGallery,
      galleryItems: transformedGalleryItems,
      galleryGroups: transformedGalleryGroups,
      narrative: narrative,
      order: orig.order ?? (i + 1),
      status: 'published',
      updatedAt: now,
    };

    syncedProjectsMap[projectId] = cleanProject;

    // Construct metadataJson with ALL fields including narrative, description, and galleryGroups
    const metadataJson = JSON.stringify({
      client: cleanProject.client,
      year: cleanProject.year,
      tags: cleanProject.tags,
      cover: cleanProject.cover,
      description: cleanProject.description,
      autoplay: cleanProject.autoplay,
      muted: cleanProject.muted,
      loop: cleanProject.loop,
      playsInline: cleanProject.playsInline,
      coverWidth: cleanProject.coverWidth,
      coverHeight: cleanProject.coverHeight,
      likes: cleanProject.likes,
      shares: cleanProject.shares,
      allowComments: cleanProject.allowComments,
      role: cleanProject.role,
      timeline: cleanProject.timeline,
      software: cleanProject.software,
      team: cleanProject.team,
      type: cleanProject.type,
      comparison: cleanProject.comparison,
      external_link: cleanProject.external_link,
      gallery: cleanProject.gallery,
      galleryItems: cleanProject.galleryItems,
      galleryGroups: cleanProject.galleryGroups,
      narrative: cleanProject.narrative,
    });

    // 1. Insert into SQL table: projects
    await queryTargetD1(
      `INSERT INTO projects (id, site_id, slug, title, status, order_index, metadata_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        targetSiteId,
        projectSlug,
        cleanProject.title,
        'published',
        cleanProject.order,
        metadataJson,
        orig.createdAt || now,
        now,
      ]
    );

    // 2. Insert into SQL table: project_narratives
    const nId = `narr-${projectId}`;
    const challenge = narrative.challenge || narrative.concept || null;
    const solution = narrative.solution || narrative.process || null;
    const impact = narrative.impact || narrative.result || narrative.detail || null;

    await queryTargetD1(
      `INSERT INTO project_narratives (id, site_id, project_id, challenge, solution, impact, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nId,
        targetSiteId,
        projectId,
        challenge,
        solution,
        impact,
        orig.createdAt || now,
        now,
      ]
    );

    // 3. Only insert into SQL table media_assets if real galleryItems exist
    if (cleanProject.galleryItems && cleanProject.galleryItems.length > 0) {
      for (let j = 0; j < cleanProject.galleryItems.length; j++) {
        const item = cleanProject.galleryItems[j];
        const mediaId = `media-${projectId}-${j}`;
        const r2Key = (item.src || '').replace(/^\/r2\//, '');
        await queryTargetD1(
          `INSERT INTO media_assets (id, site_id, project_id, r2_key, public_url, alt_text, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            mediaId,
            targetSiteId,
            projectId,
            r2Key,
            item.src,
            item.alt || cleanProject.title,
            j,
            orig.createdAt || now,
            now,
          ]
        );
      }
    }

    console.log(`✅ [${i + 1}/${projectList.length}] Saved: "${cleanProject.title}" (slug: ${projectSlug})`);
    console.log(`   - Ringkasan: "${cleanProject.description.slice(0, 45)}..."`);
    console.log(`   - Konsep: "${(narrative.concept || narrative.challenge || '').slice(0, 45)}..."`);
    console.log(`   - Proses: "${(narrative.process || narrative.solution || '').slice(0, 45)}..."`);
    console.log(`   - Detail: "${(narrative.detail || narrative.impact || '').slice(0, 45)}..."\n`);
  }

  // Also sync app_kv table with clean projects
  console.log('💾 Syncing app_kv `projects` and `lastUpdated`...');
  await queryTargetD1(
    `INSERT INTO app_kv (key, value, updated_at)
     VALUES ('projects', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [JSON.stringify(syncedProjectsMap), now]
  );
  await queryTargetD1(
    `INSERT INTO app_kv (key, value, updated_at)
     VALUES ('lastUpdated', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [JSON.stringify(now), now]
  );

  // Sync content_default-site if rawContent exists
  if (rawContent) {
    console.log('💾 Syncing `content_default-site` and `content` with full about, experience, skills, and testimonials...');
    await queryTargetD1(
      `INSERT INTO app_kv (key, value, updated_at)
       VALUES ('content_default-site', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [JSON.stringify(rawContent), now]
    );
    await queryTargetD1(
      `INSERT INTO app_kv (key, value, updated_at)
       VALUES ('content', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [JSON.stringify(rawContent), now]
    );
  }

  console.log('\n🎉 ALL 21 MACOS PROJECTS AND NARRATIVES SYNCHRONIZED SUCCESSFULLY!');
}

main().catch(console.error);
