/**
 * Service Video Hero (v1.3.49, auto-poster v1.3.57) — rekaman demo untuk
 * lembaran koridor hero halaman jualan storefront.
 *
 * Owner-mode ONLY (sama seperti pricingConfigService): data bisnis owner,
 * bukan konten klien. Disimpan di D1 `platform_settings` (key
 * `hero_preview_videos`, JSON `{ videos: { <slot>: <url> }, posters:
 * { <slot>: <url> }, updatedAt }`); file video/poster sendiri ada di R2
 * (folder `assets/hero-videos` per site) lewat jalur upload admin yang
 * sudah ada.
 *
 * `posters` (v1.3.57): foto 1 frame dari rekaman yang diupload otomatis
 * oleh panel admin (auto-poster) — dipakai sebagai gambar dasar lembaran
 * ber-video (selagi video buffer / reduced-motion pengunjung melihat
 * frame videonya sendiri, bukan screenshot lama).
 *
 * Halaman jualan (`/`) membaca via `getHeroPreviewVideos()` /
 * `getHeroPreviewPosters()` (cache 60 dtk, ISR 60 dtk) → slot kosong
 * berarti hero memakai gambar screenshot statis. Kegagalan apa pun jatuh
 * ke `{}` — hero tidak pernah gagal render karena video.
 */
import { queryD1 } from '@/lib/cloudflareD1';

const SETTINGS_KEY = 'hero_preview_videos';
const CACHE_TTL_MS = 60_000;
const MAX_URL_LENGTH = 500;
/** Peta video + poster per slot (keduanya divalidasi & di-cache bersama). */
type HeroVideoStore = {
  videos: Record<string, string>;
  posters: Record<string, string>;
};
let cache: { value: HeroVideoStore; loadedAt: number } | null = null;

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
 * URL video/poster hero harus http(s) absolut, maks 500 karakter. String
 * kosong SAH = owner menghapus isi slot (hero jatuh ke gambar screenshot).
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

/** Sematkan ?v=updatedAt (anti-cache HTTP immutable) pada URL. */
function withVersion(url: string, versionTag: string): string {
  if (!versionTag) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${versionTag}`;
}

/** Buang parameter ?v= (untuk menyimpan URL mentah kembali ke D1). */
function stripVersion(url: string): string {
  return url.replace(/[?&]v=[^&]+/, '');
}

/**
 * Membaca peta video + poster hero per slot (cache 60 detik). TIDAK PERNAH
 * melempar — kegagalan apa pun (tabel kosong, JSON rusak, D1 mati) jatuh
 * ke `{ videos: {}, posters: {} }`. Kegagalan query TIDAK di-cache
 * (bisa transien).
 */
async function loadStore(): Promise<HeroVideoStore> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.value;

  const value: HeroVideoStore = { videos: {}, posters: {} };
  try {
    const rows = await queryD1<{ value: string }>(
      'SELECT value FROM platform_settings WHERE key = ? LIMIT 1',
      [SETTINGS_KEY]
    );
    if (rows.length > 0 && rows[0].value) {
      const parsed = JSON.parse(rows[0].value) as {
        videos?: unknown;
        posters?: unknown;
        updatedAt?: unknown;
      };
      const versionTag =
        typeof parsed.updatedAt === 'string' && parsed.updatedAt
          ? encodeURIComponent(parsed.updatedAt)
          : '';
      for (const mapKey of ['videos', 'posters'] as const) {
        const raw = parsed[mapKey];
        if (!raw || typeof raw !== 'object') continue;
        for (const slot of HERO_VIDEO_SLOTS) {
          const check = validateHeroVideoUrl((raw as Record<string, unknown>)[slot]);
          if (check.valid && check.value) {
            value[mapKey][slot] = withVersion(check.value, versionTag);
          }
        }
      }
    }
    cache = { value, loadedAt: Date.now() };
    return value;
  } catch (err) {
    // Kegagalan query/parse TIDAK di-cache (bisa transien).
    console.warn('[heroVideoService] Gagal baca video hero:', err);
    return { videos: {}, posters: {} };
  }
}

/** Peta video hero per slot (URL + ?v= anti-cache); tidak pernah melempar. */
export async function getHeroPreviewVideos(): Promise<Record<string, string>> {
  return (await loadStore()).videos;
}

/** Peta poster otomatis per slot (URL + ?v=); tidak pernah melempar. */
export async function getHeroPreviewPosters(): Promise<Record<string, string>> {
  return (await loadStore()).posters;
}

/**
 * Menyimpan/menghapus satu slot video hero (upsert peta, tidak pernah
 * melempar). `url` kosong = hapus slot (poster slot ikut dihapus).
 * `posterUrl` opsional (v1.3.57): undefined = pertahankan poster tersimpan,
 * string kosong = hapus poster, isi = ganti poster.
 */
export async function updateHeroPreviewVideo(
  slug: unknown,
  url: unknown,
  posterUrl?: unknown
): Promise<{ success: boolean; error?: string }> {
  if (!isHeroVideoSlot(slug)) {
    return { success: false, error: `Slot template tidak dikenal: ${String(slug)}` };
  }
  const check = validateHeroVideoUrl(url);
  if (!check.valid) {
    return { success: false, error: check.error || 'URL video tidak valid.' };
  }
  let checkPoster: { valid: boolean; value: string; error?: string } = {
    valid: true,
    value: '',
  };
  if (posterUrl !== undefined) {
    checkPoster = validateHeroVideoUrl(posterUrl);
    if (!checkPoster.valid) {
      return {
        success: false,
        error: checkPoster.error || 'URL poster tidak valid.',
      };
    }
  }

  try {
    const current = await loadStore();
    const videos: Record<string, string> = {};
    const posters: Record<string, string> = {};
    for (const [k, v] of Object.entries(current.videos)) videos[k] = stripVersion(v);
    for (const [k, v] of Object.entries(current.posters)) posters[k] = stripVersion(v);
    if (check.value) videos[slug] = stripVersion(check.value);
    // Hapus video = poster slot ikut dihapus (poster = frame dari video itu).
    else {
      delete videos[slug];
      delete posters[slug];
    }
    if (posterUrl !== undefined) {
      if (checkPoster.value) posters[slug] = stripVersion(checkPoster.value);
      else delete posters[slug];
    }

    const now = new Date().toISOString();
    await queryD1(
      `INSERT INTO platform_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key)
       DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [SETTINGS_KEY, JSON.stringify({ videos, posters, updatedAt: now }), now]
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
