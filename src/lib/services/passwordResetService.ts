/**
 * Password Reset Service — Lupa password lewat email (link reset sekali pakai).
 *
 * Desain keamanan (audit login 2026-10-16, tracker #168):
 * - Token acak 32 byte, disimpan TER-HASH (SHA-256) di app_kv `passwordResets`
 *   → kebocoran baris database tidak serta-merta membuka akun.
 * - Kadaluarsa 30 menit, sekali pakai (dihapus pada verifikasi pertama),
 *   permintaan baru membatalkan token lama milik user yang sama.
 * - Respons ke layar TIDAK PERNAH membedakan "email terdaftar" vs tidak
 *   (anti email-enumeration) — keputusan pesan ada di route forgot-password.
 * - Setiap perubahan password menulis tanda `securityNotBefore` (app_kv);
 *   guard menolak sesi login yang terbit SEBELUM tanda itu. Diperlukan karena
 *   cookie JWT stateless (TTL 2 jam) tidak bisa dihapus dari sisi server.
 *
 * Pengiriman email memakai provider yang sama dengan struk pesanan
 * (NOTIFICATION_PROVIDER / NOTIFICATION_API_KEY / NOTIFICATION_DEFAULT_FROM).
 * Fitur OTOMATIS MATI (pesan jujur "belum aktif — hubungi owner") bila
 * provider belum diisi: deployment klien tanpa kunci email mendapat jalur
 * itu secara otomatis, tanpa perubahan pipeline deploy.
 *
 * @module services/passwordResetService
 */
import crypto from 'crypto';
import { queryD1 } from '@/crud/shared/db/connection';
import { db } from '@/lib/database';
import { cleanEnvVar } from '@/lib/utils/env';
import { getPublicBaseUrl } from '@/lib/constants';
import { createScryptPasswordRecord } from '@/crud/shared/auth/password';

const MIN_PASSWORD_LENGTH = 8;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const NOTBEFORE_CACHE_TTL_MS = 60 * 1000;
const NOTBEFORE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

interface ResetTokenRecord {
  userId: string;
  expiresAt: number;
}

export type ResetPasswordResult =
  | { success: true }
  | { success: false; error: string; status: number };

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Buat + simpan token reset untuk satu user.
 * Token mentah hanya dikembalikan lewat nilai kembalian (untuk email) —
 * yang tersimpan di database hanyalah hash-nya.
 */
export async function storeResetToken(userId: string): Promise<string | null> {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashResetToken(token);
  const now = Date.now();

  const result = await db.ref('passwordResets').transaction((store: unknown) => {
    const records =
      store && typeof store === 'object' && !Array.isArray(store)
        ? (store as Record<string, ResetTokenRecord>)
        : {};
    const next: Record<string, ResetTokenRecord> = {};
    for (const [key, record] of Object.entries(records)) {
      // Buang yang kadaluarsa + token lama milik user yang sama
      // (permintaan terbaru menang — tautan lama mati begitu minta ulang).
      if (record.expiresAt > now && record.userId !== userId) {
        next[key] = record;
      }
    }
    next[tokenHash] = { userId, expiresAt: now + RESET_TOKEN_TTL_MS };
    return next;
  });

  // Transaksi gagal men-commit (CAS sibuk, database.ts:272) = token TIDAK
  // tersimpan. Jangan kirim email berisi tautan yang pasti mati.
  if (!result.committed) {
    console.error('[PasswordReset] Gagal menyimpan token (transaksi CAS sibuk) — email tidak dikirim.');
    return null;
  }

  return token;
}

/**
 * Konsumsi token (sekali pakai). Transaksi CAS menjamin di tengah
 * percobaan serentak hanya satu yang mendapat userId.
 */
export async function consumeResetToken(token: string): Promise<{ userId: string } | null> {
  const tokenHash = hashResetToken(token);
  let found: { userId: string } | null = null;

  await db.ref('passwordResets').transaction((store: unknown) => {
    if (!store || typeof store !== 'object' || Array.isArray(store)) return undefined;
    const records = store as Record<string, ResetTokenRecord>;
    const record = records[tokenHash];
    if (!record || Date.now() > record.expiresAt) return undefined; // tidak menulis
    found = { userId: record.userId };
    const next = { ...records };
    delete next[tokenHash]; // sekali pakai
    return next;
  });

  return found;
}

// ---------------------------------------------------------------------------
// Pencabutan sesi lama (securityNotBefore)
// ---------------------------------------------------------------------------

let notBeforeCache: { fetchedAt: number; map: Record<string, number> } | null = null;

/**
 * Tandai "semua sesi yang terbit sebelum saat ini tidak berlaku lagi".
 * Dipanggil setelah password berhasil diganti (reset lupa-password
 * maupun ganti-password mandiri). Best-effort: kegagalan tulis tidak
 * menggagalkan perubahan password yang sudah berhasil.
 */
export async function setSessionNotBefore(userId: string): Promise<void> {
  try {
    const now = Date.now();
    await db.ref('securityNotBefore').transaction((store: unknown) => {
      const map =
        store && typeof store === 'object' && !Array.isArray(store)
          ? (store as Record<string, number>)
          : {};
      const next: Record<string, number> = {};
      for (const [key, value] of Object.entries(map)) {
        if (now - value < NOTBEFORE_RETENTION_MS) next[key] = value;
      }
      next[userId] = now;
      return next;
    });
    notBeforeCache = null; // cache isolate ini basi
  } catch (error) {
    console.error('[Security] securityNotBefore gagal ditulis (diabaikan):', error);
  }
}

/**
 * Ambil tanda pencabutan untuk satu user (null = tidak ada pencabutan).
 * Dibaca lewat cache 60 detik agar guard tidak menambah panggilan D1
 * di setiap request admin.
 */
export async function getSessionNotBefore(userId: string): Promise<number | null> {
  try {
    if (!notBeforeCache || Date.now() - notBeforeCache.fetchedAt > NOTBEFORE_CACHE_TTL_MS) {
      const rows = await queryD1<{ value: string }>(
        `SELECT value FROM app_kv WHERE key = 'securityNotBefore' LIMIT 1`,
        []
      );
      let map: Record<string, number> = {};
      if (rows[0]?.value) {
        try {
          const parsed = JSON.parse(rows[0].value);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) map = parsed;
        } catch {
          map = {};
        }
      }
      notBeforeCache = { fetchedAt: Date.now(), map };
    }
    return notBeforeCache.map[userId] ?? null;
  } catch (error) {
    // Fail-open terbatas (maks. 60 detik): ketersediaan login lebih penting,
    // dan paparan tetap dibatasi TTL JWT (2 jam) seperti sebelum fitur ini ada.
    console.error('[Security] securityNotBefore gagal dibaca (diabaikan):', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

export function isEmailProviderConfigured(): boolean {
  const provider = (cleanEnvVar('NOTIFICATION_PROVIDER') || '').toLowerCase();
  if (provider !== 'resend') return false;
  return Boolean(cleanEnvVar('NOTIFICATION_API_KEY') && cleanEnvVar('NOTIFICATION_DEFAULT_FROM'));
}

async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  if (!isEmailProviderConfigured()) return false;

  const apiKey = cleanEnvVar('NOTIFICATION_API_KEY')!;
  const from = cleanEnvVar('NOTIFICATION_DEFAULT_FROM')!;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: 'Atur Ulang Password Admin',
        text: [
          'Halo,',
          '',
          'Anda meminta tautan untuk mengatur ulang password admin.',
          'Buka tautan di bawah untuk membuat password baru:',
          '',
          resetUrl,
          '',
          `Tautan berlaku 30 menit dan hanya bisa dipakai satu kali.`,
          '',
          'Jika Anda tidak meminta ini, abaikan email ini — tidak ada yang',
          'berubah pada akun Anda sampai tautan di atas dibuka.',
        ].join('\n'),
      }),
    });
    return res.ok;
  } catch (error) {
    // Jangan pernah mencatat token — hanya URL asal & kegagalan.
    console.error('[PasswordReset] Kirim email gagal:', error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Alur utama
// ---------------------------------------------------------------------------

/**
 * Proses permintaan reset. HASILNYA TIDAK BOLEH ditampilkan berbeda ke
 * layar untuk email terdaftar vs tidak (pemilik keputusan pesan: route).
 */
export async function requestPasswordReset(
  siteId: string,
  email: string
): Promise<{ emailSent: boolean }> {
  const rows = await queryD1<{ id: string }>(
    `SELECT id FROM site_users WHERE site_id = ? AND email = ? LIMIT 1`,
    [siteId, email]
  );
  const user = rows[0];
  if (!user) return { emailSent: false };

  const token = await storeResetToken(user.id);
  if (!token) return { emailSent: false }; // gagal simpan → jangan kirim tautan mati

  const resetUrl = `${getPublicBaseUrl()}/admin/reset-password?token=${encodeURIComponent(token)}`;
  const emailSent = await sendPasswordResetEmail(email, resetUrl);
  return { emailSent };
}

/**
 * Ganti password berdasarkan token reset: verifikasi → tulis scrypt baru →
 * cabut semua sesi lama.
 */
export async function resetPasswordWithToken(
  siteId: string,
  token: string,
  newPassword: string
): Promise<ResetPasswordResult> {
  if (!token || typeof token !== 'string') {
    return {
      success: false,
      error: 'Tautan tidak valid atau sudah kedaluwarsa. Minta tautan baru.',
      status: 400,
    };
  }

  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      success: false,
      error: `Password baru minimal ${MIN_PASSWORD_LENGTH} karakter`,
      status: 400,
    };
  }

  const consumed = await consumeResetToken(token);
  if (!consumed) {
    return {
      success: false,
      error: 'Tautan tidak valid atau sudah kedaluwarsa. Minta tautan baru.',
      status: 400,
    };
  }

  const rows = await queryD1<{ id: string }>(
    `SELECT id FROM site_users WHERE site_id = ? AND id = ? LIMIT 1`,
    [siteId, consumed.userId]
  );
  if (!rows[0]) {
    return { success: false, error: 'Akun tidak ditemukan', status: 404 };
  }

  // Selalu tulis record scrypt segar dengan salt baru (samakan dengan
  // jalur ganti-password mandiri).
  const record = createScryptPasswordRecord(newPassword);

  await queryD1(
    `UPDATE site_users
     SET password_hash = ?, password_salt = ?, password_algorithm = 'scrypt'
     WHERE id = ?`,
    [record.passwordHash, record.passwordSalt || '', consumed.userId]
  );

  // Cabut semua sesi login lama — cookie tidak bisa dihapus dari sisi
  // server, jadi guard membandingkan waktu terbit JWT dengan tanda ini.
  await setSessionNotBefore(consumed.userId);

  return { success: true };
}
