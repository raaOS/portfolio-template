/**
 * Layanan kupon diskon checkout (v1.3.93).
 *
 * Sumber kebenaran kupon = D1 OWNER (`coupons` + `coupon_redemptions`).
 * Klien tidak pernah melihat endpoint ini; route admin dijaga
 * `requireOwnerMode()` dan endpoint publik hanya memvalidasi kode.
 *
 * Prinsip anti-fraud:
 * - Diskon selalu dihitung server (mesin harga `checkoutPricing`).
 * - Kuota direservasi ATOMIK saat order dibuat (INSERT ... SELECT dengan
 *   subquery COUNT di dalam satu statement), bukan "SELECT lalu INSERT".
 * - Reservasi dilepas saat order expired/canceled supaya kuota tidak habis
 *   karena pesanan yang tidak pernah dibayar.
 * - Kupon yang sudah pernah dipakai TIDAK dihapus (arsip), agar riwayat
 *   pendapatan utuh.
 */
import { queryD1 } from '@/lib/cloudflareD1';
import {
  computeCouponDiscount,
  isValidCouponCode,
  normalizeCouponCode,
  validateCouponDraft,
  type CouponKind,
  type CouponRule,
  type QuoteItem,
} from './checkoutPricing';

export interface CouponRecord {
  id: string;
  code: string;
  kind: CouponKind;
  value: number;
  min_subtotal: number;
  max_discount: number | null;
  /** JSON array template id, atau NULL = semua template. */
  applies_to: string | null;
  starts_at: string | null;
  ends_at: string | null;
  max_redemptions: number | null;
  max_per_email: number | null;
  is_active: number;
  note: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CouponWithUsage extends CouponRecord {
  redeemed_count: number;
  discount_total: number;
}

export interface CouponDraftInput extends CouponRule {
  startsAt?: string | null;
  endsAt?: string | null;
  maxRedemptions?: number | null;
  maxPerEmail?: number | null;
  isActive?: boolean;
  note?: string | null;
}

function newCouponId(): string {
  return `cpn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseAppliesTo(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const ids = Array.from(new Set(parsed.map((value) => String(value)).filter(Boolean)));
    return ids.length > 0 ? ids : null;
  } catch {
    return null;
  }
}

function ruleFromRecord(record: CouponRecord): CouponRule {
  return {
    code: record.code,
    kind: record.kind,
    value: Number(record.value),
    minSubtotal: Number(record.min_subtotal || 0),
    maxDiscount:
      record.max_discount === null || record.max_discount === undefined
        ? null
        : Number(record.max_discount),
    appliesTo: parseAppliesTo(record.applies_to),
  };
}

function normalizeOptionalInt(
  raw: unknown,
  min: number,
  max: number
): { valid: boolean; value: number | null } {
  if (raw === null || raw === undefined || raw === '') return { valid: true, value: null };
  const num = Number(raw);
  if (!Number.isInteger(num) || num < min || num > max) return { valid: false, value: null };
  return { valid: true, value: num };
}

function validateDates(
  startsAt: unknown,
  endsAt: unknown
): { valid: boolean; startsAt: string | null; endsAt: string | null; error?: string } {
  const parse = (value: unknown): string | null | undefined => {
    if (value === null || value === undefined || value === '') return null;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  };
  const start = parse(startsAt);
  const end = parse(endsAt);
  if (start === undefined || end === undefined) {
    return { valid: false, startsAt: null, endsAt: null, error: 'Tanggal kupon tidak valid.' };
  }
  if (start && end && new Date(end).getTime() <= new Date(start).getTime()) {
    return {
      valid: false,
      startsAt: start,
      endsAt: end,
      error: 'Tanggal berakhir harus setelah tanggal mulai.',
    };
  }
  return { valid: true, startsAt: start, endsAt: end };
}

/**
 * Validasi lengkap input admin (kode, nilai, jadwal, kuota). Mengembalikan
 * nilai siap-tulis atau pesan error yang bisa ditampilkan ke owner.
 */
export function validateCouponInput(raw: unknown): {
  valid: boolean;
  error?: string;
  value?: CouponDraftInput;
} {
  const draft = validateCouponDraft(raw);
  if (!draft.valid || !draft.value) {
    return { valid: false, error: draft.error };
  }

  const input = (raw || {}) as Record<string, unknown>;
  const dates = validateDates(input.startsAt, input.endsAt);
  if (!dates.valid) return { valid: false, error: dates.error };

  const maxRedemptions = normalizeOptionalInt(input.maxRedemptions, 1, 10_000_000);
  if (!maxRedemptions.valid) {
    return { valid: false, error: 'Kuota pemakaian harus 1–10.000.000 atau kosong.' };
  }
  const maxPerEmail = normalizeOptionalInt(input.maxPerEmail, 1, 10_000);
  if (!maxPerEmail.valid) {
    return { valid: false, error: 'Batas per email harus 1–10.000 atau kosong.' };
  }

  const note =
    typeof input.note === 'string' ? input.note.trim().slice(0, 200) || null : null;

  return {
    valid: true,
    value: {
      ...draft.value,
      startsAt: dates.startsAt,
      endsAt: dates.endsAt,
      maxRedemptions: maxRedemptions.value,
      maxPerEmail: maxPerEmail.value,
      isActive: input.isActive === undefined ? true : Boolean(input.isActive),
      note,
    },
  };
}

export async function getCouponByCode(rawCode: unknown): Promise<CouponRecord | null> {
  const code = normalizeCouponCode(rawCode);
  if (!isValidCouponCode(code)) return null;
  const rows = await queryD1<CouponRecord>(
    'SELECT * FROM coupons WHERE code = ? LIMIT 1',
    [code]
  );
  return rows[0] || null;
}

export async function listCoupons(): Promise<CouponWithUsage[]> {
  const rows = await queryD1<CouponWithUsage>(
    `SELECT c.*,
            (SELECT COUNT(*) FROM coupon_redemptions r WHERE r.coupon_id = c.id) AS redeemed_count,
            (SELECT COALESCE(SUM(r.discount_amount), 0) FROM coupon_redemptions r WHERE r.coupon_id = c.id) AS discount_total
       FROM coupons c
      ORDER BY c.created_at DESC`
  );
  return (rows || []).map((row) => ({
    ...row,
    value: Number(row.value),
    min_subtotal: Number(row.min_subtotal || 0),
    redeemed_count: Number(row.redeemed_count || 0),
    discount_total: Number(row.discount_total || 0),
    is_active: Number(row.is_active),
  }));
}

/**
 * Status kupon pada waktu tertentu. Alasan detail hanya untuk log internal;
 * pemanggil publik wajib memakai `PUBLIC_COUPON_ERROR`.
 */
export function getCouponStatus(
  record: CouponRecord,
  now = new Date()
): { usable: boolean; reason?: string } {
  if (Number(record.is_active) !== 1 || record.archived_at) {
    return { usable: false, reason: 'Kupon tidak aktif.' };
  }
  const timestamp = now.getTime();
  if (record.starts_at && new Date(record.starts_at).getTime() > timestamp) {
    return { usable: false, reason: 'Kupon belum berlaku.' };
  }
  if (record.ends_at && new Date(record.ends_at).getTime() < timestamp) {
    return { usable: false, reason: 'Kupon sudah berakhir.' };
  }
  return { usable: true };
}

export const PUBLIC_COUPON_ERROR = 'Kode kupon tidak valid atau sudah tidak berlaku.';

export interface CouponEvaluation {
  usable: boolean;
  reason?: string;
  rule?: CouponRule;
  /** Baris D1 lengkap — dibutuhkan createOrder untuk reservasi kuota. */
  record?: CouponRecord;
  discount: number;
  eligibleSubtotal: number;
}

/**
 * Evaluasi kode kupon untuk daftar item. Tidak menulis apa pun. Rate limit &
 * pesan generik ada di route publik.
 */
export async function evaluateCoupon(
  rawCode: unknown,
  items: QuoteItem[],
  now = new Date()
): Promise<CouponEvaluation> {
  const code = normalizeCouponCode(rawCode);
  if (!code) return { usable: false, discount: 0, eligibleSubtotal: 0 };
  if (!isValidCouponCode(code)) {
    return { usable: false, reason: PUBLIC_COUPON_ERROR, discount: 0, eligibleSubtotal: 0 };
  }

  let record: CouponRecord | null = null;
  try {
    record = await getCouponByCode(code);
  } catch (err) {
    console.error('[couponService] Gagal membaca kupon:', err);
    return { usable: false, reason: PUBLIC_COUPON_ERROR, discount: 0, eligibleSubtotal: 0 };
  }
  if (!record) {
    return { usable: false, reason: PUBLIC_COUPON_ERROR, discount: 0, eligibleSubtotal: 0 };
  }

  const status = getCouponStatus(record, now);
  if (!status.usable) {
    return {
      usable: false,
      reason: PUBLIC_COUPON_ERROR,
      discount: 0,
      eligibleSubtotal: 0,
    };
  }

  const rule = ruleFromRecord(record);
  const computed = computeCouponDiscount(items, rule);
  if (!computed || computed.discount <= 0) {
    return {
      usable: false,
      reason: PUBLIC_COUPON_ERROR,
      discount: 0,
      eligibleSubtotal: computed?.eligibleSubtotal ?? 0,
    };
  }

  return {
    usable: true,
    rule,
    record,
    discount: computed.discount,
    eligibleSubtotal: computed.eligibleSubtotal,
  };
}

/**
 * Reservasi kuota kupon secara atomik. Mengembalikan `false` bila kuota total
 * atau batas per-email sudah penuh. Satu order hanya boleh punya satu baris.
 */
export async function reserveCouponRedemption(
  record: CouponRecord,
  input: { orderId: string; buyerEmail: string; discount: number }
): Promise<boolean> {
  const id = `red-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const email = input.buyerEmail.trim().toLowerCase();

  // Satu statement: COUNT dievaluasi di dalam transaksi tulis SQLite, jadi dua
  // checkout bersamaan tidak bisa sama-sama lolos saat kuota tersisa 1.
  // `OR IGNORE` membuat pemanggilan ulang untuk order yang sama (mis. reopen
  // order yang sebelumnya `failed`) tidak menabrak `UNIQUE(order_id)`.
  await queryD1(
    `INSERT OR IGNORE INTO coupon_redemptions
       (id, coupon_id, order_id, buyer_email, discount_amount, created_at)
     SELECT ?, ?, ?, ?, ?, ?
      WHERE (? IS NULL OR
             (SELECT COUNT(*) FROM coupon_redemptions WHERE coupon_id = ?) < ?)
        AND (? IS NULL OR
             (SELECT COUNT(*) FROM coupon_redemptions
               WHERE coupon_id = ? AND LOWER(buyer_email) = ?) < ?)`,
    [
      id,
      record.id,
      input.orderId,
      email,
      Math.max(0, Math.floor(input.discount)),
      now,
      record.max_redemptions,
      record.id,
      record.max_redemptions,
      record.max_per_email,
      record.id,
      email,
      record.max_per_email,
    ]
  );

  const verify = await queryD1<{ id: string }>(
    'SELECT id FROM coupon_redemptions WHERE order_id = ? LIMIT 1',
    [input.orderId]
  );
  return verify.length > 0;
}

/**
 * Lepas reservasi kupon milik order (dipanggil saat expired/canceled).
 * Aman dijalankan berulang dan untuk order tanpa kupon.
 */
export async function releaseCouponRedemption(orderId: string): Promise<void> {
  if (!orderId) return;
  try {
    await queryD1('DELETE FROM coupon_redemptions WHERE order_id = ?', [orderId]);
  } catch (err) {
    console.error(`[couponService] Gagal melepas kupon order ${orderId}:`, err);
  }
}

export async function createCoupon(
  raw: unknown
): Promise<{ success: boolean; error?: string; coupon?: CouponRecord }> {
  const check = validateCouponInput(raw);
  if (!check.valid || !check.value) {
    return { success: false, error: check.error || 'Data kupon tidak valid.' };
  }
  const value = check.value;
  const now = new Date().toISOString();

  try {
    const id = newCouponId();
    await queryD1(
      `INSERT INTO coupons (
         id, code, kind, value, min_subtotal, max_discount, applies_to,
         starts_at, ends_at, max_redemptions, max_per_email, is_active,
         note, archived_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
      [
        id,
        value.code,
        value.kind,
        value.value,
        value.minSubtotal,
        value.maxDiscount,
        value.appliesTo ? JSON.stringify(value.appliesTo) : null,
        value.startsAt ?? null,
        value.endsAt ?? null,
        value.maxRedemptions ?? null,
        value.maxPerEmail ?? null,
        value.isActive === false ? 0 : 1,
        value.note ?? null,
        now,
        now,
      ]
    );
    const rows = await queryD1<CouponRecord>('SELECT * FROM coupons WHERE id = ? LIMIT 1', [id]);
    return { success: true, coupon: rows[0] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('UNIQUE constraint failed') && message.includes('code')) {
      return { success: false, error: `Kode "${value.code}" sudah dipakai kupon lain.` };
    }
    console.error('[couponService] Gagal membuat kupon:', err);
    return { success: false, error: 'Gagal menyimpan kupon.' };
  }
}

export async function updateCoupon(
  id: string,
  raw: unknown
): Promise<{ success: boolean; error?: string; coupon?: CouponRecord }> {
  if (!id) return { success: false, error: 'ID kupon wajib diisi.' };
  const check = validateCouponInput(raw);
  if (!check.valid || !check.value) {
    return { success: false, error: check.error || 'Data kupon tidak valid.' };
  }
  const value = check.value;
  const now = new Date().toISOString();

  try {
    await queryD1(
      `UPDATE coupons SET
         code = ?, kind = ?, value = ?, min_subtotal = ?, max_discount = ?,
         applies_to = ?, starts_at = ?, ends_at = ?, max_redemptions = ?,
         max_per_email = ?, is_active = ?, note = ?, updated_at = ?
       WHERE id = ?`,
      [
        value.code,
        value.kind,
        value.value,
        value.minSubtotal,
        value.maxDiscount,
        value.appliesTo ? JSON.stringify(value.appliesTo) : null,
        value.startsAt ?? null,
        value.endsAt ?? null,
        value.maxRedemptions ?? null,
        value.maxPerEmail ?? null,
        value.isActive === false ? 0 : 1,
        value.note ?? null,
        now,
        id,
      ]
    );
    const rows = await queryD1<CouponRecord>('SELECT * FROM coupons WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) return { success: false, error: 'Kupon tidak ditemukan.' };
    return { success: true, coupon: rows[0] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('UNIQUE constraint failed') && message.includes('code')) {
      return { success: false, error: `Kode "${value.code}" sudah dipakai kupon lain.` };
    }
    console.error('[couponService] Gagal mengubah kupon:', err);
    return { success: false, error: 'Gagal menyimpan perubahan kupon.' };
  }
}

/**
 * Arsipkan kupon (soft delete). Baris & riwayat redemption dipertahankan —
 * menghapus kupon yang sudah dipakai akan menghilangkan bukti pendapatan.
 */
export async function archiveCoupon(
  id: string
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'ID kupon wajib diisi.' };
  try {
    const now = new Date().toISOString();
    await queryD1(
      'UPDATE coupons SET is_active = 0, archived_at = COALESCE(archived_at, ?), updated_at = ? WHERE id = ?',
      [now, now, id]
    );
    return { success: true };
  } catch (err) {
    console.error('[couponService] Gagal mengarsipkan kupon:', err);
    return { success: false, error: 'Gagal mengarsipkan kupon.' };
  }
}
