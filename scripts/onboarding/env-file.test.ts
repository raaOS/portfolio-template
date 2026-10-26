import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseEnv, readEnvFile, upsertEnvFile } from './env-file';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-env-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('parseEnv', () => {
  it('parses quoted values and ignores comments', () => {
    const parsed = parseEnv(
      '# komentar\nCUSTOMER_NAME="Klien Uji"\nADMIN_EMAIL=budi@example.com\n'
    );
    expect(parsed.CUSTOMER_NAME).toBe('Klien Uji');
    expect(parsed.ADMIN_EMAIL).toBe('budi@example.com');
  });
});

describe('upsertEnvFile', () => {
  it('adds keys without deleting existing content', () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, '.env.local');
    fs.writeFileSync(filePath, 'OWNER_KEY=sudah-ada\n', 'utf8');

    upsertEnvFile(filePath, {
      PORTAL_VAULT_HASH: 'abc123',
      PORTAL_VAULT_SALT: 'salt456',
    });

    const env = readEnvFile(filePath);
    expect(env.OWNER_KEY).toBe('sudah-ada');
    expect(env.PORTAL_VAULT_HASH).toBe('abc123');
    expect(env.PORTAL_VAULT_SALT).toBe('salt456');
  });

  it('replaces an existing key only once and preserves CRLF', () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, '.env.local');
    fs.writeFileSync(filePath, 'PORTAL_VAULT_HASH=lama\r\nOWNER_KEY=ada\r\n', 'utf8');

    upsertEnvFile(filePath, { PORTAL_VAULT_HASH: 'baru' });

    const raw = fs.readFileSync(filePath, 'utf8');
    expect(raw).toContain('PORTAL_VAULT_HASH=baru');
    expect(raw).not.toContain('PORTAL_VAULT_HASH=lama');
    expect(raw).toContain('OWNER_KEY=ada');
    expect(raw).toContain('\r\n');
  });
});
