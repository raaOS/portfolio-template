# Perbaikan Launcher `PENGELOLA_KLIEN.bat` — 2026-10-26

**Status:** 🟢 Selesai & teruji
**Pemicu:** Owner melaporkan launcher "tidak bisa dibuka" dan "jendela tertutup saat mengetik `y`". Setelah diperbaiki agent lain (cek `tsx` + `cmd /c`), owner curiga fitur launcher hilang karena pertanyaan `Ok to proceed? (y)` dan `Press any key to continue` tidak muncul lagi.

## Klarifikasi penting

Kedua teks itu **bukan fitur** yang sengaja dibuat:

- `Ok to proceed? (y)` = pertanyaan bawaan **npx** saat `tsx` tidak ditemukan (menawarkan unduh dari internet).
- `Press any key to continue` = perintah **`pause` bawaan Windows** yang hanya muncul setelah server gagal/berhenti.

Hilangnya keduanya adalah **tanda masalahnya sudah beres**, bukan fitur yang terhapus.

## Akar masalah yang ditemukan

1. `npx tsx` membuat launcher bergantung pada prompt unduhan npx. Jika unduhan/path gagal, server tidak pernah menyala.
2. Dua `&` tidak di-escape (baris `title` dan judul `echo`) → CMD mencetak
   `'PORTAL' is not recognized as an internal or external command` dan judul terpotong.
3. Tidak ada `cd` ke folder skrip → gagal bila dibuka lewat shortcut/folder lain.
4. `pause` biasa + jendela langsung tutup membuat pesan error tidak sempat dibaca.
5. Browser dibuka setelah 2 detik, terlalu cepat untuk start `tsx` pertama kali.

Catatan teknis: percobaan menambahkan `chcp 65001` **dibatalkan** karena merusak parser batch (huruf awal baris hilang: `'ho'`, `'ls'`, `'/d'`). File wajib CRLF.

## Perubahan

File: `PENGELOLA_KLIEN.bat` (hanya file ini; tidak ada perubahan aplikasi/Worker).

- Pakai `node_modules\.bin\tsx.cmd` (bukan `npx`) → prompt unduhan hilang permanen.
- Escape `&` pada `title` dan judul header.
- `cd /d "%~dp0"` + `setlocal`.
- Cek port 4567 → label `:sudah_jalan` (pesan ramah, buka browser, exit 0).
- Setiap kegagalan mencetak kode error lalu "Tekan Enter untuk menutup jendela ini" (`pause >nul`).
- Browser dibuka setelah 4 detik.
- Guard `node_modules` hilang → instruksi `npm install`.

## Verifikasi (nyata, bukan asumsi)

| Skenario | Hasil |
|---|---|
| Jalan normal dari root proyek | server listen, HTTP `/` **200**, UI portal tampil |
| Dibuka dari `C:\Windows` (cwd lain) | tetap **200** (terbukti `cd /d` bekerja) |
| Portal sudah berjalan (port 4567 dipakai) | pesan "Portal sudah berjalan", **exit 0**, tanpa stack trace |
| Folder tanpa `node_modules` | pesan `npm install`, **exit 1** |
| Header/title | tidak ada lagi `'PORTAL' is not recognized`; judul utuh |

Server uji dimatikan setelah tes; port 4567 bersih; file temp dihapus.

## File yang diubah

- `PENGELOLA_KLIEN.bat` — ditulis ulang (perbaikan di atas).
- `CHANGELOG.md` — sub-bagian 1.3.71 (tanpa naik versi, karena bukan perubahan aplikasi).
- `docs/tracker/INDEX_TRACKER.md` — entri log ini.
- `docs/tracker/logs/fix_launcher_pengelola_klien_2026_10_26.md` — file ini.

## Catatan lanjutan

- Fitur Detail Klien + brankas kredensial (v1.3.73) berada di worktree `stellar-sailor`, belum ada di `main`. Launcher ini kompatibel dengan keduanya.
- Jika `node_modules` hilang, jalankan `npm install` (bukan lewat npx).

---

# Sinkronisasi Portal v1.3.73 ke Folder Utama — 2026-10-26

**Pemicu:** Owner melaporkan "Fitur Detail Klien + Brankas Kredensial tidak ada" dan "website Gladi Resik tidak ada" pada portal `localhost:4567`.

## Sebab sebenarnya

1. **Fitur tidak muncul** — portal yang dijalankan berasal dari `Documents\tamplate-portofolio` (aplikasi 1.3.71), sedangkan Detail + brankas baru ada di worktree `stellar-sailor` (belum di-merge).
2. **Gladi Resik tidak muncul** — arsip `arsip-klien/01_gladi-2026-10-24` hanya ada di worktree. Folder utama hanya berisi `00_site-owner` dan `uji-domain`. Status Board membaca isi folder arsip, jadi klien yang arsipnya tidak ada memang tidak bisa tampil. (Spinner lama juga wajar: health check memakan ~8 detik.)

## Tindakan

Backup dulu ke `%TEMP%\backup-portal-main-20261026` (13 file), lalu menyalin dari worktree:

- `scripts/onboarding/server.ts`, `client-deploy.ts` (+ test), `public/index.html`
- Baru: `portal-vault.ts`, `portal-clients.ts`, `env-file.ts`, `app-kv-preflight.ts` (+ masing-masing test)
- `src/crud/shared/db/schema.ts`
- `arsip-klien/01_gladi-2026-10-24` (folder arsip, tidak masuk git)

Tidak disalin: `src/` lain, `client-deploy` bagian readiness, CHANGELOG aplikasi (tetap 1.3.71), `APP_VERSION`.

## Verifikasi

| Uji | Hasil |
|---|---|
| `npx vitest run scripts/onboarding` | **8 file / 79 test PASS** |
| `GET /api/clients` | 200, **2 klien** (gladi + site-owner), **tanpa `adminPassword`** |
| `GET /api/client-detail?folder=01_gladi-2026-10-24` | 200, infra tersamar (`3bc768…27d9`), `vaultConfigured=false` |
| `GET /api/client-secrets` tanpa brankas | **401** `VAULT_LOCKED` |
| `GET /api/client-detail?folder=../../.env.local` | **400** (traversal ditolak) |
| UI Status Board | "2 klien · 1 online · 1 offline"; Gladi **Online · DB OK · 2378 ms · v1.3.72**; tombol **Detail** ada |
| Modal Detail | identitas, alamat, infrastruktur tersamar, kredensial `••••••••`, form "Buat kata sandi brankas" |
| `.env.local` | tidak tersentuh (belum ada `PORTAL_VAULT_*`) |
| Server uji | port 4568 dimatikan; 4567 & 4568 bersih |

## Catatan

- Brankas **belum dibuat**. Owner harus membuat kata sandi sendiri lewat modal Detail → "Buat & Buka" (minimal 12 karakter). Password asli tidak disimpan, hanya hash scrypt di `.env.local`.
- "TEMPLATE TERBARU" masih **v1.3.71** karena CHANGELOG aplikasi utama belum dinaikkan; kode portal sudah setara v1.3.73. Ini disengaja agar tidak memicu tanda "klien perlu update" palsu.
- Backup dapat dipulihkan kapan saja dari `%TEMP%\backup-portal-main-20261026`.

---

# Satu File Launcher (Menu Portal + Cadangan) — 2026-10-26

**Pemicu:** Owner: *"aku mau file bat itu satu, kalau ada banyak file bat aku tidak suka."*

## Perubahan

- `PENGELOLA_KLIEN.bat` kini menu: **[1] Buka Portal**, **[2] Salin Cadangan**, **[3] Keluar**; default [1] setelah 15 detik.
- Pintasan otomatisasi: `PENGELOLA_KLIEN.bat portal` / `PENGELOLA_KLIEN.bat cadangan`.
- **`SALIN_CADANGAN.bat` dihapus** (worktree + folder utama). Logikanya dipindah ke subroutine `:cadangan` tanpa mengubah perilaku: robocopy incremental, 3 aset, folder bertanggal, validasi drive, guard `backups\`, exit code.
- Rujukan diperbarui agar tidak menunjuk file yang hilang:
  - `scripts/onboarding/client-deploy.ts` (catatan serah terima otomatis) + `client-deploy.test.ts`
  - `cadangan-flashdisk/README.txt`
  - `docs/operations/GLADI_RESIK_KLIEN_PERDANA.md`

## Verifikasi (folder percobaan, data dummy — data asli tidak disentuh)

| Uji | Hasil |
|---|---|
| Salin cadangan normal | 3 aset tersalin: `d1\data.txt`, `arsip-klien\demo\config.env`, `.env.local` |
| `backups\` belum ada | pesan jelas, **exit 1** |
| Huruf drive salah (`Z`) | pesan jelas, **exit 1** |
| Menu pilih `[3]` | **exit 0** |
| Mode `portal` | server listen, **HTTP 200** |
| `npx vitest run scripts/onboarding` (worktree & folder utama) | **8 file / 79 test PASS** |
| Jumlah `.bat` di folder proyek | **1** |

## Catatan

- Riwayat di `docs/tracker/logs/*` dan `CHANGELOG.md` lama yang menyebut `SALIN_CADANGAN.bat` **tidak diubah** — itu catatan sejarah, bukan instruksi aktif.
- `arsip-klien/01_gladi-2026-10-24/CATATAN_SERAH_TERIMA.md` yang sudah ada juga dibiarkan (dokumen arsip); catatan baru akan memakai teks menu [2].

---

# Custom Domain Gladi Tidak Muncul di Status Board — 2026-10-26

**Gejala:** kolom Domain menampilkan `belum ada (gladi-2026-10-24.workers.dev)` padahal `https://gladi.makeitbatter.my.id` hidup (HTTP 200).

**Akar masalah:** bukan Cloudflare. Domain memang sudah menempel, tetapi `CUSTOM_DOMAIN` tidak pernah tertulis di `arsip-klien/01_gladi-2026-10-24/config.env` — domain dipasang di luar alur portal, jadi portal tidak punya catatannya.

**Bukti read-only:**
- `POST /api/custom-domain/status` → `{"success":true,"status":"active","zoneName":"makeitbatter.my.id","service":"gladi-2026-10-24"}`
- `config.env` sebelum perbaikan: 23 kunci, tanpa `CUSTOM_DOMAIN`

**Perbaikan:** menambah satu baris `CUSTOM_DOMAIN="gladi.makeitbatter.my.id"` (tanpa menyentuh Cloudflare). `GET /api/clients` sekarang mengembalikan `customDomain: gladi.makeitbatter.my.id`.

**Temuan tambahan (penting):**
- Zona `makeitbatter.my.id` berada di **akun Cloudflare klien gladi**, bukan akun utama owner (`.env.local`). Dibuat 2026-10-24 19:12, paket Free, status active.
- Domain terdaftar sejak 2026-07-05 via PT Registrasi Neva Angkasa; NS diarahkan ke Cloudflare pada 2026-10-24.
- Isi zona: **hanya** custom domain `gladi.makeitbatter.my.id`. Tidak ada root, `www`, MX/email, atau TXT. Nol pemakaian lain.
- Root `makeitbatter.my.id` tidak punya record → browser "tidak bisa diakses" (bukan halaman kosong).
- Dua domain mirip: `makeitbetter.my.id` (dengan "e", akun utama) vs `makeitbatter.my.id` (dengan "a", akun gladi).

**Pemindahan zona ke akun utama: DIBLOKIR.** Token yang tersedia tidak berizin:
- `CLOUDFLARE_API_TOKEN` tidak ada di `.env.local`; `CLOUDFLARE_D1_API_TOKEN` hanya bisa baca zona (POST /zones → **403**).
- `arsip-klien/00_site-owner/config.env` tidak menyimpan kredensial Cloudflare.
- Karena itu penambahan zona + perubahan nameserver harus lewat dashboard owner dan panel registrar (hanya bisa dilakukan owner). Zona lama belum dihapus; gladi tetap hidup di subdomain sampai pemindahan selesai.

## KOREKSI OWNER (2026-10-26) — jangan pindahkan

Pemindahan **dibatalkan**. Owner mengonfirmasi pemisahan ini **disengaja**:

| Domain | Peran | Akun Cloudflare |
|---|---|---|
| `makeitbetter.my.id` (huruf "e") | domain utama / produksi owner | akun utama (`.env.local`) |
| `makeitbatter.my.id` (huruf "a") | **domain uji** untuk gladi resik / calon klien | akun test (arsip gladi) |

- `gladi.makeitbatter.my.id` adalah pemakaian yang **benar** untuk domain uji.
- Root `makeitbatter.my.id` saat itu kosong; kemudian **sengaja dipasang** ke Worker gladi pada bagian berikut (2026-10-26, izin owner).
- **JANGAN** memindahkan zona `makeitbatter.my.id` ke akun utama dan **JANGAN** mengubah/menghapus `makeitbetter.my.id`. Dua domain ini sengaja terpisah.
- Verifikasi akhir (read-only): akun utama hanya berisi `makeitbetter.my.id`; akun test hanya berisi `makeitbatter.my.id` + custom domain `gladi.makeitbatter.my.id`. Tidak ada perubahan Cloudflare dari sesi ini (POST /zones gagal 403 sebelum membuat apa pun).
- Yang tersisa hanya catatan lokal: `CUSTOM_DOMAIN="gladi.makeitbatter.my.id"` di arsip gladi — benar dan dibiarkan.
- Saat bersih-bersih gladi nanti: zona `makeitbatter.my.id` ikut berada di akun test. Kalau akun test akan dihapus/ditinggalkan, pastikan domain uji dipindahkan lebih dulu agar tidak ikut hilang.

**Dokumentasi permanen:** [`docs/agent-context/10_DOMAIN_INVENTORY.md`](../../agent-context/10_DOMAIN_INVENTORY.md) — dibaca wajib oleh AI (dirujuk dari `AGENTS.md` §0, `INDEX_TRACKER.md`, dan `env-inventory.md`).

---

# Root Domain Uji Dipasang ke Situs Gladi — 2026-10-26

**Permintaan owner:** situs gladi seharusnya bisa dibuka di `https://makeitbatter.my.id`, bukan hanya di `https://gladi.makeitbatter.my.id`.

**Tindakan (disetujui owner):**
- `PUT /accounts/<akun-test>/workers/domains` → `{ hostname: "makeitbatter.my.id", service: "gladi-2026-10-24" }`.
- Subdomain `gladi.makeitbatter.my.id` **tidak dilepas**; keduanya menunjuk Worker yang sama.
- `config.env` gladi diperbarui: `CUSTOM_DOMAIN`, `WEBSITE_URL`, `ADMIN_URL` → alamat root. Jumlah kunci tetap 24 (BOM UTF-8 yang tidak sengaja tertulis saat edit langsung dihapus kembali).

**Verifikasi:**
| Cek | Hasil |
|---|---|
| `https://makeitbatter.my.id/` | **HTTP 200**, judul `Portfolio OS - Creative Portfolio`, 49.288 byte |
| `https://gladi.makeitbatter.my.id/` | **HTTP 200** (tetap hidup) |
| Custom domain di akun test | 2 entri: root + `gladi.`, keduanya `service: gladi-2026-10-24`, `enabled: true` |
| `GET /api/clients` (portal) | `customDomain: makeitbatter.my.id`, `websiteUrl: https://makeitbatter.my.id` |
| `POST /api/custom-domain/status` | `active` |
| DNS-over-HTTPS root | A `104.21.64.216`, `172.67.187.227` (resolver lokal sempat NXDOMAIN karena cache negatif) |

**Catatan koreksi:** saran lama "jangan pasang root ke Worker gladi" **tidak berlaku lagi** — saran itu dibuat saat `makeitbatter` masih dianggap domain produksi. Karena ini domain uji, root justru alamat yang benar. Dokumen domain sudah diperbarui.

---

# Status Board: "Offline" Palsu Diperbaiki + Cadangan workers.dev — 2026-10-26

**Gejala yang dilaporkan owner:** portal menulis **Offline** untuk Gladi Resik, padahal `https://makeitbatter.my.id` terbuka normal di HP owner.

**Akar masalah (terbukti, bukan dugaan):**
- Portal hanya mengecek satu alamat (`WEBSITE_URL` = `https://makeitbatter.my.id/api/health`) dengan batas **8 detik**.
- Di laptop owner, DNS router `192.168.100.1` masih menyimpan jawaban negatif (NXDOMAIN) untuk root yang baru dipasang. `curl` biasa → `Could not resolve host`; `/api/status` portal → `online=false`, `httpStatus=null`.
- Dengan `--resolve` ke IP Cloudflare, `/api/health` menjawab **200** (v1.3.72, DB connected). Jadi Worker hidup; kegagalan murni di tahap DNS.
- Temuan kedua: `site-owner` butuh **4,5–5,2 detik**, sangat dekat dengan batas 8 detik → rawan "Offline" palsu saat jaringan lambat.

**Perubahan kode (khusus portal, tanpa deploy aplikasi):**
| Berkas | Perubahan |
|---|---|
| `scripts/onboarding/portal-status.ts` (baru) | `probeClientHealth()` mencoba `baseUrls` berurutan, `HEALTH_PROBE_TIMEOUT_MS = 12_000`, menandai `answeredBy` + `viaFallback`, dedup URL, tahan balasan non-JSON |
| `scripts/onboarding/server.ts` | `/api/status` membangun `healthUrls = [websiteUrl, workersDevUrl]`, memakai `probeClientHealth` (blok `try/catch` lama dihapus) |
| `scripts/onboarding/client-deploy.ts` | `workersDevUrl()` diekstrak; `clientUrls()` memakai ulang helper itu |
| `scripts/onboarding/public/index.html` | label `· via workers.dev` + tooltip saat fallback yang menjawab |
| `portal-status.test.ts` (baru) + `client-deploy.test.ts` | 6 test probe + 2 test `workersDevUrl` |

**Verifikasi:**
| Cek | Hasil |
|---|---|
| `npx vitest run scripts/onboarding/portal-status.test.ts scripts/onboarding/client-deploy.test.ts` | **2 file / 28 test PASS** |
| `npx tsc --noEmit` | 0 error |
| `npx eslint` (5 berkas) | 0 error (berkas `scripts/onboarding` memang di-ignore konfigurasi) |
| Uji hidup portal terpisah `PORT=4568` | `site-owner` online 200 / **5233 ms** / v1.3.70; `gladi-2026-10-24` online 200 / **1129 ms** / v1.3.72; `viaFallback=false` (cache DNS sudah kedaluwarsa) |
| Portal owner di 4567 | tetap hidup, tidak diganggu |
| Port 4568 setelah uji | dimatikan bersih (`False`) |

**Catatan operasional:**
- Cadangan hanya dipakai kalau alamat utama **gagal di tingkat jaringan**. Balasan non-2xx tetap dianggap jawaban sah (Worker hidup, statusnya memang tidak sehat).
- Label `· via workers.dev` **bukan error** — artinya situs hidup tapi custom domain belum bisa dihubungi dari laptop itu (DNS/cache).
- Untuk memuat kode baru, portal di 4567 harus **di-restart** (tutup jendela, jalankan `PENGELOLA_KLIEN.bat` lagi, pilih `[1]`).

---

# Tombol "Update Klien Ini" Diuji Nyata + Bar Progres — 2026-10-26

**Pertanyaan owner:** apakah tombol **Update Klien Ini** di tab *Update Versi Template* berfungsi? Bisa dibuat bar progres?

## Hasil uji tombol (nyata, akun uji)

Alur yang dipakai sama persis dengan tombol: `POST /api/deploy-client { folderName: "01_gladi-2026-10-24" }` lewat portal uji **port 4568** (portal owner 4567 tidak dipakai).

| Cek | Hasil |
|---|---|
| Durasi build + deploy | **3,1 menit** (curl exit 0) |
| Event terakhir | `complete {success:true, results:[{clientSlug:"gladi-2026-10-24", success:true, url:"https://makeitbatter.my.id"}]}` |
| `wrangler` | `Uploaded gladi-2026-10-24 (32.30 sec)`, `Deployed … triggers (3.11 sec)` |
| Verifikasi internal | `[VERIFIKASI] Site hidup — HTTP 200 status ok` |
| `/api/health` sesudahnya | `version 1.3.71`, `database connected` |
| Versi sebelumnya | 1.3.72 (dibangun dari worktree) → turun ke **1.3.71** karena repo utama berisi `APP_VERSION = '1.3.71'` |

**Kesimpulan:** tombol berfungsi. Klik pada Gladi = build ulang + deploy ke akun Cloudflare uji.

## Batasan yang terverifikasi

- **Site Owner tidak bisa di-update lewat tombol ini.** `arsip-klien/00_site-owner/config.env` hanya berisi 7 kunci (`CUSTOMER_NAME`, `CUSTOMER_SLUG`, `WEBSITE_URL`, `ACTIVE_TEMPLATE_KEY`, `JWT_SECRET`, `PASSWORD_SALT`, `CRON_SECRET`) — tanpa `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_D1_API_TOKEN`. Server menolak dengan pesan `Konfigurasi klien belum lengkap: …` dan **tidak ada deploy**.
- Produksi owner tetap lewat `npm run deploy` di repo owner.
- Update selalu memakai kode repo tempat portal dijalankan (bukan worktree lain).

## Bar progres (UI)

Berkas: `scripts/onboarding/public/index.html` saja.

- Elemen `#update-progress-track` + `#update-progress-bar` (6px) di atas kotak log.
- `setUpdateProgress()` / `bumpUpdateProgress()` — progres tidak pernah mundur.
- Titik kemajuan dari **log nyata** (sudah dicocokkan dengan log uji di atas): `Uploaded ` → 82, `Deployed … triggers` → 90, `[VERIFIKASI] Site hidup` → 96, `complete` → 100.
- Mode batch: `8 + (current/total) * 72`.
- Gagal → bar merah penuh (`is-error`), judul kartu hasil jadi "Pembaruan Gagal" + ikon ✕.
- `finally` tidak lagi memanggil `loadUpdateView()` — fungsi itu menyembunyikan panel progres + kotak hasil sepersekian detik setelah selesai, sehingga ringkasan deploy tidak pernah terbaca.

**Verifikasi UI:** diuji di browser pada portal 4568 — jalur gagal (Site Owner) menampilkan bar merah penuh, pesan error, dan ringkasan ✗ tetap terlihat; judul berubah benar. `node --check` skrip inline = 0 error. Portal uji dimatikan setelah pengujian.

---

# Batch 1+2+3 — Portal Aman & Jujur (audit deploy) — 2026-10-26

**Permintaan owner:** jangan sampai ada kesalahan di bagian portal; tutup cacat alur update, terutama site owner yang bisa dideploy dan versi yang hanya terlihat di tab lain.

## Temuan yang ditutup

| Kode | Temuan | Perbaikan |
|---|---|---|
| K1 | Verifikasi pasca-deploy hanya cek custom domain → deploy sukses dilaporkan GAGAL saat DNS belum menyebar | `verifySiteLiveness(..., { fallbackUrls })` + `viaFallback`; `deployClient` mengirim `workersDevUrl` sebagai cadangan dan mencatatnya |
| K2 | Tidak ada kunci deploy → dua build menimpa `.open-next` | `deployInProgress` di `server.ts`; permintaan kedua → **409** |
| K3 | `sendEvent` menulis ke koneksi tertutup → `EPIPE` bisa mematikan portal | gerbang `streamClosed` + `res.on('close'/'error')`; semua tulisan dibungkus `try` |
| S1 | UI diam saat balasan non-SSE / stream putus | cek `response.ok` + `content-type`, tangkap `complete`; tanpa `complete` → pesan eksplisit |
| S2 | `loadUpdateView()` menyembunyikan progres tiap pindah tab | penyembunyian dihapus; hanya error lama yang dibersihkan |
| S3 | Tab Update tidak punya versi | badge versi per kartu (menyusul dari `/api/status`) |
| S4 | `spatial-gallery` dilabeli "Infinite Canvas" | `TEMPLATE_LABELS` 3 template + `templateLabel()` |
| S5 | "Terbaru" dari CHANGELOG | `readProjectVersions()` → `appVersion` jadi acuan + peringatan selisih |
| S6 | Update bisa menurunkan versi tanpa peringatan | `buildDeployConfirmation()` menyebut downgrade |
| R1 | `folderName` tidak divalidasi | `isSafeArchiveFolderName` untuk `folders`/`folderName` |
| R2 | Body tanpa batas | `readJsonBody` 16 KB → **413** |
| R3 | `--config` tidak dikutip (`shell: true`) | dikutip di Windows |
| R4 | Slug mentah jadi nama berkas | `isSafeCustomerSlug()` guard sebelum filesystem |
| R5 | Checkbox build diabaikan server | checkbox dihapus dari UI |
| R6 | Waktu build dari mtime folder | dari `worker.js` / `next-env.mjs` |

**Tambahan keputusan produk:**
- `deployable` dihitung `buildClientEnvPlan(env).missing.length === 0`, bukan 4 kunci pilihan.
- Batch mengirim daftar folder eksplisit; `all: true` tidak lagi dibaca.
- Kartu site owner tanpa tombol + tombol salin `npm run deploy`.
- `CATATAN_SERAH_TERIMA.md` hanya ditulis bila deploy **dan** verifikasi hidup berhasil.
- Retry deploy pada kartu sukses onboarding juga memeriksa `response.ok` / content-type.

## Berkas yang diubah

- `scripts/onboarding/portal-clients.ts` — `deployable`/`missingKeys`, `assessDeployability`, `partitionDeployTargets`, `readProjectVersions`
- `scripts/onboarding/server.ts` — handler deploy (lock, validasi, body cap, SSE aman, `skipped`), `/api/status` (`appVersion`/`changelogVersion`), `/api/build-status`
- `scripts/onboarding/client-deploy.ts` — fallback liveness, `isSafeCustomerSlug`, kutip `--config`, catatan hanya saat verifikasi lolos
- `scripts/onboarding/public/index.html` — kartu versi, filter template, kartu owner, laporan dilewati, error handling, hapus checkbox
- `scripts/onboarding/portal-clients.test.ts` — 11 test baru
- `scripts/onboarding/client-deploy.test.ts` — 5 test baru
- `CHANGELOG.md` — subbagian di bawah 1.3.71 (versi tidak dinaikkan)

## Verifikasi (angka nyata)

- `npx vitest run scripts/onboarding` → **9 file / 103 test PASS**
- `npx tsc --noEmit` → **0 error**
- `node --check` skrip inline `index.html` → **0 error** (95.544 byte, 1 blok)
- Uji hidup **port 4568** (portal 4567 tidak dipakai, server dimatikan setelahnya):
  - `/api/clients` → `01_gladi-2026-10-24 deployable=true`; `00_site-owner deployable=false`, missing 4 kunci Cloudflare
  - `/api/status` → `latestVersion=1.3.71`, `appVersion=1.3.71`, `changelogVersion=1.3.71`
  - deploy ke Site Owner → **400** tanpa build; `../etc` → **400**; `folders: []` → **400**; folder hilang → **400** + `skipped`
  - body 20.000 karakter → **413**
  - dua permintaan bersamaan → kedua **409**; setelah kunci lepas → **400** (bukan 409)
  - UI: kartu Site Owner tanpa tombol + pesan owner; badge `v1.3.71 · terbaru` / `v1.3.70 · perlu update`; chip `Semua (2) / macOS (2) / Canvas (0) / Spatial (0)`; filter Canvas → tombol massal mati; progres tetap `block` setelah pindah tab→kembali; error 400 tampil di kotak merah + bar `is-error`
  - peringatan versi diuji dengan data palsu: `kode v1.3.73 · catatan v1.3.71` → kotak kuning muncul; badge `v1.3.72 · lebih baru dari repo`; konfirmasi memuat "MENURUNKAN versi"
- **Tidak ada deploy ke klien mana pun** dalam pengujian ini.

## Catatan operasional

- Portal di 4567 harus **di-restart** agar kode baru dipakai.
- Site owner tetap lewat `npm run deploy` (pre-deploy check menolak bila `OWNER_MODE` bukan `true`).
- Filter hanya memengaruhi tombol massal; tombol per kartu tetap per klien.

---

# Deploy Site Owner 1.3.71 + Verifikasi Produksi — 2026-10-26

**Perintah owner:** `npm run deploy` (jalur produksi owner, bukan portal), lalu verifikasi.

## Jalur deploy

- `npm run deploy` → **exit 0**.
- `pre-deploy-check.js`: semua cek lolos; `worker-compat-audit --strict` → **507 file, 0 blocker, 0 review item**.
- Build Next.js 16.3.6 (Turbopack) → **74/74 halaman statis**; TypeScript 0 error.
- OpenNext: `Worker saved in .open-next\worker.js`.
- Wrangler: **955 file aset**, 7 aset baru diunggah, `Uploaded portfolio-os-template (30.59 sec)`, `Deployed … triggers (4.45 sec)`.
- Worker: `portfolio-os-template` · Version ID `01629efa-28b9-4e61-9fde-b5569efcb971` · binding D1/R2/KV utuh.

## Verifikasi produksi (11/11 PASS)

| Cek | Hasil |
|---|---|
| `GET /api/health` | HTTP **200** (5392 ms) |
| `status` | `ok` |
| `version` | **1.3.71** (baseline sebelum deploy: 1.3.70) |
| `database` | `connected` (94 ms, `cloudflare-d1`) |
| Owner mode | field `workerHealth` **ada** (blok khusus owner di `/api/health`) |
| Beranda `/` | HTTP **200**, 23.775 byte |
| `/admin/login` | HTTP **200**, 25.874 byte |
| `/api/admin/pricing` | HTTP **401** (route ada; 404 berarti owner mode hilang) |
| `/api/admin/orders` | HTTP **401** |
| `/admin/harga` | HTTP **307** → `/admin/login?redirect=%2Fadmin%2Fharga` (route hidup) |
| `/admin/system/orders` | HTTP **307** → `/admin/login?redirect=%2Fadmin%2Fsystem%2Forders` |
| `/api/projects`, `/api/os/version` | HTTP **200** |
| `portfolio-os-template.m4keitbetter.workers.dev/api/health` | `version 1.3.71`, `ok`, DB connected |
| Portal `/api/status` (uji 4568) | `site-owner deployed=1.3.71` (sebelumnya 1.3.70), `viaFallback=false`, `answeredBy=makeitbetter.my.id`; `latestVersion=appVersion=changelogVersion=1.3.71` |

**Catatan:** deploy ini juga mengaktifkan perubahan skema yang sudah ada di working tree: `CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_site_slug ON projects(site_id, slug)` di `src/crud/shared/db/schema.ts`. Aman diulang; bootstrap membungkus tiap statement dengan `try/catch`, dan data lama yang duplikat hanya membuat statement itu dilewati (tidak mengubah data). Terbukti: health `ok`, beranda & API publik 200.

Portal uji 4568 dimatikan setelah verifikasi; portal 4567 tidak pernah dijalankan/diganggu.
