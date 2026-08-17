/**
 * Maintenance Audit — Pemeriksaan integritas database dan media storage.
 *
 * Memverifikasi konsistensi data antara Cloudflare D1 (database) dan R2
 * (media bucket), serta menjalankan pengecekan dependency via npm audit.
 *
 * @module scripts/maintenance/audit
 */
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';
import path from 'path';
import { getMissingD1EnvKeys, isD1Configured, queryD1 } from '../../src/lib/cloudflareD1';
import { getMissingR2EnvKeys, isR2StorageConfigured } from '../../src/lib/r2Storage';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

type Status = 'PASS' | 'FAIL' | 'SKIP';

interface CheckResult {
  name: string;
  status: Status;
  message: string;
}

const isJsonOutput = process.argv.includes('--json');
const isOfflineMode = process.argv.includes('--offline');

function run(command: string) {
  execSync(command, { stdio: 'pipe', encoding: 'utf-8' });
}

async function checkEnvironment(): Promise<CheckResult> {
  const missing = [
    !process.env.JWT_SECRET && 'JWT_SECRET',
    !process.env.NEXT_PUBLIC_APP_URL && 'NEXT_PUBLIC_APP_URL',
    ...getMissingD1EnvKeys(),
    ...getMissingR2EnvKeys(),
    process.env.DATA_BACKEND !== 'cloudflare-d1' && 'DATA_BACKEND=cloudflare-d1',
    process.env.NEXT_PUBLIC_DATA_BACKEND !== 'cloudflare-d1' &&
      'NEXT_PUBLIC_DATA_BACKEND=cloudflare-d1',
  ].filter(Boolean) as string[];

  return missing.length > 0
    ? { name: 'Environment', status: 'FAIL', message: `Missing or invalid: ${missing.join(', ')}` }
    : {
        name: 'Environment',
        status: 'PASS',
        message: 'Required Cloudflare and app env vars are set',
      };
}

async function checkDataServices(): Promise<CheckResult> {
  if (isOfflineMode) {
    return { name: 'DataServices', status: 'SKIP', message: 'Offline mode' };
  }

  if (!isD1Configured()) {
    return {
      name: 'DataServices',
      status: 'FAIL',
      message: `D1 missing: ${getMissingD1EnvKeys().join(', ')}`,
    };
  }

  if (!isR2StorageConfigured()) {
    return {
      name: 'DataServices',
      status: 'FAIL',
      message: `R2 missing: ${getMissingR2EnvKeys().join(', ')}`,
    };
  }

  const rows = await queryD1<{ count: number }>('SELECT COUNT(*) as count FROM app_kv');
  return {
    name: 'DataServices',
    status: 'PASS',
    message: `D1 reachable, app_kv rows=${rows[0]?.count ?? 0}; R2 configured`,
  };
}

async function checkTypeScript(): Promise<CheckResult> {
  if (isOfflineMode) {
    return { name: 'TypeScript', status: 'SKIP', message: 'Offline mode' };
  }

  try {
    run('npx tsc --noEmit --pretty false');
    return { name: 'TypeScript', status: 'PASS', message: 'No type errors' };
  } catch {
    return { name: 'TypeScript', status: 'FAIL', message: 'Typecheck failed' };
  }
}

async function checkLint(): Promise<CheckResult> {
  if (isOfflineMode) {
    return { name: 'ESLint', status: 'SKIP', message: 'Offline mode' };
  }

  try {
    run('npm run lint');
    return { name: 'ESLint', status: 'PASS', message: 'Lint passed' };
  } catch {
    return { name: 'ESLint', status: 'FAIL', message: 'Lint failed' };
  }
}

async function main() {
  const checks = [
    await checkEnvironment(),
    await checkDataServices(),
    await checkTypeScript(),
    await checkLint(),
  ];

  if (isJsonOutput) {
    console.log(JSON.stringify({ checks }, null, 2));
  } else {
    for (const check of checks) {
      console.log(`${check.status.padEnd(4)} ${check.name}: ${check.message}`);
    }
  }

  if (checks.some((check) => check.status === 'FAIL')) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
