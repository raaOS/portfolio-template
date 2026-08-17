/**
 * Service Konfigurasi Pembayaran Platform
 * @module paymentConfigService
 *
 * Menyimpan dan membaca konfigurasi metode pembayaran (QRIS, bank transfer)
 * dari tabel D1 `platform_settings` dengan key `payment_config`.
 * Mendukung Multi-QRIS (QRIS 1 / Utama, QRIS 2 / Cadangan).
 */

import { queryD1 } from '@/lib/cloudflareD1';
import { maskQRISPayload, normalizeQRISPayload, validateStaticMerchantQRIS } from '@/lib/billing/qris';

export interface QRISAccount {
  id: string;
  label: string;
  imageUrl: string;
  staticPayload: string;
  isActive: boolean;
}

export interface PaymentConfig {
  /** URL gambar QRIS statis di R2 (legacy / akun 1) */
  qrisImageUrl: string;
  /** Payload QRIS statis merchant hasil decode dari aplikasi resmi/operator (legacy / akun 1) */
  qrisStaticPayload: string;
  /** Daftar akun QRIS statis/dinamis (Multi-QRIS) */
  qrisAccounts: QRISAccount[];
  /** Aktifkan QRIS dinamis nominal order */
  qrisDynamicEnabled: boolean;
  /** Tambahkan kode unik kecil ke nominal order */
  qrisUniqueAmountEnabled: boolean;
  /** Batas kode unik nominal order */
  qrisUniqueAmountMaxOffset: number;
  /** Nama bank tujuan transfer (misal: BCA, BRI) */
  bankName: string;
  /** Nomor rekening bank */
  bankAccountNumber: string;
  /** Nama pemilik rekening */
  bankAccountName: string;
  /** Instruksi tambahan pembayaran (opsional) */
  paymentInstructions: string;
  /** Jam operasional verifikasi manual (misal: 08:00 – 22:00 WIB) */
  verificationHours: string;
  /** Nomor WhatsApp admin untuk kontak bantuan */
  adminWhatsapp: string;
  /** Apakah penerimaan pembayaran aktif */
  isActive: boolean;
}

const SETTINGS_KEY = 'payment_config';

const DEFAULT_CONFIG: PaymentConfig = {
  qrisImageUrl: '',
  qrisStaticPayload: '',
  qrisAccounts: [
    {
      id: 'qris-1',
      label: 'QRIS 1 (Utama)',
      imageUrl: '',
      staticPayload: '',
      isActive: true,
    },
  ],
  qrisDynamicEnabled: false,
  qrisUniqueAmountEnabled: true,
  qrisUniqueAmountMaxOffset: 999,
  bankName: '',
  bankAccountNumber: '',
  bankAccountName: '',
  paymentInstructions: 'Transfer tepat sesuai nominal tagihan.',
  verificationHours: '08:00 – 22:00 WIB (maks. 1x24 jam)',
  adminWhatsapp: '',
  isActive: false,
};

function normalizeConfig(config: PaymentConfig): PaymentConfig {
  const maxOffset = Number(config.qrisUniqueAmountMaxOffset);

  let accounts = Array.isArray(config.qrisAccounts) ? config.qrisAccounts : [];

  if (accounts.length === 0) {
    accounts = [
      {
        id: 'qris-1',
        label: 'QRIS 1 (Utama)',
        imageUrl: config.qrisImageUrl || '',
        staticPayload: config.qrisStaticPayload || '',
        isActive: true,
      },
    ];
  }

  const normalizedAccounts: QRISAccount[] = accounts.map((acc, index) => ({
    id: acc.id || `qris-${index + 1}`,
    label: acc.label || `QRIS ${index + 1}`,
    imageUrl: acc.imageUrl || '',
    staticPayload: normalizeQRISPayload(acc.staticPayload || ''),
    isActive: acc.isActive ?? true,
  }));

  const primaryAccount = normalizedAccounts[0];

  return {
    ...config,
    qrisImageUrl: primaryAccount?.imageUrl || config.qrisImageUrl || '',
    qrisStaticPayload: primaryAccount?.staticPayload || config.qrisStaticPayload || '',
    qrisAccounts: normalizedAccounts,
    qrisDynamicEnabled: Boolean(config.qrisDynamicEnabled),
    qrisUniqueAmountEnabled: Boolean(config.qrisUniqueAmountEnabled),
    qrisUniqueAmountMaxOffset:
      Number.isInteger(maxOffset) && maxOffset >= 1 && maxOffset <= 9999 ? maxOffset : 999,
    isActive: Boolean(config.isActive),
  };
}

export function validatePaymentConfig(config: PaymentConfig): { valid: boolean; error?: string } {
  if (config.qrisDynamicEnabled) {
    const activeAccounts = config.qrisAccounts.filter((acc) => acc.isActive);
    for (const acc of activeAccounts) {
      if (!acc.staticPayload) {
        return {
          valid: false,
          error: `${acc.label}: Payload QRIS statis belum diisi`,
        };
      }
      const validation = validateStaticMerchantQRIS(acc.staticPayload);
      if (!validation.valid) {
        return {
          valid: false,
          error: `${acc.label}: ${validation.errors.join('; ')}`,
        };
      }
    }
  }

  if (config.qrisUniqueAmountEnabled && config.qrisUniqueAmountMaxOffset < 1) {
    return { valid: false, error: 'Kode unik nominal harus minimal 1' };
  }

  return { valid: true };
}

/**
 * Membaca konfigurasi pembayaran dari D1.
 * Mengembalikan default config jika belum pernah disimpan.
 */
export async function getPaymentConfig(): Promise<PaymentConfig> {
  try {
    const rows = await queryD1<{ value: string }>(
      'SELECT value FROM platform_settings WHERE key = ?',
      [SETTINGS_KEY]
    );

    if (rows.length === 0 || !rows[0].value) {
      return normalizeConfig({ ...DEFAULT_CONFIG });
    }

    const parsed = JSON.parse(rows[0].value) as Partial<PaymentConfig>;
    return normalizeConfig({ ...DEFAULT_CONFIG, ...parsed });
  } catch (err) {
    console.warn('[paymentConfigService] Failed to read config, returning defaults:', err);
    return normalizeConfig({ ...DEFAULT_CONFIG });
  }
}

/**
 * Menyimpan atau memperbarui konfigurasi pembayaran ke D1.
 */
export async function updatePaymentConfig(
  config: Partial<PaymentConfig>
): Promise<{ success: boolean; error?: string }> {
  try {
    const current = await getPaymentConfig();
    const merged = normalizeConfig({ ...current, ...config });
    const validation = validatePaymentConfig(merged);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const now = new Date().toISOString();

    await queryD1(
      `INSERT INTO platform_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key)
       DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [SETTINGS_KEY, JSON.stringify(merged), now]
    );

    return { success: true };
  } catch (err) {
    console.error('[paymentConfigService] Failed to save config:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gagal menyimpan konfigurasi',
    };
  }
}

/**
 * Membaca info pembayaran publik (tanpa data sensitif admin).
 * Dipakai oleh halaman checkout dan order detail.
 */
export async function getPublicPaymentInfo(): Promise<{
  qrisImageUrl: string;
  qrisDynamicEnabled: boolean;
  qrisAccounts: Array<{
    id: string;
    label: string;
    imageUrl: string;
    isActive: boolean;
    hasDynamicPayload: boolean;
  }>;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  paymentInstructions: string;
  verificationHours: string;
  adminWhatsapp: string;
  isActive: boolean;
}> {
  const config = await getPaymentConfig();
  const publicAccounts = config.qrisAccounts.map((acc) => ({
    id: acc.id,
    label: acc.label,
    imageUrl: acc.imageUrl,
    isActive: acc.isActive,
    hasDynamicPayload: config.qrisDynamicEnabled && Boolean(acc.staticPayload),
  }));

  return {
    qrisImageUrl: config.qrisImageUrl,
    qrisDynamicEnabled:
      config.qrisDynamicEnabled && config.qrisAccounts.some((a) => a.isActive && a.staticPayload),
    qrisAccounts: publicAccounts,
    bankName: config.bankName,
    bankAccountNumber: config.bankAccountNumber,
    bankAccountName: config.bankAccountName,
    paymentInstructions: config.paymentInstructions,
    verificationHours: config.verificationHours,
    adminWhatsapp: config.adminWhatsapp,
    isActive: config.isActive,
  };
}

export async function getAdminPaymentConfig(): Promise<
  PaymentConfig & {
    qrisStaticPayloadMasked: string;
    qrisAccountsMasked: Array<QRISAccount & { payloadMasked: string }>;
  }
> {
  const config = await getPaymentConfig();
  return {
    ...config,
    qrisStaticPayloadMasked: maskQRISPayload(config.qrisStaticPayload),
    qrisAccountsMasked: config.qrisAccounts.map((acc) => ({
      ...acc,
      payloadMasked: maskQRISPayload(acc.staticPayload),
    })),
  };
}
