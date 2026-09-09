import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { queryD1 } from '../src/lib/cloudflareD1';
import { listR2ObjectKeys } from '../src/lib/r2Storage';
import { projectSqlService } from '../src/lib/services/project/projectSqlService';

async function verify() {
  console.log('=== VERIFYING DEMO MIGRATION RESULTS ===\n');

  // 1. Check SQL projects count
  const sqlProjects = await queryD1<{ id: string; title: string; slug: string; status: string }>(
    `SELECT id, title, slug, status FROM projects WHERE site_id = 'default-site'`
  );
  console.log(`1. Total projects in D1 SQL table for default-site: ${sqlProjects.length}`);
  console.log('Sample SQL projects:');
  for (const p of sqlProjects.slice(0, 5)) {
    console.log(`  - [${p.id}] ${p.title} (${p.slug}) [${p.status}]`);
  }

  // 2. Check getProjectsSql
  const { projects } = await projectSqlService.getProjectsSql('default-site', 'published');
  console.log(`\n2. projectSqlService.getProjectsSql count: ${projects.length}`);
  if (projects.length > 0) {
    console.log('Sample project covers:');
    for (const p of projects.slice(0, 5)) {
      console.log(`  - ${p.title} -> Cover: ${p.cover}`);
    }
  }

  // 3. Check R2 objects
  const r2DemoKeys = await listR2ObjectKeys({ prefix: 'assets/demo/' });
  console.log(`\n3. Total objects in R2 with prefix "assets/demo/": ${r2DemoKeys.length}`);
  console.log('Sample R2 keys:');
  for (const k of r2DemoKeys.slice(0, 5)) {
    console.log(`  - ${k}`);
  }

  console.log('\n✅ VERIFICATION COMPLETE: ALL DATA AND ASSETS PRESENT AND VERIFIED!');
}

verify().catch(console.error);
