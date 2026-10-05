#!/usr/bin/env tsx
/**
 * Restore a D1 backup into a staging/restore database.
 *
 * Default mode is dry-run validation. Applying to the current production
 * database is blocked unless explicit danger flags are passed.
 */

import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { D1_SCHEMA_QUERIES } from '../../src/lib/d1-schema';
import { SHARED_SCHEMA_QUERIES } from '../../src/crud/shared/db/schema';
import {
  D1BackupFile,
  D1Param,
  getCurrentD1DatabaseId,
  getRestoreD1DatabaseId,
  hasFlag,
  loadBackupEnv,
  queryD1ForDatabase,
  quoteIdentifier,
  readArgValue,
  readJson,
  RESTORE_TABLE_ORDER,
} from './backup-common';

loadBackupEnv();

type Options = {
  backupFile?: string;
  targetDatabaseId?: string;
  apply: boolean;
  yes: boolean;
  allowCurrentDatabase: boolean;
  dangerAllowProductionOverwrite: boolean;
  help: boolean;
};

function printHelp() {
  console.log(`Usage:
  npx tsx scripts/cloudflare/restore-d1.ts --backup <file> [options]

Options:
  --backup <file>                         d1-backup.json from backup:d1.
  --target-database-id <id>               Restore target. Defaults to CLOUDFLARE_D1_RESTORE_DATABASE_ID.
  --apply                                 Write to target database. Default is dry-run.
  --yes, -y                               Skip interactive confirmation.
  --allow-current-database                Allow current CLOUDFLARE_D1_DATABASE_ID as target.
  --i-understand-this-can-overwrite-production
                                           Required with --apply when target is the current database.
  --help, -h                              Show this help.

Examples:
  npm run restore:d1 -- --backup backups/d1/<timestamp>/d1-backup.json
  npm run restore:d1 -- --backup backups/d1/<timestamp>/d1-backup.json --target-database-id <staging-db-id> --apply
`);
}

function parseArgs(argv: string[]): Options {
  return {
    backupFile: readArgValue(argv, '--backup'),
    targetDatabaseId: readArgValue(argv, '--target-database-id') || getRestoreD1DatabaseId(),
    apply: hasFlag(argv, '--apply'),
    yes: hasFlag(argv, '--yes') || hasFlag(argv, '-y'),
    allowCurrentDatabase: hasFlag(argv, '--allow-current-database'),
    dangerAllowProductionOverwrite: hasFlag(argv, '--i-understand-this-can-overwrite-production'),
    help: hasFlag(argv, '--help') || hasFlag(argv, '-h'),
  };
}

function validateBackup(backup: D1BackupFile) {
  if (backup.kind !== 'portfolio-os-d1-backup' || backup.version !== 1) {
    throw new Error('Unsupported backup file. Expected portfolio-os-d1-backup version 1.');
  }

  for (const table of backup.manifest.tables) {
    quoteIdentifier(table.name);
    table.columns.forEach(quoteIdentifier);

    const tableData = backup.tables[table.name];
    if (!tableData) {
      throw new Error(`Backup is missing table payload: ${table.name}`);
    }

    if (tableData.rows.length !== table.rowCount) {
      throw new Error(
        `Backup row count mismatch for ${table.name}: manifest=${table.rowCount}, rows=${tableData.rows.length}`
      );
    }
  }
}

function getRestoreOrder(backup: D1BackupFile) {
  const available = new Set(backup.manifest.tables.map((table) => table.name));
  const ordered = RESTORE_TABLE_ORDER.filter((table) => available.has(table));
  const extra = [...available].filter((table) => !ordered.includes(table as never)).sort();
  return [...ordered, ...extra];
}

async function confirm(question: string) {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(`${question} [y/N] `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

async function bootstrapTarget(databaseId: string) {
  await queryD1ForDatabase(
    databaseId,
    `CREATE TABLE IF NOT EXISTS app_kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT`
  );

  for (const sql of D1_SCHEMA_QUERIES) {
    await queryD1ForDatabase(databaseId, sql);
  }

  // Skema runtime customer (site_users, site_settings, rate_limits,
  // portfolio_templates, site_template_entitlements) — tanpa ini, backup yang
  // memuat tabel bersama gagal di-DELETE/INSERT pada target staging yang
  // dibuat murni dari D1_SCHEMA_QUERIES. Semua query memakai IF NOT EXISTS
  // (tabel yang sudah ada, termasuk `sites`/`projects` buatan D1, dibiarkan).
  for (const sql of SHARED_SCHEMA_QUERIES) {
    await queryD1ForDatabase(databaseId, sql);
  }

  const projectInfo = await queryD1ForDatabase<{ name: string }>(
    databaseId,
    'PRAGMA table_info(projects)'
  );
  const hasMetadata = projectInfo.some((column) => column.name === 'metadata_json');
  if (!hasMetadata) {
    await queryD1ForDatabase(databaseId, 'ALTER TABLE projects ADD COLUMN metadata_json TEXT');
  }
}

async function countTargetRows(databaseId: string, tables: string[]) {
  const counts: Record<string, number> = {};

  for (const table of tables) {
    try {
      const rows = await queryD1ForDatabase<{ count: number }>(
        databaseId,
        `SELECT COUNT(*) as count FROM ${quoteIdentifier(table)}`
      );
      counts[table] = Number(rows[0]?.count || 0);
    } catch {
      counts[table] = 0;
    }
  }

  return counts;
}

function rowParams(row: Record<string, unknown>, columns: string[]) {
  return columns.map((column) => {
    const value = row[column];
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return value;
    }

    return JSON.stringify(value);
  }) as D1Param[];
}

async function restoreTable(databaseId: string, table: string, backup: D1BackupFile) {
  const tableData = backup.tables[table];
  const columns = tableData.columns;
  if (columns.length === 0) return;

  await queryD1ForDatabase(databaseId, `DELETE FROM ${quoteIdentifier(table)}`);

  if (tableData.rows.length === 0) return;

  const quotedColumns = columns.map(quoteIdentifier).join(', ');
  const placeholders = columns.map(() => '?').join(', ');
  const sql = `INSERT INTO ${quoteIdentifier(table)} (${quotedColumns}) VALUES (${placeholders})`;

  for (const row of tableData.rows) {
    await queryD1ForDatabase(databaseId, sql, rowParams(row, columns));
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  if (!options.backupFile) throw new Error('--backup is required.');

  const backup = await readJson<D1BackupFile>(options.backupFile);
  validateBackup(backup);

  const currentDatabaseId = getCurrentD1DatabaseId();
  const targetDatabaseId = options.targetDatabaseId || currentDatabaseId;
  if (!targetDatabaseId) {
    throw new Error(
      'Restore target missing. Set CLOUDFLARE_D1_RESTORE_DATABASE_ID or pass --target-database-id.'
    );
  }

  const usingCurrentDatabase = Boolean(currentDatabaseId && targetDatabaseId === currentDatabaseId);
  if (options.apply && usingCurrentDatabase && !options.allowCurrentDatabase) {
    throw new Error(
      'Refusing to use current CLOUDFLARE_D1_DATABASE_ID as restore target. Use a staging DB via CLOUDFLARE_D1_RESTORE_DATABASE_ID or --target-database-id.'
    );
  }

  if (
    options.apply &&
    usingCurrentDatabase &&
    !options.dangerAllowProductionOverwrite
  ) {
    throw new Error(
      'Refusing destructive restore into current database. Pass --i-understand-this-can-overwrite-production only if this is truly intended.'
    );
  }

  const tableOrder = getRestoreOrder(backup);
  const beforeCounts = await countTargetRows(targetDatabaseId, tableOrder);

  console.log('D1 restore validation');
  console.log(`Mode       : ${options.apply ? 'apply' : 'dry-run'}`);
  console.log(`Backup     : ${options.backupFile}`);
  console.log(`Generated  : ${backup.generatedAt}`);
  console.log(`Target     : ${usingCurrentDatabase ? 'current database' : 'restore/staging database'}`);
  console.log(`Tables     : ${tableOrder.length}`);
  console.log('');
  tableOrder.forEach((table) => {
    const incoming = backup.tables[table]?.rows.length || 0;
    console.log(`- ${table}: target currently ${beforeCounts[table] || 0}, incoming ${incoming}`);
  });

  if (!options.apply) {
    console.log('');
    console.log('Dry-run only. No D1 rows were changed.');
    return;
  }

  if (!options.yes) {
    const ok = await confirm('This will delete and replace rows in the target database. Continue?');
    if (!ok) {
      console.log('Canceled.');
      return;
    }
  }

  await bootstrapTarget(targetDatabaseId);

  const deleteOrder = [...tableOrder].reverse();
  for (const table of deleteOrder) {
    await queryD1ForDatabase(targetDatabaseId, `DELETE FROM ${quoteIdentifier(table)}`);
  }

  for (const table of tableOrder) {
    const tableData = backup.tables[table];
    if (!tableData) continue;

    const columns = tableData.columns;
    if (columns.length === 0 || tableData.rows.length === 0) continue;

    const quotedColumns = columns.map(quoteIdentifier).join(', ');
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${quoteIdentifier(table)} (${quotedColumns}) VALUES (${placeholders})`;

    for (const row of tableData.rows) {
      await queryD1ForDatabase(targetDatabaseId, sql, rowParams(row, columns));
    }
  }

  const afterCounts = await countTargetRows(targetDatabaseId, tableOrder);
  console.log('');
  console.log('Restore apply completed.');
  tableOrder.forEach((table) => {
    console.log(`- ${table}: ${afterCounts[table] || 0} rows`);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
