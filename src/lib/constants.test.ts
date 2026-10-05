import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { APP_VERSION, DEFAULT_SITE_URL, getPublicBaseUrl } from './constants';

// Guard terhadap bug audit 2026-10-06: build produksi pernah meng-inline
// NEXT_PUBLIC_APP_URL=localhost dari .env.local sehingga semua email order
// (struk, aktivasi, expired, cancel) menautkan pembeli ke link mati.
describe('getPublicBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('memakai NEXT_PUBLIC_APP_URL bila bukan loopback', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://klien.example.com');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', DEFAULT_SITE_URL);
    expect(getPublicBaseUrl()).toBe('https://klien.example.com');
  });

  it('mengabaikan localhost APP_URL di produksi dan jatuh ke SITE_URL', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', DEFAULT_SITE_URL);
    expect(getPublicBaseUrl()).toBe(DEFAULT_SITE_URL);
  });

  it('jatuh ke DEFAULT_SITE_URL bila semua kandidat loopback/kosong', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://127.0.0.1:3000');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    expect(getPublicBaseUrl()).toBe(DEFAULT_SITE_URL);
  });

  it('memakai localhost apa adanya saat development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
    expect(getPublicBaseUrl()).toBe('http://localhost:3000');
  });

  it('memotong trailing slash agar tidak ada ganda // di link email', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://contoh.example/');
    expect(getPublicBaseUrl()).toBe('https://contoh.example');
  });
});

describe('APP_VERSION', () => {
  it('sama dengan entri teratas CHANGELOG.md (dipakai /api/health → portal status board)', () => {
    const changelog = fs.readFileSync(path.join(process.cwd(), 'CHANGELOG.md'), 'utf8');
    const match = changelog.match(/^##\s*\[([^\]]+)\]/m);
    expect(match).not.toBeNull();
    expect(APP_VERSION).toBe(match![1]);
  });
});
