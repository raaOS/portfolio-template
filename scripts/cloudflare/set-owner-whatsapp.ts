/**
 * Set / ganti nomor WhatsApp owner di D1 OWNER (key `owner_whatsapp` di
 * `platform_settings`). Dipakai tombol "Chat Admin", "Bantuan WA (Terlanjur
 * Bayar)" di halaman order, dan wizard aktivasi R2 (`getOwnerWhatsapp`).
 *
 * Pemakaian:
 *   npx tsx scripts/cloudflare/set-owner-whatsapp.ts 08817472310
 *
 * Format diterima: 08xx / 628xx / +628xx — otomatis dinormalisasi ke 628xx.
 * TANPA flag apa pun script ini hanya menampilkan nilai saat ini (read-only).
 *
 * Catatan owner 2026-11-14: nomor 628817472310 SEMENTARA — akan diganti suatu
 * saat. Jalankan ulang script ini dengan nomor baru (tidak perlu deploy).
 */
import { loadProductEnv } from './product-env';
import { getCurrentD1DatabaseId, queryD1ForDatabase } from './backup-common';

function normalize(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  if (!/^62\d{8,13}$/.test(digits)) {
    return { ok: false, error: `Nomor tidak valid setelah normalisasi: "${digits}"` };
  }
  return { ok: true, value: digits };
}

async function main() {
  loadProductEnv();
  const databaseId = getCurrentD1DatabaseId();
  if (!databaseId) {
    console.error('✗ Database D1 owner tidak ditemukan di env (CLOUDFLARE_D1_DATABASE_ID).');
    process.exit(1);
  }

  const raw = process.argv[2];
  if (!raw) {
    // Read-only: tampilkan nilai saat ini.
    const rows = await queryD1ForDatabase<{ value: string }>(
      databaseId,
      `SELECT value FROM platform_settings WHERE key = 'owner_whatsapp' LIMIT 1`
    );
    console.log(
      rows.length > 0
        ? `Nomor WA owner saat ini: ${rows[0].value}`
        : 'owner_whatsapp belum diisi di platform_settings.'
    );
    return;
  }

  const check = normalize(raw);
  if (!check.ok) {
    console.error(`✗ ${check.error}`);
    process.exit(1);
  }

  const now = new Date().toISOString();
  await queryD1ForDatabase(
    databaseId,
    `INSERT INTO platform_settings (key, value, updated_at)
     VALUES ('owner_whatsapp', ?, ?)
     ON CONFLICT(key)
     DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [JSON.stringify({ number: check.value, updatedAt: now }), now]
  );

  // Verifikasi baca balik — jangan klaim sukses tanpa bukti.
  const rows = await queryD1ForDatabase<{ value: string }>(
    databaseId,
    `SELECT value FROM platform_settings WHERE key = 'owner_whatsapp' LIMIT 1`
  );
  const written = rows[0]?.value ? (JSON.parse(rows[0].value) as { number?: string }) : null;
  if (written?.number === check.value) {
    console.log(`✓ owner_whatsapp terpasang: ${check.value} (terverifikasi baca balik).`);
  } else {
    console.error(`✗ Verifikasi gagal — nilai di DB: ${rows[0]?.value}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`✗ Gagal: ${(err as Error).message}`);
  process.exit(1);
});
