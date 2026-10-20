/**
 * Service Video Hero (v1.3.49) — rekaman demo untuk lembaran koridor hero
 * halaman jualan storefront.
 *
 * Owner-mode ONLY (sama seperti pricingConfigService): data bisnis owner,
 * bukan konten klien. Disimpan di D1 `platform_settings` (key
 * `hero_preview_videos`, JSON `{ videos: { <slug>: <url> }, updatedAt }`);
 * file video sendiri ada di R2 (folder `assets/hero-videos` per site) lewat
 * jalur upload admin yang sudah ada.
 *
 * Halaman jualan (`/`) membaca via `getHeroPreviewVideos()` (cache 60 dtk,
 * ISR 60 dtk) → slot kosong berarti hero memakai video default bawaan atau
 * gambar screenshot. Kegagalan apa pun jatuh ke `{}` — hero tidak pernah
 * gagal render karena video.
 */
import { queryD1 } from '@/lib/cloudflareD1';

const SETTINGS_KEY = 'hero_preview_videos';
const CACHE_TTL_MS = 60_000;
const MAX_URL_LENGTH = 500;
let cache: { value: Record<string, string>; loadedAt: number } | null = null;

/** Slot template hero — harus selalu cocok dengan `id` di TEMPLATES_DATA. */
export const HERO_VIDEO_SLOTS = [
  'os-desktop',
  'infinite-canvas',
  'spatial-gallery',
] as const;
export type HeroVideoSlot = (typeof HERO_VIDEO_SLOTS)[number];

export function isHeroVideoSlot(value: unknown): value is HeroVideoSlot {
  return (
    typeof value === 'string' &&
    (HERO_VIDEO_SLOTS as readonly string[]).includes(value)
  );
}

/**
 * URL video hero harus http(s) absolut, maks 500 karakter. String kosong
 * SAH = owner menghapus video slot (hero jatuh ke video default/gambar).
 */
export function validateHeroVideoUrl(value: unknown): {
  valid: boolean;
  value: string;
  error?: string;
} {
  if (value === null || value === undefined) return { valid: true, value: '' };
  const url = String(value).trim();
  if (url === '') return { valid: true, value: '' };
  if (url.length > MAX_URL_LENGTH) {
    return { valid: false, value: '', error: 'URL video terlalu panjang.' };
  }
  if (!/^https?:\/\/\S+$/.test(url)) {
    return {
      valid: false,
      value: '',
      error: 'URL video harus http:// atau https:// (contoh: hasil upload /api/admin/upload).',
    };
  }
  return { valid: true, value: url };
}

/** Bersihkan cache baca (dipakai unit test; update memanggil ini otomatis). */
export function clearHeroVideosCache(): void {
  cache = null;
}

/**
 * Membaca peta video hero per slot (cache 60 detik). TIDAK PERNAH melempar —
 * kegagalan apa pun (tabel kosong, JSON rusak, D1 mati) jatuh ke `{}`.
 * Kegagalan query TIDAK di-cache (bisa transien).
 */
export async function getHeroPreviewVideos(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.value;

  const value: Record<string, string> = {};
  try {
    const rows = await queryD1<{ value: string }>(
      'SELECT value FROM platform_settings WHERE key = ? LIMIT 1',
      [SETTINGS_KEY]
    );
    if (rows.length > 0 && rows[0].value) {
      const parsed = JSON.parse(rows[0].value) as { videos?: unknown };
      if (parsed && typeof parsed.videos === 'object' && parsed.videos) {
        const raw = parsed.videos as Record<string, unknown>;
        for (const slot of HERO_VIDEO_SLOTS) {
          const check = validateHeroVideoUrl(raw[slot]);
          if (check.valid && check.value) value[slot] = check.value;
        }
      }
    }
    cache = { value, loadedAt: Date.now() };
    return value;
  } catch (err) {
    // Kegagalan query/parse TIDAK di-cache (bisa transien).
    console.warn('[heroVideoService] Gagal baca video hero:', err);
    return {};
  }
}

/**
 * Menyimpan/menghapus satu slot video hero (upsert peta, tidak pernah
 * melempar). `url` kosong = hapus slot.
 */
export async function updateHeroPreviewVideo(
  slug: unknown,
  url: unknown
): Promise<{ success: boolean; error?: string }> {
  if (!isHeroVideoSlot(slug)) {
    return { success: false, error: `Slot template tidak dikenal: ${String(slug)}` };
  }
  const check = validateHeroVideoUrl(url);
  if (!check.valid) {
    return { success: false, error: check.error || 'URL video tidak valid.' };
  }

  try {
    const current = await getHeroPreviewVideos();
    const videos: Record<string, string> = { ...current };
    if (check.value) videos[slug] = check.value;
    else delete videos[slug];

    const now = new Date().toISOString();
    await queryD1(
      `INSERT INTO platform_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key)
       DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [SETTINGS_KEY, JSON.stringify({ videos, updatedAt: now }), now]
    );
    cache = null;
    return { success: true };
  } catch (err) {
    console.error('[heroVideoService] Gagal simpan video hero:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gagal menyimpan',
    };
  }
}
