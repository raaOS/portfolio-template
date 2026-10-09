import { afterEach, describe, expect, it, vi } from 'vitest';
import { isOwnerMode, requireOwnerMode } from './ownerMode';

describe('ownerMode', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('isOwnerMode true hanya saat OWNER_MODE=true', () => {
    vi.stubEnv('OWNER_MODE', 'true');
    expect(isOwnerMode()).toBe(true);
  });

  it('isOwnerMode false untuk nilai lain / tidak diset (fail-closed)', () => {
    vi.stubEnv('OWNER_MODE', 'false');
    expect(isOwnerMode()).toBe(false);

    vi.stubEnv('OWNER_MODE', '');
    expect(isOwnerMode()).toBe(false);

    vi.stubEnv('OWNER_MODE', 'TRUE');
    expect(isOwnerMode()).toBe(false);

    delete (process.env as Record<string, string | undefined>).OWNER_MODE;
    expect(isOwnerMode()).toBe(false);
  });

  it('requireOwnerMode lolos saat owner mode aktif', () => {
    vi.stubEnv('OWNER_MODE', 'true');
    expect(requireOwnerMode()).toBeNull();
  });

  it('requireOwnerMode balas 404 (bukan 403) saat owner mode mati', () => {
    vi.stubEnv('OWNER_MODE', 'false');
    const res = requireOwnerMode();
    expect(res?.status).toBe(404);
    expect(res?.headers.get('content-type')).toContain('application/json');
  });
});
