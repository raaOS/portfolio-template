/**
 * Test fail-closed env build klien — fokus `STOREFRONT`.
 *
 * Ranjau yang dicegah: kalau `STOREFRONT=true` bocor ke build klien, website
 * klien akan merender halaman jualan (LandingPage) alih-alih portofolio
 * milik klien. `collectOwnerBlankKeys` harus SELALU mereset kunci milik
 * owner yang tidak punya override klien.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildClientEnvPlan,
  collectOwnerBlankKeys,
  readOwnerEnvKeys,
  renderHandoverNote,
} from './client-deploy';

let tempDirs: string[] = [];

function makeOwnerRoot(envLocal: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'client-deploy-test-'));
  tempDirs.push(dir);
  writeFileSync(path.join(dir, '.env.local'), envLocal, 'utf8');
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs = [];
});

describe('collectOwnerBlankKeys (STOREFRONT fail-closed)', () => {
  it('blanks STOREFRONT from owner .env.local for client builds', () => {
    const root = makeOwnerRoot('STOREFRONT=true\nCUSTOMER_SITE_ID=klien-slug\n');

    const blanks = collectOwnerBlankKeys(root, {});

    expect(blanks).toContain('STOREFRONT');
    expect(readOwnerEnvKeys(root)).toContain('STOREFRONT');
  });

  it('keeps STOREFRONT blank even when client overrides other keys', () => {
    const root = makeOwnerRoot('STOREFRONT=true\nNEXT_PUBLIC_SITE_URL=https://toko.example\n');

    const blanks = collectOwnerBlankKeys(root, {
      NEXT_PUBLIC_SITE_URL: 'https://klien.example',
    });

    expect(blanks).toContain('STOREFRONT');
    expect(blanks).not.toContain('NEXT_PUBLIC_SITE_URL');
  });

  it('does not blank owner keys that are explicitly inherited or never-blank', () => {
    const root = makeOwnerRoot(
      'STOREFRONT=true\nNEXT_PUBLIC_PRODUCT_NAME=Porto\nNODE_ENV=production\n'
    );

    const blanks = collectOwnerBlankKeys(root, {});

    expect(blanks).toContain('STOREFRONT');
    expect(blanks).not.toContain('NEXT_PUBLIC_PRODUCT_NAME');
    expect(blanks).not.toContain('NODE_ENV');
  });
});

describe('buildClientEnvPlan (Owner Mode fail-closed)', () => {
  it('memaksa OWNER_MODE & NEXT_PUBLIC_OWNER_MODE=false meski config.env klien berisi true', () => {
    const plan = buildClientEnvPlan({
      CUSTOMER_SLUG: 'klien-satu',
      CLOUDFLARE_ACCOUNT_ID: 'acc',
      CLOUDFLARE_API_TOKEN: 'acctok',
      CLOUDFLARE_D1_DATABASE_ID: 'db',
      CLOUDFLARE_D1_API_TOKEN: 'tok',
      CLOUDFLARE_R2_BUCKET: 'bucket',
      JWT_SECRET: 'jwt',
      PASSWORD_SALT: 'salt',
      // Skenario salah-konfigurasi: klien "minta" jadi owner.
      OWNER_MODE: 'true',
      NEXT_PUBLIC_OWNER_MODE: 'true',
    });

    expect(plan.overrides.OWNER_MODE).toBe('false');
    expect(plan.overrides.NEXT_PUBLIC_OWNER_MODE).toBe('false');
    expect(plan.missing).toEqual([]);
  });

  it('OWNER_MODE ikut false tanpa disebut di config.env sama sekali', () => {
    const plan = buildClientEnvPlan({
      CUSTOMER_SLUG: 'klien-dua',
      CLOUDFLARE_ACCOUNT_ID: 'acc',
      CLOUDFLARE_D1_DATABASE_ID: 'db',
      CLOUDFLARE_D1_API_TOKEN: 'tok',
      CLOUDFLARE_R2_BUCKET: 'bucket',
      JWT_SECRET: 'jwt',
      PASSWORD_SALT: 'salt',
    });

    expect(plan.overrides.OWNER_MODE).toBe('false');
    expect(plan.overrides.NEXT_PUBLIC_OWNER_MODE).toBe('false');
  });
});

describe('readOwnerEnvKeys', () => {
  it('reads keys from every .env* file and skips comments', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'client-deploy-test-'));
    tempDirs.push(dir);
    writeFileSync(path.join(dir, '.env.local'), 'ALPHA=1\n# BETA=2\nBETA=3\n', 'utf8');
    writeFileSync(path.join(dir, '.env'), 'GAMMA=4\n', 'utf8');

    const keys = readOwnerEnvKeys(dir);

    expect(keys).toContain('ALPHA');
    expect(keys).toContain('BETA');
    expect(keys).toContain('GAMMA');
  });
});

describe('renderHandoverNote (CATATAN_SERAH_TERIMA.md)', () => {
  const baseInput = {
    clientName: 'Budi Santoso',
    slug: 'budi-site',
    websiteUrl: 'https://budi-site.workers.dev',
    adminUrl: 'https://budi-site.workers.dev/admin/login',
    configPath: 'arsip-klien/budi-site/config.env',
    buildCode: 0,
    deployCode: 0,
    deployNotes: ['Secret klien dibuat & disimpan: JWT_SECRET'],
    generatedAt: new Date('2026-10-08T00:00:00.000Z'),
  };

  it('render identitas, URL, dan penunjuk kredensial tanpa membocorkan secret', () => {
    const note = renderHandoverNote(baseInput);

    expect(note).toContain('# Catatan Serah Terima — Budi Santoso (budi-site)');
    expect(note).toContain('https://budi-site.workers.dev');
    expect(note).toContain('https://budi-site.workers.dev/admin/login');
    expect(note).toContain('arsip-klien/budi-site/config.env');
    expect(note).toContain('2026-10-08T00:00:00.000Z');
    // Catatan hanya MENUNJUK kunci, tidak pernah menulis nilai password.
    expect(note).not.toContain('ADMIN_PASSWORD=');
    expect(note).toContain('ADMIN_PASSWORD');
  });

  it('melaporkan kode build/deploy gagal secara jujur', () => {
    const note = renderHandoverNote({ ...baseInput, deployCode: 7 });

    expect(note).toContain('Build: sukses');
    expect(note).toContain('Deploy: GAGAL (kode 7)');
  });

  it('memuat catatan teknis deploy, checklist, dan jalur pemulihan password', () => {
    const note = renderHandoverNote(baseInput);

    expect(note).toContain('Secret klien dibuat');
    expect(note).toContain('Checklist serah terima');
    expect(note).toContain('reset-customer-password.ts');
    expect(note).toContain('SALIN_CADANGAN.bat');
    expect(note).toContain('GLADI_RESIK_KLIEN_PERDANA.md');
  });
});
