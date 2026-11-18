/**
 * Logika pembelian & aktivasi template untuk portal owner (lokal).
 *
 * Model bisnis (keputusan owner 2026-11-18, JANGAN diubah tanpa izin):
 * - Setiap template dijual terpisah Rp199.000 (harga default = Harga Jual owner).
 * - Klien hanya "memiliki" template yang sudah dibeli → satu baris
 *   `site_template_entitlements` per template (UNIQUE site_id + template_id).
 * - Pindah ke template yang SUDAH dibeli = gratis (tidak ada order baru).
 * - Template yang tampil hanya ditentukan `sites.active_template_key`.
 * - Tidak ada pilihan template di panel admin klien; aktivasi hanya dari portal
 *   lokal owner (punya kredensial D1 klien) atau CLI owner dengan guard.
 *
 * Modul ini sengaja menerima `query` sebagai parameter supaya bisa diuji tanpa
 * jaringan: portal mengirim `d1Query` dengan kredensial klien, skrip backfill
 * mengirim helper fetch-nya sendiri.
 *
 * Urutan tulis di `applyTemplateChange`:
 *   katalog → entitlement (hanya kalau belum dimiliki) → active_template_key →
 *   audit_logs → verifikasi baca balik.
 * Kalau langkah setelah entitlement gagal, error membawa `partial` supaya
 * pemanggil TIDAK menghapus order yang sudah tercatat (klien memang membeli).
 */

import {
  SYSTEM_DEFAULT_TEMPLATE_ID,
  TEMPLATES,
  getTemplate,
  type TemplateMeta,
} from '../../src/lib/templates/registry';

export { SYSTEM_DEFAULT_TEMPLATE_ID, TEMPLATES };
export type { TemplateMeta };

/** Batas harga sama dengan panel Harga Jual (anti salah ketik nol hilang). */
export const TEMPLATE_PRICE_MIN = 50_000;
export const TEMPLATE_PRICE_MAX = 50_000_000;

/** Fallback bila D1 owner belum pernah menyimpan harga. */
export const DEFAULT_TEMPLATE_PRICE = 199_000;

/** Sejak v1.3.88 konten inti (canvas/spatial) setara macOS. */
export const TEMPLATE_CONTENT_PARITY_VERSION = '1.3.88';
/** Sejak v1.3.90 menu admin disaring sesuai template aktif. */
export const TEMPLATE_ADMIN_FILTER_VERSION = '1.3.90';

export type TemplateQuery = (
  sql: string,
  params?: Array<string | number | null>
) => Promise<Array<Record<string, unknown>>>;

export interface OwnedTemplate {
  templateId: string;
  purchasedAt: string;
  price: number;
  grantedBy: string | null;
}

export interface TemplateState {
  siteId: string;
  siteName: string;
  activeTemplateKey: string;
  siteCreatedAt: string;
  owned: OwnedTemplate[];
  catalogReady: boolean;
}

export type TemplateMode = 'activate' | 'purchase';

export type TemplateAction =
  | { kind: 'noop'; message: string }
  | { kind: 'activate' }
  | { kind: 'purchase' }
  | { kind: 'error'; message: string };

export interface TemplateChangePartial {
  entitlementCreated: boolean;
  keyChanged: boolean;
}

/**
 * Error aktivasi yang membawa status parsial. Pemanggil WAJIB membedakan:
 * - `entitlementCreated === false` → aman menghapus order yang baru dibuat.
 * - `entitlementCreated === true`  → order DIPERTAHANKAN (klien sudah membeli);
 *   aktivasi boleh diulang gratis.
 */
export class TemplateChangeError extends Error {
  readonly partial: TemplateChangePartial;

  constructor(message: string, partial: TemplateChangePartial) {
    super(message);
    this.name = 'TemplateChangeError';
    this.partial = partial;
  }
}

export function isKnownTemplateKey(key: string): boolean {
  return Boolean(getTemplate(key));
}

export function templateDisplayName(key: string): string {
  return getTemplate(key)?.name || key;
}

export function validatePurchasePrice(
  raw: unknown
): { valid: boolean; value?: number; error?: string } {
  const num = typeof raw === 'string' ? Number(raw.trim()) : raw;
  if (typeof num !== 'number' || Number.isNaN(num)) {
    return { valid: false, error: 'Harga harus berupa angka.' };
  }
  if (!Number.isInteger(num)) {
    return { valid: false, error: 'Harga harus bilangan bulat (tanpa desimal).' };
  }
  if (num < TEMPLATE_PRICE_MIN || num > TEMPLATE_PRICE_MAX) {
    return {
      valid: false,
      error:
        `Harga harus antara Rp${TEMPLATE_PRICE_MIN.toLocaleString('id-ID')} dan ` +
        `Rp${TEMPLATE_PRICE_MAX.toLocaleString('id-ID')}.`,
    };
  }
  return { valid: true, value: num };
}

export function compareVersions(a: string, b: string): number {
  const pa = String(a).split('.').map((part) => Number(part) || 0);
  const pb = String(b).split('.').map((part) => Number(part) || 0);
  const length = Math.max(pa.length, pb.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export type VersionGateLevel = 'ok' | 'warn' | 'block';

export interface VersionGate {
  level: VersionGateLevel;
  message: string;
}

/**
 * Gate versi deployment klien SEBELUM template diganti. Soft-guard untuk owner:
 * build lama tetap bisa menampilkan template lain, tetapi konten canvas/spatial
 * belum lengkap (<1.3.88) dan menu admin belum disaring (<1.3.90).
 */
export function checkTemplateVersionGate(
  deployedVersion: string | null | undefined,
  targetKey: string
): VersionGate {
  if (!deployedVersion) {
    return {
      level: 'warn',
      message: 'Versi deployment tidak terbaca. Cek Status Board sebelum mengganti template.',
    };
  }
  if (targetKey === SYSTEM_DEFAULT_TEMPLATE_ID) {
    return { level: 'ok', message: '' };
  }
  if (compareVersions(deployedVersion, TEMPLATE_CONTENT_PARITY_VERSION) < 0) {
    return {
      level: 'block',
      message:
        `Deployment v${deployedVersion} belum mendukung konten canvas/spatial ` +
        `(butuh ≥ v${TEMPLATE_CONTENT_PARITY_VERSION}). Deploy update dulu, ` +
        'lalu ulangi aktivasi.',
    };
  }
  if (compareVersions(deployedVersion, TEMPLATE_ADMIN_FILTER_VERSION) < 0) {
    return {
      level: 'warn',
      message:
        `Deployment v${deployedVersion} belum menyaring menu admin per template ` +
        `(baru sejak v${TEMPLATE_ADMIN_FILTER_VERSION}). Tampilan admin bisa terlihat ` +
        'penuh, tetapi konten tetap aman.',
    };
  }
  return { level: 'ok', message: '' };
}

/**
 * Tentukan aksi tanpa menulis apa pun.
 * - Sudah dimiliki & sudah aktif → noop.
 * - Sudah dimiliki, template lain → activate (gratis).
 * - Belum dimiliki → purchase (wajib harga).
 * - Mode "activate" untuk template yang belum dimiliki → error (cegah gratis).
 */
export function decideTemplateAction(
  state: TemplateState,
  templateKey: string,
  requestedMode: TemplateMode
): TemplateAction {
  if (!isKnownTemplateKey(templateKey)) {
    return {
      kind: 'error',
      message: `Template "${templateKey}" tidak dikenal. Key valid: ${TEMPLATES.map((t) => t.id).join(', ')}.`,
    };
  }

  const owned = state.owned.some((item) => item.templateId === templateKey);
  if (owned) {
    if (state.activeTemplateKey === templateKey) {
      return {
        kind: 'noop',
        message: `Template ${templateDisplayName(templateKey)} sudah aktif — tidak ada perubahan.`,
      };
    }
    return { kind: 'activate' };
  }

  if (requestedMode !== 'purchase') {
    return {
      kind: 'error',
      message:
        `Template ${templateDisplayName(templateKey)} belum dibeli. ` +
        'Catat pembelian dulu (Rp199.000) sebelum mengaktifkannya.',
    };
  }

  return { kind: 'purchase' };
}

/**
 * Baca keadaan template klien langsung dari D1-nya dengan invarian managed
 * service: tepat 1 baris `sites`, dan `CUSTOMER_SITE_ID` arsip wajib cocok.
 */
export async function readTemplateState(
  query: TemplateQuery,
  expectedSiteId = ''
): Promise<TemplateState> {
  const siteRows = await query(
    'SELECT id, name, active_template_key, created_at FROM sites'
  );

  if (siteRows.length !== 1) {
    throw new Error(
      `D1 klien berisi ${siteRows.length} baris sites (harus tepat 1). Tidak ada yang diubah — periksa database dulu.`
    );
  }

  const site = siteRows[0];
  const siteId = String(site.id || '');
  const wanted = expectedSiteId.trim();
  if (wanted && wanted !== siteId) {
    throw new Error(
      `CUSTOMER_SITE_ID arsip ("${wanted}") tidak sama dengan id baris sites di D1 ("${siteId}"). Arsip dan D1 tidak sinkron.`
    );
  }

  const entitlementRows = await query(
    `SELECT template_id, purchased_at, price, granted_by
       FROM site_template_entitlements
      WHERE site_id = ?
      ORDER BY purchased_at ASC`,
    [siteId]
  );

  const catalogRows = await query('SELECT COUNT(*) AS total FROM portfolio_templates');
  const catalogTotal = Number(catalogRows[0]?.total || 0);

  return {
    siteId,
    siteName: String(site.name || ''),
    activeTemplateKey: String(site.active_template_key || SYSTEM_DEFAULT_TEMPLATE_ID),
    siteCreatedAt: String(site.created_at || ''),
    owned: entitlementRows.map((row) => ({
      templateId: String(row.template_id || ''),
      purchasedAt: String(row.purchased_at || ''),
      price: Number(row.price || 0),
      grantedBy: row.granted_by == null ? null : String(row.granted_by),
    })),
    catalogReady: catalogTotal > 0,
  };
}

/**
 * Upsert katalog dari registry (bukan daftar manual) supaya template yang
 * dijual tidak pernah ketinggalan. Aman dijalankan berulang.
 */
export async function ensureTemplateCatalog(
  query: TemplateQuery,
  options: { price?: number } = {}
): Promise<void> {
  const priceCheck = validatePurchasePrice(options.price ?? DEFAULT_TEMPLATE_PRICE);
  const price = priceCheck.valid && typeof priceCheck.value === 'number'
    ? priceCheck.value
    : DEFAULT_TEMPLATE_PRICE;

  for (const template of TEMPLATES) {
    await query(
      `INSERT INTO portfolio_templates (id, name, description, price, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         price = excluded.price,
         is_active = 1,
         updated_at = datetime('now')`,
      [template.id, template.name, template.description, price]
    );
  }
}

export interface ApplyTemplateChangeInput {
  templateKey: string;
  /** Harga pembelian; wajib untuk template yang belum dimiliki. */
  price?: number;
  /** Id order owner, ditulis sebagai jejak di `granted_by`. */
  orderId?: string;
  grantedBy?: string;
  note?: string;
  /** Harga katalog yang ditulis ulang (ikut Harga Jual owner). */
  catalogPrice?: number;
}

export interface ApplyTemplateChangeResult {
  changed: boolean;
  entitlementCreated: boolean;
  previousKey: string;
  activeTemplateKey: string;
  auditWarning: string | null;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Tulis perubahan template ke D1 klien. TIDAK membuat order (itu tugas
 * pemanggil di D1 owner) dan TIDAK menyentuh arsip (itu tugas server portal).
 */
export async function applyTemplateChange(
  query: TemplateQuery,
  state: TemplateState,
  input: ApplyTemplateChangeInput
): Promise<ApplyTemplateChangeResult> {
  const templateKey = input.templateKey;
  const previousKey = state.activeTemplateKey;
  let entitlementCreated = false;
  let keyChanged = false;

  if (!isKnownTemplateKey(templateKey)) {
    throw new TemplateChangeError(
      `Template "${templateKey}" tidak dikenal.`,
      { entitlementCreated, keyChanged }
    );
  }

  const alreadyOwned = state.owned.some((item) => item.templateId === templateKey);

  try {
    // Katalog selalu diselaraskan (idempoten) — entitlement punya FK ke sini.
    await ensureTemplateCatalog(query, { price: input.catalogPrice });

    if (!alreadyOwned) {
      const priceCheck = validatePurchasePrice(input.price);
      if (!priceCheck.valid || typeof priceCheck.value !== 'number') {
        throw new Error(priceCheck.error || 'Harga pembelian tidak valid.');
      }

      const grantedBy = input.grantedBy
        || (input.orderId ? `portal:${input.orderId}` : 'owner-portal');

      await query(
        `INSERT OR IGNORE INTO site_template_entitlements
           (id, site_id, template_id, purchased_at, price, granted_by, created_at)
         VALUES (?, ?, ?, datetime('now'), ?, ?, datetime('now'))`,
        [newId('ent'), state.siteId, templateKey, priceCheck.value, grantedBy]
      );

      const verify = await query(
        `SELECT id FROM site_template_entitlements
          WHERE site_id = ? AND template_id = ? LIMIT 1`,
        [state.siteId, templateKey]
      );
      if (verify.length === 0) {
        throw new Error('Entitlement gagal tersimpan (verifikasi baca balik kosong).');
      }
      entitlementCreated = true;
    }

    if (previousKey !== templateKey) {
      await query(
        'UPDATE sites SET active_template_key = ?, updated_at = ? WHERE id = ?',
        [templateKey, new Date().toISOString(), state.siteId]
      );

      const after = await query(
        'SELECT active_template_key FROM sites WHERE id = ?',
        [state.siteId]
      );
      const actual = after[0]?.active_template_key;
      if (actual !== templateKey) {
        throw new Error(
          `Verifikasi gagal — nilai active_template_key di DB: ${actual == null ? '(null)' : String(actual)}.`
        );
      }
      keyChanged = true;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new TemplateChangeError(message, { entitlementCreated, keyChanged });
  }

  let auditWarning: string | null = null;
  if (keyChanged || entitlementCreated) {
    try {
      const metadata = JSON.stringify({
        templateKey,
        previousKey,
        price: input.price ?? null,
        orderId: input.orderId ?? null,
        note: input.note ?? null,
      });
      await query(
        `INSERT INTO audit_logs
           (id, site_id, user_id, action, entity_type, entity_id, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          newId('audit'),
          state.siteId,
          'owner-portal',
          entitlementCreated ? 'template_purchased' : 'template_activated',
          'template',
          templateKey,
          metadata,
        ]
      );
    } catch (error) {
      // Aktivasi sudah tersimpan; audit yang gagal tidak boleh membuat owner
      // mengira aktivasi gagal (dan mengulang pembelian).
      auditWarning = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    changed: keyChanged,
    entitlementCreated,
    previousKey,
    activeTemplateKey: templateKey,
    auditWarning,
  };
}
