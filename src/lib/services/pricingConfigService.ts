/**
 * Service Harga Jual (PK4 — rencana v1.3.27).
 *
 * Harga dasar template disimpan di D1 `platform_settings` (key
 * `pricing_config`) supaya owner bisa mengubahnya lewat panel admin
 * "Harga Jual" (`/admin/system/harga`) tanpa deploy ulang. `BASE_PRICE`
 * tetap dipakai sebagai fallback: belum pernah diisi / nilai tidak valid /
 * D1 tidak terjangkau → harga bawaan, halaman tidak pernah gagal render.
 *
 * Sumber kebenaran nominal order = SERVER: `createOrder()` membaca harga
 * dari sini. Route checkout tidak pernah menerima `amount` dari klien —
 * harga yang tampil di UI hanya untuk display, nominal diorders selalu
 * dihitung ulang dari D1.
 */
import { queryD1 } from '@/lib/cloudflareD1';
import { BASE_PRICE } from '@/constants/pricing';

const SETTINGS_KEY = 'pricing_config';

/**
 * Guardrail anti salah-ketik (bukan batas bisnis): nominal di bawah Rp1.000
 * hampir pasti salah ketik nol hilang (mis. 199.000 → 199), di atas Rp100 juta
 * juga di luar nalar untuk satu template.
 */
const MIN_BASE_PRICE = 1_000;
const MAX_BASE_PRICE = 100_000_000;

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
      error: `Harga harus antara Rp ${MIN_BASE_PRICE.toLocaleString('id-ID')} dan Rp ${MAX_BASE_PRICE.toLocaleString('id-ID')}.`,
    };
  }
  return { valid: true, value: num };
}

/**
 * Membaca harga dasar dari D1. Tidak pernah melempar — kegagalan apa pun
 * (tabel kosong, JSON rusak, nilai di luar batas, D1 mati) jatuh ke
 * `BASE_PRICE`.
 */
export async function getBasePrice(): Promise<number> {
  try {
    const rows = await queryD1<{ value: string }>(
      'SELECT value FROM platform_settings WHERE key = ?',
      [SETTINGS_KEY]
    );
    if (rows.length === 0 || !rows[0].value) return BASE_PRICE;

    const parsed = JSON.parse(rows[0].value) as { basePrice?: unknown };
    const check = validateBasePrice(parsed.basePrice);
    return check.valid && typeof check.value === 'number' ? check.value : BASE_PRICE;
  } catch (err) {
    console.warn('[pricingConfigService] Gagal baca harga, pakai fallback BASE_PRICE:', err);
    return BASE_PRICE;
  }
}

/**
 * Menyimpan harga dasar (upsert). Mengembalikan `{ success, error? }` —
 * tidak pernah melempar.
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
    return { success: true, basePrice: check.value };
  } catch (err) {
    console.error('[pricingConfigService] Gagal simpan harga:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gagal menyimpan harga',
    };
  }
}
