import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assessDeployability,
  isSafeArchiveFolderName,
  listClientSummaries,
  maskIdentifier,
  partitionDeployTargets,
  readClientDetail,
  readClientSecrets,
  readProjectVersions,
  resolveArchiveConfigPath,
} from './portal-clients';

const tempDirs: string[] = [];

function makeArchive(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-clients-'));
  tempDirs.push(dir);
  return dir;
}

function writeClientConfig(archiveDir: string, folderName: string): void {
  const folder = path.join(archiveDir, folderName);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(
    path.join(folder, 'config.env'),
    [
      'CUSTOMER_NAME="Klien Uji"',
      'CUSTOMER_SLUG=klien-uji',
      'CUSTOMER_SITE_ID=klien-uji',
      'ACTIVE_TEMPLATE_KEY=os-desktop',
      'CLOUDFLARE_ACCOUNT_ID=abcdef1234567890abcdef1234567890',
      'CLOUDFLARE_D1_DATABASE_NAME=db-klien-uji',
      'CLOUDFLARE_D1_DATABASE_ID=11111111-2222-3333-4444-555555555555',
      'CLOUDFLARE_R2_BUCKET_NAME=media-klien-uji',
      'CLOUDFLARE_KV_INC_NAMESPACE_ID=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'CLOUDFLARE_KV_TAG_NAMESPACE_ID=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      'CLOUDFLARE_API_TOKEN=SECRET_CF_API_TOKEN',
      'CLOUDFLARE_D1_API_TOKEN=SECRET_D1_API_TOKEN',
      'JWT_SECRET=SECRET_JWT_VALUE',
      'PASSWORD_SALT=SECRET_PASSWORD_SALT',
      'CRON_SECRET=SECRET_CRON_VALUE',
      'ADMIN_EMAIL=admin@example.com',
      'ADMIN_PASSWORD=SECRET_ADMIN_PASSWORD',
      'WEBSITE_URL=https://klien-uji.workers.dev',
      'ADMIN_URL=https://klien-uji.workers.dev/admin',
      'WORKERS_SUBDOMAIN=anaak-setaan',
      '',
    ].join('\n'),
    'utf8'
  );
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('isSafeArchiveFolderName', () => {
  it('accepts normal archive folder names', () => {
    expect(isSafeArchiveFolderName('01_gladi-2026-10-24')).toBe(true);
    expect(isSafeArchiveFolderName('02 klien baru')).toBe(true);
  });

  it('rejects traversal and absolute paths', () => {
    expect(isSafeArchiveFolderName('..')).toBe(false);
    expect(isSafeArchiveFolderName('../luar')).toBe(false);
    expect(isSafeArchiveFolderName('folder\\luar')).toBe(false);
    expect(isSafeArchiveFolderName('C:\\Windows')).toBe(false);
    expect(isSafeArchiveFolderName('')).toBe(false);
  });

  it('resolves only config.env inside archive-klien', () => {
    const archiveDir = makeArchive();
    writeClientConfig(archiveDir, '01_klien-uji');

    expect(resolveArchiveConfigPath(archiveDir, '01_klien-uji')).toBe(
      path.join(archiveDir, '01_klien-uji', 'config.env')
    );
    expect(resolveArchiveConfigPath(archiveDir, '../01_klien-uji')).toBeNull();
    expect(resolveArchiveConfigPath(archiveDir, 'tidak-ada')).toBeNull();
  });
});

describe('client summaries', () => {
  it('never includes adminPassword in /api/clients data', () => {
    const archiveDir = makeArchive();
    writeClientConfig(archiveDir, '01_klien-uji');

    const summaries = listClientSummaries(archiveDir);
    const serialized = JSON.stringify(summaries);

    expect(summaries).toHaveLength(1);
    expect(summaries[0].clientName).toBe('Klien Uji');
    expect(summaries[0].adminEmail).toBe('admin@example.com');
    expect(serialized).not.toContain('adminPassword');
    expect(serialized).not.toContain('SECRET_ADMIN_PASSWORD');
    expect(serialized).not.toContain('SECRET_CF_API_TOKEN');
  });
});

describe('client detail', () => {
  it('returns infrastructure with identifiers masked and no raw secrets', () => {
    const archiveDir = makeArchive();
    writeClientConfig(archiveDir, '01_klien-uji');

    const detail = readClientDetail(archiveDir, '01_klien-uji');
    const serialized = JSON.stringify(detail);

    expect(detail).not.toBeNull();
    expect(detail?.infra.accountIdMasked).toBe('abcdef…7890');
    expect(detail?.infra.d1DatabaseIdMasked).toBe('111111…5555');
    expect(detail?.credentialStatus).toEqual({
      adminPassword: true,
      cloudflareApiToken: true,
      cloudflareD1ApiToken: true,
    });
    expect(serialized).not.toContain('SECRET_ADMIN_PASSWORD');
    expect(serialized).not.toContain('SECRET_CF_API_TOKEN');
    expect(serialized).not.toContain('SECRET_D1_API_TOKEN');
    expect(serialized).not.toContain('abcdef1234567890abcdef1234567890');
  });

  it('returns null for a missing archive', () => {
    const archiveDir = makeArchive();
    expect(readClientDetail(archiveDir, 'tidak-ada')).toBeNull();
  });
});

describe('client secrets', () => {
  it('returns only allowlisted credential fields', () => {
    const archiveDir = makeArchive();
    writeClientConfig(archiveDir, '01_klien-uji');

    const secrets = readClientSecrets(archiveDir, '01_klien-uji');
    const serialized = JSON.stringify(secrets);

    expect(secrets?.adminPassword).toBe('SECRET_ADMIN_PASSWORD');
    expect(secrets?.cloudflareApiToken).toBe('SECRET_CF_API_TOKEN');
    expect(secrets?.cloudflareD1ApiToken).toBe('SECRET_D1_API_TOKEN');
    expect(secrets?.accountId).toBe('abcdef1234567890abcdef1234567890');
    expect(serialized).not.toContain('SECRET_JWT_VALUE');
    expect(serialized).not.toContain('SECRET_PASSWORD_SALT');
    expect(serialized).not.toContain('SECRET_CRON_VALUE');
    expect(Object.keys(secrets || {})).not.toContain('jwtSecret');
    expect(Object.keys(secrets || {})).not.toContain('passwordSalt');
    expect(Object.keys(secrets || {})).not.toContain('cronSecret');
  });
});

describe('maskIdentifier', () => {
  it('shows only a short prefix and suffix', () => {
    expect(maskIdentifier('abcdef1234567890abcdef1234567890')).toBe('abcdef…7890');
    expect(maskIdentifier('pendek')).toBe('••••');
    expect(maskIdentifier('')).toBe('');
  });
});

describe('assessDeployability (sumber: buildClientEnvPlan)', () => {
  const complete = {
    CUSTOMER_SLUG: 'klien-uji',
    CLOUDFLARE_ACCOUNT_ID: 'acc',
    CLOUDFLARE_API_TOKEN: 'tok',
    CLOUDFLARE_D1_DATABASE_ID: 'db',
    CLOUDFLARE_D1_API_TOKEN: 'dbtok',
    CLOUDFLARE_R2_BUCKET: 'media',
    JWT_SECRET: 'jwt',
    PASSWORD_SALT: 'salt',
  };

  it('menandai konfigurasi lengkap sebagai deployable', () => {
    const result = assessDeployability(complete);
    expect(result.deployable).toBe(true);
    expect(result.missingKeys).toEqual([]);
  });

  it('menyebut kunci yang kurang dan tidak menawarkan deploy', () => {
    const result = assessDeployability({ ...complete, CLOUDFLARE_API_TOKEN: '', JWT_SECRET: '' });
    expect(result.deployable).toBe(false);
    expect(result.missingKeys).toContain('CLOUDFLARE_API_TOKEN');
    expect(result.missingKeys).toContain('JWT_SECRET');
  });

  it('arsip site owner tanpa kredensial Cloudflare tidak deployable', () => {
    const result = assessDeployability({ CUSTOMER_NAME: 'Site Owner' });
    expect(result.deployable).toBe(false);
    expect(result.missingKeys).toContain('CLOUDFLARE_ACCOUNT_ID');
  });
});

describe('client summaries: status deploy', () => {
  it('menyertakan deployable=true untuk konfigurasi lengkap', () => {
    const archiveDir = makeArchive();
    writeClientConfig(archiveDir, '01_klien-uji');

    const [client] = listClientSummaries(archiveDir);
    expect(client.deployable).toBe(true);
    expect(client.missingKeys).toEqual([]);
  });

  it('menyertakan deployable=false + alasan untuk arsip tanpa kredensial', () => {
    const archiveDir = makeArchive();
    const folder = path.join(archiveDir, '00_site-owner');
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(
      path.join(folder, 'config.env'),
      'CUSTOMER_NAME="Site Owner"\nCUSTOMER_SLUG=site-owner\n',
      'utf8'
    );

    const [client] = listClientSummaries(archiveDir);
    expect(client.deployable).toBe(false);
    expect(client.missingKeys).toContain('CLOUDFLARE_ACCOUNT_ID');
  });
});

describe('partitionDeployTargets (daftar folder eksplisit)', () => {
  const base = {
    adminEmail: '',
    websiteUrl: '',
    adminUrl: '',
    customDomain: '',
    templateKey: 'os-desktop',
  };

  it('memisahkan siap deploy dari yang dilewati', () => {
    const summaries = [
      { ...base, id: '01_siap', clientName: 'Siap', clientSlug: 'siap', deployable: true, missingKeys: [] },
      {
        ...base,
        id: '00_owner',
        clientName: 'Owner',
        clientSlug: 'owner',
        deployable: false,
        missingKeys: ['CLOUDFLARE_API_TOKEN'],
      },
    ];

    const result = partitionDeployTargets(summaries, ['01_siap', '00_owner']);

    expect(result.deployable.map((c) => c.id)).toEqual(['01_siap']);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].id).toBe('00_owner');
    expect(result.skipped[0].reason).toContain('CLOUDFLARE_API_TOKEN');
  });

  it('folder tak dikenal masuk skipped, bukan gagal deploy', () => {
    const result = partitionDeployTargets([], ['99_hilang']);
    expect(result.deployable).toEqual([]);
    expect(result.skipped[0].reason).toContain('tidak ditemukan');
  });

  it('mengabaikan duplikat dan entri tidak valid', () => {
    const summaries = [
      { ...base, id: '01_siap', clientName: 'Siap', clientSlug: 'siap', deployable: true, missingKeys: [] },
    ];
    const result = partitionDeployTargets(summaries, ['01_siap', '01_siap', '', '   ']);
    expect(result.deployable).toHaveLength(1);
    expect(result.skipped).toEqual([]);
  });
});

describe('readProjectVersions (acuan versi = kode, bukan CHANGELOG)', () => {
  it('memakai APP_VERSION dan melaporkan selisih catatan', () => {
    const root = makeArchive();
    fs.mkdirSync(path.join(root, 'src', 'lib'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'src', 'lib', 'constants.ts'),
      "export const APP_VERSION = '1.3.73';\n",
      'utf8'
    );
    fs.writeFileSync(
      path.join(root, 'CHANGELOG.md'),
      '## [1.3.71] - 2026-10-24\n\n- catatan lama\n',
      'utf8'
    );

    const versions = readProjectVersions(root);
    expect(versions.appVersion).toBe('1.3.73');
    expect(versions.changelogVersion).toBe('1.3.71');
    expect(versions.latestVersion).toBe('1.3.73');
  });

  it('jatuh ke CHANGELOG bila APP_VERSION tidak terbaca', () => {
    const root = makeArchive();
    fs.writeFileSync(path.join(root, 'CHANGELOG.md'), '## [1.3.71] - 2026-10-24\n', 'utf8');

    const versions = readProjectVersions(root);
    expect(versions.appVersion).toBeNull();
    expect(versions.latestVersion).toBe('1.3.71');
  });

  it('mengembalikan null semua bila tidak ada berkas versi', () => {
    const root = makeArchive();
    const versions = readProjectVersions(root);
    expect(versions).toEqual({ appVersion: null, changelogVersion: null, latestVersion: null });
  });
});
