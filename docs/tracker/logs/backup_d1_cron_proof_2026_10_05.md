# Log: Bukti Fire Cron + Fitur Backup D1 Harian (v1.3.22)

**Tanggal:** 2026-10-05
**Status:** 🟢 Selesai — gerbang hijau (tsc 0, eslint 0, **118 file / 914 test PASS**, `release:audit` **59/59**, `release:sale-readiness` **12/12**)
**Trigger:** Perintah owner: _"fitur Backup via cron dan bukti cron benar-benar jalan jam 01:00"_.

---

## Bagian 1 — Bukti cron benar-benar menembak

### Temuan awal (meluruskan catatan lama)

- Cek read-only `GET .../workers/scripts/portfolio-os-template/schedules`: jadwal uji **`* * * * *` ternyata masih terpasang di server** sejak deploy 3 Okt (`created_on 2026-10-03T19:04:59Z`) — padahal log `cron_worker_secrets_2026_10_03.md:95` menulis "sudah dilepas". Yang dilepas hanya `wrangler.jsonc` lokal, pendaftaran server tidak pernah dikembalikan. Konsekuensinya: fire harian `0 18 * * *` **mustahil terjadi** pada 2026-10-04 18:00 UTC karena jadwal terdaftar saat itu menitan.
- Guard D1 `platform_settings.billing_expire_sweep_at` bergerak tiap **tepat 10 menit** (`1791166980635` → `1791167580639`) = pola sweep terakhir, **bukan** sidik jari fire harian → tidak bisa dipakai sebagai bukti tunggal.
- Endpoint `GET .../workers/observability/cron_events` → **HTTP 403** (tidak dipakai).

### Uji mekanisme (bukti kuat, 2026-10-05 09:38–09:41 WIB)

1. `npx wrangler triggers deploy` (setelah `wrangler.jsonc` diset `* * * * *`) → output persis:
   `Deployed portfolio-os-template triggers (3.87 sec)` + `schedule: * * * * *`.
2. `npx wrangler tail portfolio-os-template --format pretty` 215 detik → **3 event + 3 log endpoint**:
   ```
   "* * * * *" @ 05/10/2026, 09:39:21 - Ok
     (log) [cron] POST /api/cron/daily -> 200
   "* * * * *" @ 05/10/2026, 09:40:21 - Ok
     (log) [cron] POST /api/cron/daily -> 200
   "* * * * *" @ 05/10/2026, 09:41:21 - Ok
     (log) [cron] POST /api/cron/daily -> 200
   ```
   (Raw tersimpan: `%TEMP%\opencode\cron-tail-proof.txt`.)
3. **Jadwal harian dikembalikan:** `wrangler.jsonc` → `0 18 * * *`, `git diff` kosong, `triggers deploy` ulang → `schedule: 0 18 * * *` + verifikasi GET schedules `0 18 * * *` (created `2026-10-05T02:42:36Z`).

**Kesimpulan:** rantai **scheduler Cloudflare → handler `scheduled` → service binding → `POST /api/cron/daily` → `sweepExpiredOrders()` → tulis D1** terbukti jalan di produksi; jadwal harian 01:00 WIB terpasang & terverifikasi API. Koreksi permanen dicatat di `cron_worker_secrets_2026_10_03.md` (bagian Koreksi 2026-10-05).

## Bagian 2 — Fitur Backup D1 (cron + panel admin)

### Perilaku

- **Otomatis 01:00 WIB** (ikut cron `0 18 * * *` di `/api/cron/daily`, setelah sweep order): seluruh tabel D1 di-snapshot jadi 1 file JSON → R2 prefix `sites/{siteId}/backups/d1/<ISO>.json`. Guard idempoten: backup terbaru < 20 jam → dilewati; kegagalan backup **tidak menggagalkan run cron** (try/catch terpisah).
- **Retensi 7 backup terbaru** (otomatis hapus yang lebih lama).
- **Panel admin** `Sistem & Tampilan → Backup Database` (`/admin/system/backup`): tombol **Backup Sekarang** (admin + CSRF), daftar backup + **Unduh**, info jadwal 01:00 WIB, peringatan kalau env D1/R2 belum lengkap.
- Daftar tabel **dinamis dari `sqlite_master`** — sengaja tidak memakai `DEFAULT_D1_BACKUP_TABLES` CLI yang basi (masih memuat `client_access` yang DROP; belum `site_users`/`orders`/`platform_settings`). Format file = format CLI `D1BackupFile` → tetap kompatibel tool restore.

### File

| Baru (7)                                                                                                                          | Ubah (4)                                                             |
| --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `src/lib/services/d1BackupService.ts` (inti: `createD1Backup`, `listD1Backups`, `runDailyBackup`, `pickBackupKeysToDelete` murni) | `src/app/api/cron/daily/route.ts` (panggil backup, try/catch)        |
| `src/app/api/admin/backup/route.ts` (GET list / POST backup-now, `validateAdminRequest`)                                          | `src/app/api/cron/daily/route.test.ts` (+2 test)                     |
| `src/app/api/admin/backup/download/route.ts` (validasi key ketat, stream)                                                         | `src/app/admin/desktop/registry.ts` (app `backup` + `APP_ROUTE_MAP`) |
| `src/app/admin/desktop/panels/BackupPanel.tsx`                                                                                    | `src/app/admin/desktop/WindowContentRenderer.tsx` (`PANEL_MAP`)      |
| `src/app/admin/system/backup/page.tsx`                                                                                            |                                                                      |
| `src/app/api/admin/backup/__tests__/route.test.ts` (13 test)                                                                      |                                                                      |
| `src/lib/services/__tests__/d1BackupService.test.ts` (4 test)                                                                     |                                                                      |

### Verifikasi

- `tsc --noEmit` 0 · `eslint src` 0 (781 file) · `npm test` **118 file / 914 test PASS** (17 test baru) · `prettier --check` 7/7 file baru PASS · `release:audit` **59/59** · `release:sale-readiness` **12/12**.
- Review manual: guard retensi tidak menghapus saat gagal, validasi key download (prefix site + `.json` + tanpa `..`), respons cron tidak berubah.

## Sisa / Lanjutan

- **Belum diuji live:** backup pertama baru jalan pada fire cron berikutnya (01:00 WIB) setelah deploy — verifikasi besok: objek baru di prefix `sites/{siteId}/backups/d1/` + tampil di panel.
- CLI `scripts/cloudflare/backup-common.ts` (`DEFAULT_D1_BACKUP_TABLES`) **tidak diubah** (perubahan perilaku script lama = butuh izin owner, aturan Ponytail AGENTS.md §0) — jalur runtime sudah tidak bergantung padanya. → **Diperbarui: izin owner diberikan 2026-10-05, lihat bagian Tambahan di bawah.**
- Restore file backup (dari format `D1BackupFile`) masih lewat tooling CLI `restore-d1.ts` — belum ada tombol "Restore" di panel (belum ada permintaan).

## Tambahan 2026-10-05 — Daftar Tabel CLI Disamakan (v1.3.23, atas izin owner)

Owner menjawab _"lakukan perubahan di opsi ke 2"_ → perubahan perilaku script lama kini sah.

**Diubah (2 file):**

1. `scripts/cloudflare/backup-common.ts` — `DEFAULT_D1_BACKUP_TABLES` **dan** `RESTORE_TABLE_ORDER` (pasangan yang harus sinkron) → **18 tabel** gabungan `SHARED_SCHEMA_QUERIES` + `D1_SCHEMA_QUERIES`; `client_access` (sudah `DROP TABLE`) dihapus.
2. `scripts/cloudflare/restore-d1.ts` — `bootstrapTarget()` kini **juga menjalankan `SHARED_SCHEMA_QUERIES`** (import baru, semua `IF NOT EXISTS`) setelah `D1_SCHEMA_QUERIES`. _Kenapa wajib:_ tanpa ini, backup baru berisi `site_users`/`site_settings`/`rate_limits`/`portfolio_templates`/`site_template_entitlements` akan membuat `DELETE FROM` gagal di target staging yang hanya dibuat dari `D1_SCHEMA_QUERIES` → restore putus. Tabel yang sudah ada (`sites`/`projects` buatan D1) dibiarkan karena `IF NOT EXISTS` — perilaku lama untuk tabel gawean D1 tidak berubah.

**Caller diverifikasi sebelum ubah:** `DEFAULT_D1_BACKUP_TABLES` hanya dipakai `parseTableList` → `backup-d1.ts`; `RESTORE_TABLE_ORDER` hanya `restore-d1.ts:94` (difilter ke tabel yang ada di backup → aman).

**Verifikasi nyata (bukan hanya unit test):**

- `npm run backup:d1 -- --dry-run` → **Tables 18, Rows 77, missing kosong**, tanpa `client_access`; ada `site_users` 1, `orders` 12, `platform_settings` 2 (semua ikut terhitung).
- Backup nyata ke folder lokal → `restore:d1` dry-run (tanpa `--apply`) → **validasi 18/18 tabel cocok** (`target currently X` = `incoming X`); folder backup verifikasi dihapus setelahnya; `git status` kembali hanya 2 file.
- Gerbang penuh: `tsc --noEmit` 0 · `eslint src` 0 · `npm test` **118 file / 914 test PASS** · `release:audit` **59/59** · `release:sale-readiness` **12/12**.
- Prettier: `backup-common.ts` di-`--write` (gagalnya karena perubahan kita); `restore-d1.ts` **gagal pra-ada** (sudah gagal di HEAD) → sengaja tidak direformat (aturan baseline: jangan reformat massal).

**Di luar scope (dicatat apa adanya):** `seed-restore-drill-project.ts` masih `INSERT INTO client_access` — skrip drill lama itu sudah rusak sejak tabel di-DROP (bukan akibat perubahan ini); `audit-restore-integrity.ts` punya daftar `siteScopedTables` sendiri yang masih memuat `client_access` (berhasil tanpa error karena tabel tidak ada di backup → 0 baris).
