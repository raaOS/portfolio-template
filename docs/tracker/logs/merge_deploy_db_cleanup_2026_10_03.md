# Merge Cabang Rilis, Deploy Produksi & Pembersihan Database (v1.3.18)

**Tanggal:** 2026-10-03
**Status:** 🟢 Selesai (deploy produksi + `--apply` database sudah dijalankan; belum di-push ke GitHub)
**Versi template:** v1.3.18

## Ringkasan

Empat poin permintaan owner dieksekusi berurutan: (1) perbaikan 1 error ESLint yang memblokir commit, (2) commit pekerjaan AI lain di `main`, (3) merge `fix/security-audit-2026-09-29` ke `main`, (4) deploy ke Cloudflare produksi → **baru** pembersihan database `--apply`. Dua jawaban owner lebih dulu: *"perbaiki 1 error ESLint"* dan *"`client_access` → Hapus"*.

## 1. Perbaikan lint `ActivityLogPanel.tsx` (repo utama)

- **Gejala:** `react-hooks/set-state-in-effect` pada `src/app/admin/desktop/panels/ActivityLogPanel.tsx:38` — `void fetchLogs()` dipanggil sinkron dari `useEffect`, dan `fetchLogs` membuka dengan `setIsLoading(true)`. Ini satu-satunya error `npx eslint src` di repo utama sehingga pre-commit menolak commit apa pun.
- **Percobaan pertama (gagal):** memindahkan `setIsLoading(true)`/`setError('')` ke tombol Segarkan supaya semua `setState` di `fetchLogs` berada setelah `await`. Rule tetap menandai karena analisisnya konservatif: memanggil fungsi komponen yang berisi `setState` dari effect tetap dianggap sinkron.
- **Perbaikan final:** pemuatan awal dijadwalkan lewat `setTimeout(() => void fetchLogs(), 0)` + cleanup — **pola persis seperti `OrdersPanel.tsx:103`** yang memang sudah lolos lint. Perilaku tidak berubah (satu macrotask nanti), tombol Segarkan tetap memakai `fetchLogs` langsung.

## 2. Commit pekerjaan AI lain di `main` (`eb5bfeb`, 14 file, +579/−23)

Pekerjaan AI lain di repo utama belum tercatat di mana pun, jadi sekalian didokumentasikan:

- **Enam perbaikan keamanan alur order/billing** (Referrer-Policy `/orders/*`, timing-safe webhook, CSRF same-origin fallback, guard same-origin checkout, SSRF guard bukti bayar, audit trail cancel + upload bukti) — sudah ada di CHANGELOG/INDEX buatan mereka.
- **Batch kedua yang TIDAK mereka catat:** aplikasi **"Log Aktivitas"** (`ActivityLogPanel.tsx` + `registry.ts` + `WindowContentRenderer.tsx`) dan perombakan `GET /api/admin/audit-logs` (menggabungkan blob `app_kv` + tabel relasional `audit_logs`, dedup by id, sort desc, 50 entri, gagal baca tabel ditelan).
- **Dilengkapi AI sesi ini:**
  - `src/app/admin/system/activity-log/page.tsx` **baru** — pemeriksaan membuktikan `APP_ROUTE_MAP.activityLog` adalah **satu-satunya entri tanpa `page.tsx`** (semua rute admin lain punya), jadi deep-link ke `/admin/system/activity-log` pasti 404.
  - Perbaikan lint (bagian 1).
  - Catatan panel ditambahkan ke CHANGELOG `[1.3.18]` dan INDEX (baris *Tambahan batch kedua*).

## 3. Merge `fix/security-audit-2026-09-29` → `main` (`dc27edc`)

Repo utama sudah bersih (HEAD `eb5bfeb`, working tree hijau) sehingga merge dijalankan. **5 konflik**, semuanya diselesaikan sekali:

| Berkas | Penyelesaian |
|---|---|
| `CHANGELOG.md` | Kedua sisi punya entri `1.3.11` berbeda (audit 29 Sep vs hardening order 2 Okt). Entri milik `main` dinaikkan jadi **`[1.3.18]`** agar tidak ada dua entri bernomor sama, ditaruh di paling atas; entri cabang `1.3.12`–`1.3.17` dipertahankan. |
| `docs/tracker/INDEX_TRACKER.md` | Baris *Isi* entri 121 di `main` **terpotong** jadi `… (`​/projects`, `/about`, `/`... [truncated]` (2015 karakter vs 2509 di cabang) — dipulihkan dari versi cabang yang utuh. Entri `main` jadi **123**, entri cabang 123–127 digeser jadi **124–128**. |
| `src/app/api/billing/checkout/route.ts` | **Kedua perubahan dipertahankan**: guard same-origin (main) + rate limit diperketat 5 request/menit, blokir 10 menit (cabang). |
| `src/app/api/telegram/webhook/route.ts` | Dipilih `safeEqual()` milik cabang (`crypto.timingSafeEqual` + guard panjang), mengganti blok XOR manual buatan main. |
| `src/lib/services/orderService.ts` | `import { logActivity }` (main) + `r2Storage`/`BASE_PRICE` (cabang). `PLAN_BASE_PRICES` tidak lagi ada sejak v1.3.15 — diverifikasi `grep PLAN_BASE_PRICES\|constants/plans` di seluruh repo: **0 rujukan kode** (sisa hanya dokumen & arsip tracker). |

**Bug type-check yang muncul setelah merge (bukan dari kedua orang tua):** `npx tsc --noEmit` → 3 error TS2790 di `orderService.test.ts` (`delete process.env.NOTIFICATION_PROVIDER`). Penyebabnya `cloudflare-env.d.ts` (hasil `wrangler types`, **gitignored**, hanya ada di repo utama) mendeklarasikan `NOTIFICATION_PROVIDER` sebagai properti **wajib** — di worktree berkas itu tidak ada sehingga kedua cabang lolos. Diperbaiki dengan helper kecil `unsetEnv(name)` yang melempar cast, dipakai di 3 titik.

**Gate setelah merge:** `tsc` 0, `eslint src` 0, **114 file / 881 test PASS**, `release:audit` **62/62**, `release:sale-readiness` **13/13**, `pre-deploy` (termasuk audit kompatibilitas Worker, 478 file, 0 blocker) **EXIT 0**.

## 4. Deploy produksi

- **Gagal pertama:** `opennextjs-cloudflare deploy` → workerd `kj/filesystem-disk-win32.c++:773 failed: CreateDirectory: #5 Access is denied; path = miniflare-email-store`. Ini **insiden lingkungan yang sama** dengan yang tercatat di log `wallpaper_poster_fix_2026_09_28.md` (entry 121 INDEX): workerd hanya bisa membuat folder di dalam folder project.
- **Workaround sesuai runbook:** `TEMP`/`TMP` di-set sementara ke `<project>\node_modules\.cache\mftemp` selama `npm run deploy`, lalu dijalankan ulang.
- **Sukses:** Worker `portfolio-os-template` ter-deploy, **Version ID `dd3385e7-b758-47e0-9cb1-6b6a185f3d47`**, `https://portfolio-os-template.m4keitbetter.workers.dev`, 30 aset baru diunggah (898 sudah ada).
- **Smoke produksi** (`node scripts/release/smoke-production.js --url=https://makeitbetter.my.id`): **6/6 PASS** (`/api/health`, `/`, `/api/public/sites/demo-designer` + projects, HEAD `/r2/ffmpeg/ffmpeg-core.js` + `.wasm`).

## 5. Pembersihan database (`--apply`)

Urutan wajib "kode dulu, database belakangan" dipatuhi: deploy selesai → baru `--apply`.

```bash
npx tsx scripts/cloudflare/remove-plan-columns.ts          # dry-run, aman
npx tsx scripts/cloudflare/remove-plan-columns.ts --apply  # eksekusi
```

- **`DROP TABLE client_access` ditambahkan ke skrip** (keputusan owner: **Hapus**, tanpa ekspor → 4 baris email + hash pembeli hilang permanen).
- Dry-run sebelum apply: **6/6 `[ada]`** (`sites.plan`, `orders.plan`, `site_subscriptions`, `idx_site_subscriptions_site`, `client_password_resets`, `client_access`).
- **Hasil `--apply`: 6/6 `[ok]`.**
- **Verifikasi sesudah apply: 6/6 `[n/a]`** → *"Tidak ada yang perlu dibersihkan. Database sudah bersih."*
- **Smoke ulang setelah `--apply`: 6/6 PASS** — membuktikan kode yang tayang tidak lagi membaca kolom/tabel yang dihapus.
- `npm run cf:live-check` setelah apply: **D1 ok, R2 ok, live write guard confirmed**.

## 6. Pembersihan tambahan (jejak terakhir)

- Dua baris mock mati di `orderService.test.ts` (`existingClients check`, `insert client_access`) dihapus — urutan query `activateOrder` yang sebenarnya hanya `lock → INSERT sites → UPDATE orders → INSERT audit_logs` (+ update `expired` di jalur late), jadi kedua mock itu tidak pernah terpakai. Test file: **29/29 PASS**.
- Satu-satunya sisa kata `/client/login` di `src/` kini hanya **komentar** `MenuBar.tsx:40` yang menjelaskan penghapusan (bukan rute).

## File yang dimodifikasi (bertahap)

1. `src/app/admin/desktop/panels/ActivityLogPanel.tsx` — fix lint (commit `eb5bfeb`)
2. `src/app/admin/system/activity-log/page.tsx` — **baru** (commit `eb5bfeb`)
3. `CHANGELOG.md`, `docs/tracker/INDEX_TRACKER.md` — dokumentasi batch panel (commit `eb5bfeb`)
4. `CHANGELOG.md`, `docs/tracker/INDEX_TRACKER.md`, `checkout/route.ts`, `telegram/webhook/route.ts`, `orderService.ts`, `orderService.test.ts` — resolusi merge (commit `dc27edc`)
5. `scripts/cloudflare/remove-plan-columns.ts` — tambah `DROP TABLE client_access` (commit `fe002ad`)
6. `src/lib/services/orderService.test.ts` — hapus 2 mock mati (belum di-commit saat log ini ditulis)

## Handoff / Belum dikerjakan

- **Belum di-push ke GitHub** — `main` lokal `ahead 20` dari `origin/main`. Menunggu perintah owner (repo remote: `github.com/raaOS/portfolio-template`).
- **Cabang `fix/security-audit-2026-09-29` sudah tergabung** ke `main` (worktree `cosmic-rocket`); penghapusan cabang & worktree menunggu konfirmasi owner.
- Masih tertunda dari sesi sebelumnya: **cron harian Wrangler** (`wrangler.jsonc` tidak punya `crons`, jadi `sweepExpiredOrders`/backup masih manual) dan **pemindahan rahasia ke Worker secrets**.
- Panel "Log Aktivitas" **belum dilihat di browser** (membaca datanya butuh login admin; `.env.local` hanya berisi hash `ADMIN_PASSWORD_SCRYPT`).
