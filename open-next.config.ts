// @ts-nocheck
import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// LEMARI CACHE (2026-09-26): tanpa ini, setiap pengunjung memicu render ulang
// di Worker (TTFB terukur 15-17s produksi; x-nextjs-cache: MISS terus).
// KV incremental+tag cache =ISR Next.js benar-benar bekerja di Cloudflare:
// render sekali, simpan, serve ±100ms sampai kedaluwarsa (revalidate 60s).
// Binding: NEXT_INC_CACHE_KV + NEXT_TAG_CACHE_KV di wrangler.jsonc.
//
// LAPISAN CACHE REGIONAL (2026-10-21): kuota baca KV gratisan Cloudflare
// (100.000 read/hari) HABIS di tengah hari. `wrangler tail` produksi
// menangkap berulang: "Failed to get from cache / Error: KV get() limit
// exceeded for the day" — tercatat 13 kejadian dari 9 invocation yang disampel.
// Dampaknya berantai: setiap request gagal baca cache -> render penuh di Worker
// (TTFB 1,5-3,8s, x-nextjs-cache: MISS pada SEMUA route) -> beberapa render
// bersamaan menembus memori isolate (128 MB) -> Error 1102 pada iframe demo
// live. Trafik nyata 7.000-37.000 request/hari x ±2-6 read per request
// (1 incremental + 1 batch tag per request; bisa lebih saat itemsCache kosong)
// melebihi kuota harian, jadi kegagalan ini terulang tiap hari.
//
// `withRegionalCache` menaruh Cache API Cloudflare (per Data Center) di depan
// KV sehingga KV hanya dibaca saat entry pertama per Data Center per URL:
//   - hit regional  -> 0 read KV; tag cache dilewati (bypassTagCacheOnCacheHit)
//     dan refresh KV di latar dimatikan (shouldLazilyUpdateOnCacheHit) sehingga
//     benar-benar 0 read.
//   - miss regional -> baca KV sekali, lalu diisi ke Cache API (waitUntil).
// Konsekuensi yang disadari: revalidasi on-demand (/api/revalidate) bisa
// tertahan maksimal `defaultLongLivedTtlSec` = 300 detik — sama dengan
// `revalidate` halaman preview, jadi batas staleness tetap terukur, bukan
// tak terbatas (entry kedaluwarsa oleh `max-age` pada hasil `cache.put`).
const incrementalCache = async () => {
  const kvCache = (
    await import('@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache')
  ).default;
  const { withRegionalCache } = await import(
    '@opennextjs/cloudflare/overrides/incremental-cache/regional-cache'
  );
  return withRegionalCache(kvCache, {
    mode: 'long-lived',
    defaultLongLivedTtlSec: 300,
    shouldLazilyUpdateOnCacheHit: false,
    bypassTagCacheOnCacheHit: true,
  });
};
const tagCache = async () =>
  (await import('@opennextjs/cloudflare/overrides/tag-cache/kv-next-tag-cache')).default;

// QUEUE REVALIDASI (2026-09-28): sebelumnya `queue: 'direct'` — ternyata dipetakan ke
// `overrides/queue/direct.js` (object bernama `dev-queue`) yang me-revalidate dengan
// fetch() ke URL publiknya sendiri, tanpa memeriksa hasil. Dokumentasi resmi OpenNext:
// "`direct` mode ... only works in preview mode (i.e. `wrangler dev`)" -> di produksi
// ISR 60s tidak pernah commit (x-opennext-cache: STALE permanen, terukur 6/6 + timing
// GET 135-868ms vs revalidasi nyata 6-9s). Memory queue memakai service binding
// WORKER_SELF_REFERENCE (dispatch in-Workers, bukan lewat URL publik) DAN mengecek
// `x-nextjs-cache: REVALIDATED`, sehingga kegagalan revalidasi ikut ter-log.
// Binding `services`-nya ada di wrangler.jsonc.
const queue = async () =>
  (await import('@opennextjs/cloudflare/overrides/queue/memory-queue')).default;

const config = defineCloudflareConfig({
  incrementalCache,
  tagCache,
  queue,
  enableCacheInterception: true,
});

config.default.minify = true;
if (config.middleware) {
  config.middleware.minify = true;
}

export default config;
