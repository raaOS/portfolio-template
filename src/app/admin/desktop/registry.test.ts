import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminZone } from './types';

/**
 * Logika filter Owner Mode di registry desktop admin:
 * - deployment owner (NEXT_PUBLIC_OWNER_MODE=true) melihat semua app;
 * - site klien menyaring app `ownerOnly` (Harga Jual, Order & Pembayaran,
 *   Video Hero) keluar dari ADMIN_ZONES, dan zone yang kehabisan app ikut hilang.
 *
 * Registry membaca env saat module init → pakai resetModules + import dinamis.
 */
async function loadZones(): Promise<AdminZone[]> {
  vi.resetModules();
  const mod = await import('./registry');
  return mod.ADMIN_ZONES;
}

/**
 * Semua app di registry wajib punya key PANEL_MAP (WindowContentRenderer),
 * kalau tidak window-nya cuma menampilkan "Panel belum tersedia".
 * Pengecualian: `ai` — fitur AI sengaja mati per keputusan owner v1.3.28.
 */
it('setiap app ADMIN_ZONES terdaftar di PANEL_MAP (guard "Panel belum tersedia")', async () => {
  vi.stubEnv('NEXT_PUBLIC_OWNER_MODE', 'true');
  const zones = await loadZones();
  const { PANEL_MAP } = await import('./WindowContentRenderer');

  const appIds = zones.flatMap((z) => z.apps.map((a) => a.id));
  const missing = appIds.filter((id) => !(id in PANEL_MAP));

  expect(missing).toEqual(['ai']);
});

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
  it('deployment owner melihat app ownerOnly (harga, orders, heroVideos)', async () => {
    vi.stubEnv('NEXT_PUBLIC_OWNER_MODE', 'true');
    const zones = await loadZones();

    expect(findApp(zones, 'harga')).toBeDefined();
    expect(findApp(zones, 'orders')).toBeDefined();
    expect(findApp(zones, 'heroVideos')).toBeDefined();
  });

  it('letak zone owner: Harga/Orders/Video Hero di "Sistem Owner", bukan di "Tampilan"', async () => {
    vi.stubEnv('NEXT_PUBLIC_OWNER_MODE', 'true');
    const zones = await loadZones();

    const system = zones.find((z) => z.id === 'system');
    expect(system?.label).toBe('Sistem Owner');
    expect(system?.apps.map((a) => a.id)).toEqual(
      expect.arrayContaining(['harga', 'orders', 'heroVideos'])
    );

    const display = zones.find((z) => z.id === 'display');
    expect(display?.apps.map((a) => a.id)).not.toContain('heroVideos');
  });

  it('site klien menyaring app ownerOnly keluar (fail-closed: env tidak diset pun tersembunyi)', async () => {
    vi.stubEnv('NEXT_PUBLIC_OWNER_MODE', 'false');
    const zones = await loadZones();

    expect(findApp(zones, 'harga')).toBeUndefined();
    expect(findApp(zones, 'orders')).toBeUndefined();
    expect(findApp(zones, 'heroVideos')).toBeUndefined();
    // app klien lain di zona yang sama tetap ada
    expect(findApp(zones, 'analytics')).toBeDefined();
    expect(findApp(zones, 'projects')).toBeDefined();
  });

  it('OWNER_MODE tidak diset = dianggap site klien (app ownerOnly hilang)', async () => {
    delete (process.env as Record<string, string | undefined>).NEXT_PUBLIC_OWNER_MODE;
    const zones = await loadZones();

    expect(findApp(zones, 'harga')).toBeUndefined();
    expect(findApp(zones, 'orders')).toBeUndefined();
    expect(findApp(zones, 'heroVideos')).toBeUndefined();
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
