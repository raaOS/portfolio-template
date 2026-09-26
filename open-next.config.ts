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

const config = defineCloudflareConfig({
  incrementalCache,
  tagCache,
  queue: 'direct',
  enableCacheInterception: true,
});

config.default.minify = true;
if (config.middleware) {
  config.middleware.minify = true;
}

export default config;
