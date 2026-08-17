#!/usr/bin/env tsx
/**
 * Validate D1 backup and optional R2 manifest/live R2 object availability.
 */

import path from 'path';
import { headR2Object } from '../../src/lib/r2Storage';
import {
  collectR2KeysFromJson,
  D1BackupFile,
  expandKnownVideoSidecars,
  extractR2KeyFromValue,
  hasFlag,
  isR2NotFoundError,
  loadBackupEnv,
  readArgValue,
  readJson,
  writeJson,
} from './backup-common';

loadBackupEnv();

type R2Manifest = {
  kind: 'portfolio-os-r2-media-backup';
  objects: Array<{ key: string; size: number; error?: string }>;
};

type Issue = {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  table?: string;
  id?: string;
};

type Options = {
  backupFile?: string;
  r2ManifestFile?: string;
  liveR2: boolean;
  outFile?: string;
  json: boolean;
  help: boolean;
};

function printHelp() {
  console.log(`Usage:
  npx tsx scripts/cloudflare/audit-restore-integrity.ts --backup <file> [options]

Options:
  --backup <file>       d1-backup.json from backup:d1.
  --r2-manifest <file>  r2-manifest.json from backup:r2.
  --live-r2             Check referenced objects directly against R2.
  --out <file>          Write JSON report. Default: restore-integrity-report.json beside backup.
  --json                Print JSON report.
  --help, -h            Show this help.

Examples:
  npm run restore:audit -- --backup backups/d1/<timestamp>/d1-backup.json --r2-manifest backups/r2/<timestamp>/r2-manifest.json
  npm run restore:audit -- --backup backups/d1/<timestamp>/d1-backup.json --live-r2
`);
}

function parseArgs(argv: string[]): Options {
  return {
    backupFile: readArgValue(argv, '--backup'),
    r2ManifestFile: readArgValue(argv, '--r2-manifest'),
    liveR2: hasFlag(argv, '--live-r2'),
    outFile: readArgValue(argv, '--out'),
    json: hasFlag(argv, '--json'),
    help: hasFlag(argv, '--help') || hasFlag(argv, '-h'),
  };
}

function tableRows<T extends Record<string, unknown>>(backup: D1BackupFile, table: string) {
  return (backup.tables[table]?.rows || []) as T[];
}

function addIssue(issues: Issue[], issue: Issue) {
  issues.push(issue);
}

function parseJsonField(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function parseSitePrefix(key: string) {
  const match = /^sites\/([^/]+)\/([^/]+)\/.+/.exec(key);
  return match ? { siteId: match[1], category: match[2] } : null;
}

async function objectExistsInLiveR2(key: string) {
  try {
    await headR2Object(key);
    return true;
  } catch (error) {
    if (isR2NotFoundError(error)) return false;
    throw error;
  }
}

async function audit(options: Options) {
  if (!options.backupFile) throw new Error('--backup is required.');

  const backup = await readJson<D1BackupFile>(options.backupFile);
  if (backup.kind !== 'portfolio-os-d1-backup') {
    throw new Error('Unsupported backup file.');
  }

  const r2Manifest = options.r2ManifestFile
    ? await readJson<R2Manifest>(options.r2ManifestFile)
    : null;
  const r2ManifestKeys = new Set(r2Manifest?.objects.map((object) => object.key) || []);
  const r2ManifestFailed = r2Manifest?.objects.filter((object) => object.error).length || 0;

  const issues: Issue[] = [];
  if (r2ManifestFailed > 0) {
    addIssue(issues, {
      severity: 'warning',
      code: 'r2_manifest_download_errors',
      message: `${r2ManifestFailed} R2 objects had download errors in the manifest.`,
    });
  }

  const sites = tableRows<{ id: string; slug: string }>(backup, 'sites');
  const projects = tableRows<{ id: string; site_id: string; metadata_json?: string | null }>(
    backup,
    'projects'
  );
  const mediaAssets = tableRows<{ id: string; site_id: string; project_id?: string | null; r2_key: string }>(
    backup,
    'media_assets'
  );

  const siteIds = new Set(sites.map((site) => site.id));
  const projectIds = new Set(projects.map((project) => project.id));

  const siteScopedTables = [
    'client_access',
    'site_subscriptions',
    'client_password_resets',
    'site_quota_overrides',
    'projects',
    'project_narratives',
    'media_assets',
    'submissions',
    'ai_generations',
    'audit_logs',
  ];

  for (const table of siteScopedTables) {
    for (const row of tableRows<Record<string, unknown>>(backup, table)) {
      const siteId = row.site_id;
      if (typeof siteId !== 'string' || !siteIds.has(siteId)) {
        addIssue(issues, {
          severity: 'error',
          code: 'unknown_site_id',
          table,
          id: typeof row.id === 'string' ? row.id : undefined,
          message: `${table} references missing site_id: ${String(siteId)}`,
        });
      }
    }
  }

  for (const row of tableRows<Record<string, unknown>>(backup, 'project_narratives')) {
    const projectId = row.project_id;
    if (typeof projectId === 'string' && !projectIds.has(projectId)) {
      addIssue(issues, {
        severity: 'error',
        code: 'unknown_project_id',
        table: 'project_narratives',
        id: typeof row.id === 'string' ? row.id : undefined,
        message: `project_narratives references missing project_id: ${projectId}`,
      });
    }
  }

  for (const row of mediaAssets) {
    if (row.project_id && !projectIds.has(row.project_id)) {
      addIssue(issues, {
        severity: 'error',
        code: 'unknown_project_id',
        table: 'media_assets',
        id: row.id,
        message: `media_assets references missing project_id: ${row.project_id}`,
      });
    }
  }

  const referencedKeys = new Set<string>();
  const sidecarKeys = new Set<string>();

  for (const row of mediaAssets) {
    const key = extractR2KeyFromValue(row.r2_key);
    if (!key) {
      addIssue(issues, {
        severity: 'error',
        code: 'invalid_r2_key',
        table: 'media_assets',
        id: row.id,
        message: `media_assets row has invalid r2_key: ${row.r2_key}`,
      });
      continue;
    }

    referencedKeys.add(key);
    expandKnownVideoSidecars(key)
      .filter((sidecar) => sidecar !== key)
      .forEach((sidecar) => sidecarKeys.add(sidecar));

    const parsed = parseSitePrefix(key);
    if (parsed && parsed.siteId !== row.site_id) {
      addIssue(issues, {
        severity: 'error',
        code: 'cross_site_media_path',
        table: 'media_assets',
        id: row.id,
        message: `media_assets key ${key} belongs to ${parsed.siteId}, row belongs to ${row.site_id}`,
      });
    }
  }

  for (const project of projects) {
    const metadata = parseJsonField(project.metadata_json);
    if (!metadata) continue;

    for (const key of collectR2KeysFromJson(metadata)) {
      referencedKeys.add(key);
      const parsed = parseSitePrefix(key);
      if (parsed && parsed.siteId !== project.site_id) {
        addIssue(issues, {
          severity: 'error',
          code: 'cross_site_project_metadata_path',
          table: 'projects',
          id: project.id,
          message: `project metadata key ${key} belongs to ${parsed.siteId}, project belongs to ${project.site_id}`,
        });
      }
    }
  }

  for (const row of tableRows<{ key: string; value: string }>(backup, 'app_kv')) {
    const parsed = parseJsonField(row.value);
    if (!parsed) continue;
    collectR2KeysFromJson(parsed).forEach((key) => referencedKeys.add(key));
  }

  const missingReferenced: string[] = [];
  const missingSidecars: string[] = [];

  if (options.liveR2 || r2Manifest) {
    for (const key of referencedKeys) {
      const exists = options.liveR2 ? await objectExistsInLiveR2(key) : r2ManifestKeys.has(key);
      if (!exists) missingReferenced.push(key);
    }

    for (const key of sidecarKeys) {
      const exists = options.liveR2 ? await objectExistsInLiveR2(key) : r2ManifestKeys.has(key);
      if (!exists) missingSidecars.push(key);
    }
  }

  missingReferenced.forEach((key) =>
    addIssue(issues, {
      severity: 'error',
      code: 'missing_referenced_r2_object',
      message: `Referenced R2 object is missing: ${key}`,
    })
  );

  missingSidecars.forEach((key) =>
    addIssue(issues, {
      severity: 'warning',
      code: 'missing_video_sidecar',
      message: `Expected video sidecar was not found: ${key}`,
    })
  );

  if (r2Manifest) {
    for (const key of r2ManifestKeys) {
      const isSiteMedia = /^sites\/[^/]+\/(projects|wallpapers)\//.test(key);
      if (!isSiteMedia) continue;
      if (referencedKeys.has(key) || sidecarKeys.has(key)) continue;

      addIssue(issues, {
        severity: 'warning',
        code: 'unreferenced_r2_media_object',
        message: `R2 manifest contains site media not referenced by D1 backup: ${key}`,
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    backupFile: options.backupFile,
    r2ManifestFile: options.r2ManifestFile || null,
    liveR2: options.liveR2,
    summary: {
      sites: sites.length,
      projects: projects.length,
      mediaAssets: mediaAssets.length,
      referencedR2Keys: referencedKeys.size,
      sidecarKeys: sidecarKeys.size,
      errors: issues.filter((issue) => issue.severity === 'error').length,
      warnings: issues.filter((issue) => issue.severity === 'warning').length,
    },
    issues,
  };

  const outFile =
    options.outFile ||
    path.join(path.dirname(path.resolve(options.backupFile)), 'restore-integrity-report.json');
  await writeJson(outFile, report);

  return { report, outFile };
}

function printHuman(result: Awaited<ReturnType<typeof audit>>) {
  const { report, outFile } = result;
  console.log('Restore integrity audit');
  console.log(`Sites        : ${report.summary.sites}`);
  console.log(`Projects     : ${report.summary.projects}`);
  console.log(`Media assets : ${report.summary.mediaAssets}`);
  console.log(`R2 refs      : ${report.summary.referencedR2Keys}`);
  console.log(`Errors       : ${report.summary.errors}`);
  console.log(`Warnings     : ${report.summary.warnings}`);
  console.log(`Report       : ${outFile}`);

  if (report.issues.length > 0) {
    console.log('');
    report.issues.slice(0, 50).forEach((issue) => {
      console.log(`- ${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}`);
    });
    if (report.issues.length > 50) {
      console.log(`... ${report.issues.length - 50} more issues in JSON report.`);
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const result = await audit(options);
  if (options.json) {
    console.log(JSON.stringify(result.report, null, 2));
  } else {
    printHuman(result);
  }

  if (result.report.summary.errors > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
