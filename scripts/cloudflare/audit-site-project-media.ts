#!/usr/bin/env tsx
/**
 * Audit + optional cleanup for Cloudflare R2 project media under:
 *   sites/{siteId}/projects/...
 *
 * This is the multi-tenant replacement for the legacy assets/projects audit.
 * It reads the relational D1 project tables, compares valid project references
 * with R2 objects, and reports:
 *   - orphan R2 objects: object exists in R2 but no valid project references it
 *   - dangling references: project points at an R2 key that is missing
 *   - cross-site references: project references another site's project media
 *   - invalid media rows: media_assets rows whose project is missing
 *
 * Default is report-only. Deletion requires --delete-orphans and passes safety
 * guards before deleting anything.
 */

import { config as loadEnv } from 'dotenv';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import {
  getMissingD1EnvKeys,
  isD1Configured,
  queryD1,
} from '../../src/lib/cloudflareD1';
import {
  deleteFromR2,
  getMissingR2EnvKeys,
  isR2StorageConfigured,
  listR2Objects,
} from '../../src/lib/r2Storage';
import {
  MediaAssetSqlRow,
  ProjectSqlRow,
  mapSqlToProject,
} from '../../src/lib/mappers/projectMapper';
import {
  extractProjectAssets,
  extractSiteProjectMediaKey,
  extractSiteProjectMediaKeys,
} from '../../src/lib/services/project/projectStorage';

type SiteRow = {
  id: string;
  slug: string;
  name: string;
  plan: string;
  status: string;
};

type MediaAssetAuditRow = Omit<MediaAssetSqlRow, 'project_id'> & {
  project_id: string | null;
};

type CliOptions = {
  siteId?: string;
  json: boolean;
  deleteOrphans: boolean;
  yes: boolean;
  help: boolean;
};

type ProjectRef = {
  siteId: string;
  projectId: string;
  slug: string;
  title: string;
  source: 'project_metadata' | 'media_assets';
  value: string;
  key: string;
};

type OrphanRow = {
  siteId: string;
  key: string;
  size: number;
  uploaded?: string;
};

type DanglingRow = ProjectRef;

type CrossSiteRef = ProjectRef & {
  referencedSiteId: string;
};

type InvalidMediaRow = {
  id: string;
  siteId: string;
  projectId: string | null;
  key: string;
  reason: 'missing_project' | 'cross_site_key';
};

type UnknownSiteObject = {
  siteId: string;
  key: string;
  size: number;
};

type SiteSummary = {
  siteId: string;
  siteSlug?: string;
  siteStatus?: string;
  r2Objects: number;
  r2Bytes: number;
  referencedKeys: number;
  orphans: number;
  dangling: number;
  invalidMediaRows: number;
  crossSiteRefs: number;
};

type AuditResult = {
  scope: string;
  generatedAt: string;
  totals: {
    sites: number;
    projects: number;
    validProjectRefs: number;
    r2ProjectObjects: number;
    r2Bytes: number;
    orphans: number;
    dangling: number;
    crossSiteRefs: number;
    invalidMediaRows: number;
    unknownSiteObjects: number;
  };
  siteSummaries: SiteSummary[];
  orphans: OrphanRow[];
  dangling: DanglingRow[];
  crossSiteRefs: CrossSiteRef[];
  invalidMediaRows: InvalidMediaRow[];
  unknownSiteObjects: UnknownSiteObject[];
};

const ALL_PROJECT_MEDIA_PREFIX = 'sites/';
const ORPHAN_DELETE_RATIO_THRESHOLD = 0.2;

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    deleteOrphans: false,
    yes: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') options.json = true;
    else if (arg === '--delete-orphans') options.deleteOrphans = true;
    else if (arg === '--yes' || arg === '-y') options.yes = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--site-id') {
      const siteId = argv[i + 1];
      if (!siteId || siteId.startsWith('-')) throw new Error('--site-id requires a value');
      options.siteId = siteId;
      i += 1;
    } else if (arg.startsWith('--site-id=')) {
      options.siteId = arg.slice('--site-id='.length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  npx tsx scripts/cloudflare/audit-site-project-media.ts [options]

Options:
  --site-id <id>       Audit one site only. Default: all sites.
  --json               Print JSON report.
  --delete-orphans     Delete orphan R2 objects after safety checks.
  --yes, -y            Skip confirmation prompt for deletion.
  --help, -h           Show this help.

Examples:
  npx tsx scripts/cloudflare/audit-site-project-media.ts
  npx tsx scripts/cloudflare/audit-site-project-media.ts --site-id default-site
  npx tsx scripts/cloudflare/audit-site-project-media.ts --json
`);
}

function getSiteProjectPrefix(siteId?: string) {
  return siteId ? `sites/${siteId}/projects/` : ALL_PROJECT_MEDIA_PREFIX;
}

function normalizePotentialR2Key(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const path = /^https?:\/\//i.test(trimmed) ? new URL(trimmed).pathname : trimmed;
    const decodedPath = decodeURIComponent(path).replace(/^\/+/, '');
    return decodedPath.startsWith('r2/') ? decodedPath.substring('r2/'.length) : decodedPath;
  } catch {
    return null;
  }
}

function parseSiteProjectKey(key: string): { siteId: string } | null {
  const match = /^sites\/([^/]+)\/projects\/.+/.exec(key);
  return match ? { siteId: match[1] } : null;
}

function expandKnownProjectMediaSidecars(key: string): string[] {
  const keys = [key];
  const videoMatch = key.match(/^(.*)\.(mp4|webm|mov)$/i);

  if (videoMatch && !key.match(/-preview\.(mp4|webm|mov)$/i)) {
    const base = videoMatch[1];
    keys.push(`${base}-preview.mp4`, `${base}.jpg`, `${base}.webp`);
  }

  return keys;
}

function addReference(refsByKey: Map<string, ProjectRef[]>, ref: ProjectRef) {
  const refs = refsByKey.get(ref.key) ?? [];
  refs.push(ref);
  refsByKey.set(ref.key, refs);
}

function groupByProject(mediaRows: MediaAssetAuditRow[]) {
  const grouped = new Map<string, MediaAssetSqlRow[]>();
  for (const row of mediaRows) {
    if (!row.project_id) continue;
    const rows = grouped.get(row.project_id) ?? [];
    rows.push(row as MediaAssetSqlRow);
    grouped.set(row.project_id, rows);
  }
  return grouped;
}

async function loadSites(siteId?: string) {
  if (siteId) {
    return queryD1<SiteRow>(
      `SELECT id, slug, name, plan, status FROM sites WHERE id = ? ORDER BY created_at ASC`,
      [siteId]
    );
  }

  return queryD1<SiteRow>(
    `SELECT id, slug, name, plan, status FROM sites ORDER BY created_at ASC`
  );
}

async function loadProjects(siteId?: string) {
  if (siteId) {
    return queryD1<ProjectSqlRow>(`SELECT * FROM projects WHERE site_id = ?`, [siteId]);
  }

  return queryD1<ProjectSqlRow>(`SELECT * FROM projects`);
}

async function loadMediaAssets(siteId?: string) {
  if (siteId) {
    return queryD1<MediaAssetAuditRow>(`SELECT * FROM media_assets WHERE site_id = ?`, [siteId]);
  }

  return queryD1<MediaAssetAuditRow>(`SELECT * FROM media_assets`);
}

async function loadProjectR2Objects(siteId?: string) {
  const listed = await listR2Objects({ prefix: getSiteProjectPrefix(siteId) });
  return listed.filter((object) => Boolean(parseSiteProjectKey(object.key)));
}

function createSiteSummary(siteId: string, site?: SiteRow): SiteSummary {
  return {
    siteId,
    siteSlug: site?.slug,
    siteStatus: site?.status,
    r2Objects: 0,
    r2Bytes: 0,
    referencedKeys: 0,
    orphans: 0,
    dangling: 0,
    invalidMediaRows: 0,
    crossSiteRefs: 0,
  };
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function audit(options: CliOptions): Promise<AuditResult> {
  if (!isD1Configured()) {
    throw new Error(
      `Cloudflare D1 env tidak lengkap. Missing: ${getMissingD1EnvKeys().join(', ')}`
    );
  }
  if (!isR2StorageConfigured()) {
    throw new Error(
      `Cloudflare R2 env tidak lengkap. Missing: ${getMissingR2EnvKeys().join(', ')}`
    );
  }

  const [sites, projectRows, mediaRows, r2Objects] = await Promise.all([
    loadSites(options.siteId),
    loadProjects(options.siteId),
    loadMediaAssets(options.siteId),
    loadProjectR2Objects(options.siteId),
  ]);

  const sitesById = new Map(sites.map((site) => [site.id, site]));
  const projectRowsById = new Map(projectRows.map((project) => [project.id, project]));
  const mediaRowsByProject = groupByProject(mediaRows);
  const referencedKeys = new Set<string>();
  const directRefsByKey = new Map<string, ProjectRef[]>();
  const crossSiteRefs: CrossSiteRef[] = [];
  const invalidMediaRows: InvalidMediaRow[] = [];

  for (const projectRow of projectRows) {
    const projectMediaRows = mediaRowsByProject.get(projectRow.id) ?? [];
    const project = mapSqlToProject(projectRow, null, projectMediaRows);
    const mediaRowKeys = projectMediaRows
      .map((row) => row.r2_key)
      .filter((key): key is string => Boolean(key));

    const projectKeys = extractSiteProjectMediaKeys(projectRow.site_id, project, mediaRowKeys);
    projectKeys.forEach((key) => referencedKeys.add(key));

    for (const value of extractProjectAssets(project)) {
      const normalizedKey = normalizePotentialR2Key(value);
      if (!normalizedKey) continue;
      const parsed = parseSiteProjectKey(normalizedKey);
      if (!parsed) continue;

      const ref: ProjectRef = {
        siteId: projectRow.site_id,
        projectId: projectRow.id,
        slug: projectRow.slug,
        title: projectRow.title,
        source: 'project_metadata',
        value,
        key: normalizedKey,
      };

      if (parsed.siteId !== projectRow.site_id) {
        expandKnownProjectMediaSidecars(normalizedKey).forEach((key) => referencedKeys.add(key));
        crossSiteRefs.push({ ...ref, referencedSiteId: parsed.siteId });
      } else {
        addReference(directRefsByKey, ref);
      }
    }

    for (const row of projectMediaRows) {
      const key = extractSiteProjectMediaKey(projectRow.site_id, row.r2_key);
      if (!key) continue;

      addReference(directRefsByKey, {
        siteId: projectRow.site_id,
        projectId: projectRow.id,
        slug: projectRow.slug,
        title: projectRow.title,
        source: 'media_assets',
        value: row.r2_key,
        key,
      });
    }
  }

  for (const row of mediaRows) {
    const key = normalizePotentialR2Key(row.r2_key);
    if (!key) continue;
    const parsed = parseSiteProjectKey(key);
    if (!parsed) continue;

    if (!row.project_id || !projectRowsById.has(row.project_id)) {
      invalidMediaRows.push({
        id: row.id,
        siteId: row.site_id,
        projectId: row.project_id,
        key,
        reason: 'missing_project',
      });
    } else if (parsed.siteId !== row.site_id) {
      invalidMediaRows.push({
        id: row.id,
        siteId: row.site_id,
        projectId: row.project_id,
        key,
        reason: 'cross_site_key',
      });
    }
  }

  const r2ObjectsByKey = new Map(r2Objects.map((object) => [object.key, object]));
  const r2KeySet = new Set(r2ObjectsByKey.keys());
  const orphans: OrphanRow[] = [];
  const dangling: DanglingRow[] = [];
  const unknownSiteObjects: UnknownSiteObject[] = [];

  for (const object of r2Objects) {
    const parsed = parseSiteProjectKey(object.key);
    if (!parsed) continue;
    if (!sitesById.has(parsed.siteId) && !projectRows.some((project) => project.site_id === parsed.siteId)) {
      unknownSiteObjects.push({
        siteId: parsed.siteId,
        key: object.key,
        size: object.size,
      });
    }
    if (!referencedKeys.has(object.key)) {
      orphans.push({
        siteId: parsed.siteId,
        key: object.key,
        size: object.size,
        uploaded: object.uploaded?.toISOString(),
      });
    }
  }

  for (const [key, refs] of directRefsByKey) {
    if (r2KeySet.has(key)) continue;
    dangling.push(...refs);
  }

  const referencedProjectKeySiteIds = new Set<string>();
  referencedKeys.forEach((key) => {
    const parsed = parseSiteProjectKey(key);
    if (parsed) referencedProjectKeySiteIds.add(parsed.siteId);
  });

  const allSiteIds = new Set<string>([
    ...sites.map((site) => site.id),
    ...projectRows.map((project) => project.site_id),
    ...r2Objects.map((object) => parseSiteProjectKey(object.key)?.siteId).filter(Boolean),
    ...referencedProjectKeySiteIds,
  ] as string[]);
  const siteSummaries = [...allSiteIds]
    .sort()
    .map((siteId) => createSiteSummary(siteId, sitesById.get(siteId)));
  const siteSummaryById = new Map(siteSummaries.map((summary) => [summary.siteId, summary]));

  for (const object of r2Objects) {
    const parsed = parseSiteProjectKey(object.key);
    if (!parsed) continue;
    const summary = siteSummaryById.get(parsed.siteId);
    if (!summary) continue;
    summary.r2Objects += 1;
    summary.r2Bytes += object.size;
  }

  referencedKeys.forEach((key) => {
    const parsed = parseSiteProjectKey(key);
    if (!parsed) return;
    const summary = siteSummaryById.get(parsed.siteId);
    if (summary) summary.referencedKeys += 1;
  });
  orphans.forEach((row) => {
    const summary = siteSummaryById.get(row.siteId);
    if (summary) summary.orphans += 1;
  });
  dangling.forEach((row) => {
    const summary = siteSummaryById.get(row.siteId);
    if (summary) summary.dangling += 1;
  });
  invalidMediaRows.forEach((row) => {
    const summary = siteSummaryById.get(row.siteId);
    if (summary) summary.invalidMediaRows += 1;
  });
  crossSiteRefs.forEach((row) => {
    const summary = siteSummaryById.get(row.siteId);
    if (summary) summary.crossSiteRefs += 1;
  });

  const r2Bytes = r2Objects.reduce((total, object) => total + object.size, 0);

  return {
    scope: options.siteId ? `sites/${options.siteId}/projects/` : 'sites/*/projects/',
    generatedAt: new Date().toISOString(),
    totals: {
      sites: sites.length,
      projects: projectRows.length,
      validProjectRefs: referencedKeys.size,
      r2ProjectObjects: r2Objects.length,
      r2Bytes,
      orphans: orphans.length,
      dangling: dangling.length,
      crossSiteRefs: crossSiteRefs.length,
      invalidMediaRows: invalidMediaRows.length,
      unknownSiteObjects: unknownSiteObjects.length,
    },
    siteSummaries,
    orphans,
    dangling,
    crossSiteRefs,
    invalidMediaRows,
    unknownSiteObjects,
  };
}

function printRows<T>(rows: T[], formatter: (row: T) => string, emptyText: string) {
  if (rows.length === 0) {
    console.log(emptyText);
    return;
  }

  rows.forEach((row) => console.log(formatter(row)));
}

function printHumanReport(result: AuditResult) {
  console.log(`Scope              : ${result.scope}`);
  console.log(`Generated          : ${result.generatedAt}`);
  console.log(`Sites              : ${result.totals.sites}`);
  console.log(`Projects           : ${result.totals.projects}`);
  console.log(`R2 project objects : ${result.totals.r2ProjectObjects}`);
  console.log(`R2 project bytes   : ${formatBytes(result.totals.r2Bytes)}`);
  console.log(`Referenced keys    : ${result.totals.validProjectRefs}`);
  console.log('');

  console.log('Per-site summary');
  if (result.siteSummaries.length === 0) {
    console.log('  No sites/projects/project media found.');
  } else {
    for (const site of result.siteSummaries) {
      console.log(
        `  - ${site.siteId}${site.siteSlug ? ` (${site.siteSlug})` : ''}: ` +
          `${site.r2Objects} objects, ${formatBytes(site.r2Bytes)}, ` +
          `${site.referencedKeys} refs, ${site.orphans} orphan, ` +
          `${site.dangling} dangling, ${site.invalidMediaRows} invalid rows, ` +
          `${site.crossSiteRefs} cross-site refs`
      );
    }
  }
  console.log('');

  console.log(`Orphan files: ${result.orphans.length}`);
  printRows(
    result.orphans,
    (row) => `  - ${row.key} (${formatBytes(row.size)})`,
    '  None'
  );
  console.log('');

  console.log(`Dangling references: ${result.dangling.length}`);
  printRows(
    result.dangling,
    (row) => `  - ${row.siteId}/${row.slug} ${row.source}: ${row.value}`,
    '  None'
  );
  console.log('');

  console.log(`Cross-site references: ${result.crossSiteRefs.length}`);
  printRows(
    result.crossSiteRefs,
    (row) =>
      `  - ${row.siteId}/${row.slug} references ${row.referencedSiteId}: ${row.value}`,
    '  None'
  );
  console.log('');

  console.log(`Invalid media_assets rows: ${result.invalidMediaRows.length}`);
  printRows(
    result.invalidMediaRows,
    (row) => `  - ${row.id} site=${row.siteId} project=${row.projectId ?? '<null>'} ${row.reason}: ${row.key}`,
    '  None'
  );
  console.log('');

  console.log(`Unknown site R2 objects: ${result.unknownSiteObjects.length}`);
  printRows(
    result.unknownSiteObjects,
    (row) => `  - ${row.key} (${formatBytes(row.size)})`,
    '  None'
  );
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(`${question} [y/N] `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

async function deleteOrphans(result: AuditResult, skipConfirm: boolean) {
  if (result.orphans.length === 0) {
    console.log('Tidak ada orphan untuk dihapus.');
    return;
  }

  if (result.totals.validProjectRefs === 0) {
    console.error(
      'ABORT: D1 returned zero valid project media references. Refusing to delete anything.'
    );
    process.exitCode = 2;
    return;
  }

  if (result.invalidMediaRows.length > 0 || result.crossSiteRefs.length > 0) {
    console.error(
      'ABORT: Data issues found (invalid media rows or cross-site refs). Fix/report them before deleting R2 objects.'
    );
    process.exitCode = 2;
    return;
  }

  const ratio =
    result.totals.r2ProjectObjects > 0
      ? result.orphans.length / result.totals.r2ProjectObjects
      : 0;
  if (ratio > ORPHAN_DELETE_RATIO_THRESHOLD) {
    console.error(
      `ABORT: orphan ratio ${(ratio * 100).toFixed(1)}% (${result.orphans.length}/${result.totals.r2ProjectObjects}) above ${ORPHAN_DELETE_RATIO_THRESHOLD * 100}% safety threshold.`
    );
    process.exitCode = 2;
    return;
  }

  console.log(`Akan menghapus ${result.orphans.length} object dari R2:`);
  result.orphans.forEach((row) => console.log(`  - ${row.key}`));

  if (!skipConfirm) {
    const ok = await confirm('Lanjut hapus permanen?');
    if (!ok) {
      console.log('Dibatalkan.');
      return;
    }
  }

  let deleted = 0;
  let failed = 0;
  for (const row of result.orphans) {
    try {
      await deleteFromR2(row.key);
      console.log(`  deleted ${row.key}`);
      deleted += 1;
    } catch (error) {
      console.error(`  failed ${row.key}: ${(error as Error).message}`);
      failed += 1;
    }
  }

  console.log(`Done. deleted=${deleted}, failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const result = await audit(options);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHumanReport(result);
  }

  if (options.deleteOrphans) {
    console.log('');
    await deleteOrphans(result, options.yes);
  }

  if (
    !options.deleteOrphans &&
    (result.orphans.length > 0 ||
      result.dangling.length > 0 ||
      result.invalidMediaRows.length > 0 ||
      result.crossSiteRefs.length > 0)
  ) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
