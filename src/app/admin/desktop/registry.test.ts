import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminZone } from './types';

/**
 * Logika filter Owner Mode di registry desktop admin:
 * - deployment owner (NEXT_PUBLIC_OWNER_MODE=true) melihat semua app;
 * - site klien menyaring app `ownerOnly` (Harga Jual, Order & Pembayaran)
 *   keluar dari ADMIN_ZONES, dan zone yang kehabisan app ikut hilang.
 *
 * Registry membaca env saat module init → pakai resetModules + import dinamis.
 */
async function loadZones(): Promise<AdminZone[]> {
  vi.resetModules();
  const mod = await import('./registry');
  return mod.ADMIN_ZONES;
}

function findApp(zones: AdminZone[], appId: string) {
  for (const zone of zones) {
    const app = zone.apps.find((a) => a.id === appId);
    if (app) return app;
  }
  return undefined;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('ADMIN_ZONES owner filter', () => {
  it('deployment owner melihat app ownerOnly (harga & orders)', async () => {
    vi.stubEnv('NEXT_PUBLIC_OWNER_MODE', 'true');
    const zones = await loadZones();

    expect(findApp(zones, 'harga')).toBeDefined();
    expect(findApp(zones, 'orders')).toBeDefined();
  });

  it('site klien menyaring app ownerOnly keluar (fail-closed: env tidak diset pun tersembunyi)', async () => {
    vi.stubEnv('NEXT_PUBLIC_OWNER_MODE', 'false');
    const zones = await loadZones();

    expect(findApp(zones, 'harga')).toBeUndefined();
    expect(findApp(zones, 'orders')).toBeUndefined();
    // app klien lain di zona yang sama tetap ada
    expect(findApp(zones, 'analytics')).toBeDefined();
    expect(findApp(zones, 'projects')).toBeDefined();
  });

  it('OWNER_MODE tidak diset = dianggap site klien (app ownerOnly hilang)', async () => {
    delete (process.env as Record<string, string | undefined>).NEXT_PUBLIC_OWNER_MODE;
    const zones = await loadZones();

    expect(findApp(zones, 'harga')).toBeUndefined();
    expect(findApp(zones, 'orders')).toBeUndefined();
  });

  it('zona system tidak ikut hilang untuk klien (masih berisi app klien lain)', async () => {
    vi.stubEnv('NEXT_PUBLIC_OWNER_MODE', 'false');
    const zones = await loadZones();

    const system = zones.find((z) => z.id === 'system');
    expect(system).toBeDefined();
    expect(system!.apps.length).toBeGreaterThan(0);
    expect(system!.apps.some((a) => a.ownerOnly)).toBe(false);
  });
});
