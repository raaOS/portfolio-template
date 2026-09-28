// @ts-nocheck
import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// LEMARI CACHE (2026-09-26): tanpa ini, setiap pengunjung memicu render ulang
// di Worker (TTFB terukur 15-17s produksi; x-nextjs-cache: MISS terus).
// KV incremental+tag cache =ISR Next.js benar-benar bekerja di Cloudflare:
// render sekali, simpan, serve ±100ms sampai kedaluwarsa (revalidate 60s).
// Binding: NEXT_INC_CACHE_KV + NEXT_TAG_CACHE_KV di wrangler.jsonc.
const incrementalCache = async () =>
  (await import('@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache')).default;
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
