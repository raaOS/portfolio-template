#!/usr/bin/env tsx
/**
 * Production-safe Cloudflare D1 backup.
 *
 * Reads selected product tables and writes a local JSON backup. Secret values
 * from .env.local are never printed.
 */

import crypto from 'crypto';
import path from 'path';
import { D1_SCHEMA_QUERIES } from '../../src/lib/d1-schema';
import {
  D1BackupFile,
  ensureDir,
  getCurrentD1DatabaseId,
  hasFlag,
  loadBackupEnv,
  parseTableList,
  queryD1ForDatabase,
  quoteIdentifier,
  readArgValue,
  resolveOutputDir,
  safeTimestamp,
  writeJson,
} from './backup-common';

loadBackupEnv();

type CountRow = { count: number };
type TableInfoRow = { name: string };

type Options = {
  outDir: string;
  tables: string[];
  dryRun: boolean;
  json: boolean;
  help: boolean;
};

function printHelp() {
  console.log(`Usage:
  npx tsx scripts/cloudflare/backup-d1.ts [options]

Options:
  --out <dir>        Output directory. Default: backups/d1/<timestamp>
  --tables <list>    Comma-separated table list. Default: product tables.
  --dry-run          Read table counts only; do not write backup files.
  --json             Print machine-readable summary.
  --help, -h         Show this help.

Examples:
  npm run backup:d1
  npm run backup:d1 -- --out backups/drills/2026-07-07/d1
  npm run backup:d1 -- --dry-run
`);
}

function parseArgs(argv: string[]): Options {
  return {
    outDir: resolveOutputDir(readArgValue(argv, '--out'), ['backups', 'd1', safeTimestamp()]),
    tables: parseTableList(readArgValue(argv, '--tables')),
    dryRun: hasFlag(argv, '--dry-run'),
    json: hasFlag(argv, '--json'),
    help: hasFlag(argv, '--help') || hasFlag(argv, '-h'),
  };
}

async function tableExists(databaseId: string, table: string) {
  const rows = await queryD1ForDatabase<{ name: string }>(
    databaseId,
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`,
    [table]
  );

  return rows.length > 0;
}

async function getColumns(databaseId: string, table: string) {
  const rows = await queryD1ForDatabase<TableInfoRow>(
    databaseId,
    `PRAGMA table_info(${quoteIdentifier(table)})`
  );

  return rows.map((row) => row.name);
}

async function countRows(databaseId: string, table: string) {
  const rows = await queryD1ForDatabase<CountRow>(
    databaseId,
    `SELECT COUNT(*) as count FROM ${quoteIdentifier(table)}`
  );

  return Number(rows[0]?.count || 0);
}

async function loadTable(databaseId: string, table: string) {
  return queryD1ForDatabase<Record<string, unknown>>(
    databaseId,
    `SELECT * FROM ${quoteIdentifier(table)} ORDER BY rowid ASC`
  );
}

async function createBackup(options: Options) {
  const databaseId = getCurrentD1DatabaseId();
  if (!databaseId) throw new Error('CLOUDFLARE_D1_DATABASE_ID is missing.');

  const generatedAt = new Date().toISOString();
  const schemaHash = crypto
    .createHash('sha256')
    .update(D1_SCHEMA_QUERIES.join('\n'))
    .digest('hex');

  const backup: D1BackupFile = {
    kind: 'portfolio-os-d1-backup',
    version: 1,
    generatedAt,
    manifest: {
      source: 'cloudflare-d1',
      tables: [],
      totalRows: 0,
      schemaHash,
      notes: [
        'Local JSON backup for restore drill and staging restore.',
        'Do not commit this file. It may contain buyer email, password hashes, and reset token hashes.',
      ],
    },
    tables: {},
  };

  const missingTables: string[] = [];

  for (const table of options.tables) {
    if (!(await tableExists(databaseId, table))) {
      missingTables.push(table);
      continue;
    }

    const columns = await getColumns(databaseId, table);
    const rowCount = await countRows(databaseId, table);

    backup.manifest.tables.push({ name: table, columns, rowCount });
    backup.manifest.totalRows += rowCount;

    if (!options.dryRun) {
      const rows = await loadTable(databaseId, table);
      backup.tables[table] = {
        columns,
        rows: rows as never,
      };
    }
  }

  if (options.dryRun) {
    return {
      dryRun: true,
      outDir: options.outDir,
      generatedAt,
      tables: backup.manifest.tables,
      totalRows: backup.manifest.totalRows,
      missingTables,
    };
  }

  await ensureDir(options.outDir);
  const backupFile = path.join(options.outDir, 'd1-backup.json');
  const manifestFile = path.join(options.outDir, 'manifest.json');
  await writeJson(backupFile, backup);
  await writeJson(manifestFile, backup.manifest);

  return {
    dryRun: false,
    outDir: options.outDir,
    backupFile,
    manifestFile,
    generatedAt,
    tables: backup.manifest.tables,
    totalRows: backup.manifest.totalRows,
    missingTables,
  };
}

function printHumanSummary(result: Awaited<ReturnType<typeof createBackup>>) {
  console.log('D1 backup summary');
  console.log(`Mode       : ${result.dryRun ? 'dry-run' : 'written'}`);
  console.log(`Generated  : ${result.generatedAt}`);
  console.log(`Tables     : ${result.tables.length}`);
  console.log(`Rows       : ${result.totalRows}`);
  console.log(`Output dir : ${result.outDir}`);
  if (!result.dryRun) {
    console.log(`Backup file: ${result.backupFile}`);
    console.log(`Manifest   : ${result.manifestFile}`);
  }
  if (result.missingTables.length > 0) {
    console.log(`Missing    : ${result.missingTables.join(', ')}`);
  }
  console.log('');
  result.tables.forEach((table) => {
    console.log(`- ${table.name}: ${table.rowCount} rows, ${table.columns.length} columns`);
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const result = await createBackup(options);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHumanSummary(result);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
