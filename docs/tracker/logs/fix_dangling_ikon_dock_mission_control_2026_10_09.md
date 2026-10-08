# Log Perbaikan: 1 Dangling Ikon Dock `mission-control` (Widget Storage Stats)

**Tanggal:** 2026-10-09
**Pelapor:** Owner (screenshot widget status storage di menubar admin: kategori "Hard Skill & Dock Icons" tampil **MISMATCH — 1 dangling**)
**Jenis:** Perbaikan data D1 produksi (bukan perubahan kode template)
**Status:** ✅ Selesai & terverifikasi

---

## Gejala

Widget storage breakdown (`/api/admin/storage-stats` → `StorageBreakdown.tsx`) menampilkan:

- D1 database: 10 iconUrl dock (9 lokal + 1 absolut `/r2/…`)
- R2 bucket `assets/icons-library/`: **0 object**
- **1 dangling** → badge MISMATCH

## Investigasi (semua klaim diverifikasi langsung)

1. **Makna angka** dibaca dari kode: `route.ts` menghitung referensi D1 vs listing R2 per prefix; `dangling` = referensi D1 dengan `storagePath` di bawah prefix yang tidak ada di R2 (`categoryStats.ts:117-123`).
2. **Referensi tunggal bermasalah** ditemukan di D1 (`app_kv` row `content` & `content_default-site`, path `about.dockConfig.mission-control.iconUrl`):
   `/r2/assets/icons-library/1780861777693-icnsfile-914f0809e7265c1ecada715daf73500a-s7g02whs8p.webp`
3. **File sudah hilang selamanya** — bukan sekadar salah path:
   - R2: listing seluruh bucket (71 object) tidak memuat prefix `assets/icons-library/` sama sekali; pencarian id file nihil.
   - Repo: `public/assets/icons-library/` (19 file) tidak ada yang match.
   - Produksi: `GET /r2/assets/icons-library/1780861777693-…webp` → **HTTP 404** (ikon ini rusak/broken di site sejak file hilang).
4. **Entry adalah config mati (orphan)** — bukan ikon aktif:
   - Dock desktop hanya punya 5 app: projects, about, whatsapp, contact, notes (`OSDock.tsx:92-125`, `GlobalDock.tsx:53-97`). Tidak ada item `mission-control`.
   - Panel admin Dock (`DockConfigForm.tsx` `DEFAULT_DOCK_ITEMS`) juga hanya 5 id — entry `mission-control` **tidak bisa dilihat/diedit via UI**.
   - `mission-control` di kode hanya sebagai fitur Mission Control (shortcut/layout), bukan dock app.
5. **Asal-usul:** ikon diunggah ± Juni 2026 (timestamp `1780861777693`) lewat jalur proxy lama `/r2/…` yang sudah dihapus dari kode (lihat catatan `r2Storage.ts:189` — proxy `/r2/` pernah dibuang karena memperlambat LCP). Sisa URL mati di database; object R2-nya sendiri ikut lenyap (kemungkinan terhapus saat pembersihan/pindah pola penyimpanan).

## Perbaikan

Skrip sekali-pakai `scratch/fix-mission-control-dangling.ts` (gitignored):

- Backup nilai asli kedua row ke `scratch/backup-appkv-<key>-before-mc-fix.json` sebelum menulis.
- Guard assert: iconUrl harus persis berisi fragment id file yang dikenal; hasil edit wajib identik JSON dengan original-minus-key.
- Hapus key `about.dockConfig.mission-control` via **parameterized** `UPDATE app_kv SET value=? WHERE key=?`; verifikasi balik dari DB (key hilang, 1 row ter-update per baris).

Hasil: `content` 31.684 → 31.555 char; `content_default-site` 32.175 → 32.046 char (−129 char masing-masing).

**Tidak ada kode template yang diubah** — dock memang tidak pernah merender entry itu, jadi tampilan site tidak berubah sama sekali; yang hilang hanya peringatan MISMATCH.

## Verifikasi (anti-halusinasi)

| Cek | Hasil |
|---|---|
| Cross-check ulang semua iconUrl dock vs R2 (skrip inspeksi) | Tersisa 9 referensi, semuanya path lokal `/assets/icons-library/…` (dikecualikan dari hitungan R2 oleh `extractR2IconStoragePath`), nol referensi absolut `/r2/…` |
| Logika asli route (`buildCategory` + `extractR2IconStoragePath`, data live) | `d1={total:9,image:9}`, `r2={0}`, `orphans:0`, `dangling:0` → **HAS MISMATCH: false** |
| Cache | Hanya in-memory TTL 5–30 dtk (`contentService`) → perubahan terbaca sendiri, tanpa deploy |
| Kesehatan produksi | `/api/about` 200, `/api/projects` 200, homepage 200 |

## Catatan Lanjutan (opsional, bukan bagian fix)

- Ikon kustom `mission-control` **tidak bisa dipulihkan** (file asli hilang dari segala tempat) dan memang tidak ada dock app yang akan menampilkannya. Kalau suatu saat owner ingin app Mission Control di dock, itu fitur kode baru (butuh item dock + handler), bukan pemulihan data.
- 9 ikon dock lainnya sengaja lokal (`/assets/icons-library/` di `public/`) — kondisi normal, sudah diberi catatan oleh `describeCategory`.
- R2 bucket saat ini tanpa prefix `assets/icons-library/` sama sekali; upload ikon baru via admin akan kembali menuliskan object ke prefix itu (jalur `icons/route.ts` aktif).

## File Terkait (dibaca untuk investigasi, tidak diubah)

- `src/app/api/admin/storage-stats/route.ts` + `categoryStats.ts` (logika widget)
- `src/app/admin/desktop/status-popouts/StorageBreakdown.tsx` (render angka + badge)
- `src/components/os/core/OSDock.tsx`, `GlobalDock.tsx`, `utils/dockUtils.tsx` (bukti 5 item dock + fallback ikon)
- `src/app/admin/system/components/DockConfigForm.tsx` (bukti UI hanya mengenal 5 id)
- `src/lib/r2Storage.ts` (catatan sejarah hapus proxy `/r2/`)

## File Dimodifikasi

- D1 produksi `app_kv`: row `content` & `content_default-site` (hapus 1 key orphan `about.dockConfig.mission-control`)
- Backup lokal: `scratch/backup-appkv-content-before-mc-fix.json`, `scratch/backup-appkv-content_default-site-before-mc-fix.json`
