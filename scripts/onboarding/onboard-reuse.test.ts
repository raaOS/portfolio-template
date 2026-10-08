import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  findArchiveForSlug,
  createArchiveDir,
  resolveProvisionedAdminPassword,
  guardCrossClientSlug,
  pickD1Rows,
  parseEnvText,
} from './onboard-reuse';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onboard-reuse-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeArchive(folderName: string, content: string) {
  const dir = path.join(tmpDir, folderName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.env'), content, 'utf-8');
  return dir;
}

describe('resolveProvisionedAdminPassword (audit MEDIUM M4)', () => {
  const generateFallback = () => 'Porto-generated!';

  it('memakai password eksplisit dan menulis ulang hash (rotasi disengaja)', () => {
    const decision = resolveProvisionedAdminPassword({
      explicitPassword: 'Baru123!',
      adminExists: true,
      archivePassword: 'Lama456!',
      generateFallback,
    });
    expect(decision).toEqual({ effectivePassword: 'Baru123!', seedUser: true });
  });

  it('generate password baru kalau admin belum pernah ada', () => {
    const decision = resolveProvisionedAdminPassword({
      adminExists: false,
      generateFallback,
    });
    expect(decision).toEqual({ effectivePassword: 'Porto-generated!', seedUser: true });
  });

  it('memertahankan password lama saat re-provision (tanpa rotasi diam-diam)', () => {
    const decision = resolveProvisionedAdminPassword({
      adminExists: true,
      archivePassword: 'Lama456!',
      generateFallback,
    });
    expect(decision).toEqual({ effectivePassword: 'Lama456!', seedUser: false });
  });

  it('menolak kalau admin sudah ada tapi arsip tidak ada (password tak terpulihkan)', () => {
    expect(() =>
      resolveProvisionedAdminPassword({
        adminExists: true,
        generateFallback,
      })
    ).toThrow(/sudah pernah dijalankan/);
  });

  it('memperlakukan password eksplisit yang hanya spasi sebagai kosong', () => {
    const decision = resolveProvisionedAdminPassword({
      explicitPassword: '   ',
      adminExists: true,
      archivePassword: 'Lama456!',
      generateFallback,
    });
    expect(decision.seedUser).toBe(false);
  });
});

describe('findArchiveForSlug / createArchiveDir', () => {
  it('mencari arsip dari CUSTOMER_SLUG di config.env', () => {
    writeArchive('01_budi', 'CUSTOMER_SLUG="budi"\nADMIN_PASSWORD="Lama1!"\n');
    const hit = findArchiveForSlug(tmpDir, 'budi');
    expect(hit).not.toBeNull();
    expect(hit?.folderName).toBe('01_budi');
    expect(hit?.env.ADMIN_PASSWORD).toBe('Lama1!');
  });

  it('mengembalikan null kalau slug belum pernah diarsipkan', () => {
    expect(findArchiveForSlug(tmpDir, 'belum-ada')).toBeNull();
  });

  it('arsip ganda (bug lama) diputuskan ke folder bernomor terbesar', () => {
    writeArchive('01_budi', 'CUSTOMER_SLUG="budi"\nADMIN_PASSWORD="Pertama!"\n');
    writeArchive('02_budi', 'CUSTOMER_SLUG="budi"\nADMIN_PASSWORD="Kedua!"\n');
    const hit = findArchiveForSlug(tmpDir, 'budi');
    expect(hit?.folderName).toBe('02_budi');
    expect(hit?.env.ADMIN_PASSWORD).toBe('Kedua!');
  });

  it('createArchiveDir melanjutkan nomor folder berikutnya', () => {
    writeArchive('01_budi', 'CUSTOMER_SLUG="budi"\n');
    writeArchive('02_budi', 'CUSTOMER_SLUG="budi"\n');
    const created = createArchiveDir(tmpDir, 'budi');
    expect(created.folderName).toBe('03_budi');
    expect(fs.existsSync(path.join(created.dirPath))).toBe(true);
  });

  it('createArchiveDir mulai dari 01 kalau arsip kosong', () => {
    const created = createArchiveDir(tmpDir, 'budi');
    expect(created.folderName).toBe('01_budi');
  });
});

describe('guardCrossClientSlug (audit 2026-10-08, temuan #6)', () => {
  it('menolak slug yang sudah jadi arsip akun Cloudflare lain', () => {
    writeArchive('01_budi', 'CUSTOMER_SLUG="budi"\nCLOUDFLARE_ACCOUNT_ID="akun-lama"\n');
    const hit = findArchiveForSlug(tmpDir, 'budi');
    expect(() => guardCrossClientSlug(hit, 'akun-baru')).toThrow(/sudah dipakai klien lain/);
  });

  it('mengizinkan re-provision pada akun Cloudflare yang sama', () => {
    writeArchive('01_budi', 'CUSTOMER_SLUG="budi"\nCLOUDFLARE_ACCOUNT_ID="akun-sama"\n');
    const hit = findArchiveForSlug(tmpDir, 'budi');
    expect(() => guardCrossClientSlug(hit, 'akun-sama')).not.toThrow();
  });

  it('slug baru (tanpa arsip) tidak ditolak', () => {
    expect(() => guardCrossClientSlug(null, 'akun-apapun')).not.toThrow();
  });

  it('arsip tanpa CLOUDFLARE_ACCOUNT_ID dilewatkan (tidak bisa dibandingkan)', () => {
    writeArchive('01_budi', 'CUSTOMER_SLUG="budi"\n');
    const hit = findArchiveForSlug(tmpDir, 'budi');
    expect(() => guardCrossClientSlug(hit, 'akun-baru')).not.toThrow();
  });
});

describe('pickD1Rows', () => {
  it('mengambil results pertama dari envelope query D1', () => {
    const rows = pickD1Rows({ result: [{ results: [{ id: 'user-1' }], success: true }] });
    expect(rows).toEqual([{ id: 'user-1' }]);
  });

  it('aman terhadap envelope kosong / gagal', () => {
    expect(pickD1Rows(null)).toEqual([]);
    expect(pickD1Rows(undefined)).toEqual([]);
    expect(pickD1Rows({})).toEqual([]);
    expect(pickD1Rows({ result: [] })).toEqual([]);
  });
});

describe('parseEnvText', () => {
  it('membaca KEY="value" dan melewati komentar', () => {
    const env = parseEnvText('# header\nADMIN_PASSWORD="Rahasia1!"\nCUSTOMER_SLUG=budi\n');
    expect(env.ADMIN_PASSWORD).toBe('Rahasia1!');
    expect(env.CUSTOMER_SLUG).toBe('budi');
  });

  it('tolak baris tanpa tanda =', () => {
    expect(parseEnvText('baris acak\nKEY="v"\n')).toEqual({ KEY: 'v' });
  });
});
