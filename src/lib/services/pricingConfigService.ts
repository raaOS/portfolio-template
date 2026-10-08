/**
 * Service Harga Jual (PK4 — rencana v1.3.27; disesuaikan spesifikasi owner
 * pada v1.3.28: key `base_price_idr`, guardrail Rp50.000–Rp50.000.000,
 * cache baca 60 detik).
 *
 * Harga dasar template disimpan di D1 `platform_settings` (key
 * `base_price_idr`; key lama `pricing_config` dari rilis 1.3.27 tetap dibaca
 * sebagai fallback supaya harga yang pernah disimpan owner tidak hilang)
 * supaya owner bisa mengubahnya lewat panel admin "Harga Jual"
 * (`/admin/harga`) tanpa deploy ulang. `BASE_PRICE` tetap dipakai sebagai
 * fallback: belum pernah diisi / nilai tidak valid / D1 tidak terjangkau →
 * harga bawaan, halaman tidak pernah gagal render.
 *
 * Hasil baca di-cache di memori proses selama 60 detik (spesifikasi PK4);
 * `updateBasePrice()` membersihkan cache supaya harga baru langsung terbaca
 * pada proses yang sama. Proses lain menyusul maksimal 60 detik.
 *
 * Sumber kebenaran nominal order = SERVER: `createOrder()` membaca harga
 * dari sini. Route checkout tidak pernah menerima `amount` dari klien —
 * harga yang tampil di UI hanya untuk display, nominal diorders selalu
 * dihitung ulang dari D1.
 */
import { queryD1 } from '@/lib/cloudflareD1';
import { BASE_PRICE } from '@/constants/pricing';

const SETTINGS_KEY = 'base_price_idr';
/** Key lama (rilis 1.3.27) — dibaca hanya bila key baru belum pernah ditulis. */
const LEGACY_SETTINGS_KEY = 'pricing_config';

/**
 * Guardrail anti salah-ketik sesuai spesifikasi owner (bukan batas bisnis
 * fleksibel): nominal di bawah Rp50.000 hampir pasti salah ketik nol hilang
 * (mis. 199.000 → 1.990), di atas Rp50 juta di luar nalar untuk satu template.
 */
const MIN_BASE_PRICE = 50_000;
const MAX_BASE_PRICE = 50_000_000;

/** Cache baca 60 detik (spesifikasi PK4). */
const CACHE_TTL_MS = 60_000;
let priceCache: { value: number; loadedAt: number } | null = null;

export interface PricingConfig {
  basePrice: number;
  updatedAt?: string;
}

export function validateBasePrice(
  value: unknown
): { valid: boolean; error?: string; value?: number } {
  const num = typeof value === 'string' ? Number(value.trim()) : value;
  if (typeof num !== 'number' || Number.isNaN(num)) {
    return { valid: false, error: 'Harga harus berupa angka.' };
  }
  if (!Number.isInteger(num)) {
    return { valid: false, error: 'Harga harus bilangan bulat (tanpa desimal).' };
  }
  if (num < MIN_BASE_PRICE || num > MAX_BASE_PRICE) {
    return {
      valid: false,
      error: `Harga harus antara Rp ${MIN_BASE_PRICE.toLocaleString('id-ID')} dan Rp ${MAX_BASE_PRICE.toLocaleString('id-ID')}.`
    };
  }
  return { valid: true, value: num };
}

/** Bersihkan cache baca (dipakai unit test; `updateBasePrice` memanggil ini otomatis). */
export function clearBasePriceCache(): void {
  priceCache = null;
}

/**
 * Membaca harga dasar dari D1 (cache 60 detik). Tidak pernah melempar —
 * kegagalan apa pun (tabel kosong, JSON rusak, nilai di luar batas, D1 mati)
 * jatuh ke `BASE_PRICE`. Kegagalan query TIDAK di-cache (bisa transien).
 */
export async function getBasePrice(): Promise<number> {
  if (priceCache && Date.now() - priceCache.loadedAt < CACHE_TTL_MS) {
    return priceCache.value;
  }
  try {
    const rows = await queryD1<{ value: string }>(
      `SELECT value FROM platform_settings
        WHERE key IN (?, ?)
        ORDER BY CASE WHEN key = ? THEN 0 ELSE 1 END
        LIMIT 1`,
      [SETTINGS_KEY, LEGACY_SETTINGS_KEY, SETTINGS_KEY]
    );
    let value = BASE_PRICE;
    if (rows.length > 0 && rows[0].value) {
      const parsed = JSON.parse(rows[0].value) as { basePrice?: unknown };
      const check = validateBasePrice(parsed.basePrice);
      if (check.valid && typeof check.value === 'number') value = check.value;
    }
    priceCache = { value, loadedAt: Date.now() };
    return value;
  } catch (err) {
    console.warn('[pricingConfigService] Gagal baca harga, pakai fallback BASE_PRICE:', err);
    return BASE_PRICE;
  }
}

/**
 * Menyimpan harga dasar (upsert ke key `base_price_idr`). Mengembalikan
 * `{ success, error? }` — tidak pernah melempar. Sukses → cache dibersihkan
 * sehingga pembacaan berikutnya langsung memakai harga baru.
 */
export async function updateBasePrice(
  value: unknown
): Promise<{ success: boolean; error?: string; basePrice?: number }> {
  const check = validateBasePrice(value);
  if (!check.valid || typeof check.value !== 'number') {
    return { success: false, error: check.error || 'Harga tidak valid.' };
  }

  try {
    const now = new Date().toISOString();
    const payload: PricingConfig = { basePrice: check.value, updatedAt: now };
    await queryD1(
      `INSERT INTO platform_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key)
       DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [SETTINGS_KEY, JSON.stringify(payload), now]
    );
    priceCache = null;
    return { success: true, basePrice: check.value };
  } catch (err) {
    console.error('[pricingConfigService] Gagal simpan harga:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gagal menyimpan harga'
    };
  }
}
