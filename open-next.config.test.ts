import { describe, expect, it } from 'vitest';
import config from './open-next.config';

/**
 * Guardrail anti-Error 1102 (lihat
 * docs/tracker/logs/error_1102_preview_iframe_diagnosis_2026_10_21.md).
 *
 * Kuota baca KV gratisan (100.000 read/hari) habis di tengah hari -> semua
 * route `x-nextjs-cache: MISS` -> tiap kunjungan render penuh di Worker ->
 * render bersamaan menembus memori isolate 128 MB -> 1102 pada iframe demo live.
 *
 * Test ini mengunci dua hal yang menyelesaikannya:
 *  1. incremental cache HARUS dibungkus RegionalCache (Cache API per Data Center
 *     di depan KV), dan
 *  2. opsi yang membuat hit regional benar-benar 0 read KV.
 */
type RegionalCacheLike = {
  name: string;
  getCacheInstance: unknown;
  putToCache: unknown;
  opts: Record<string, unknown>;
};

/** Bangun instance cache persis seperti yang dipakai `defineCloudflareConfig`. */
async function resolveIncrementalCache(): Promise<RegionalCacheLike> {
  const override = config.default.override?.incrementalCache;
  expect(typeof override).toBe('function');

  return (typeof override === 'function'
    ? await (override as () => Promise<unknown>)()
    : override) as unknown as RegionalCacheLike;
}

describe('open-next.config — lapisan cache anti-1102', () => {
  it('incremental cache dibungkus RegionalCache (Cache API di depan KV)', async () => {
    const cache = await resolveIncrementalCache();

    // Hanya RegionalCache yang punya metode lapisan lokal ini.
    expect(typeof cache.getCacheInstance).toBe('function');
    expect(typeof cache.putToCache).toBe('function');

    // Store di belakang lapisan regional tetap KV (binding NEXT_INC_CACHE_KV).
    expect(cache.name).toBe('cf-kv-incremental-cache');
  });

  it('hit regional tidak membaca KV: tanpa refresh latar + tag cache dilewati', async () => {
    const cache = await resolveIncrementalCache();

    expect(cache.opts).toMatchObject({
      mode: 'long-lived',
      // Staleness dibatasi 300 detik = sama dengan `revalidate` halaman preview.
      defaultLongLivedTtlSec: 300,
      // Tanpa ini, setiap hit tetap menarik KV di latar (waitUntil) -> kuota terbakar.
      shouldLazilyUpdateOnCacheHit: false,
      // Tanpa ini, tag cache tetap dibaca KV pada tiap request (~1 read/request).
      bypassTagCacheOnCacheHit: true,
    });
  });
});
