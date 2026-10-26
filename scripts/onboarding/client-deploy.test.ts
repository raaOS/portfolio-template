/**
 * Test fail-closed env build klien — fokus `STOREFRONT`.
 *
 * Ranjau yang dicegah: kalau `STOREFRONT=true` bocor ke build klien, website
 * klien akan merender halaman jualan (LandingPage) alih-alih portofolio
 * milik klien. `collectOwnerBlankKeys` harus SELALU mereset kunci milik
 * owner yang tidak punya override klien.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildClientEnvPlan,
  clientUrls,
  collectOwnerBlankKeys,
  ensureR2Bucket,
  isSafeCustomerSlug,
  readOwnerEnvKeys,
  renderHandoverNote,
  rewriteNextEnvFile,
  verifySiteLiveness,
  workersDevUrl,
  writeWranglerClientConfig,
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

  it('menaruh token D1 di buildOnly, bukan di overrides runtime', () => {
    const plan = buildClientEnvPlan({
      CUSTOMER_SLUG: 'klien-tiga',
      CLOUDFLARE_ACCOUNT_ID: 'acc',
      CLOUDFLARE_D1_DATABASE_ID: 'db',
      CLOUDFLARE_D1_API_TOKEN: 'tok-d1',
      CLOUDFLARE_R2_BUCKET: 'bucket',
      JWT_SECRET: 'jwt',
      PASSWORD_SALT: 'salt',
    });

    // Prerender `next build` butuh token (REST), Worker klien tidak.
    expect(plan.buildOnly.CLOUDFLARE_D1_API_TOKEN).toBe('tok-d1');
    expect(plan.overrides.CLOUDFLARE_D1_API_TOKEN).toBeUndefined();
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
    expect(note).toContain('PENGELOLA_KLIEN.bat');
    expect(note).toContain('Salin Cadangan');
    expect(note).toContain('GLADI_RESIK_KLIEN_PERDANA.md');
  });
});

describe('writeWranglerClientConfig (binding D1, tanpa token di vars)', () => {
  it('menulis binding env.DB dan tidak menanam token D1 di vars', () => {
    const root = makeOwnerRoot('');

    const configPath = writeWranglerClientConfig({
      rootDir: root,
      slug: 'klien-satu',
      overrides: {
        CLOUDFLARE_D1_DATABASE_ID: 'db-id-123',
        CLOUDFLARE_R2_BUCKET: 'media-klien-satu',
        JWT_SECRET: 'jwt-klien',
      },
      d1DatabaseName: 'portfolio-klien-satu',
    });

    const config = JSON.parse(readFileSync(configPath, 'utf8')) as {
      d1_databases: Array<Record<string, string>>;
      vars: Record<string, string>;
    };

    expect(config.d1_databases).toEqual([
      { binding: 'DB', database_name: 'portfolio-klien-satu', database_id: 'db-id-123' },
    ]);
    expect(config.vars.JWT_SECRET).toBe('jwt-klien');
    expect(config.vars.CLOUDFLARE_D1_API_TOKEN).toBeUndefined();
    expect(config.vars.CLOUDFLARE_API_TOKEN).toBeUndefined();
  });

  it('melempar saat CLOUDFLARE_D1_DATABASE_ID kosong (fail-closed)', () => {
    const root = makeOwnerRoot('');

    expect(() =>
      writeWranglerClientConfig({
        rootDir: root,
        slug: 'klien-tanpa-db',
        overrides: {},
      })
    ).toThrow(/CLOUDFLARE_D1_DATABASE_ID kosong/i);
  });
});

describe('rewriteNextEnvFile (deteksi format untuk fail-closed)', () => {
  it('melaporkan mode yang dikenali dan membuang rahasia owner', () => {
    const root = makeOwnerRoot('');
    const cloudflareDir = path.join(root, '.open-next', 'cloudflare');
    mkdirSync(cloudflareDir, { recursive: true });
    writeFileSync(
      path.join(cloudflareDir, 'next-env.mjs'),
      'export const production = {"JWT_SECRET":"owner","AI_API_KEY":"rahasia","NEXT_PUBLIC_PRODUCT_NAME":"Porto"};\n',
      'utf8'
    );

    const result = rewriteNextEnvFile(path.join(root, '.open-next'), {
      JWT_SECRET: 'jwt-klien',
    });

    expect(result.modes).toEqual(['production']);
    expect(result.dropped).toContain('AI_API_KEY');
    const written = readFileSync(path.join(cloudflareDir, 'next-env.mjs'), 'utf8');
    expect(written).toContain('"JWT_SECRET":"jwt-klien"');
    expect(written).toContain('"NEXT_PUBLIC_PRODUCT_NAME":"Porto"');
    expect(written).not.toContain('AI_API_KEY');
  });
});

describe('verifySiteLiveness (hanya 200 + status ok yang dianggap hidup)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('menerima health 200 dengan status ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ status: 'ok' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await verifySiteLiveness('https://klien.example', () => {}, {
      attempts: 1,
      backoffMs: 0,
    });

    expect(result.alive).toBe(true);
    expect(result.detail).toContain('status ok');
  });

  it('menolak health 503 dan halaman utama 500', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ status: 503, ok: false, json: async () => ({ status: 'degraded' }) })
      .mockResolvedValueOnce({ status: 500, ok: false, json: async () => null });
    vi.stubGlobal('fetch', fetchMock);

    const result = await verifySiteLiveness('https://klien.example', () => {}, {
      attempts: 1,
      backoffMs: 0,
    });

    expect(result.alive).toBe(false);
    expect(result.detail).toContain('HTTP 500');
  });

  it('jatuh ke halaman utama saat health 404', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ status: 404, ok: false, json: async () => null })
      .mockResolvedValueOnce({ status: 200, ok: true, json: async () => null });
    vi.stubGlobal('fetch', fetchMock);

    const result = await verifySiteLiveness('https://klien.example', () => {}, {
      attempts: 1,
      backoffMs: 0,
    });

    expect(result.alive).toBe(true);
    expect(result.url).toBe('https://klien.example');
  });

  it('jatuh ke workers.dev saat custom domain belum menyebar (K1)', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (String(url).includes('klien.workers.dev')) {
        return Promise.resolve({ status: 200, ok: true, json: async () => ({ status: 'ok' }) });
      }
      return Promise.reject(new Error('getaddrinfo ENOTFOUND'));
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await verifySiteLiveness('https://domain-belum-siap.example', () => {}, {
      attempts: 1,
      backoffMs: 0,
      fallbackUrls: ['https://klien.workers.dev'],
    });

    expect(result.alive).toBe(true);
    expect(result.viaFallback).toBe(true);
    expect(result.url).toContain('klien.workers.dev');
    expect(result.detail).toContain('via klien.workers.dev');
  });

  it('tidak menandai viaFallback saat alamat utama yang menjawab', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 200, ok: true, json: async () => ({ status: 'ok' }) })
    );

    const result = await verifySiteLiveness('https://klien.example', () => {}, {
      attempts: 1,
      backoffMs: 0,
      fallbackUrls: ['https://klien.workers.dev'],
    });

    expect(result.alive).toBe(true);
    expect(result.viaFallback).toBe(false);
  });

  it('tetap gagal bila alamat utama dan cadangan sama-sama mati', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const result = await verifySiteLiveness('https://klien.example', () => {}, {
      attempts: 1,
      backoffMs: 0,
      fallbackUrls: ['https://klien.workers.dev'],
    });

    expect(result.alive).toBe(false);
    expect(result.viaFallback).toBe(false);
  });
});

describe('isSafeCustomerSlug (R4: slug jadi nama berkas & Worker)', () => {
  it('menerima slug normal', () => {
    expect(isSafeCustomerSlug('gladi-2026-10-24')).toBe(true);
    expect(isSafeCustomerSlug('uji-domain')).toBe(true);
  });

  it('menolak traversal, spasi, dan path', () => {
    expect(isSafeCustomerSlug('../owner')).toBe(false);
    expect(isSafeCustomerSlug('a/b')).toBe(false);
    expect(isSafeCustomerSlug('slug dengan spasi')).toBe(false);
    expect(isSafeCustomerSlug('')).toBe(false);
    expect(isSafeCustomerSlug(undefined)).toBe(false);
  });
});

describe('ensureR2Bucket (fail-closed sebelum build)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lolos saat bucket ada', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ success: true, result: { name: 'media-klien' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await ensureR2Bucket('acc', 'tok', 'media-klien');

    expect(result.ok).toBe(true);
    expect(result.detail).toContain('ada');
  });

  it('memberi pesan actionable saat R2 belum diaktifkan (10042)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 400,
      ok: false,
      json: async () => ({
        success: false,
        errors: [{ code: 10042, message: 'Please enable R2 through the Cloudflare Dashboard.' }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await ensureR2Bucket('acc', 'tok', 'media-klien');

    expect(result.ok).toBe(false);
    expect(result.detail).toContain('R2 belum diaktifkan');
  });

  it('menolak bucket yang hilang, bukan lanjut build', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 404,
      ok: false,
      json: async () => ({ success: false, errors: [{ code: 10006, message: 'Not found' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await ensureR2Bucket('acc', 'tok', 'media-klien');

    expect(result.ok).toBe(false);
    expect(result.detail).toContain('tidak ditemukan');
  });

  it('create=true tetap lolos kalau bucket ternyata sudah ada', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        status: 400,
        ok: false,
        json: async () => ({ success: false, errors: [{ code: 10004, message: 'exists' }] }),
      })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({ success: true, result: { name: 'media-klien' } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await ensureR2Bucket('acc', 'tok', 'media-klien', { create: true });

    expect(result.ok).toBe(true);
    expect(result.detail).toContain('sudah tersedia');
  });
});

describe('workersDevUrl (cadangan health-check Status Board)', () => {
  it('mengembalikan alamat workers.dev walau WEBSITE_URL memakai custom domain', () => {
    const env = {
      CUSTOMER_SLUG: 'gladi-2026-10-24',
      WORKERS_SUBDOMAIN: 'anaak-setaan',
      WEBSITE_URL: 'https://makeitbatter.my.id',
    };

    expect(workersDevUrl(env)).toBe('https://gladi-2026-10-24.anaak-setaan.workers.dev');
    expect(clientUrls(env)).toEqual({
      websiteUrl: 'https://makeitbatter.my.id',
      adminUrl: 'https://makeitbatter.my.id/admin',
    });
  });

  it('jatuh ke slug tanpa subdomain dan kosong bila slug tidak ada', () => {
    expect(workersDevUrl({ CUSTOMER_SLUG: 'andi' })).toBe('https://andi.workers.dev');
    expect(workersDevUrl({}, 'andi')).toBe('https://andi.workers.dev');
    expect(workersDevUrl({})).toBe('');
  });
});
