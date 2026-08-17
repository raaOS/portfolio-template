/**
 * Bootstrap D1 — Inisialisasi skema tabel Cloudflare D1.
 *
 * Membaca konfigurasi dari `.env.local` lalu menjalankan migrasi skema
 * dasar (CREATE TABLE IF NOT EXISTS) pada database D1.
 *
 * @module scripts/cloudflare/bootstrap-d1
 */
import * as dotenv from 'dotenv';
import path from 'path';
import { bootstrapD1Schema, getMissingD1EnvKeys, isD1Configured } from '../../src/lib/cloudflareD1';
import { requireProductCloudflareEnvConfirmed } from './product-env';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  requireProductCloudflareEnvConfirmed('apply D1 schema');

  if (!isD1Configured()) {
    throw new Error(
      `Cloudflare D1 env is incomplete. Missing: ${getMissingD1EnvKeys().join(', ')}`
    );
  }

  await bootstrapD1Schema();
  console.log('Cloudflare D1 schema is ready.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
