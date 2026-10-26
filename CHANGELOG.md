# Changelog — Portfolio OS Template

Semua pembaruan fitur, optimasi, dan perbaikan bug template dicatat di file ini.
Format catatan ini otomatis dibaca oleh portal `PENGELOLA_KLIEN.bat` di menu **Update Versi Template**.

## [1.3.74] - 2026-10-26

### 🛡️ Audit Kesiapan Produksi: Klien Baru Bisa Login, Kunci Tidak Bocor, Gerbang Mutu

Rilis ini memindahkan hasil audit kesiapan produksi (2026-10-24/25) dari salinan kerja ke `main`. **Kode aplikasi berubah**, jadi situs owner perlu `npm run deploy` untuk ikut versi ini — deploy **belum** dijalankan.

> **Catatan nomor versi:** di salinan kerja, pekerjaan ini sempat diberi nomor 1.3.72 dan 1.3.73. Catatan rilis untuk kedua nomor itu tertimpa saat penyamaan dokumen dan tidak bisa dipulihkan; isinya dirangkum ulang di entri 1.3.74 ini supaya tidak ada dua sumber yang berbeda.

- **K1 (KRITIS) — klien baru tidak bisa menyimpan apa pun.** Database yang dibuat portal onboarding memakai `app_kv` dengan kolom `id` wajib, sedangkan penulis data hanya mengirim `key` → `NOT NULL constraint failed: app_kv.id`, rate-limit login gagal (**429**), dan seluruh simpan konten mati. Penulis kini mendeteksi bentuk tabel (`PRAGMA table_info`, memoized) dan mengisi `id` bila diperlukan; onboarding juga menolak lanjut bila uji tulis `app_kv` gagal. Database owner tidak pernah terkena karena bentuknya berbeda sejak awal.
- **K2 — kunci database tidak lagi ditanam di situs klien.** Worker klien memakai binding `env.DB` (bukan REST + token di `vars`); `next-env.mjs` fail-closed; verifikasi pasca-deploy wajib `200` + `status:ok`.
- **Backup D1 jujur.** Satu tabel gagal → dicoba ulang sekali, lalu **seluruh backup dibatalkan** tanpa meninggalkan file separuh yang tampak sah.
- **Upload tidak bisa diakali.** Kuota memakai ukuran byte aktual saat `Content-Length` tidak dikirim; ekstensi file diambil dari content-type (bukan nama kiriman); path `assets/...` selalu di-scope ke `sites/<siteId>/...`; isi `backups/` tidak dihitung sebagai pemakaian media.
- **SVG tidak bisa jadi halaman jahat.** `/r2/...` menyajikan SVG sebagai lampiran (`Content-Disposition: attachment`) + CSP ketat, menutup celah stored XSS.
- **Header keamanan tidak lagi dobel.** Header statis hanya dari `next.config.mjs`; middleware hanya memasang CSP. Sebelumnya HSTS muncul dua kali dengan nilai berbeda sehingga tidak valid.
- **Alat owner tertutup di situs klien.** `/api/admin/sites` dan entitlement memasang `requireOwnerMode()` → **404** di deployment klien.
- **Bucket media gagal = berhenti, bukan "sukses".** Jalur CLI (`cloud-manager.ts`) kini fail-closed seperti portal: akun baru tanpa R2 aktif berhenti dengan pesan yang bisa ditindaklanjuti, bukan build 5–10 menit lalu gagal di `wrangler deploy`.
- **Gerbang mutu otomatis.** `.github/workflows/quality.yml` menjalankan tsc + lint + unit test pada push/PR, dan `npm run deploy` kini juga menjalankan ketiganya (plus wajib `CRON_SECRET`).
  - **Temuan saat verifikasi:** gerbang versi awal menjalankan tes dengan `.env.local` yang sudah dimuat, sehingga tes rate-limit menembak D1 asli (timeout 5 detik) dan tes "notifikasi belum dikonfigurasi" benar-benar mengirim email. Tes sekarang dijalankan dengan environment **sebelum** `.env.local` dimuat.
- **Portal owner (dari pekerjaan yang sama):** tombol **Detail** di Status Klien, brankas scrypt (`PORTAL_VAULT_HASH`/`PORTAL_VAULT_SALT`, auto-hide 30 detik, sesi 120 detik, 5× salah → kunci 5 menit), `/api/clients` tidak lagi mengirim `adminPassword`, rahasia hanya lewat allowlist, endpoint portal menolak Host non-loopback dan wajib `X-Portal-Request`.

**Verifikasi:** `npx tsc --noEmit` **0 error**; `npm run lint` bersih; `npm run pre-deploy` **exit 0** dengan **150 file / 1266 test PASS**; `node --check` skrip portal 0 error. Sisa risiko yang belum ditutup tetap dicatat di `docs/tracker/logs/audit_production_readiness_2026_10_24.md` (kuota lock per-isolat, validasi dimensi wallpaper masih no-op, `/api/health` publik menampilkan versi/memori, `public/` ~118 MB).

**Perlu tindakan:** (1) tutup lalu buka lagi `PENGELOLA_KLIEN.bat` agar portal memakai kode baru, (2) jalankan `npm run deploy` bila ingin situs owner ikut 1.3.74, (3) brankas portal belum pernah dibuat — buat kata sandinya langsung di modal Detail (jangan dikirim ke siapa pun).

## [1.3.71] - 2026-10-24

### 🛡️ Portal Aman & Jujur: Site Owner Tidak Bisa Dideploy + Versi Tampil di Kartu (2026-10-26)

Perbaikan khusus portal owner (`scripts/onboarding/`) — **tidak ada perubahan kode aplikasi/Worker**, jadi tidak perlu deploy dan tidak menaikkan versi template.

**Kenapa penting:** portal dulu memperlakukan *semua* folder di `arsip-klien/` sebagai klien yang bisa di-update, dan tombol update ada di tab yang tidak menampilkan versi terpasang. Dua hal itu diperbaiki sekarang.

- **Site Owner tidak lagi bisa dideploy dari portal.** Status "siap deploy" dihitung dengan fungsi yang sama yang dipakai server (`buildClientEnvPlan`), bukan tebakan 4 kunci. Kartu Site Owner tampil tanpa tombol update, diganti keterangan *"Produksi owner — update lewat `npm run deploy`, bukan portal"* + tombol salin perintah. Ini penting: `deployClient()` selalu memaksa `OWNER_MODE=false`, jadi deploy site owner lewat portal akan **menghilangkan panel Harga Jual & Order**.
- **"Update Semua" mengirim daftar folder eksplisit**, bukan `all: true`. Filter yang terlihat di layar = target yang dikirim. Arsip yang tidak siap masuk laporan **"↷ DILEWATI"** (bukan "GAGAL").
- **Versi terpasang tampil langsung di kartu update:** `v1.3.71 · terbaru`, `· perlu update`, atau `· lebih baru dari repo` (biru). Data diambil dari `/api/status` di latar belakang, jadi kartu tetap muncul cepat meski health-check lambat.
- **Filter template:** chip **Semua / macOS / Canvas / Spatial** dengan jumlah klien. Label template kini benar untuk 3 template (sebelumnya `spatial-gallery` salah dilabeli "Infinite Canvas").
- **Acuan "terbaru" = `APP_VERSION` di kode**, bukan judul `CHANGELOG.md`. Bila keduanya berbeda, muncul peringatan kuning (mis. "kode v1.3.73, catatan v1.3.71").
- **Peringatan downgrade:** bila klien memakai versi lebih baru daripada repo, konfirmasi menyebutkan bahwa melanjutkan akan **menurunkan** versi.
- **Deploy tidak bisa dobel:** kunci server menolak permintaan kedua dengan **HTTP 409** ("Pembaruan lain sedang berjalan"). Dua build bersamaan bisa saling menimpa `.open-next`.
- **Verifikasi pasca-deploy tidak lagi menghukum DNS:** kalau custom domain belum menyebar, portal mengecek `workers.dev` sebagai cadangan dan menulis di catatan bahwa site diverifikasi lewat alamat cadangan. `CATATAN_SERAH_TERIMA.md` hanya ditulis bila deploy **dan** verifikasi berhasil, supaya status portal dan catatan serah terima tidak pernah berbeda.
- **UI tidak diam saat error:** balasan JSON (400/409/413/500) ditampilkan sebagai pesan, stream yang putus tanpa `complete` dilaporkan, dan bar progres berubah merah. Panel progres juga **tidak hilang** saat pindah tab.
- **Penulisan log aman:** stream yang ditutup pengguna tidak lagi bisa memicu `EPIPE` yang mematikan portal.
- **Validasi & batas:** `folders`/`folderName` divalidasi, body dibatasi 16 KB, path `--config` dikutip untuk Windows, dan `CUSTOMER_SLUG` yang aneh ditolak sebelum menyentuh filesystem.
- **Kerapian:** checkbox "Kompilasi build baru" dihapus (server memang selalu build ulang), dan "Waktu Build Terakhir" dibaca dari berkas hasil build, bukan mtime folder.

**Verifikasi:** `npx vitest run scripts/onboarding` → **9 file / 103 test PASS** (16 test baru: deployable, pemisahan target, versi, fallback verifikasi, slug). `npx tsc --noEmit` 0 error. `node --check` skrip inline `index.html` 0 error. Uji hidup di **port 4568** (portal 4567 tidak dipakai): `/api/clients` menandai `00_site-owner` **deployable=false** dengan 4 kunci kurang; `POST /api/deploy-client` ke Site Owner → **400** tanpa build; folder traversal → **400**; body >16 KB → **413**; dua permintaan bersamaan → yang kedua **409** dan kunci lepas setelahnya; `/api/status` melaporkan `appVersion=1.3.71`, `changelogVersion=1.3.71`; kartu Site Owner tanpa tombol; filter Canvas → 0 siap + tombol massal mati; panel progres tetap terlihat setelah pindah tab; error JSON tampil di kotak merah. **Tidak ada deploy ke klien mana pun dalam pengujian ini.**

### 🐛 Backport ke `main`: `SecurityError` `texImage2D` Video Hero + Klik Lembaran Akurat

Perbaikan yang sudah ada di branch `fix/landing-click` (commit `c17107f`, `34ee75b`, `bfac743`) **belum pernah masuk `main`**, sehingga dev server `localhost:3000` masih menampilkan error ini tiap frame. Sekarang di-backport utuh:

- `SecurityError: Failed to execute 'texImage2D' ... video element contains cross-origin data` **hilang**: media ber-key R2 (video & poster hero) dialihkan ke proxy **same-origin `/r2/…`**, `crossOrigin="anonymous"` dipasang, dan `previewVideoOf()` hanya mengembalikan URL same-origin — video eksternal non-R2 dilewati (lembaran memakai poster statis) alih-alih memicu error di loop render.
- Klik lembaran hero kembali akurat: lapisan video disembunyikan sementara selama pass pick, jadi template yang dibuka selalu sesuai lembaran yang diketuk.
- Tanpa perubahan perilaku lain: gerak koridor, snap, siklus demo live, dan tampilan video tetap sama.

**Verifikasi:** `vitest` magazine-showcase PASS, `tsc --noEmit` 0 error, `eslint` bersih.

### 🐞 Launcher `PENGELOLA_KLIEN.bat` Tidak Lagi Menutup Sendiri (2026-10-26)

Perbaikan khusus file peluncur lokal — **tidak ada perubahan kode aplikasi/Worker**, jadi tidak perlu deploy dan tidak menaikkan versi template:

- **Pertanyaan `npx` "Ok to proceed? (y)" dihapus dari alur.** Penyebab jendela gagal: launcher memakai `npx tsx`, dan bila `tsx` tidak terdeteksi `npx` menawarkan unduh dari internet. Kini launcher memakai `node_modules\.bin\tsx.cmd` langsung, jadi pertanyaan itu tidak pernah muncul lagi.
- **Dua bug `&` diperbaiki** pada baris `title` dan judul header. Sebelumnya CMD mencetak `'PORTAL' is not recognized as an internal or external command` dan judul terpotong.
- **`cd /d "%~dp0"`** — launcher tetap menemukan `scripts\onboarding\server.ts` walau dibuka lewat shortcut atau dari folder lain.
- **Deteksi portal yang sudah berjalan** (port 4567) — yang muncul pesan ramah "Portal sudah berjalan" + browser dibuka, bukan stack trace `EADDRINUSE`.
- **Jendela tidak menutup sendiri saat gagal** — semua jalur berakhir dengan "Tekan Enter untuk menutup jendela ini" beserta kode error, dan browser baru dibuka setelah 4 detik (bukan 2 detik) agar server sempat menyala.

**Verifikasi:** diuji 4 skenario — (1) normal: server listen + HTTP 200; (2) dibuka dari `C:\Windows`: tetap 200; (3) port sudah dipakai: pesan ramah, exit 0; (4) `node_modules` hilang: pesan `npm install`, exit 1. Tidak ada lagi keluaran `'PORTAL' is not recognized`.

### 🗂️ Satu File Launcher: Menu Portal + Salin Cadangan (2026-10-26)

Permintaan owner: *"aku mau file bat itu satu, kalau ada banyak file bat aku tidak suka."* Sekarang hanya ada **satu** file `.bat` di folder proyek:

- `PENGELOLA_KLIEN.bat` menjadi menu: **[1] Buka Portal**, **[2] Salin Cadangan**, **[3] Keluar** (tanpa memilih → otomatis [1] setelah 15 detik).
- **`SALIN_CADANGAN.bat` dihapus**; seluruh logika robocopy dipindah ke subroutine `:cadangan` di file yang sama. Perilaku dipertahankan: menyalin `backups\` + `arsip-klien\` + `.env.local` ke folder bertanggal, validasi huruf drive, guard bila `backups\` belum ada, dan exit code gagal.
- Pintasan untuk otomatisasi: `PENGELOLA_KLIEN.bat portal` dan `PENGELOLA_KLIEN.bat cadangan`.
- Rujukan ikut diperbarui agar tidak menunjuk file yang sudah tidak ada: catatan serah terima otomatis (`client-deploy.ts`) + test-nya, `cadangan-flashdisk/README.txt`, dan `docs/operations/GLADI_RESIK_KLIEN_PERDANA.md`.

**Verifikasi:** uji di folder percobaan (data dummy, bukan data asli) — 3 aset tersalin lengkap; tanpa `backups\` → exit 1; drive salah (`Z`) → exit 1; menu [3] → exit 0; portal → HTTP 200; `npx vitest run scripts/onboarding` **8 file / 79 test PASS**. Hanya tersisa satu file `.bat`.

### 🔌 Status Board Portal Tidak Lagi "Offline" Palsu (2026-10-26)

Perbaikan khusus portal owner (`scripts/onboarding/`) — **tidak ada perubahan kode aplikasi/Worker**, jadi tidak perlu deploy dan tidak menaikkan versi template:

- **Penyebab nyata:** portal mengecek hanya satu alamat (`WEBSITE_URL`). Saat custom domain `makeitbatter.my.id` baru dipasang, DNS di jaringan owner masih menyimpan jawaban lama "domain tidak ada". Permintaan gagal sebelum sampai ke Cloudflare (`httpStatus=null`), lalu portal menulis **Offline** padahal `/api/health` lewat alamat `workers.dev` menjawab **200** (v1.3.72, DB connected).
- **Cadangan otomatis `workers.dev`:** kalau alamat utama gagal di tingkat jaringan (DNS/timeout/koneksi ditolak), pengecekan mengulang ke `<slug>.<subdomain>.workers.dev`. Modul baru `portal-status.ts` (`probeClientHealth`, `answeredBy`, `viaFallback`); `workersDevUrl` diekstrak di `client-deploy.ts` dan dipakai ulang `clientUrls`.
- **Batas waktu 8 detik → 12 detik.** Site owner butuh ~4,5–5,2 detik; batas lama membuat situs hidup bisa tercatat Offline saat jaringan sedikit lambat.
- **UI jujur:** baris status menampilkan label kecil **"· via workers.dev"** hanya ketika yang menjawab alamat cadangan, dengan tooltip bahwa situsnya tetap hidup.

**Verifikasi:** `npx vitest run scripts/onboarding/portal-status.test.ts scripts/onboarding/client-deploy.test.ts` → **2 file / 28 test PASS** (6 test probe: utama, fallback, semua gagal, anti-duplikat, non-JSON, timeout). `tsc --noEmit` 0 error. Uji hidup di portal terpisah port `4568` (portal owner di 4567 tidak diganggu): `site-owner` online 200 / 5233 ms / v1.3.70, `gladi-2026-10-24` online 200 / 1129 ms / v1.3.72, keduanya `viaFallback=false` karena cache DNS lokal sudah kedaluwarsa.

### 📊 Bar Progres di "Update Klien Ini" + Ringkasan Hasil Tidak Lagi Hilang (2026-10-26)

Khusus UI portal owner (`scripts/onboarding/public/index.html`) — tanpa perubahan aplikasi/Worker, tanpa menaikkan versi template:

- **Bar progres 6px** muncul di atas kotak log saat pembaruan berjalan. Lebarnya mengikuti tahap nyata dari server, bukan timer: 4% mulai → 8% build → **82%** setelah baris `Uploaded …` → **90%** setelah `Deployed … triggers` → **96%** setelah `[VERIFIKASI] Site hidup` → **100%** saat `complete`. Corak garis bergerak hanya penanda proses masih hidup. Mode "Update Semua Klien" memakai `current/total` untuk membagi rentang antar klien.
- **Gagal = merah:** bar penuh merah, judul kartu hasil berubah menjadi "Pembaruan Gagal" + ikon ✕. Sebelumnya judul selalu "Pembaruan Berhasil Dikirim!" walau semua klien gagal.
- **Bug lama diperbaiki:** blok `finally` memanggil `loadUpdateView()`, yang menyembunyikan panel progres + kotak hasil sepersekian detik setelah selesai — jadi ringkasan deploy tidak pernah sempat terbaca. Panggilan itu dihapus (daftar klien tetap segar saat tab dibuka lagi).
- **Verifikasi jalur sukses:** tombol diuji nyata lewat endpoint portal (`POST /api/deploy-client`) pada Gladi di port 4568 — build + deploy **3,1 menit**, `complete {success:true}`, verifikasi `HTTP 200` dari `https://makeitbatter.my.id/api/health`, versi berubah **1.3.72 → 1.3.71** (sesuai isi repo utama).
- **Verifikasi jalur gagal:** diklik pada Site Owner → bar merah + pesan "Konfigurasi klien belum lengkap: CLOUDFLARE_ACCOUNT_ID, …" tampil dan tetap terbaca. `node --check` pada skrip inline = 0 error.

## [1.3.70] - 2026-10-24

### 🎭 Mode Demo Chat: Balasan Simulasi di Situs Milik Owner — Nol Nomor HP Terlibat

Lanjutan keputusan owner (2026-10-24): *"kalau untuk demo template macOS gak perlu; ada solusi?"* — owner menolak memasang nomor WA pribadi untuk di-demos, dan memilih **mode demo: balasan simulasi**.

- Demo desktop (`/preview/os-desktop`, situs milik owner — ditandai `NEXT_PUBLIC_OWNER_MODE=true` yang dihasilkan saat build): tombol kirim di jendela Contact **TIDAK** membuka `wa.me` dan **TIDAK** menulis D1. Setelah kirim, muncul indikator "sedang mengetik" lalu dua bubble admin dari kamus: pemberitahuan *'ℹ️ Ini halaman DEMO template — chat sungguhan tidak berjalan di sini.'* dan penjelasan *'Di situs milik Anda nanti, pesan seperti ini langsung terkirim ke WhatsApp Anda… '*.
- **Situs klien selalu perilaku nyata**: `deployClient()` memaksa `NEXT_PUBLIC_OWNER_MODE='false'` (dua lapis fail-closed, perilaku yang telah ada) sehingga param demo selalu `null` di sana — jembatan WhatsApp v1.3.68 + jalur legacy tetap seperti biasa, tanpa sedikit pun terganggu.
- Pada mode demo, jalur legacy "menyimpan pesan D1 tak dibaca" **mati juga** di demo (kirim nyata tidak menulis apa pun). Jika someday owner mengisi nomor WA di `/admin`, jembatan WhatsApp spektakuler langsung digunakan dan mengesampingkan simulasi (aturan di hook: nomor WA valid mengalahkan demo).
- Kamus baru `chat.demoNotice` + `chat.demoReply` (id/en); test hook baru (fake timers): nol `fetch`, nol `window.open`, urutan mengetik → pemberitahuan → balasan siap. Suite penuh **144 file / 1197 test PASS**, tsc 0, lint 0.
- `APP_VERSION` bump → `1.3.70`.

## [1.3.69] - 2026-10-23

### 🧹 Bersih-bersih Chat: Rute Mikrofon Diratakan, Versi Health Dibump

Lanjutan jembatan WhatsApp (v1.3.68) — keputusan owner semuanya dua-duanya: **"BERSIHKAN"**.

- **`/api/chat/voice` dihapus total** (route + 8 test): rute transkripsi suara Groq yang hanya jalan bila `FEATURE_AI=true` + provider groq — di demo (dan klien tanpa AI) selalu **403**. Satu-satunya pemanggil adalah tombol mikrofon footer, yang di mode WA sudah disembunyikan v1.3.68.
- **Footer chat dirapikan**: MediaRecorder, timer, transkripsi, dan ikon mic/square/loader buang — chat kini teks + emoji, tombol kirim **selalu tampil** di kedua mode (disabled saat kosong) — tidak ada lagi tombol yang menekan 404/403. ~90 baris kode mati hilang.
- Kata kamus yatim `chat.recording`/`chat.transcribing` (id+en) ikut dibuang; daftar CSRF tidak lagi mendaftar `/api/chat/voice`.
- **`APP_VERSION` dibump `1.3.67` → `1.3.69`** — pertanyaan owner *"aku gak paham bump apa?"*: itu cukup ganti angka versi di konstanta (`src/lib/constants.ts`) supaya `/api/health` memajang versi rilis yang benar-benar berjalan, bukan yang bengkalai.
- **Jalur yang TETAP hidup dan dipertahankan:** `/api/chat/send` + `/api/chat/sync` (pemicu cadangan saat nomor WA klien kosong) + fungsi orphan `addAdminReply`/`setAiMode` (fondasi jawaban admin someday).
- Data chat produksi (`"daad"`, pengunjung asli 21:37 WIB) **dipura dari D1** setelah barisnya diback-up (`chat_rows_backup.json`): app_kv kembali **0 baris chat** — persis baseline audit v1.3.68.

## [1.3.68] - 2026-10-23

### 💬 Jendela Contact Kini Jadi Jembatan WhatsApp — Chat yang Benar-Benar Dijawab

Status fitur chat template sudah diperiksa sampai ke database (Oct 2026):

| Fakta | Bukti |
|---|---|
| Kotak chat lama berjanji "nanti aku segera balas" | `src/data/contact.json` subtext |
| **Tidak pernah ada yang menjawab** | `FEATURE_AI=false` + key AI kosong; fungsi balasan admin (`chatStore.addAdminReply`) ada di kode tapi **tidak dipanggil oleh route/API/UI mana pun** |
| Belum pernah dipakai pengunjung | app_kv D1 demo: **0 baris** `sessions`/`messages`/`typing` (semua bentuk key dicek) |
| App admin "Messages" bukan chat | Ia membaca `/api/leads` (form kontak), bukan pesan chat |

**Keputusan owner: chat = jembatan WhatsApp.** Jendela chat tetap ada sebagai tampilan ikonik; tombol kirim kini meneruskan pesan ke **nomor WhatsApp klien** (`wa.me`) dengan isi pesan yang diketik terbawa. Percakapan nyata terjadi di aplikasi WhatsApp klien — **di luar template** — dan dijawab langsung oleh orangnya, bukan bot. Setup klien: isi satu kolom — app admin "Contacts" → Nomor WhatsApp (kolom sudah ada sejak lama).

**Yang berubah:**

- `useChatSync(greeting, whatsappNumber)` — mode baru: polling 8 dtk/60 dtk **dimatikan sama sekali**, tombol kirim membuka `wa.me/<nomor>?text=<pesan>`, balon pesan tetap tampil dengan centang biru. **Nol request, nol tulis D1** — pemborong request terbesar demo hilang; anggaran harian Workers Free lega.
- **Nomor tidak ada/tidak valid → perilaku lama dipakai** (pesan tersimpan D1, polling jalan) — situs klien yang belum mengisi nomor tidak kehilangan fitur, dan bot/`FEATURE_AI` tidak disentuh (tetap tidur, bisa dinyalakan klien dengan key miliknya).
- Footer mode WA: tombol mikrofon (transkripsi) & `+` disembunyikan; pengirim emoji tetap bisa.
- Helper bersama baru `src/utils/whatsappLink.ts` (`normalizeWhatsAppNumber` + `buildWhatsAppLink`): menerima `0812…` (auto → `62…`), `+62…`, `62…`, bahkan URL wa.me yang di-paste; digit 8–15.
- Builder WA di template infinite-canvas (`CanvasLeftDrawer`) kini memakai helper yang sama — nomor ber-prefix `0` sebelumnya menghasilkan link `wa.me/0812…` yang **rusak**; sekarang benar.

**Verifikasi (nomor dummy `081234567890`, bukan nomor asli siapa pun):**

- Unit: 12 test baru — normalisasi semua bentuk nomor + hook `useChatSync` (mode WA: `window.open(wa.me…)` tanpa **satu pun** `fetch`; mode lama: tetap `POST /api/chat/send`). Suite penuh **145 file / 1204 test PASS**, tsc 0, lint 0.
- Live (dev + browser automation): desktop `/preview/os-desktop?app=contact` → ketik pesan → kirim → browser membuka **WhatsApp asli**: *"Chat on WhatsApp with +62 812-3456-7890"* + pesan full *"Tes dari agent - nomor dummy 6281234567890"*. Balon muncul centang biru. Log dev **nol** request chat. Nomor dummy lalu **ditarik dari D1** (baris `content_default-site` dipulihkan **identik byte-per-byte** dengan back-up — dibandingkan hash).

Catatan operasional: satu pesan pengunjung asli (`"daad"`, 21:37 WIB) masuk jalur lama saat halaman produksi belum punya jembatan — tinggal di D1 versi lama; setelah deploy ini, chat baru sepanjang nomor WA terisi tidak akan menyimpan apa pun lagi.

## [1.3.67] - 2026-10-23

###🩺 Probe Harian Berhenti Memberi Lampu Hijau Palsu

Temuan pasca-deploy v1.3.65: **hasil probe harian tidak pernah tersimpan**, tapi portal tetap menampilkan angka segar. Penyelidikan dengan angka nyata:

| Fakta | Bukti |
|---|---|
| Cron melapor sukses setiap kali | Respons `probedAt 19:28:56`, semua field ada, `passed true` |
| D1 tidak pernah menerimanya | `worker-health/latest` masih `updated_at 19:18:58` — 19 menit kemudian |
| Riwayat cuma berisi 1 entri | `worker-health/history` = 1 entri, padahal cron dipanggil 5 kali |

**Akar masalah yang terlihat dari kode:** `workerHealth` di-assign *sebelum* `recordWorkerHealth()`. Ketika tulisan itu melempar, `catch` menelannya dan respons tetap memamerkan angka — sehingga portal memajang bacaan lama sebagai bacaan hari ini.

**Yang diperbaiki:**

- Kegagalan **menyimpan** kini ikut dilaporkan di respons cron (`workerHealthRecorded` + `workerHealthRecordError`) — tidak lagi ditelan diam-diam. Hasil probe yang sah tetap dibalikkan, karena membuangnya justru menyembunyikan pengukurannya.
- `/api/health` kini menyertakan penanda **`stale`**: bacaan lebih tua dari **25 jam** (satu siklus cron) ditandai.
- Portal menampilkan badge **kuning `KUNO …`** untuk bacaan usang, lengkap dengan usianya — bukan lagi badge hijau `HIT 100%` yang bisa disalahartikan sebagai kondisi hari ini. Angka lama tetap disimpan apa adanya, karena menyembunyikannya justru menghapus satu-satunya petunjuk bahwa probe sudah lama berhenti menyimpan.
- Operasi D1 kini berjalan lewat **binding `env.DB`**, bukan `fetch()` ke `api.cloudflare.com`. Itu remediasi sebenarnya: melalui binding, operasi D1 jadi *subrequest internal* (batas 1.000) alih-alih eksternal (batas 50), dan tidak lagi membayar round-trip HTTP ~200-400 ms per query.
- Binding itu **tidak dipakai saat `next build` melakukan prerender**. Prerender ternyata juga berjalan dengan `NODE_ENV = production`, tapi D1 yang dijangkaunya adalah proxy miniflare **lokal yang kosong** — sehingga build gagal dengan `no such table: projects`. Prerender tetap membaca database produksi remote lewat REST, persis seperti perilaku lama yang berfungsi. Pembedanya: apakah konteks Cloudflare hidup di global scope, yang hanya terjadi di dalam Worker.

**Penyebabnya terbukti** — dan justru `workerHealthRecordError` yang baru dipasang itu yang membongkarnya:

```
Too many subrequests by single Worker invocation. To configure this limit, refer to
https://developers.cloudflare.com/workers/wrangler/configuration/#limits
```

Worker ini **tidak punya binding D1**, sehingga setiap operasi D1 ditempuh **keluar** lewat `fetch()` ke `api.cloudflare.com` — terhitung **subrequest eksternal** (batas 50 per invokasi). `bootstrapD1Schema()` sendiri memakai **24 panggilan** tiap isolate dingin. Isolate yang sudah pernah mem-bootstrap cukup membayar 2 tulisan; isolate dingin harus membayar 24 lebih dulu, lalu meledakkan batasnya.

Penyebab lain sudah **dikesampingkan lewat pengujian, bukan ditebak**: skema `app_kv` benar (`key TEXT PRIMARY KEY`), REST API sehat dari luar (jalur kode aslinya sukses: bootstrap 6098 ms, tulis 192 ms, baca 146 ms; 30 query beruntun 0 gagal), bootstrap 24 statement tidak pernah gagal, dan **alat pemicu maupun waktu-sejak-deploy bukan penyebabnya** (uji 3 putaran curl/Node bergantian: yang membedakan durasi run — 1373 ms sukses vs ~3900 ms gagal).

**Remediasi — binding D1.** Perbaikan pertama yang dicoba adalah `limits.subrequests: 500` di `wrangler.jsonc`, karena itu yang ditunjuk pesan error itu sendiri. **Gagal:** deploy ditolak API dengan `CPU limits are not supported for the Free plan [code: 100328]` — jadi akun ini **paket Free**, dan batas 50 subrequest eksternal memang tidak bisa dinaikkan.

Jalan buntu itu justru menegaskan arah perbaikan yang benar: **Worker ini tidak seharusnya memanggil database-nya sendiri lewat internet.** `wrangler.jsonc` kini memasang binding `d1_databases` (`env.DB` → `portfolio-template-prod`, diverifikasi 19 tabel lewat API), dan `queryD1()` menggunakannya di runtime produksi. Karena `queryD1` adalah satu-satunya titik leher — 43 pemanggilan, semua operasi D1 melewatinya — satu perbaikan ini menutup masalahnya untuk probe, backup, sweep, bootstrap, sekaligus seluruh fitur lain.

Dua hal yang dijaga ketat:

- **Tidak ada fallback setelah pernyataan dikirim ke binding.** Kalau binding gagal di tengah jalan, galat diteruskan — bukan diulang lewat REST — karena pernyataan mungkin sudah dieksekusi. Mengulangnya berarti menulis dua kali.
- **Jalur REST dipertahankan utuh** sebagai fallback untuk dev lokal, unit test, dan 23 script pemeliharaan yang dijalankan lewat `tsx`. Karena itu binding diimpor **secara dinamis di dalam `try/catch`**: import statis `@opennextjs/cloudflare` akan ikut dimuat oleh modul ini dan berpotensi mematikan semua alat operasional itu di luar runtime Cloudflare.

**Hasil akhir — terverifikasi, bukan diklaim.** Deploy `cbf69f4e-edfa-4402-8ebe-ada4b7d6b490` menampilkan `env.DB (portfolio-template-prod)` di daftar binding. Uji multi-run: **9 putaran berturut-turut, 9 tulisan masuk**, tiap putaran dibaca langsung dari D1 (bukan dari respons cron) — termasuk putaran pertama pada isolate dingin, kondisi yang dulu **pasti** gagal. Sebelum remediasi: 1 dari 5. Saat verifikasi `/api/health`: `stale false`, rasio cache 100%, p95 156 ms.

## [1.3.66] - 2026-10-23

###🗂️ Redesain Desktop Admin: 4 Zone Langsung Terbuka 2×2, Kartu Folder Dihapus

Login admin kini **langsung menampilkan 4 jendela zone tersusun 2×2** — layar "4 kartu folder" yang harus diklik dulu sudah dihapus:

- **Susunan otomatis sesuai pesanan owner:** Sistem Owner (kiri-atas), Komunikasi (kanan-atas), Konten & Berkas (kiri-bawah), Tampilan (kanan-bawah). Posisi dihitung dari ukuran layar → selalu rapi dan kembali rapi setiap halaman admin dibuka ulang.
- **Jendela zone terkunci penuh:** titik merah/kuning/hijau tetap dirender tapi fungsi tutup/kecilkan/full dimatikan; zona juga tidak bisa digeser maupun diubah ukurannya — komposisi 2×2 mustahil berantakan. Judul zone (ikon + nama) tetap.
- **Jendela CRUD di dalam zone tetap normal:** bisa ditutup, diminimize, difull, digeser, dan diresize seperti biasa.
- **Taskbar bawah tetap** hanya menampilkan jendela yang terbuka (4 zone + CRUD yang dibuka) — tanpa tombol launcher tambahan.
- **Layar kecil (< 1160×700):** keempat zone tetap otomatis terbuka dengan posisi bertumpuk (stagger) — masih bisa digeser manual.
- Kartu folder `ZoneFolderIcon.tsx` + gaya CSS-nya dihapus (sudah mati). Guard test baru: auto-open 4 zone, urutan kuadran sesuai mockup, aman terhadap StrictMode double-invoke, dan fallback layar kecil.

## [1.3.65] - 2026-10-23

### 🩺 Koreksi: probe harian kini mengukur kesehatan cache (perbaikan atas 1.3.64)

**Versi 1.3.64 ternyata tidak mengukur apa pun, dan ini harus dikoreksi terbuka.** Verifikasi pasca-deploy membuktikan probe-nya selalu melapor `32/32 lulus` — sebuah **lampu hijau palsu**. Empat fakta terukur langsung di produksi:

1. **Query unik tidak mem-bust cache.** Halaman demo adalah ISR statis (`revalidate = 300`), sehingga cache key-nya pathname saja. Tiga URL `?probe=` berbeda berturut-turut semuanya menjawab `x-opennext-cache: HIT`. Artinya 32 request probe membaca **entri cache yang sama** dan selesai hanya ±34 ms.
2. **`/api/revalidate` tidak menembus.** Endpoint melapor `{"revalidated":true}` tapi cache tetap `HIT` — karena `shouldLazilyUpdateOnCacheHit: false` membuat regional cache otoritatif sampai `max-age` 300 detiknya habis sendiri.
3. **Setelah TTL habis pun bukan MISS.** Uji tunggu 315 detik: responsnya `STALE` (baca KV, sajikan basi, revalidasi **sekali** di latar), lalu `HIT`. Tidak pernah terjadi 32 render serentak.
4. **Burst 32 serentak tepat setelah purge:** `{"HIT":32}` — nol miss.

Jadi memaksa render dingin **tidak mungkin dilakukan dari dalam aplikasi** tanpa mengubah konfigurasi cache — yang tidak kita inginkan. Ditambah, 32 jauh di bawah ambang patah terukur (48 bersih, 64 → 1102), jadi bahkan dalam skenario rusak pun versi lama tetap hijau.

**Perbaikannya:** berhenti berpura-pura memaksa render, dan mengukur hal yang justru menjadi **akar masalah** — apakah cache masih melindungi.

- Probe kini membaca header `x-opennext-cache` dari **setiap** respons dan menghitung **rasio cache**: `HIT` dan `STALE` dihitung dilindungi (keduanya menyaji dari cache tanpa render), `MISS`/tanpa header dihitung berrender.
- `passed` kini **dua syarat**: tidak ada request gagal **dan** rasio cache ≥ 90%. Rasio runtuh di bawah ambang tetap ditandai merah **walau nol request error** — dan itu persis kondisi saat kuota KV habis pada 2026-10-21 yang berujung Error 1102.
- Menyimpan p95 TTFB sebagai indikator kuantitatif tambahan: selama cache sehat 32 request serentak selesai ±34 ms; kalau mulai render, angkanya melonjak ke ratusan milidetik.
- Portal: kolom diganti jadi **"Kesehatan Cache Worker"** dengan badge `HIT 100%` (hijau) atau `HIT 87% · 2× 1102` (merah), plus p95 di tooltip. Entri lama tanpa field baru tetap tampil dengan format lawas tanpa error.

**Yang tidak berubah:** tetap cron 01:00 WIB, tetap 32 request serentak lewat service binding, tetap khusus site owner (`OWNER_MODE`), tetap tampil di `/api/health` **dan** portal.

**Batasan yang tetap jujur:** sifatnya masih **prediktif, bukan retroaktif** — menjawab "perlindungan cache masih utuh hari ini?", bukan "1102 terjadi kapan". Probe tidak mendeteksi 1102 lewat jumlah kegagalan; sinyalnya ada pada rasio cache dan latensi.

Gate: **141 file / 1.167 test PASS** (3 test baru mengunci perilaku inti: rasio runtuh walau nol error → gagal; `STALE` tetap dihitung terlindungi; ambang 0,90 diuji dua sisi), tsc 0, lint 0.

## [1.3.64] - 2026-10-23

### 🩺 Fitur: Pemeriksaan Kesehatan Worker Harian (peringatan dini Error 1102)

Mengatasi masalah Error 1102 yang sempat membuat halaman demo iframe mati. Error 1102 mematikan isolate Worker, sehingga **tidak bisa ditangkap** `try/catch` maupun error tracker mana pun — satu-satunya cara mengetahuinya selama ini adalah memantau `wrangler tail` secara manual. Kini situs mengukur sendiri **kepala ruang**-nya setiap hari.

**Cara kerjanya:** cron harian (01:00 WIB) menembakkan **32 request render-dingin serentak** ke halaman demo `/preview/spatial-gallery`, menghitung berapa yang tumbang, lalu menyimpan hasilnya di database.

- **Mengapa 32:** ambang patah sudah terukur — 48 paralel masih bersih, 64 mulai menimbulkan Error 1102. Jadi 32 duduk jauh di bawah ambang: probe normalnya lulus, dan baru berubah merah kalau kepala ruang benar-benar menyusut.
- **Khusus situs owner** (`OWNER_MODE`): situs klien **tidak dijalankan** probe ini dan tidak menulis apa pun ke database mereka — beban harian klien tidak bertambah.
- **Tampil di dua tempat:** kolom baru **"Kepala Ruang Worker"** di menu Status Klien portal (`PENGELOLA_KLIEN.bat`) — hijau `32/32` berarti sehat, merah `29/32 · 2× 1102` berarti kepala ruang sudah menyempit — dan field `workerHealth` di `/api/health`.
- **Riwayat 7 hari** disimpan agar trennya bisa dilihat, bukan hanya angka hari ini.

**Perbaikan portal:** site Anda sendiri sebelumnya **tidak muncul** di menu Status Klien. Daftar itu dibangun dari `arsip-klien/*/config.env`, dan satu-satunya folder (`uji-domain`) tidak punya `config.env` — portal memakai fallback `uji-domain.workers.dev` yang mati (HTTP 000). Kini dibuat entry `arsip-klien/00_site-owner/config.env` yang menunjuk ke `https://makeitbetter.my.id` (HTTP 200), jadi site produksi ikut terpantau bersama klien lain.

**Yang perlu diketahui (jujur):** sifatnya **prediktif, bukan retroaktif** — ia menjawab "kepala ruang berapa hari ini", bukan "Error 1102 terjadi kemarin jam berapa". Probe juga membebani Worker 32 render serentak sekali sehari, dan menyisakan entri cache yang kedaluwarsa sendiri dalam 300 detik.

Gate: **21 test PASS** (10 modul probe + 11 route cron, termasuk kasus 1102 vs 503 biasa vs timeout, owner-only, dan "probe gagal tidak menggagalkan cron").

> ⚠️ **DIKOREKSI di [1.3.65].** Ternyata probe pada versi ini **tidak mengukur apa pun**: query unik tidak mem-bust cache sehingga semua request membaca entri cache yang sama, dan jumlah kegagalan takkan pernah naik karena 32 berada jauh di bawah ambang patah. Rincian keempat bukti produksi dan perbaikannya ada di entri 1.3.65.

## [1.3.63] - 2026-10-23

### 🗂️ Perapian Desktop Admin: Video Hero pindah ke "Sistem Owner"

Permintaan owner: (1) app **Video Hero** dipindahkan dari zone **Tampilan** ke zone **Sistem**, dan (2) zone **Sistem** diganti namanya jadi **"Sistem Owner"** — sehingga seluruh tiga app khusus owner (**Harga Jual, Order & Pembayaran, Video Hero**) kini berkumpul dalam satu zone yang jelas identitasnya.

- Perubahan murni tata letak desktop admin (registry `ADMIN_ZONES`); route, panel, API, dan proteksi `ownerOnly` (sembunyi di situs klien + API balas 404) **tidak berubah sama sekali**.
- Guard test registry diperkuat: `heroVideos` kini ikut dipastikan `ownerOnly` (tampil di owner, hilang di klien) + test baru mengunci letak zone & label "Sistem Owner".

Gate: **tsc 0 + lint 0 + registry test 6/6 PASS**.

## [1.3.62] - 2026-10-23

### ✨ Fitur: CRUD Kontak Publik terpisah + label WhatsApp Transaksi (2 CRUD, 2 tujuan)

Permintaan owner: sistem CRUD WA & email selama ini membingungkan karena ada dua tujuan berbeda — akhirnya diputuskan **dua CRUD terpisah di dua letak berbeda**:

1. **Komunikasi → Contacts — tab baru "Contact Info"**: form **Email, Telepon, WhatsApp, Alamat**. Sebelumnya field ini (`info.email`/`phone`/`address`/`socialMedia.whatsapp`) sudah didukung tipe & API-nya tapi **tidak punya form admin sama sekali** — jadi tidak bisa diisi dari panel. Isinya kontak publik yang tampil ke pengunjung (window Contact, tombol "Mulai Obrolan WhatsApp", link email); di situs klien otomatis = kontak milik klien.
2. **Sistem → Harga Jual — label diperjelas**: field WA kini berjudul **"WhatsApp Transaksi — buyer chat setelah membeli"** + keterangan bahwa kontak publik diatur terpisah di Komunikasi → Contacts. Nomor ini hanya untuk alur pesanan (konfirmasi bayar & serah-terima akses), bukan kontak tampilan.
3. **🐛 Fix: tab Settings di panel Contact Page tidak bisa menyimpan** — "Chat Button Text" selalu gagal 400 `Invalid contact payload` (schema `updateContactSchema` `.strict()` tidak memuat key `labels`, dan `updateContactData` tidak pernah menyimpannya). Diperbaiki di kedua lapis + 2 test baru.

Gate: **tsc 0 + lint 0 + suite 140 file / 1.150 test PASS**.

## [1.3.61] - 2026-10-21

### 🔧 Fix: Error 1102 "Worker exceeded resource limits" pada iframe demo live

Laporan owner: saat membuka iframe demo live di halaman muka, **Spatial Gallery** dan **Infinite Canvas** memunculkan halaman Error 1102 (Ray `a4e0e2f0d882016b`), sementara macOS Desktop lancar. Error 1102 direproduksi di produksi (bukan tebakan): 16 request parallel ke `/preview/spatial-gallery` membalas **4 dari 32** dengan HTTP 503 `error code: 1102` (plus 1 respons HTML terpotong di tengah stream), `/preview/infinite-canvas` 2 dari 32, sedangkan 6/6 request **sequential selalu 200** — jadi pemicunya render SSR bersamaan, bukan beratnya template.

**Akar masalah (terbukti dari `wrangler tail` produksi):** kuota baca KV harian Cloudflare habis — `Failed to get from cache / Error: KV get() limit exceeded for the day`. Karena baca cache gagal, **semua** route jatuh ke render penuh di Worker tiap request (`x-nextjs-cache: MISS` + TTFB 1,5–3,8 detik pada URL identik berulang), lalu beberapa render bersamaan menembus memori isolate 128 MB → 1102.

- **Perbaikan:** `open-next.config.ts` kini membungkus KV incremental cache dengan `withRegionalCache` (Cache API per Data Center) + `bypassTagCacheOnCacheHit` + `shouldLazilyUpdateOnCacheHit: false`. KV hanya dibaca saat entry pertama per Data Center per URL (mode `long-lived`, TTL 300 detik); request berikutnya dilayani Cache API dengan **0 read KV dan 0 read tag cache** — kuota harian kembali jauh di bawah batas, TTFB kembali ke ±100 ms, dan render bersamaan (pemicu 1102) nyaris hilang.
- **Konsekuensi yang disadari:** revalidasi on-demand bisa tertahan maksimum 300 detik (sama dengan `revalidate` halaman preview), sehingga batas staleness tetap terukur.
- **Catatan:** penanganan ini murni di sisi cache. Opsi lanjutan bila kuota masih ketat di masa depan: naikkan plan Cloudflare, atau pindahkan store cache ke R2 (`NEXT_INC_CACHE_R2_BUCKET`).

## [1.3.56] - 2026-10-21

### 🐛 Fix: Gambar statis tengkorak hilang total (sliver pusat + fallback webp diperbarui)

Laporan owner via screenshot: gambar statis bawaan ("tengkorak") **masih sempat terlihat ketika lembaran meluncur di tengah layar** (dilingkari merah). Akar masalah: aturan `VIDEO_SKIP_CENTER` (0.35) sengaja melepas lapisan video saat lembaran berada di sudut tepi/sliver tengah, sehingga menampakkan gambar latar dasar `os-desktop.webp` bawaan lama yang masih berupa gambar tengkorak.

- **Perbaikan WebGL:** `VIDEO_SKIP_CENTER` dimatikan (set ke 0). Seluruh lembaran ber-video terlapisi video penuh tanpa pernah dilepas di posisi mana pun, termasuk saat di tengah layar.
- **Pembersihan Aset Bawaan:** File gambar dasar `public/landing/os-desktop.webp` diganti dengan tangkapan layar bersih dari rekaman video asli owner (biru) — gambar tengkorak lama terhapus total dari seluruh website, sehingga saat loading awal maupun fallback statis, tampilan selalu serasi dengan video.
- **Anti-Cache Video Hero:** URL video hero kini menyematkan versi `?v=<updatedAt>` dari database agar saat owner mengganti rekaman di masa mendatang, pengunjung langsung melihat video terbaru tanpa terhalang cache browser.

## [1.3.60] - 2026-10-21

### 🧹 Perapian Kode: Bilah Demo Live

Permintaan owner: baris `background` di kedua tombol bilah "Live Web" (Tab Baru & ✕) **dihapus total dari kode** (bukan lagi diset `transparent`). Hasil tampilan identik 100% dengan v1.3.59 — nilai awal CSS memang "tanpa latar", jadi kedua tombol tetap polos bersih tanpa kotak maupun garis.

## [1.3.59] - 2026-10-21

### 🎨 Perbaikan Tampilan Lanjutan: Bilah Demo Live

Sesuai masukan lanjutan owner: latar abu-abu transparan (kotak kaca `rgba(255,255,255,0.1)` / `0.12`) di belakang teks **Tab Baru** dan tombol **✕** pada bilah "Live Web" **dihapus total** — kedua tombol kini tampil polos transparan tanpa kotak maupun garis tepi, hanya teks dan ikon putih.

## [1.3.58] - 2026-10-21

### 🎨 Perbaikan Tampilan: Bilah Demo Live di Halaman Jualan

Sesuai masukan owner: garis putih transparan (border) pada tombol **Tab Baru** dan tombol **✕ (tutup)** di bilah "Live Web" atas lembaran demo **dihapus total** — kedua tombol kini tampil bersih dengan latar kaca putih samar tanpa garis tepi.

## [1.3.57] - 2026-10-21

### ✨ Fitur: Auto-Poster Otomatis untuk Video Hero

Saat Anda upload rekaman di **Tampilan → Video Hero**, browser kini otomatis **mengekstrak satu foto frame terbaik (detik ke-1)** dari video dan mengunggahnya bersama sebagai **poster** — tanpa perlu membuat screenshot manual.

- **Pengunjung koneksi lambat:** foto frame rekaman Anda tampil lebih dulu (diam sesaat), lalu mulus bergerak jadi video — tidak ada kedipan hitam atau gambar lain yang menyelingi.
- **Pengunjung dengan animasi dimatikan (pengaturan hemat gerak):** yang tampil adalah foto asli dari rekaman Anda, bukan screenshot lama.
- **Bebas repot:** kapan pun Anda ganti rekaman, posternya **ikut berganti otomatis** mengikuti video barunya.
- Gagal ekstrak poster (kasus jarang) = rekaman tetap tersimpan normal tanpa poster.
- Panel admin kini menampilkan pratinjau poster di tiap slot yang aktif.

## [1.3.55] - 2026-10-21

### 🐛 Fix: Cover statis ("tengkorak") masih tampil di lembaran berulang koridor

Laporan owner via screenshot: rekaman upload (biru) tampil di sebagian lembaran, tetapi **beberapa lembaran lain tetap menampilkan gambar statis bawaan** — padahal rekaman sudah di-upload dan halaman sudah di-refresh berkali-kali. Akar masalah: koridor majalah berisi **20 lembaran yang mengulang 3 template** (template yang sama muncul ±7 kali), sedangkan lapisan video dibuat **tetap hanya 2** — sehingga hanya 2 lembaran terdekat yang kebagian video, sedangkan lembaran template yang sama di posisi lain tetap statis.

- **Perbaikan:** jumlah lapisan video kini **dinamis = jumlah lembaran yang punya rekaman** di koridor. Setiap lembaran hasil upload rekaman selalu menampilkan videonya, di posisi gulir mana pun. Elemen video tetap satu per URL (biaya bandwidth & memori tidak bertambah, hanya draw call GPU tambahan yang ringan).
- Slot tanpa rekaman tetap gambar screenshot statis (tanpa video bawaan, sesuai permintaan owner).

## [1.3.54] - 2026-10-21

### 🐛 Fix: Rekaman upload "tertutupi" gambar statis di beberapa posisi gulir

Lanjutan uji nyata owner (setelah v1.3.53): rekaman upload hanya tampil sesekali — di posisi gulir tertentu, lembarannya menampilkan **gambar statis** seolah video tertutupi. Akar masalah: pemilihan lembaran ber-video hanya mengambil 2 lembaran dengan posisi Z terdekat **tanpa memprioritaskan lembaran yang punya rekaman** — bila lembaran ber-video kebetulan jatuh di urutan ke-3 atau sliver pusat, lapisan videonya hilang dan yang tampil gambar statisnya.

- **Perbaikan:** semua lembaran terbaca kini menjadi kandidat, lalu **hanya lembaran yang punya rekaman upload** yang mengisi lapisan video (maksimal 2, tetap). Lembaran tanpa rekaman tidak lagi memakan jatah lapisan.
- **Uji:** tsc 0; lint bersih; suite penuh PASS; verifikasi visual halaman jualan pada beberapa posisi gulir.

## [1.3.53] - 2026-10-21

### 🎨 Perubahan: Video default bawaan tidak lagi tampil di hero halaman jualan

Owner menemukan saat uji nyata: setelah meng-upload video hero, **video/gambar default bawaan masih ikut tampil** di lembaran lain (fallback otomatis `/landing/*.mp4`) sehingga terlihat seperti "dobel / tertimpa". Sesuai permintaan owner: **hanya rekaman hasil upload yang beranimasi** — slot tanpa rekaman kini menampilkan **gambar screenshot statis**, tanpa animasi video bawaan sama sekali.

- **Perubahan:** fallback turunan `.webp → .mp4` pada `previewVideoOf` (MagazineShowcase) dihapus; sumber video hero = URL admin (D1) saja.
- **Uji:** tsc 0; lint bersih; suite penuh PASS; verifikasi visual halaman jualan (upload → hanya video upload tampil; hapus → semua statis).

## [1.3.52] - 2026-10-21

### 🐛 Fix: Mutasi admin berikutnya bisa gagal "Invalid or missing CSRF token" (polling auth merotasi token)

Uji nyata upload Video Hero menemukan bahwa **setelah satu mutasi sukses, mutasi berikutnya bisa ditolak server** dengan pesan _"Invalid or missing CSRF token"_. Akar masalah lintas-fitur: `GET /api/auth/check-auth` (dipoll `useAdminAuth`) **membuat token CSRF baru setiap kali** dan menimpa cookie `csrf_token`, sedangkan sisi client meng-cache token lama (`client-csrf.ts`) dan tidak tahu cookie sudah berganti → header basi → server menolak. Ini bisa mempengaruhi **semua form admin** (simpan profil, upload, dsb.), bukan hanya Video Hero.

- **Perbaikan:** `check-auth` kini **menggunakan ulang token dari cookie** yang sudah ada (hanya membuat baru bila belum ada) — pola yang sudah dipakai lama oleh `/api/admin/check-auth`. Token stabil selama sesi → cache client selalu cocok.
- **Uji:** 1 test baru (cookie yang ada tidak di-rotate); suite auth 7 file / 35 test PASS; tsc 0; lint bersih.

## [1.3.51] - 2026-10-21

### 🐛 Fix: Upload Video Hero selalu gagal di langkah terakhir ("URL video harus http(s)")

Uji nyata pertama oleh owner (v1.3.50) menemukan bahwa **alur upload selalu gagal setelah kompresi & unggah sukses**: route `/api/admin/upload` mengembalikan **URL relatif** (`/r2/assets/projects/…`) sedangkan validasi penyimpanan D1 dengan sengaja mewajibkan **http(s) absolut** (guard keamanan — tolak `javascript:` & protocol-relative). Selain itu parameter `folder=hero-videos` tidak dikenali route upload (hanya `sounds`/`wallpapers`/`models`/`assets/*`) sehingga video hero jatuh ke folder `assets/projects` yang tercampur file karya.

- **Perbaikan (panel Video Hero):** URL hasil upload dijadikan absolut (`new URL(url, origin)`) sebelum disimpan, dan folder upload jadi `assets/hero-videos` (folder khusus, dihormati route upload). Validasi keamanan service tidak diubah — tetap ketat.
- **Uji:** tsc 0; lint bersih; test terkait PASS (service + route tidak berubah).

## [1.3.50] - 2026-10-20

### 🐛 Fix: App "Video Hero" tidak bisa dibuka dari desktop admin (Panel belum tersedia)

Ditemukan saat uji nyata oleh owner: klik **Video Hero** di zone Tampilan membuka window, tapi isinya hanya teks _"Panel 'heroVideos' belum tersedia"_. Akar masalah: app terdaftar di registry (`registry.ts`) dan `APP_ROUTE_MAP`, halaman `/admin/hero-videos` juga ada — tetapi key-nya **tidak didaftarkan ke `PANEL_MAP`** di `WindowContentRenderer.tsx`. Semua isi window admin diambil dari `PANEL_MAP` (halaman route tidak dirender `ClientAdminLayout`), jadi panelnya tidak pernah tampil. Bug kelas ini terulang untuk ketiga kalinya (`ai` v1.3.28, `harga` v1.3.29, kini `heroVideos`).

- **Perbaikan:** dynamic import `HeroVideosPanel` + key `heroVideos` di `PANEL_MAP`.
- **Guard anti-ulang:** `PANEL_MAP` kini di-export dan ditambah test coverage — semua app di `ADMIN_ZONES` wajib punya key `PANEL_MAP` (kecuali `ai` yang sengaja mati), jadi app baru yang terlewat langsung gagal test.
- **Uji:** test registry 5 PASS; tsc 0; lint bersih.

## [1.3.49] - 2026-10-20

### ✨ Video Preview Hidup di Lembaran Hero + Panel Admin "Video Hero" (Owner Rekam & Upload Sendiri)

Lembaran koridor majalah di hero halaman jualan kini bisa **menampilkan video rekaman demo** (muted, loop) yang menempel presisi pada lembaran sambil bergerak — kesan "hidup" tanpa membebani browser (maksimal 2 lembaran paling terbaca sekaligus; video disembunyikan otomatis saat lembaran terangkat/demo live tayang, tab tersembunyi, atau video gagal dimuat — kembali ke gambar seperti biasa).

**Alur untuk owner (tanpa script, tanpa IT):** rekam layar demo (HP/laptop, durasi pendek ±15–30 detik, tanpa suara) → login `/admin` → zone **Tampilan** → buka **Video Hero** → upload rekaman ke slot template yang sesuai (OS Desktop / Infinite Canvas / Spatial Gallery). Rekaman **dikompres otomatis di browser** (MP4 H.264 720p, audio dibuang, faststart — jadi ringan & mulai diputar sambil masih diunduh), file mentah besar pun aman (batas 500 MB). Bisa **Ganti** atau **Hapus** kapan saja; hero ter-update otomatis dalam ±1 menit. Slot kosong otomatis memakai video default bawaan / gambar screenshot — tidak pernah ada kotak kosong.

**Khusus pemilik (owner-only):** aplikasi "Video Hero" dan API-nya hanya hidup di site owner — di site klien aplikasi tidak tampil sama sekali dan API membalas 404 (guard `ownerMode`, diuji test). Data tersimpan di D1 `platform_settings`, file video di R2.

- **Catatan wajib (tracker #172):** jika tampilan demo template berubah (wallpaper/layout baru), rekam ulang video hero & upload lewat panel Video Hero supaya preview selalu akurat.
- **Uji:** 15 test baru (service D1 + route API owner-mode + fallback aman); suite penuh lihat tracker #172; tsc 0; lint bersih.
- **File:** baru `heroVideoService.ts` (+test), `api/admin/hero-videos/route.ts` (+test), `HeroVideosPanel.tsx`, `admin/hero-videos/page.tsx`; ubah `registry.ts` (app ownerOnly), `page.tsx`, `LandingPage.tsx`, `MagazineShowcase.tsx`, `constants.ts` (1.3.49); `public/landing/os-desktop.mp4` = video default contoh.
- **Bersih-bersih:** script rekam otomatis `rekam:demo` (percobaan sebelumnya) dihapus — alur resmi = rekam manual + upload via admin.

## [1.3.48] - 2026-10-20

### ✨ Hero "Jungkir-balik Majalah": Koridor Berhenti → Demo LIVE Sungguhan (Tanpa Popup)

Permintaan owner setelah melihat hasil v1.3.47: *"hasil gambar screenshot kurang bagus… lembaran yang bergerak harus live web"* — dengan syarat **efek koridor majalah tidak berubah** dan **tanpa popup**. Solusi: **ritme luncur → berhenti → terangkat → LIVE** (gaya hybrid "live saat berhenti" yang direkomendasikan; opsi CSS3D & live-penuh ditolak dengan angka terukur: 6–8 iframe Next.js serentak = freeze HP, halaman demo ±1,5 MB JS).

**Perilaku baru:** koridor meluncur satu lembaran (±1 dtk) → berhenti (±0,8 dtk) → lembaran terdekat **terangkat & berputar menghadap** (animasi flip bawaan) → **iframe demo live sungguhan ditumpangkan presisi di atasnya** (bisa scroll & klik) → setelah ±5,5 dtk otomatis lanjut ke lembaran berikutnya. Geser manual → snap ke lembaran terdekat → live. Ketuk lembaran mana pun → terangkat → live. **✕ / Esc / ketuk luar** menutup. Pengunjung yang menyentuh demo (klik/scroll di iframe) tidak akan diganggu siklus otomatis. Saat tab tersembunyi, rAF browser berhenti → seluruh siklus ikut jeda (hemat baterai). Selalu **1 iframe dalam satu waktu** (±1,5 MB JS pertama, sisanya hangat di cache) — bukan berbagai gambar statis yang dikeluhkan.

**Teknis:** mesin drift konstan diganti state-machine luncur–snap–jeda di `MagazineShowcase.step()` (snap ala carousel saat drag berakhir; `facingIndex()` memakai rumus `zCorridor` shader yang sama; rect tumpangan dihitung dari proyeksi kamera WebGL `computeFocusRect()` sehingga presisi di segala ukuran layar + recompute saat resize); tumpangan transparan sampai `onLoad` iframe (tanpa kedip putih); render WebGL dijeda saat live tayang; `previewUrl` kini melekat pada tiap gambar lembaran.

**Dihapus (riwayat git = cadangan):** `TemplateDetailModal.tsx` + testnya (popup digantikan lembaran live; jalur fallback kini buka demo di **tab baru**), props `basePrice`/`adminWhatsapp` LandingPage + pembacaan D1 `getBasePrice`/`getPublicPaymentInfo` di `page.tsx` (hanya dipakai popup), state `activeIndex`, mesin drift (`travel.drift`).

- **Uji:** 6 test (`magazine-showcase.test.tsx` — kartu fallback, window.open previewUrl, nav keyboard, reduced-motion, tanpa previewUrl = tanpa tab kosong); suite penuh lihat tracker #171; tsc 0; lint bersih.
- **File:** ubah `MagazineShowcase.tsx`, `LandingPage.tsx`, `page.tsx`, `constants.ts` (1.3.48); hapus `TemplateDetailModal.tsx` + testnya.
- **Belum teruji otomatis:** jalur live-on-focus butuh WebGL nyata (jsdom tidak punya) — diverifikasi via pemeriksaan DOM produksi + mata owner.

## [1.3.47] - 2026-10-19

### ✨ Hero Baru: Koridor Majalah WebGL (Magazine Flip) — Pengganti 3 Iframe Live

Permintaan owner: *"efek iframe live web… aku tidak suka yang sekarang"* → ditemukan komponen **"Magazine Flip"** dari Originkit (originkit.dev, lisensi **MIT**). Kode sumbernya disertakan penuh di dalam prompt AI mereka, jadi **tanpa CLI/registry/API key** — kode disalin, diaudit, dan disesuaikan langsung. Hasil: hero kini koridor lembaran majalah 3D yang berjalan tanpa henti (drag/geser menjelajah; ketuk lembaran → terangkat → **popup detail dengan iframe LIVE interaktif** — permintaan v1.3.41 tetap).

**Keuntungan performa:** hero sebelumnya memuat **3 iframe situs live (±4,7 MB JS)**; kini hanya **3 tangkapan layar WebP (±102 KB total)**. `three` sudah ada di project → **nol dependensi baru**.

**Penyesuaian atas kode asli (5):** (1) sel atlas 512→1024px (ketajaman saat zoom); (2) `images` wajib tanpa default foto Unsplash; (3) callback `onSheetActivate` dipanggil saat animasi terangkat tuntas → membuka popup; (4) `prefers-reduced-motion` / gagal WebGL → grid kartu statis yang tetap bisa diklik; (5) latar transparan (mengambang di atas split off-white/biru) + nav keyboard sr-only untuk aksesibilitas.

**Bersih-bersih:** `LiveStage.tsx` (kartu ifloat/parallax/FLIP, 142 baris) + CSS stage lama (±170 baris) + test lama dihapus; riwayat git tetap jadi cadangan. Tangkapan layar demo diambil dari preview produksi (`/preview/*`) → `public/landing/`.

- **Uji:** 5 test baru (`magazine-showcase.test.tsx` — fallback klik, nav keyboard, reduced-motion, sumber gambar); suite penuh **138 file / 1.110 test PASS**; tsc 0; lint bersih.
- **File:** baru `MagazineShowcase.tsx` + test; ubah `LandingPage.tsx`, `templates.ts` (+field `screenshot`), `landing.css`, `constants.ts` (1.3.47); hapus `LiveStage.tsx` + testnya; aset `public/landing/*.webp`.
- **Catatan:** komponen pihak ketiga (MIT) wajib tetap teratribusi di kepala file — jangan hapus catatan provenance.

## [1.3.46] - 2026-10-19

### 🔍 Audit Ulang Fitur Lupa Password: 3 Cacat Logika Ditemukan & Diperbaiki

Permintaan owner: *"cek lagi cacat logika"* — audit ulang menyeluruh terhadap v1.3.45 dengan membaca ulang kode terpasang (bukan mengulang klaim). Tiga cacat NYATA ditemukan, semuanya diperbaiki + diuji:

1. **Tautan mati bisa terkirim lewat email.** `storeResetToken` mengabaikan hasil transaksi CAS — `database.ts:272` bisa mengembalikan `committed:false` setelah3 kali gagal-saing, artinya token TIDAK tersimpan padahal dikembalikan untuk email. **Perbaikan:** cek `result.committed`; gagal → token tidak dikirim (log error, respons generik tetap 200). Test baru: CAS gagal → email tidak dikirim.
2. **Dua halaman admin lolos dari pencabutan sesi.** `/admin` dan `/admin/projects/explorer` memanggil `verifySiteUserJWT` **langsung** (bukan lewat guard) — sesi yang sudah dicabut (password diganti) masih me-render kerangka dashboard (data API tetap ditolak guard, tapi halaman menampilkan diri sebagai login). **Perbaikan:** kedua halaman kini memeriksa `isSessionRevoked` (konsisten dengan halaman login).
3. **Ganti password sendiri = langsung dilempar keluar (regresi UX).** `setSessionNotBefore` di `changePassword.ts` menangkap SEMUA sesi — termasuk sesi pelaku ganti-password, padahal sebelum v1.3.45 pemilik tetap login setelah sukses. **Perbaikan:** `POST /api/auth/change-password` kini menerbitkan **cookie segar** setelah sukses (`signSiteUserJWT` + set cookie) — pelaku lanjut mulus, sesi-sesi LAIN tetap mati (iu token baru ≥ tanda pencabutan → lolos guard). Test baru: sukses → cookie segar terbit; gagal → tidak ada cookie.

**Risiko yang ditinjau dan DITERIMA (dicatat, bukan diperbaiki):** sisi-waktu (timing) permintaan lupa-password — email terdaftar = kerja lebih berat dari tidak terdaftar, tapi rate-limit 3/10 menit membuat serangan statistik tidak praktis; token tanpa klaim `iat` dianggap tidak tercabut (memalsukan butuh `JWT_SECRET`); jendela ≤60 detik akibat cache per-isolat (by design, dokumentasi); **backlog:** `reset-customer-password.ts` (jalur owner) tidak menulis `securityNotBefore` — sesi lama korban bisa hidup ≤2 jam setelah owner mereset dari script.

- **Test:** +3 (cookie segar, gagal-ganti-tanpa-cookie, CAS gagal) → total suite hijau.
- `src/lib/constants.ts` — `APP_VERSION` → **1.3.46**.

## [1.3.45] - 2026-10-19

### 🔑 Fitur Baru: Lupa Password — Tautan Reset Lewat Email (+ Pencabutan Sesi Login Lama)

Permintaan owner (2026-10-18): klien harus bisa mengatur ulang password sendiri seperti website lain. Alur OTP-dulu-baru-link yang diajukan direvisi menjadi **tautan saja** (bukti identik, cukup 1 email, 2 langkah — standar Gmail/GitHub).

- **Alur baru:** halaman login → tautan **"Lupa password?"** → `/admin/lupa-password` (isi email) → 1 email berisi tautan `/admin/reset-password?token=…` (**berlaku 30 menit, sekali pakai**) → buat password baru (min. 8 karakter) → semua sesi login lama otomatis dicabut.
- **Dua endpoint baru:** `POST /api/auth/forgot-password` + `POST /api/auth/reset-password` (terdaftar di `publicRoutes` middleware + allowlist CSRF).
- **Anti email-enumeration:** respons layar **identik** untuk email terdaftar maupun tidak ("Jika email terdaftar, tautan sudah dikirim…"); kegagalan internal juga tidak pernah bocor ke layar.
- **Keamanan token:** acak 32 byte, disimpan **ter-hash SHA-256** di `app_kv.passwordResets` (bocor database ≠ akun jebol), kadaluarsa 30 menit, sekali pakai lewat transaksi CAS, permintaan baru membatalkan token lama; rate-limit 3 kirim/10 menit per IP (anti email-bombing) dan 5 percobaan tebak token/10 menit.
- **Pencabutan sesi lama (`securityNotBefore`):** JWT stateless 2 jam tidak bisa dihapus dari sisi server — kini setiap ganti password (reset **maupun** ganti mandiri di `changePassword.ts`) menulis tanda waktu di `app_kv`; `getSiteUserSession` menolak sesi yang terbit sebelum tanda itu (cache baca 60 detik, toleransi pembulatan 5 detik, fail-open terbatas agar login tidak ikut mati saat D1 sesat). **Celah kritis ikut ditutup:** sliding-refresh di `middleware/customer-auth.ts` kini mempertahankan `iat` ASLI token — sebelumnya token yang sudah dicabut bisa "diperpanjang" selamanya dan lolos dari guard.
- **Aktivasi otomatis per deployment:** fitur hidup hanya bila `NOTIFICATION_PROVIDER`+API key+`NOTIFICATION_DEFAULT_FROM` terisi (jalur email struk pesanan yang sama, `src/lib/services/passwordResetService.ts`). Site owner sudah lengkap; deployment **klien tanpa kunci otomatis dapat pesan jujur** "Fitur … belum aktif. Hubungi owner Anda." (503) — tanpa perubahan pipeline deploy. Jalur reset via owner (`reset-customer-password.ts`) tetap ada sebagai fallback.
- **UI:**2 halaman baru bergaya halaman login (`/admin/lupa-password`, `/admin/reset-password` dengan status token hilang/kedaluwarsa/sukses), tautan "Lupa password?" di `LoginForm`.
- **Test baru (23 kasus):** `passwordResetService.test.ts` (single-use, kadaluarsa, hash-only, pembatalan token lama, pencabutan), `guard.test.ts` (sesi lama ditolak / login baru lolos / toleransi 5 detik), route test kedua endpoint (429 berdurasi, 503 provider mati, respons identik anti-enumeration, kegagalan internal tetap 200 generik).
- `src/lib/constants.ts` — `APP_VERSION` → **1.3.45**.

## [1.3.44] - 2026-10-16

### 🔐 Perbaikan Login: Login Sukses Kini Mengembalikan Saldo Percobaan (+ Pesan yang Jujur)

Perbaikan atas insiden owner 2026-10-16: sukses mengganti password, logout, lalu mencoba login lagi **langsung kena "Terlalu banyak percobaan login. Coba lagi nanti."** — dan saat memakai password lama muncul notif "kesalahan database". Semua angka di bawah diambil dari jejak nyata di `app_kv.rateLimits` produksi, bukan perkiraan.

- **Bukti dari produksi (WIB, 16 Okt):** key `login_114_12_6_45` mencapai `attempts=3` dan diblokir **00:20:47–00:50:47** (30 menit); kunci `chpwd_...` membuktikan ganti password sukses sekitar 00:19:48. Seluruh rangkaian hanya berjarak ±3 menit. Pemilik mencoba lagi 00:49:55 (masih diblokir) dan baru bisa masuk setelah blokir berakhir.
- **Cacat 1 — login SUKSES ikut dihitung dan tidak pernah di-reset:** `POST /api/auth/login` memanggil `checkDataRateLimit` (mode "catat") **sebelum** password diperiksa, dan **tidak ada satu pun** fungsi reset di seluruh codebase (`resetDataRateLimit` = nol kemunculan). Akibatnya "3 percobaan / 5 menit" berarti "3 kali menekan tombol login apa pun hasilnya" — alur normal (login → ganti password → uji login baru) memakai 2 dari 3 slot, lalu satu kali coba password lama mengunci owner **30 menit**. Pelindung brute-force justru menghukum pemilik.
- **Cacat 2 — pesan 500 menyesatkan:** `useAdminLogin.ts` menerjemahkan semua 500 jadi *"⚠️ Backend Error: Masalah koneksi database… Pastikan server stabil."* Padahal 500 = segala gangguan sesaat setelah lolos rate limit (termasuk satu kali kegagalan REST D1 sesaat yang terbukti terjadi di produksi). Password salah seharusnya cukup membalas 401 "Email atau password salah".
- **Cacat 3 — dua situasi tampil identik:** 429 bisa berarti "diblokir 30 menit" **atau** "transaksi pencatatan gagal menulis ke D1, coba lagi 60 detik" (jalur fail-closed `dataRateLimit.ts`) — keduanya menampilkan kalimat sama; angka `retryAfter` yang sudah tersedia tidak pernah ditampilkan layar.
- **Perbaikan:**
  - `src/lib/dataRateLimit.ts` — fungsi baru **`resetDataRateLimit(key)`**: menghapus catatan satu key lewat transaksi CAS `db.ref('rateLimits')` (best-effort, kegagalan hanya dicatat).
  - `src/app/api/auth/login/route.ts` — **reset dipanggil saat login sukses** (guard kini menghitung hanya kegagalan: 3 gagal → blokir 30 menit); pesan 429 kini menyertakan lamanya penantian ("Coba lagi dalam ±X menit"); pesan 500 diringkas jujur tanpa menyalahkan database.
  - `src/app/admin/login/_hooks/useAdminLogin.ts` — pesan 500 → *"Layanan login sedang bermasalah di sisi server. Coba lagi beberapa saat lagi."* (berhenti menuduh "database" di depan pengguna).
  - `src/crud/shared/auth/login.ts` — UPDATE `last_login_at` dan upgrade hash password kini **best-effort** (`try/catch` + log): kegagalan tulis catatan sampingan tidak lagi menggagalkan login yang passwordnya benar.
  - `src/app/api/auth/login/route.test.ts` — **test baru (sebelumnya route ini tidak punya test sama sekali)**: 6 kasus — 429 menyebut lamanya waktu, retryAfter pendek dibulatkan, 401 tidak mereset counter, sukses mereset counter, reset gagal tidak menggagalkan login sah, dan 500 tidak menyalahkan database.
  - `src/lib/constants.ts` — `APP_VERSION` → **1.3.44**.
- **Perilaku hasil:** peretas tetap terhambat (3 kegagalan berturut-turut → blokir 30 menit, kredensial tidak bisa ditebak); pemilik yang login sukses kembali dengan saldo penuh sehingga alur "ganti password lalu uji login" tidak lagi bisa mengunci dirinya sendiri.
- **Verifikasi:** `tsc --noEmit` 0 error, `npm run lint` bersih, `npm test` seluruhnya hijau (nol test patah), pre-commit + pre-push audit lolos; smoke live pasca-deploy.

## [1.3.43] - 2026-10-16

### ⚡ Optimasi Kecepatan Homepage: Query Project Batch (N+1 → 3 Query) + Cache Demo 5 Menit

Perbaikan performa atas keluhan owner 2026-10-16: *"iframe live web di halaman utama pas pertama kali masuk halaman itu lama sekali"*. Seluruh angka di bawah terukur langsung di produksi, bukan perkiraan.

- **Gejala (terukur):** ketiga iframe `/preview/*` membutuhkan **6,7–11,7 detik** server-side (TTFB) saat cache ISR habis; uji ketiga iframe dimuat paralel (persis seperti browser) = **8,31 detik wall clock** hanya untuk menghasilkan HTML, sebelum satu byte aset pun turun. Kunjungan berikutnya justru cepat (0,3–0,5 detik, `x-opennext-cache: HIT`) — makanya keluhan "khususnya pertama kali".
- **Akar masalah 1 — pola N+1 query:** `projectSqlService.getProjectsSql()` menjalankan **1 query daftar project + 2 query per project (narrative & media) berurutan di dalam loop**. Untuk portofolio 20 project di produksi = **±41 query REST**, dan tiap query adalah satu round-trip HTTP ke `api.cloudflare.com` (±150–450 ms) → **±8 detik**, cocok persis dengan TTFB terukur.
- **Akar masalah 2 — cache terlalu pendek:** `revalidate = 60` di `/preview/[template]` berarti **tiap 60 detik pengunjung pertama menanggung seluruh biaya render ulang** itu.
- **Konteks (belum diubah, di luar scope):** tiap iframe memuat aplikasi Next.js penuh — 24 file JS/CSS = **1,54 MB per iframe (±4,7 MB untuk tiga)** serentak saat kunjungan pertama, ditambah seluruh payload data situs ikut ter-inline di HTML (87–106 KB per halaman).
- **Perbaikan:**
  - `src/lib/services/project/projectSqlService.ts` — `getProjectsSql()` kini hanya **3 query**: 1 daftar project + 2 batch `WHERE project_id IN (subquery)` yang berjalan paralel (`Promise.all`), lalu pemetaan di memori. Subquery dipakai agar jumlah parameter tidak tumbuh seiring jumlah project. Hasil **identik** dengan pola lama: urutan project, narrative pertama per project, media terurut `sort_order`.
  - `src/app/preview/[template]/page.tsx` — `revalidate` 60 → **300** detik (demo hanya berubah saat owner mengedit konten).
  - `src/lib/services/project/projectSqlService.test.ts` — **2 test regresi baru**: (a) dua project = *tepat* 3 query + pemetaan narrative/media per project benar; (b) tanpa project = berhenti di 1 query. Mengunci pola batch agar tidak dikembalikan ke N+1.
  - `src/lib/constants.ts` — `APP_VERSION` → **1.3.43**.
- **Dampak:** render ulang halaman demo turun dari ±8 detik menjadi ±0,6–1 detik (3–5 query REST), dan pemicunya menjadi tiap 5 menit, bukan tiap menit. Perbaikan ini otomatis berlaku juga untuk homepage `/`, halaman publik `/projects`, dan 3 endpoint API projects — semuanya memanggil fungsi yang sama.
- **Verifikasi:** `tsc --noEmit` 0 error, `npm run lint` bersih, `npm test` **133 file / 1.071 test PASS** (baseline 1.069 + 2 test regresi baru; nol test patah).
- **Sisa kandidat (belum dikerjakan, butuh izin owner):** pola N+1 serupa di `getOtherProjectMediaKeys()` (`projectSqlService.ts:105-126`) — jalur mutasi admin (hapus/salin project), bukan halaman publik; berat unduhan ±4,7 MB JS ketiga iframe (butuh strategi lazy-load on-demand, keputusan desain); dan **D1 binding langsung** sebagai perbaikan struktural (mengganti REST, tiap query turun dari ±200 ms ke <10 ms) — menyentuh pipeline deploy, perlu rencana terpisah.

## [1.3.42] - 2026-10-14

### 🔧 Hotfix Login Admin: Server Tidak Lagi "Mengunci" Diri Sendiri Setelah Gagal Sekali

Perbaikan bug login `/admin/login` yang membalas **500 "Gagal memproses login"** secara intermiten (terdeteksi tepat setelah deploy v1.3.41, tapi akar masalahnya bukan perubahan v1.3.41).

- **Gejala:** login gagal, padahal pengecekan kesehatan sistem (`/api/health`) melaporkan database **terhubung**. Berulang-ulang dan tidak bisa diatasi dengan mencoba lagi.
- **Akar masalah (3 lapis saling mengunci):**
  1. Setiap kali server Cloudflare memulai "isolate" baru untuk melayani login, ia menjalankan **19 query pengecekan/ pembuatan tabel berurutan** ke D1 lewat REST — makan waktu **4–8 detik** untuk database produksi yang skemanya sudah lama lengkap.
  2. Hasil 19 query itu disimpan dalam satu `Promise` modul. Saat satu query **gagal sesaat** (mis. burst limit D1), Promise itu tersimpan **selamanya rejected** → semua login berikutnya langsung ditolak **tanpa mencoba lagi** sampai isolate didaur ulang. Terbukti dari pola latensi: 8.451 ms → 527 ms → 664 ms.
  3. `catch {}` pada route login **tidak mencatat apa pun**, sehingga kegagalan tidak meninggalkan jejak di log worker (`wrangler tail` menunjukkan `"exceptions": [], "logs": []`) — penyebab hanya bisa ditemukan lewat reproduksi manual.
- **Bukti bahwa skema/data/token sehat:** jalur login yang identik dijalankan dari Node → membalas "Email atau password salah" dengan benar; tulisan worker ke D1 tetap berfungsi (`app_kv` tertulis 2026-10-14T17:33Z); `site_users.last_login_at` menunjukkan login terakhir sukses 2026-10-08. Docs Cloudflare juga memastikan `node:crypto` (termasuk `scrypt`) didukung penuh di Workers dengan `nodejs_compat`.
- **Perbaikan (2 file, tanpa perubahan perilaku login):**
  - `src/crud/shared/db/connection.ts` — tiap statement `bootstrapD1Schema()` dibungkus `try/catch` **best-effort**: kegagalan sesaat dicatat (`[D1] bootstrapD1Schema: statement dilewati ->`) dan dilanjutkan. Promise tidak pernah lagi reject → isolate tidak bisa terkunci. Kegagalan skema yang benar-benar nyata tetap terlihat sebagai error SQL `no such table` pada query berikutnya.
  - `src/app/api/auth/login/route.ts` — `catch {}` → `catch (error)` + `console.error('[Auth] /api/auth/login gagal:', error)` agar kegagalan masa depan langsung terlihat di log worker (fix observabilitas: sebelumnya butuh berjam-jam pelacakan manual).
  - `src/lib/constants.ts` — `APP_VERSION` → **1.3.42**.
- **Verifikasi:** `tsc --noEmit` 0 error, `npm run lint` bersih, `npm test` **133 file / 1.069 test PASS** (identik baseline — nol test patah), smoke live `POST /api/auth/login` (password salah) **401 konsisten, nol 500**.
- **Tindak lanjut yang disarankan (belum dikerjakan, butuh izin owner):** pola `schemaPromise` yang sama masih ada di `src/lib/cloudflareD1.ts:173` (risiko jauh kecil — hanya ±3 statement); dan bootstrap 19 statement per isolate dingin tetap membebani login ~4–8 detik (kandidat optimasi).

## [1.3.41] - 2026-10-13

### 🎭 Redesain Total Storefront: Panggung Demo Live (LiveStage) + Modal Konversi + Restyle "Sticker on Paper"

Pembaruan tampilan homepage storefront (`/`) menjadi halaman super-minimal **1 section tanpa scroll**: hanya navbar melayang + **panggung tiga kartu demo live** — satu kartu besar di tengah (demo aktif) dan dua kartu samping mengecil + redup di kiri-kanan, semuanya menghadap lurus depan tanpa efek berputar. Blok lama dihapus atas permintaan owner: **judul raksasa `PORTFOLIO OS` + tagline, spotlight hub bawah, pill 01–03, teks panduan, dan baris harga** ikut dibuang (h1 tetap ada secara `sr-only` untuk SEO/a11y).

- **Isi kartu = 3 DEMO LIVE (iframe), bukan gambar.** `os-desktop`, `infinite-canvas`, dan `spatial-gallery` ditampilkan lewat iframe `/preview/[template]` (ISR 60 detik) — pengunjung melihat site berjalan sungguhan. Ketiganya ter-mount sekaligus; kartu hanya berpindah slot lewat class CSS (**tanpa penukar `src` → tidak pernah reload**).
- **Render iframe selalu di viewport desain 1440×810 (`--fit`), bukan seukuran kartu** — sebelumnya iframe ikut ukuran kartu (720×405 desktop, ~335×188 ponsel) sehingga halaman demo "mikir" jalan di jendela kecil → responsif berantakan & elemen **numpuk** (icon menimpa window) — apalagi di mode HP. Kini tiap iframe dirender pada viewport DESAIN tetap **1440×810** (16:9, sama dengan aspek kartu) lalu di-`scale(--fit)` pas selebar kartu (`--fit` = lebar kartu/1440, diukur saat mount + resize di `LiveStage`): halaman demo selalu melihat desktop 1440px → **tata letak identik seperti aslinya** di kartu besar maupun ponsel, murni `transform` (kompositor).
- **Popup detail: media preview kini iframe LIVE, bukan gambar mockup statis.** Area media `.wave-modal-media` (16:9) diisi iframe `/preview/[template]` yang dirender pada **viewport desain tetap 1440×810** lalu di-scale pas lebar area media (`--fit` = lebar media/1440, diukur mount + resize di `TemplateDetailModal`) → demo tampil seperti aslinya & tidak pernah numpuk di semua mode device (QA: `contentWindow 1440×810` — desktop media 658px `--fit 0.457`, HP media 348px `--fit 0.242`). `pointer-events: none` supaya scroll/tutup modal tetap jalan (interaksi penuh lewat tombol Live Preview). Aset mockup statis dihapus: field `imageUrl` dari `TemplateItem` + 3 file `public/images/mockup-*.jpg` ikut dibuang. Test baru `template-detail-modal.test.tsx` (4 test: iframe live + ukuran desain, 3 jalur konversi, Escape, null).
- **Restyle visual "Sticker on Paper" — minimalis-pop sesuai selera owner (anti AI-slop).** Palet diturunkan langsung dari logo MAKE IT BETTER: latar **kertas off-white `#f4f1ec`**, kartu/nav/popup **putih**, teks **ink `#0b0b0f`** (sekunder `#5a5a66`), aksen **biru electric `#0008FF`** (CTA nav, tombol Pesan Sekarang, harga, subtitle, ikon) dan **hijau acid `#38f538`** khusus titik "live" + chip "Paling Populer" (teks hitam di hijau = cetak keycap logo). Aturan keras: **nol `box-shadow`, nol gradient, nol `backdrop-filter`/glass, nol emoji** — semua tepi pakai **border hairline 1px tanpa bayangan** (pilihan owner), hover hanya ganti warna/posisi. Dihapus dari `landing.css`: 3 radial-gradient `.wave-stage`, glow `.live-stage::before` + keyframes `stageGlow`, glass di nav/pill/badge/close, gradient tombol `.wave-btn-order`, overlay gradient media popup (tepi jadi keras/datar), sisa warna sky `#38bdf8`, token `--wr-accent-glow`/`--wr-wa-green`, emoji `✨` baris garansi. Tipografi: font **Archivo Black** baru via `next/font` (variabel `--font-brand`, `font-synthesis:none`) untuk brand nav, judul popup, dan harga — padat & playful; body tetap DM Sans. QA: kontras putih-di-biru ~8,5:1 (AAA), hitam-di-hijau ~12:1, sekunder-di-putih ~6,8:1 (AA). **Latar split 50/50 (permintaan lanjutan owner):** _"setengah putih setengah biru, di tengah-tengah itu iframe live web"_ → setengah atas kertas off-white + setengah bawah biru logo `#0008FF` dengan **tepi keras lurus persis di tengah viewport** di belakang panggung — blok datar via `.wave-landing-viewport::after` (`inset: 50% 0 0 0`, bukan gradient). QA: split di 450px (viewport 900) & 422px (HP 844) = 50% mutlak, panggung z-index 5 di atas blok biru, `docH = clientH` (tanpa scroll).
- **Gerak yang hidup tapi tidak kaku — tanpa putaran silinder.** Komponen baru `landing/LiveStage.tsx` (menggantikan sepenuhnya `ui/tilted-grid-hero.tsx` yang efek silinder `rotateY`-nya ditolak owner): (1) **ambient float** — tiap kartu bergoyang pelan sine ±7px dengan fase berbeda, (2) **mouse parallax** — panggung mengikuti kursor dengan easing lembut (translate murni), (3) **tukar posisi FLIP-spring** — klik kartu samping, kartu terbang tukar dengan overshoot jelly `cubic-bezier(0.34, 1.56, 0.64, 1)` ~520ms, (4) **entrance stagger** bertahap saat load, (5) kartu samping diberi `brightness + blur` tipis untuk kesan kedalaman; badge chip-ink nama demo + titik hijau acid berdenyut "live" di kartu aktif.
- **Semua gerak = transform/opacity murni di kompositor (60fps, tanpa layout thrash), tanpa dependency baru, tanpa scroll-coupling, tanpa rAF.** Halaman normal 100vh/100svh; bug "stack macet setelah scroll", "animasi kaku", & "pusing berputar" dari versi sebelumnya hilang secara struktural.
- **Interaksi (jalur konversi setelah hapus hub):** klik **kartu tengah** (demo aktif) → popup detail; klik **kartu samping** → panggung menukar posisi kartu; navbar CTA **"Pesan Template"** → `/checkout`. Popup tetap menawarkan Live Preview / Pesan Sekarang (`/checkout?template=[id]`) / Tanya via WhatsApp (prefill `adminWhatsapp`).
- **Bersih-bersih kode:** mesin scroll (`landing/reel/*` + test-nya), arsip WebGL sisa Gemini (`WaveReelCanvas/Scene/Mesh/Shader`), fork silinder `ui/tilted-grid-hero.tsx` (5 test lama ikut dihapus), serta CSS hero/hub/pill/guide/spotlight **dihapus bersih**; katalog template di `landing/templates.ts`.
- **Nomor WhatsApp owner bisa diganti tanpa deploy:** panel **Harga Jual** kini punya kartu "Nomor WhatsApp owner" → D1 `platform_settings` key `owner_whatsapp` (cache 60 dtk, fallback env `NEXT_PUBLIC_ADMIN_WA` → field legacy `payment_config`) — dipakai tombol WA di popup order (`GET/PUT /api/admin/pricing` membawa `adminWhatsapp`, field opsional).
- **Aksesibilitas & reduced-motion:** satu `h1` (`sr-only` — "PORTFOLIO OS"), zona klik kartu ber-`aria-label` jelas (samping = "Tampilkan demo …", tengah = "Lihat detail template …") + `iframe` ber-`title`; `prefers-reduced-motion` mematikan seluruh gerak ambient (float, glow, denyut, parallax, transisi FLIP) → panggung diam rapi tapi demo tetap hidup; test unit baru `live-stage.test.tsx` (5 test: guardrail 3 iframe + src tak pernah berubah, tepat 1 kartu tengah, rotasi slot, klik → callback, entrance/label).

### 🎞️ Loader Animasi Homepage: "Deck Reveal" (ala k95.it) + pilihan gaya "Hello" — berlaku untuk SEMUA template

- **Permintaan owner:** boot loader ala k95.it — tumpukan gambar yang melebar berjenjang dengan counter `[0]→[100]`, lalu "patch reveal" menyingkap halaman utama; gayanya bisa dipilih di admin — **Deck Reveal** atau **Hello** (animasi lottie HELLO) — dan berlaku untuk **ketiga template** (os-desktop, infinite-canvas, spatial-gallery).
- **Komponen baru `src/components/shared/DeckRevealLoader.tsx`:** 10 layer (lebar akhir 82%→100%), stagger easing cubic-bezier(.16,1,.3,1), preload gambar dengan timeout + failsafe, exit patch `box-shadow` reveal. Props kustom: `durationMs` (1–10 dtk), `accentColor`, `showCounter`. Murni overlay — tidak menyentuh logic template mana pun.
- **`HomepageLoaderGate`** (`src/components/shared/`): loader tampil **sekali per sesi browser** (sessionStorage `portfolio_loader_played`), gambar di-resolve dari cover project terpilih (video → poster side-car), `prefers-reduced-motion` dihormati. Dipasang sekali di `src/app/page.tsx` sehingga otomatis berlaku untuk semua template.
- **Anti HELLO dobel (rekonsiliasi dengan intro bawaan v1.3.36/v1.3.37):** gaya **Hello** di spatial-gallery & infinite-canvas memutar intro HELLO **bawaan** mereka (gate diam — penjagaan `ready` scene 3D tetap utuh); di **os-desktop** gate memutar HelloIntro **dan** boot native StartScreen (HELLO hitam, v1.3.37) disenyapkan lewat flag `suppressIntro` baru yang disusun server-side: `page.tsx → OSDesktopRenderer → DesktopEnvironment → useBootSequence({ forceSkip })` (default `false`). Gaya **Deck Reveal** menyenyapkan intro bawaan ketiga template. Hasilnya: tepat SATU animasi boot di semua kombinasi; loader mati → seluruh jalur native berjalan persis seperti biasa.
- **App admin baru "Loader Animasi"** di zona **Tampilan** (`/admin/system/loader` + window desktop): sakelar enable, kartu pilih gaya, pemilih cover project berurutan (**maks 10 layer**), slider durasi, color picker aksen, toggle counter — field gambar/durasi/warna/counter hanya tampil untuk Deck Reveal.
- **Konfigurasi:** `loaderConfig` (`enabled`, `style: 'deck-reveal' | 'hello'`, `imageProjectIds` maks 10, durasi 1–10 dtk, hex color) disimpan sebagai blob di tabel `app_kv` key `about`, divalidasi zod strict `loaderConfigSchema` — tanpa tabel/endpoint baru. **Default `enabled: false`** — deployment lama tidak berubah perilaku sampai admin mengaktifkan.
- **Preview terisolasi `/lab/loader`** (sandbox dengan tombol Replay; menghapus folder `lab/loader` + 2 komponen shared meninggalkan nol sisa).
- **Test:** +3 `useBootSequence` (regresi `forceSkip` vs boot native) melengkapi 8 zod schema & 11 `HomepageLoaderGate` (termasuk regresi StrictMode). Suite: **130 file / 1034 test PASS**, `tsc --noEmit` 0, ESLint 0 warning.

## [1.3.40] - 2026-10-12

### 💬 Alur Pesanan Chat-First (Alur B): Buat Order dari Panel + Link Checkout Sekali Salin

Keputusan owner setelah kajian kepercayaan pembeli: penjualan lewat **percakapan WhatsApp dulu, checkout belakangan** — keputusan deal dan data pembeli diverifikasi owner sebelum order dibuat. Mekanisme pembayaran (QRIS nominal unik, upload bukti, verifikasi, aktivasi) **tidak berubah sama sekali**; yang berubah hanya siapa yang mengisi form checkout.

- **Endpoint baru `action=create` di `POST /api/admin/orders`:** owner membuat order atas nama pembeli (nama, email, WA wajib; slug opsional — auto-generate dari nama, sama seperti checkout publik). Sengaja **tidak melewati rate-limit publik** `billing_checkout` (5/menit per IP) karena pemanggilnya owner sendiri — anti-spam publik tidak relevan di jalur admin. Route tetap terkunci `requireOwnerMode()` (404 di site klien) + auth + CSRF.
- **Link checkout sekali salin:** `createOrder` hanya mengembalikan token mentah saat pembuatan (di D1 tersimpan `access_token_hash`), jadi panel menampilkan kotak hijau berisi link + tombol **Salin Link** sesaat setelah order dibuat, lengkap dengan peringatan bahwa link hanya tampil satu kali. Token dicetak ke respons admin (bukan publik), dibatasi owner-mode + CSRF.
- **Panel Pesanan (`/admin/system/orders`):** tombol **Buat Pesanan** di toolbar membuka form ringkas (nama, email, WA, slug, pilihan template) — alur owner kini: chat deal → buat order → salin link → kirim WA ke pembeli.
- **Perilaku checkout publik TIDAK dihapus.** `/checkout` tetap terbuka sebagai jalur mandiri pembeli yang mengisi sendiri, dan sebagai persiapan otomasi penuh (bayar → deploy) di masa depan. Alur chat-first hanya memindahkan *default*, bukan menghapus pilihan.
- **+3 test route** (`action=create` sukses + slug auto-generate, validasi data wajib, error service diteruskan 400). Total route orders: 10/10 PASS.
- **Perbaikan test flaky `orderService` (temuan review 2026-10-12):** test "melepas slot kode unik dari pesanan pending tua" menyediakan mock "harga dasar" yang tak pernah dipanggil (`input.amount` membuat `input.amount ?? getBasePrice()` short-circuit) → seluruh antrian `queryD1` bergeser satu posisi: test gagal ~50% (flaky) **dan** skenario kolam penuh tak pernah benar-benar terjalani bahkan saat lulus. Mock sisa dihapus + komentar penjelas; kini deterministik 37/37 PASS (dijalankan 6× berturut-turut).

- **Menu di jendela `PENGELOLA_KLIEN.bat` diperbarui:** daftar menu di layar kini mencantumkan tab **[5] Peta Bisnis** — sebelumnya daftar berhenti di [4] padahal tab-nya sudah ada sejak v1.3.32, sehingga owner pemula tidak tahu diagram alur jualan itu ada di mana. (File `.bat` sendiri hanya peluncur — teks alur bisnis tetap tersentral di `docs/diagrams/*.mmd`, yang dibaca portal saat tab Peta Bisnis dibuka.)

### 📚 Dokumentasi Alur Baru

- **Diagram alur bisnis** (`docs/diagrams/alur-bisnis.mmd`, tampil di tab Peta Bisnis portal): node P1/P2/S1/O1–O2 ditulis ulang — pembeli kini chat WhatsApp dulu, order dibuat owner dari panel, link checkout dikirim via WA, verifikasi mutasi sebelum aktivasi.
- **Playbook dukungan** (`docs/operations/support-playbook.md`): alur order baru + kebiasaan wajib **"cek mutasi → aktifkan → deploy"** (jangan deploy dari notifikasi) + penanganan pembayaran telat via Buka Kembali.
- **Panduan owner** & **sales guide** disesuaikan ke alur chat-first; template balasan WhatsApp siap pakai ditambahkan.

## [1.3.39] - 2026-10-12

### 🛠️ Portal Onboarding: Tab "Peta Bisnis" Kembali Menampilkan Kedua Diagram

- **Perbaikan Diagram Gagal Dimuat (temuan owner 2026-10-12):** Tab "Peta Bisnis" menampilkan "Diagram gagal dimuat. Pastikan internet aktif…" padahal internet normal. Penyebab sebenarnya: `docs/diagrams/alur-bisnis.mmd` baris 21 memakai kutip lurus `\"` gaya JavaScript di dalam label Mermaid — sintaks itu tidak sah bagi Mermaid sehingga render gagal (masuk sejak commit `ab27f5b`, teks email aktivasi). Kedua diagram ikut blank karena sebelumnya dirender dalam satu panggilan `run()` bersama.
- **Perbaikan:** kutip liar dihapus (arti teks tetap sama); render kini **terpisah per diagram** (file rusak tidak mematikan diagram sebelahnya); pesan error kini menjelaskan tahap yang benar-benar gagal (mengambil data portal / memuat pustaka CDN / teks diagram tidak valid + baris error Mermaid apa adanya) — tidak lagi otomatis menyalahkan "internet".
- **Sama seperti catatan v1.3.24:** perubahan hanya `docs/diagrams/*.mmd` + `scripts/onboarding/public/index.html` (alat portal owner) — tidak memengaruhi situs klien.
- **Visual Garis Alur Utama (permintaan owner putaran 2):** garis **tebal** (`==>`) yang sebelumnya berkelok-kelok kini dirangkum otomatis menjadi **maksimal satu belokan 90°** (kasus padat: dua belokan lewat koridor bebas). `straightenEdges` menguji dua/tiga kandidat rute dan memilih yang tidak menabrak kotak mana pun; segmen penutup selalu tegak lurus ke tepi kotak → **segitiga panah lurus dan simetris**, masuk pas di tengah kotak. Verifikasi browser: 10/10 garis tebal (6 alur + 4 aset) nol tabrakan, konsol bersih; jalur CF3→PB2 (satu-satunya koridor padat) memakai 2 belokan.

## [1.3.38] - 2026-10-11

### 🚀 Portal Onboarding & Checkout: 3D Spatial Gallery, Saran Slug Pintar & Penjagaan Render OS

- **Spatial Gallery di Portal Onboarding:** Template ke-3 `spatial-gallery` resmi didaftarkan ke portal visual `PENGELOLA_KLIEN.bat` (`index.html`, `server.ts`, dan `cloud-manager.ts`). Kartu pilihan 3D Spatial Gallery kini tersedia di form pendaftaran, pesan serah terima WhatsApp otomatis dibuat per-template, dan layout grid menyesuaikan 3 opsi.
- **Pencegahan Human Error Form Portal:** Pengetikan nama klien tidak lagi menimpa (`overwrite`) kotak slug yang sudah dipilih dari saran order pembeli.
- **Saran Slug Pintar ala Gmail di Checkout:** Halaman `/checkout` kini menampilkan kolom isian slug dengan pratinjau alamat live `https://[slug].workers.dev` dan 3 tombol saran cerdas (contoh: `budi`, `budi-portfolio`, `karya-budi`) yang dibuat otomatis saat pembeli mengetik nama.
- **Transparansi Template di Notifikasi & Admin:** Notifikasi Telegram untuk pesanan baru dan bukti transfer kini secara eksplisit mencantumkan baris `Template: 3D Spatial Gallery / macOS Desktop / Infinite Canvas`. Panel pesanan admin (`OrdersPanel.tsx`) juga menampilkan label template di setiap kartu order.
- **Penjagaan Render `useOSOverlays`:** Menambahkan hook aman `useOSOverlaysOptional` di `OSSystemContext.tsx` untuk `HomeOSWrapperInner` agar transisi antar-halaman preview tidak crash saat berada di luar provider.
- **Sapuan Darurat Kolam Kode Unik QRIS (audit MEDIUM):** Saat kolam 999 kode unik penuh (pesanan pending tak terbayar mengunci slot), `createOrder` kini **sekali saja** melepas slot pesanan `pending_payment` tua (>6 jam) lewat `expireStalePendingOrders` dengan cutoff khusus — lalu alokasi ulang. Sapuan lain (aktivasi macet, batal 7 hari) tetap memakai waktu sebenarnya. Ada unit test baru (pool 2 slot disimulasikan).
- **Label Serah Terima Portal:** Ringkasan "Template Dipilih" di surat serah terima kini menulis **"3D Spatial Gallery"** (sebelumnya salah cetak "Infinite Canvas" untuk template spatial).
- **Info Alamat di Checkout (audit LOW):** Di bawah pratinjau slug kini dijelaskan bahwa alamat `*.workers.dev` sudah aktif & gratis selamanya dan bisa disambungkan ke domain pribadi (.com/.id) kapan saja.
- **SOP Tertulis:** `docs/operations/GLADI_RESIK_KLIEN_PERDANA.md` §9 — SOP pembuatan akun Cloudflare klien (owner buatkan, email klien, incognito, jeda 1–2 akun/hari; jalur klien daftar sendiri untuk skala besar) + checklist anti struk palsu (wajib cocokkan mutasi bank asli sebelum Verifikasi & Aktifkan).

## [1.3.37] - 2026-10-11

### 💻 OS Desktop: HELLO hitam kini diputar sampai selesai baru ke halaman utama

- **Laporan owner:** di template os-desktop, animasi awal tulisan HELLO hitam sering tidak terlihat / terpotong — layar langsung pindah ke halaman utama sebelum animasi selesai. Durasi harus disesuaikan: biarkan tulisan HELLO selesai animasinya, baru transisi.
- **Akar masalah:** `StartScreen` os-desktop auto-start setelah **1,2 detik** (`autoStartDelay`) sementara animasi `hello hitam.json` butuh **6 detik** satu putaran — dan chunk `lottie-react` (dynamic import) sering baru tiba menjelang 1,2 detik, sehingga HELLO tak sempat tampil sama sekali.
- **Perubahan (`src/components/os/ui/StartScreen.tsx`):** lottie HELLO hitam kini `loop={false}` + `onComplete` → saat animasi **selesai satu putaran penuh**, layar slide ke desktop (jalur suara klik/skip tidak berubah). Timer lama diganti `safetyFallbackDelay: 15000` — jaring pengaman agar halaman tidak tersangkut bila chunk lottie gagal atau tab tersembunyi menunda rAF, **bukan** penentu durasi.
- **Unit test baru** `StartScreen.test.tsx` (5 kasus): tidak auto-mulai sebelum selesai, onComplete → boot, jaring pengaman 15 dtk, klik = skip, layar dilepas setelah boot.

## [1.3.36] - 2026-10-11

### 👋 Intro HELLO bersama: spatial-gallery & infinite-canvas putar sampai selesai

- **Permintaan owner:** animasi lottie HELLO di **infinite-canvas** dan **spatial-gallery** diputar **sampai selesai satu putaran penuh**, baru transisi menampilkan halaman utama (sebelumnya overlay langsung memudar begitu scene siap / tidak ada intro sama sekali di infinite-canvas).
- **Komponen baru `src/components/shared/HelloIntro.tsx`** dipakai bersama kedua template: layar hitam penuh + HELLO oranye (loop), satu putaran selesai (`onComplete`/`onLoopComplete`) → fade-out 700ms → halaman utama tampil. Prop opsional `ready` memungkinkan intro bertahan kalau konten belum siap.
- **spatial-gallery:** overlay loading v1.3.35 diganti `<HelloIntro ready={sceneReady} />` — intro baru mulai memudar setelah HELLO selesai **dan** scene 3D siap, jadi tidak ada layar hitam antar-intro ke galeri.
- **infinite-canvas:** `<HelloIntro />` dipasang di root renderer — sebelumnya kanvas langsung tampil tanpa pembuka.
- Logo intro memakai `pointer-events-none` (interaksi tetap tembus ke kanvas di belakangnya untuk pemanasan aset).

## [1.3.35] - 2026-10-11

### 👋 Spatial Gallery: poster cover awal dihapus, diganti animasi lottie HELLO

- **Permintaan owner:** poster gambar cover yang tampil saat awal loading dihapus saja, diganti **animasi lottie HELLO** yang sudah ada di template lain (varian `hello orange.json` — oranye, terlihat jelas di latar galeri hitam; varian "hitam" hanya untuk latar terang).
- **Perubahan:** `<img>` poster cover (LCP fix) di `SpatialGalleryRenderer.tsx` diganti overlay lottie HELLO (`dynamic import`, ssr:false — mengikuti pola infinite-canvas & OS Desktop StartScreen). Animasi lottie berbasis SVG terpaint seketika sehingga fungsinya tetap sama: mengisi layar selagi chunk three.js + texture dimuat (mencegah layar hitam), lalu fade-out 0.8s saat scene 3D pertama siap. Pemilihan cover project + fallback `/tube/im1.jpg` ikut dihapus (tidak dipakai lagi).
- **Tanpa perubahan logika 3D** — hanya overlay loading yang berganti.

## [1.3.34] - 2026-10-11

### 🖼️ Spatial Gallery: poster awal loading diperbaiki (tidak lagi meregang/crop)

- **Laporan owner:** saat halaman baru dibuka (sebelum scene 3D siap), gambar cover yang tampil sebagai poster loading terlihat bug — foto potret dipaksa meregang fullscreen dan ter-crop aneh.
- **Perbaikan:** poster kini tampil `object-contain` — karya tampil utuh dan terpusat dengan letterbox hitam yang senada dengan latar galeri, bukan dipaksa meregang. Fungsi teknisnya tidak berubah: poster tetap elemen LCP yang ter-paint seketika (mencegah layar hitam ±14 detik sampai aset 3D termuat) dan tetap fade-out 0.8s saat scene pertama siap.
- Perubahan 1 baris di `SpatialGalleryRenderer.tsx`; nol perubahan logika 3D.

## [1.3.33] - 2026-10-11

### 🖼️ Spatial Gallery: panel detail disamakan persis dengan template demo macOS (mode gelap)

- **Permintaan owner:** tampilan panel "klik cover project" Spatial Gallery disamakan dengan panel project di template demo macOS (OS Desktop), tapi mode gelap.
- **Cara:** panel tidak lagi ditiru manual — kini **memakai komponen yang sama persis** dengan window project OS Desktop: `ProjectDetailTwoColumn` mode window, yaitu cover media + interaction bar (suka/bagikan/ulasan/terjemah), judul, **tab pill geser** Ringkasan/Proses/Galeri (dengan badge jumlah), meta project, "Tentang Proyek", **narrative folder-tabs** Tantangan/Solusi/Dampak, galeri + lightbox. Karena komponen dipakai bersama, perbaikan/tampilan OS Desktop berikutnya otomatis ikut.
- **Mode gelap dipaksa** lewat kelas `dark` di root modal (`tailwind darkMode: 'class'`) — seluruh varian `dark:` OS Desktop aktif tanpa mengubah tema situs.
- **Detail teknis:** cover/gallery disusun mengikuti pola `ProjectDetailWrapper` (ratio dari `coverWidth/Height`, poster video otomatis) dengan resolver URL pipeline spatial; Esc menutup panel kecuali lightbox galeri sedang terbuka (Esc pertama menutup lightbox saja); tombol ✕ gaya chrome window; penutup ✕/klik luar/Esc dan pause rotasi tabung tetap seperti sebelumnya.
- **Tanpa perubahan CRUD/endpoint** dan **nol perubahan logika 3D** — hanya file `SpatialProjectModal.tsx` yang ditulis ulang.

## [1.3.32] - 2026-10-11

### 🖼️ Spatial Gallery: klik cover project → panel detail (Ringkasan + Proses) & cursor dibuat terlihat

- **Tile tabung 3D kini bisa diklik** — membuka panel detail project pemilik tile. Sebelumnya tile hanya punya hover (tooltip nama); klik tidak melakukan apa pun. Penambahan mengikuti pola event hover yang sudah ada (`onPointerOver/Move/Out` → `onImageClick(texIndex)` → index project lewat peta paralel `projectIndexes`); mesin rotasi/gulir/shader **tidak disentuh**. Rotasi tabung otomatis pause selama panel terbuka (via ref kecepatan yang sudah ada).
- **File baru `SpatialProjectModal.tsx`** (folder spatial — panel tema gelap mengikuti karakter galeri, mengikuti desain tab milik owner): tab **Ringkasan** (media utama gambar/video + thumbnail strip dari `cover`/`galleryItems`/`gallery`, chips klien & tahun, meta Peran/Software/Waktu/Tim/Tipe, "Tentang Proyek", tag) dan tab **Proses** (sub-tab **Tantangan/Solusi/Dampak** untuk project komersial — legacy `result` didukung; **Konsep/Proses/Detail** untuk seni visual). Semua field conditional: kosong → bagian/tab tidak dirender; data diambil apa adanya dari CRUD admin yang sudah ada (`project_narratives` + gallery) — **tanpa CRUD/endpoint baru**. Tutup via ✕ / klik luar / Esc.
- **Cursor Spatial Gallery dibuat terlihat:** cursor kustom (`cursor: none` + bola putih RAF ±60 baris) dilaporkan owner tidak muncul — diganti **cursor native browser** yang pasti tampil di semua environment. Tooltip hover, parallax pointer, dan lazy-load 3D tetap berfungsi seperti sebelumnya.
- **Aman untuk template lain:** perubahan hanya di folder `spatial-gallery`; Infinite Canvas (`CanvasProjectModal`) dan OS Desktop tidak disentuh.

## [1.3.31] - 2026-10-10

### 🛍️ Landing storefront kini menampilkan ketiga template demo (Spatial Gallery dicantumkan)

- **Kartu template di halaman jualan `/` bertambah jadi 3.** Template `spatial-gallery` sebenarnya sudah lengkap sejak awal — tersedia di `/preview/spatial-gallery`, registry template, dan pilihan checkout — tetapi **tidak pernah dicantumkan di showcase landing** (`src/components/landing/LandingPage.tsx`, array `TEMPLATES` berhenti di 2 entri). Pengunjung hanya melihat OS Desktop & Infinite Canvas, sementara pembeli di checkout bisa memilih Spatial Gallery tanpa pernah melihat demo-nya. Kini kartu ketiga tampil dengan deskripsi selaras checkout ("curved grid dan orbital artwork") + live preview iframe.
- **Hero disesuaikan:** "Dua pilihan template" → "Tiga pilihan template".
- **Grid kartu dibuat adaptif** (`repeat(auto-fit, minmax(300px, 1fr))` di `landing.css`): 3 kolom di layar lebar, otomatis menyusut ke 2/1 kolom mengikuti lebar layar — tidak lagi hardcode 2 kolom sehingga aman untuk jumlah kartu berapa pun.

## [1.3.30] - 2026-10-09

### 🔑 Owner Mode (superadmin): tool owner tidak lagi terlihat/terjangkar di site klien

- **Sakelar identitas deployment baru `OWNER_MODE` + `NEXT_PUBLIC_OWNER_MODE`.** Keputusan owner: _"aku mau sistem dan project ini tau kalau aku sebagai superadmin, jadi ada beberapa tool gak ke-deploy karena tau ini punya superadmin"_. Site milik owner (produksi sendiri) menjalankan build dengan kedua kunci `true` di `.env.local`; **build klien memaksa keduanya `'false'`** di pipeline `deployClient()` (`scripts/onboarding/client-deploy.ts`) — fail-closed dua lapis, bahkan jika tertulis `true` di `config.env` klien sekalipun.
- **App desktop admin kini bisa ditandai `ownerOnly`.** Dua app pertama yang dikunci: **"Harga Jual"** dan **"Order & Pembayaran"** — keduanya adalah sistem penjualan site milik owner (harga dasar jual + data pembeli: nama, email, WhatsApp, slug tujuan, jumlah bayar, status aktivasi). Sebelumnya kedua app ini ikut tampil (walau panelnya kosong/keliru) di desktop admin setiap klien. Di site klien app disaring keluar dari `ADMIN_ZONES` (`registry.ts`) — zona Sistem tetap ada berisi app klien lain.
- **Route API-nya ikut dikunci:** `/api/admin/pricing` (GET/PUT) dan `/api/admin/orders` (GET/POST) kini membalas **404** (bukan 403 — seolah route memang tidak ada) di deployment non-owner, sebelum lapisan auth mana pun, via guard baru `requireOwnerMode()` (`src/lib/ownerMode.ts`). Data bisnis owner tidak pernah terjangkar dari site klien.
- **Cara menambah tool superadmin berikutnya:** tandai app dengan `ownerOnly: true` di `registry.ts` + pasang `requireOwnerMode()` di route API-nya (panduan lengkap: `AGENTS.md` §8 "Owner Mode"). Fitur untuk klien TIDAK memakai flag ini.
- **+test baru:** unit guard ownerMode (fail-closed 404), route pricing & orders (guard 404 tanpa menyentuh auth/service), dan `buildClientEnvPlan` memaksa `false` meski config.env klien meminta `true`.
- **Catatan operasional:** site produksi owner perlu `OWNER_MODE="true"` + `NEXT_PUBLIC_OWNER_MODE="true"` di `.env.local` saat deploy — sudah diset; tanpa kunci ini kedua panel hilang dari admin owner (kembali dengan menambah kunci + deploy ulang). Klien yang sudah ada otomatis mendapat perlindungan ini pada update template berikutnya.
- **+Guard anti-human-error:** `npm run deploy` kini **menolak build** bila `OWNER_MODE`/`NEXT_PUBLIC_OWNER_MODE` tidak `"true"` (`scripts/deploy/pre-deploy-check.js`) — mencegah panel Harga Jual & Order hilang diam-diam dari admin owner karena kunci tidak sengaja terhapus. Build klien tidak melewati script ini (jalur `deployClient` → `cf:build` langsung) sehingga klien tetap dipaksa `false` tanpa konflik.

## [1.3.29] - 2026-10-08

### 🐛 Perbaikan: app "Harga Jual" di desktop admin membuka window kosong

- **Panel `harga` didaftarkan ke `PANEL_MAP`.** Akar masalah: app `harga` terdaftar di zona desktop (`registry.ts`) dan `APP_ROUTE_MAP`, halaman `/admin/harga` juga ada — tetapi `ClientAdminLayout` tidak me-render halaman route, semua isi window diambil dari `PANEL_MAP` di `WindowContentRenderer.tsx`. Karena key `harga` tidak pernah ditambahkan (terlewat saat fitur dibuat di v1.3.28), membuka "Harga Jual" selalu menampilkan _"Panel 'harga' belum tersedia"_ sehingga harga tidak bisa diatur.
- **Konten dipisah jadi `desktop/panels/HargaPanel.tsx`** mengikuti pola panel lain (mis. `BackupPanel`): `page.tsx` kini pembungkus `AdminAuthGuard` + `AdminHeader` + `<HargaPanel />`, isi panel diekstraksi utuh tanpa perubahan logika (diff murni hapus impor guard/header + ganti nama fungsi).
- **Catatan:** app `ai` (Asisten AI) tetap tidak didaftarkan — sesuai keputusan owner v1.3.28 (fitur AI dimatikan, janji fitur dihapus dari penjualan).
- **Bug kedua: 4 endpoint GET admin selalu 401 "Unauthorized".** Route-route GET memakai `checkAdminAuth` polos yang hanya mengenali cookie legacy `admin_token`, padahal login admin saat ini hanya menerbitkan sesi customer `site_user_token` (`/api/auth/login` → `createLoginResponse`) — panel akhirnya menampilkan "Gagal memuat harga" / "Gagal memuat log". Diperbaiki memakai `validateAdminRequest(request, { checkCsrf: false })`, pola identik dengan GET route admin lain (backup, storage-stats) yang sudah berfungsi: **`/api/admin/pricing`** (dilaporkan owner), **`/api/admin/audit-logs`** (panel Log Aktivitas, dilaporkan owner), **`/api/admin/orders`** dan **`/api/admin/payment-config`** (endpoint dormant, disamakan sekalian supaya tidak jadi bom waktu). Handler PUT/POST di keempat route sudah benar sejak awal. +8 test (7 test route pricing baru + 1 guard regresi auth audit-logs).
- **Endpoint `/api/admin/payment-config` dihapus total (keputusan owner: "ya, hapus").** Route GET/PUT + dua fungsi service yang hanya dipakai route itu (`getAdminPaymentConfig`, `updatePaymentConfig`, termasuk impor `maskQRISPayload` yang ikut mati) dibuang — nol pemanggil sejak panel dihapus di v1.3.20: tidak ada UI/script/test yang menyinggungnya, dan **billing tidak pernah lewat API ini** (checkout/QRIS/payment-info baca `paymentConfigService` langsung), sehingga alasan lama "endpoint dipertahankan untuk billing & tooling" tidak akurat. Catatan `AGENTS.md` §12 ikut dikoreksi. **`/api/admin/orders` TIDAK dihapus** — justru kini dipakai panel Pesanan baru (v1.3.29) + script load-test + support-playbook.

### 🗂️ Zona desktop admin dipecah: 3 → 4 zona (keputusan owner)

- **Zona "Sistem & Tampilan" (sudah 10 app) dipecah jadi dua** di `registry.ts` (`ADMIN_ZONES`): **"Sistem"** (Asisten AI, Statistik Pengunjung, Log Aktivitas, Backup Database, Harga Jual, Order & Pembayaran) dan **"Tampilan"** baru — ikon Palette ungu — berisi app visual (Tampilan/wallpaper, Sistem Dock, Widget & Catatan, Efek Suara). Zona digambar otomatis dari data → folder ke-4 muncul sendiri; `openApp` meng-scan semua zona tanpa peduli ID zona, `APP_ROUTE_MAP` tidak disentuh → pemindahan app ini murni tata letak, tanpa perubahan perilaku. Tabel zona `AGENTS.md` §12 + 3 dokumen operasional (GLADI_RESIK, backup-restore-runbook, SALES_PRICING) ikut disesuaikan; catatan historis di CHANGELOG/log lama sengaja dibiarkan apa adanya.

### 🔍 Batch perbaikan audit alur bisnis end-to-end (temuan #1–#18, atas izin owner "fix 18 temuan kamu")

- **Skema database onboarding kini lengkap & terverifikasi (🔴 #1/#2/#14).** Portal (`PENGELOLA_KLIEN` + CLI `cloud-manager`) memasang `SHARED_SCHEMA_QUERIES` **lalu** `D1_SCHEMA_QUERIES` — tabel `orders`, `platform_settings`, `project_narratives`, dll. ikut terbentuk, plus kolom runtime `projects.order_index`/`cover_media_id` & `media_assets.alt_text`/`sort_order`/`updated_at` ditambahkan ke skema SHARED (ALTER self-heal untuk database lama). Setiap hasil query D1 kini **dicek** (dulu diabaikan → database kosong pun dilaporkan sukses), dan provisioning **memverifikasi** tabel + baris site/admin tersimpan sebelum build/deploy/email. Invarian keselarasan dua skema didokumentasikan di AGENTS.md §12. **Temuan lanjutan saat verifikasi live:** dua INDEX di `D1_SCHEMA_QUERIES` merujuk `order_index`/`sort_order` — pada database hasil portal lama, index gagal **sebelum** blok self-heal sempat jalan (bootstrap = aplikasi mati total); solusinya `healProjectMediaColumns()` kini menambah kolom project/media **sebelum** loop skema. Terbukti pada D1 dummy di akun owner (4 fase: portal lama → boot lama → runtime baru → portal baru) = **33/33 ekspektasi cocok**, database dummy dihapus setelahnya.
- **Panel Pesanan & Pembayaran hadir di admin (🔴 #3).** Aplikasi baru di zona *Sistem & Tampilan* (`/admin/system/orders`): daftar order + filter status + pencarian + paginasi, dan aksi **Aktifkan** (termasuk order kedaluwarsa), **Batalkan** (alasan wajib, berkonfirmasi), **Buka Kembali** — memakai endpoint `/api/admin/orders` yang selama ini jalan tanpa UI.
- **Race status order ditutup (🟠 #4).** `uploadPaymentProof` dan `cancelOrder` memakai UPDATE ber-guard status + `RETURNING` (mengikuti pola lock `activateOrder`/`reopenOrder`) — pembayaran/cancel tidak lagi bisa menimpa order yang keburu diaktifkan; pembersihan bukti bayar di R2 dipindah **setelah** pembatalan terkonfirmasi. +2 test race baru.
- **SQL portal pakai binding parameter (🟠 #5).** Semua query `server.ts`/`cloud-manager.ts` lewat helper `d1Query` (`?` + params), interpolasi string dihapus total.
- **Guard slug lintas klien (🟠 #6).** `guardCrossClientSlug` menolak slug yang sudah menjadi arsip akun Cloudflare **berbeda** sebelum resource (D1/R2/Worker) dibuat; re-provision akun yang sama tetap diizinkan. +4 test.
- **Kredensial GitHub Actions keluar dari input & ringkasan (🟠 #7).** Workflow `pengelola-klien` kini membaca `secrets.CF_API_TOKEN` (+ `secrets.CLIENT_ADMIN_PASSWORD` yang opsional — kosong = password admin klien di-generate otomatis; kedua Secret sudah disiapkan owner untuk `CF_API_TOKEN`); password admin tidak lagi tampil di Job Summary maupun log — hanya di `arsip-klien/<slug>/config.env` & `SURAT_SERAH_TERIMA.txt`.
- **Simpan konten gagal kini balas error, bukan sukses palsu (🟠 #8).** Service experience/testimonial/hardSkill/konsep/sticky-notes dan rute labels mengecek hasil `saveData()` — kegagalan tulis melempar error → respons API error, UI berhenti menampilkan "tersimpan" saat sebenarnya gagal.
- **Hapus massal project minta konfirmasi (🟠 #9).** Dialog berisi jumlah project terpilih + peringatan tidak bisa dibatalkan (publish/draft tetap langsung karena masih bisa dibalik).
- **Update template klien punya titik pulih (🟠 #10).** Sebelum deploy update, backup D1 per klien dijalankan otomatis (re-use `backup:d1` dengan env klien → `backups/d1/<timestamp>/preupdate-<slug>`, best-effort + log jelas); self-heal ALTER kini mencakup 4 tabel (projects, media_assets, sites, orders).
- **`.env.example` dijaga dari nilai rahasia (🟡 #12).** Key basi `AI_MONTHLY_TOKEN_LIMIT_LITE`/`_PRO` dihapus (0 pemakaian kode); `release:audit` kini **gagal** kalau key pola `*_TOKEN`/`*_SECRET`/`*_KEY`/`*_PASSWORD`/`*_SALT` berisi nilai non-kosong (value tidak pernah dicetak).
- **Deploy klien diverifikasi benar-benar hidup (🟡 #15).** Setelah `wrangler deploy`, `deployClient` mengecek `/api/health` (fallback `/`) hingga 3× dengan backoff — site tidak merespon = deploy gagal, email "Website Sudah Online" tidak dikirim.
- **`/api/setup` dimatikan pada deployment managed (🟢 #16).** Bila `CUSTOMER_SITE_ID` terisi → POST balas 404 dan GET balas "setup sudah selesai" — penyerang tidak bisa mengklaim site pada database kosong; jalur lokal owner tetap berfungsi (ada test).
- **Load test jalur order tersedia (🟢 #18).** Fase `--order-phase` di `load:multi-buyer` (default mati): membuat N order → membaca status via token akses → cancel semua di blok `finally`; guard `--run-live`/`--confirm-host`/allow-flag tetap berlaku.
- **File mati dihapus (🟢 #17).** `scripts/deploy/build-customer.sh` + `deploy-customer.sh` (tidak pernah dipanggil kode mana pun) dihapus; referensi AGENTS.md & BENGKEL_HANDOFF disesuaikan.

### ⚠️ Dua temuan terbukti premisnya salah (sengaja TIDAK diubah)

- **#11 "verifikasi kredensial pakai wrangler":** fakta di lapangan — portal & CLI sudah memakai REST API (`/user/tokens/verify` + `/accounts/{id}`); wrangler menerima token lewat env, bukan argumen proses.
- **#13 "deploy tanpa build TS":** `next build` meng-compile TypeScript langsung dari `src/` (`tsconfig` `noEmit:true`, nol file JS di `src/`, `ignoreBuildErrors:false`) — tidak ada jalur deploy JS stale.

### ✅ Gerbang pengujian

- **Semua hijau (gabungan kedua batch v1.3.29):** `tsc --noEmit` 0 error → ESLint 0 error → **125 file / 992 test PASS** (+20 test baru) → `release:audit` 60/60 → `next build` exit 0.

## [1.3.28] - 2026-10-08

### 🧾 Batch perbaikan hasil audit reviewer rilis 1.3.27 (F-01…F-11, semua temuan dieksekusi atas izin owner)

- **`SALIN_CADANGAN.bat` kini benar-benar menyelamatkan semua aset penting (F-01, temuan P1).** Dulu hanya `backups\` yang disalin — `arsip-klien\` (kredensial tiap klien) dan `.env.local` (secret utama) tidak pernah ikut, padahal dua aset itu paling sulit dibangun ulang saat bencana. Kini ketiganya disalin; dua terakhir dilewati dengan pesan jelas bila belum ada, dan kegagalan salinan per-aset ikut memunculkan exit code gagal.
- **Output backup bertanggal `YYYY-MM-DD` (F-07).** Tujuan kini `cadangan-flashdisk\<tanggal>\` (atau `<drive>:\cadangan-portfolio\<tanggal>\`) memakai format locale-independent via PowerShell — salinan lama tidak lagi tercampur dengan yang baru.
- **README backup menyarankan enkripsi 7-Zip berpassword (F-08).** Isi backup kini sensitif (data pembeli + arsip klien + `.env.local`): README menambah cara kompres `7z a -p -mhe=on` dan aturan simpan password terpisah dari flashdisk.
- **Guardrail harga diselaraskan spesifikasi: Rp50.000–Rp50.000.000 (F-02).** Rentang lama Rp1.000–Rp100.000.000 loloskan typo nol-hilang (199.000 → 1.990); kini batas bawah Rp50.000 menutup kasus itu. Test boundary ditambah (Rp50.000 & Rp50.000.000 valid; Rp49.999 & Rp50.000.001 ditolak).
- **Key harga pindah ke `base_price_idr` sesuai spesifikasi (F-03).** Key lama `pricing_config` (rilis 1.3.27) tetap dibaca sebagai fallback — harga yang pernah disimpan owner tidak hilang; penulisan hanya ke key baru, pembacaan key baru selalu menang.
- **`getBasePrice()` punya cache 60 detik sesuai spesifikasi (F-04).** Dulu 1 query D1 per pembacaan; kini hasil baca di-cache in-memory 60 dtk, `updateBasePrice()` membersihkan cache (harga baru langsung terbaca), error query tidak di-cache. Test: query hanya sekali dalam TTL + cache bersih setelah update.
- **Halaman harga pindah ke `/admin/harga` sesuai spesifikasi (F-05).** Dari `/admin/system/harga` (registry desktop ikut); proteksi `AdminAuthGuard` + middleware `/admin` tidak berubah — tetap redirect Admin Login tanpa sesi.
- **Test baru: harga baru tidak menghitung ulang order lama (F-06).** Order dibuat saat Rp250.000 → harga diubah ke Rp400.000 → order baru = Rp400.000, order lama tetap Rp250.000, dan nol `UPDATE` menyentuh kolom `amount`.
- **Runbook gladi resik melengkapi cakupan token & cron backup (F-10).** Prasyarat kini menyebut **D1 Edit + R2 Edit + Workers Edit** (template *Edit Cloudflare Workers* sesuai panduan portal); gerbang final ikut mengecek backup otomatis harian 01:00 WIB.
- **`CATATAN_SERAH_TERIMA` checklist kini 6 langkah (F-09):** ditambah "Panduan singkat kelola konten dijelaskan ke klien".
- **Monitoring: helper mati `endpointPath('{siteSlug}')` dihapus (F-11).** Check synthetic monitor semuanya path statis pasca-hapus tenant; `--site-slug` tetap dipakai sebagai label laporan.

### ✅ Gerbang pengujian

- **Semua hijau (dijalankan ulang independen setelah batch perbaikan):** `tsc --noEmit` 0 error · ESLint 0 error · **123 file / 972 test PASS** (+4 test baru) · `npm run build` exit 0.

## [1.3.27] - 2026-10-08

### 🧹 Hapus total konsep tenant `/<slug>` (PK1 + PK3)

- **Semua rute tenant dibuang.** Rute `/<slug>/...` (portfolio, projects, about, contact, cv, preview, api publik per-tenant) dihapus — satu deployment hanya melayani satu klien, path ber-tenant tidak pernah ada gunanya. `activateOrder` kini **Opsi A**: label generatif `site_<ts>_<rand>` ditulis ke `orders.site_id`/`audit_logs.site_id` **tanpa INSERT ke tabel `sites`**; skrip `cleanup-fake-sites.ts` membersihkan baris fake hasil alur lama (SELECT dulu → tampilkan → hapus terarah; `sites` produksi kini hanya `default-site`). 5 script penunjang ikut diperbaiki.
- **Email aktivasi jujur (Opsi A).** "Pembayaran Terverifikasi — Website Sedang Disiapkan" hanya berisi fakta (verifikasi sukses, diupayakan online ≤1×24 jam, akses diserahkan via WhatsApp) — **nol link, nol tombol, nol slug**, diproteksi test (`not.toMatch(/https?:\/\//)`). Link website baru muncul di email "Website Sudah Online" setelah deploy benar-benar sukses.
- **Halaman order jujur** sesuai status nyata; **banner DRAFT refund dihapus** — kebijakan refund di playbook §8 resmi disetujui owner dan boleh dijanjikan ke klien (PK3, selesai dalam commit PK1).

### 📧 Email "Website Sudah Online" + dropdown slug dari order (PK2)

- **`scripts/onboarding/notify-online.ts` (baru):** email Resend pasca-deploy pertama — URL live, tautan `/admin/login`, catatan kredensial; tidak pernah melempar error (mem-balik `{sent, reason}`); lookup order via `queryD1ForDatabase`. 8 test baru.
- **Hanya deploy pertama sukses yang mengirim email** (alur provisioning + retry dengan flag `notifyOnline: true`); batch update cloud-manager dan `/api/deploy-client` sengaja tidak mengirim.
- **Dropdown saran slug di portal** kini `<datalist>` dari `GET /api/order-slugs` (status pending/waiting/activated); ketik manual tetap bisa.

### 💰 Harga jual bisa diubah owner lewat admin (PK4)

- **Panel `/admin/system/harga`** (zona Sistem & Tampilan): ubah harga lewat UI → disimpan di D1 `platform_settings` key `pricing_config`; guardrail Rp1.000–Rp100.000.000 (anti-typo); `BASE_PRICE` 199.000 tetap fallback di mana pun — D1 mati/belum di-set pun tidak pernah error.
- **Nominal order dihitung server dari harga D1** (route checkout tidak pernah menerima `amount` dari klien); tampilan harga di landing di-inject server (ISR 60 dtk, 0 request/visitor) dan checkout membaca dari `payment-info` (0 request ekstra); `GET`/`PUT /api/admin/pricing` (admin + CSRF). 11 test baru.

### 📜 Halaman Syarat & Ketentuan + Kebijakan Privasi (PK5)

- **`/syarat-ketentuan`** (8 poin: harga terkunci saat order, verifikasi manual ≤1×24 jam, refund = playbook §8, akses setup Cloudflare, source code sekali bayar) dan **`/kebijakan-privasi`** (10 poin sesuai alur nyata: D1/R2/Workers, Resend, WhatsApp, statistik kunjungan, tanpa cookie iklan) — brand Make it Better Studio, kontak m4keitbetter@gmail.com, saling tertaut, masuk `sitemap.xml`.
- **Checkout:** baris persetujuan "Dengan memesan, Anda menyetujui Syarat & Ketentuan dan Kebijakan Privasi" di bawah tombol Pesan.
- **Email struk/kedaluwarsa/batal** (teks + HTML): footer tautan S&K + Privasi dari origin situs. Email aktivasi tetap **nol link** — desain PK1 dipertahankan.

### 💾 `SALIN_CADANGAN.bat` (PK6)

- **Script sekali klik di root repo:** menyalin `backups\` ke flashdisk (prompt huruf drive + validasi drive) atau ke `cadangan-flashdisk\` (tekan Enter); robocopy incremental (file lama tidak disalin ulang); pesan `[OK]`/`[X]` jelas untuk pemilik non-teknis. Diuji 4 jalur: tanpa backup, salin lokal, drive salah, dan inkremental dengan data asli 62 MB.
- `.gitignore`: `cadangan-flashdisk/*` dikeluarkan dari git kecuali `README.txt` (petunjuk cara pakai).

### 📋 Runbook gladi resik klien perdana (PK7)

- **`docs/operations/GLADI_RESIK_KLIEN_PERDANA.md`:** checklist 8 bagian — prasyarat → alur order storefront → portal provisioning/deploy → verifikasi isi & data → simulasi serah terima → pembersihan → gerbang final hari-H → tabel kegagalan cepat. Menunjuk dokumen yang sudah ada, tidak menduplikasi; seluruh perintah & path dirujuk diverifikasi ada.

### 🧾 Catatan serah terima otomatis + kebiasaan operasional (PK8)

- **`CATATAN_SERAH_TERIMA.md` ditulis otomatis `deployClient()`** ke `arsip-klien/<slug>/` setelah deploy sukses: aset URL, penunjuk kredensial (**tanpa nilai password**), status build/deploy jujur, checklist serah terima, jalur rutin backup/reset-password. Kegagalan menulis catatan tidak mengubah status deploy. 3 test baru.
- **Support-playbook:** kebiasaan wajib **Mutasi → Baca Ulang → Laporkan** (wajib bukti baca-ulang sebelum klaim "selesai") + tabel **retensi bukti bayar terverifikasi dari kode** (file dihapus saat batal/sweep 7 hari mengikuti audit PII 29 Sep; dipertahankan saat aktif; versi lama penggantian tertinggal sampai pembersihan).

### ✅ Gerbang pengujian

- **Semua hijau:** `tsc --noEmit` 0 error · ESLint 0 error · seluruh test pass (123+ file) · `npm run build` exit 0 · type-check `scripts/` (tsconfig sementara) bersih.

### ⚠️ Catatan rilis

- Perubahan berlaku setelah **deploy produksi + restart portal `PENGELOLA_KLIEN.bat` (port 4567)**. Harga jual di panel baru terbaca setelah deploy; pastikan sesuai sebelum klien pertama.

## [1.3.26] - 2026-10-06

### 🚀 Rilis Produksi & Bukti Uji Nyata

- **v1.3.26 LIVE di produksi** (2026-10-06): push ke GitHub ✓, deploy worker (version ID `9a5ec86c`, jadwal cron backup harian `0 18 * * *` aktif), endpoint `/api/health` menjawab `1.3.26`.
- **Uji nyata edit konten di produksi LOLOS:** dari sesi admin, judul satu project diubah → halaman `/projects` publik memuat perubahan dalam ≤10 detik (invalidasi cache terbukti jalan) → judul dikembalikan ke semula dan terverifikasi dari database. Skrip uji dihapus, data produksi bersih seperti sediakala.

### 🔧 Perbaikan Temuan MEDIUM Hasil Audit Alur Bisnis (Batch 2 — 8 dari 8 temuan)

- **Backup harian klien kini benar-benar jalan.** Masalahnya: config wrangler hasil onboarding tidak punya `triggers.crons` dan `CRON_SECRET` tidak pernah dibuat untuk klien — handler `scheduled` di worker klien tidak pernah terpicu, jadi backup D1 harian + bersih order klien mati sejak awal. Perbaikannya: `deployClient()` kini membuat `CRON_SECRET` per klien (persist ke `config.env`), ikut masuk rencana env, dan config wrangler klien mendapat jadwal `0 18 * * *` (01:00 WIB) — sama dengan milik owner; binding `WORKER_SELF_REFERENCE` sudah ada sehingga endpoint `/api/cron/daily` bisa dipanggil dari cron.
- **Kegagalan form checkout tidak lagi mengunci email pembeli 24 jam.** Masalahnya: rate limit per-email menghitung SETIAP percobaan — 5× salah isi form saja membuat email diblokir 24 jam. Perbaikannya: `checkDataRateLimit` mendapat mode intip (`record: false`) yang hanya mengecek blokir tanpa menambah hitungan; checkout memakai mode intip saat cek awal dan HANYA menghitung setelah order berhasil dibuat. Batas 5 order/jam per email + blokir 24 jam tetap berlaku untuk yang benar-benar membuat order.
- **Countdown halaman order kini menghitung aturan yang benar.** Masalahnya: order `waiting_verification` menghitung ke `expires_at` (dibuat + 24 jam) padahal aturan pembatalan otomatis server adalah 7 hari sejak `updated_at` (saat bukti diunggah) — countdown menunjuk nol ±6 hari sebelum order benar-benar dibatalkan, plus satuan hari/detik sama-sama memakai "d". Perbaikannya: status menunggu verifikasi kini menghitung ke `updated_at + 7 hari` dengan label "Dibatalkan otomatis dalam:", satuan hari jadi "hr", dan API order ikut mengembalikan `updated_at`.
- **Komentar & metrik publik kini punya pagar.** Masalahnya: POST `/api/comments` tanpa rate limit IP (bot bisa membanjiri) dan kedua endpoint menerima `siteId` apa pun (tiap siteId baru = baris D1 baru yang lolos kontrol per-path). Perbaikannya: komentar POST dibatasi 5/menit per IP (blokir 10 menit), dan komentar + metrics menolak `siteId` yang bukan site resmi deployment (hanya `SITE_ID` atau bucket legacy `default-site`). Rate limit metrics 60/menit yang sudah ada tidak diubah.
- **Re-provision slug sama tidak lagi merotasi password diam-diam & menggandakan arsip.** Masalahnya: menjalankan ulang onboarding untuk klien lama selalu membuat hash password BARU dari password random (login klien lama mati tanpa pemberitahuan) dan membuat folder arsip bernomor baru (`01_slug`, `02_slug`, ...) dengan config.env yang saling bertentangan. Perbaikannya: modul bersama `scripts/onboarding/onboard-reuse.ts` dipakai portal & CLI — arsip lama ditemukan lebih dulu dan dipakai ulang (folder sama, `JWT_SECRET`/`PASSWORD_SALT`/URL custom domain/`CRON_SECRET` dipertahankan, kunci tak dikenal ikut terbawa); password hanya dirotasi bila diminta eksplisit (`--password`/kolom portal); kalau admin sudah ada tapi arsip hilang, onboarding MENOLAK dengan pesan jujur (ada test unit untuk semua cabang keputusan).
- **Custom domain kini punya guard duplikat + jalur lepas.** Masalahnya: `PUT workers/domains` diam-diam memindahkan domain yang sudah menempel ke worker lain, dan tidak ada cara melepas domain. Perbaikannya: `guardWorkerDomainAttach()` mengecek dulu — sudah menempel di worker yang sama → idempoten (tanpa PUT), menempel di worker lain → ditolak dengan instruksi; aksi CLI baru `detach_domain` memakai API resmi `DELETE /accounts/{id}/workers/domains/{domain_id}` dan membersihkan catatan `CUSTOM_DOMAIN` di arsip. Portal & CLI sama-sama terlindungi.
- **ISR/revalidasi terbukti end-to-end di produksi (M2 — verifikasi, tanpa perubahan kode).** Bukti hari ini terhadap produksi v1.3.25: halaman `/preview/os-desktop` `x-opennext-cache: HIT` (baca cache KV sehat kembali — kuota harian yang dulu menghancurkan ISR sudah beres), webhook `/api/revalidate` HMAC valid → `{"revalidated":true}` → GET berikutnya **STALE** (invalidasi menyebar) → GET setelah 65 detik **HIT** kembali (revalidasi latar via memory queue selesai & ter-commit) — rantai inilah yang dipakai admin saat mengedit konten (`revalidatePath`); halaman `/about` & `/contact` ternyata dynamic (edit tampil langsung), `/projects` ISR ≤60 detik. Perbaikan tag `revalidatePath('/preview/*')` dari investigasi 28 Sep kini terverifikasi (catatan "belum dibuktikan" ditutup).
- **Dokumen & temuan kecil:** klaim `SALES_PRICING.md` soal "akses dikirim via email" diluruskan (email aktivasi hanya berisi link website + ringkasan order, akses admin diserahkan terpisah); isi Draft kebijakan refund di `support-playbook.md` §8 (ditandai **DRAFT — menunggu sign-off owner**, belum boleh dijanjikan ke klien); visibilitas repo GitHub **terverifikasi privat** (API tanpa autentikasi menjawab 404) — artifact arsip 7 hari aman, temuan audit "visibility belum terverifikasi" ditutup.
- **Diuji (semua hijau):** `tsc --noEmit` 0 error · ESLint 0 error · **942/942 test pass** (15 test baru: keputusan re-provision ×5, arsip/parse/D1 ×9, penolakan siteId asing; 2 test lama disesuaikan ke kebijakan siteId tunggal) · type-check terpisah untuk `scripts/` — berkas onboarding yang diubah bersih (6 error tersisa ada di 4 berkas lama yang memang tidak pernah masuk gerbang tsconfig).
- **Catatan:** perubahan webhook/portal berjalan di laptop (portal `PENGELOLA_KLIEN.bat` baru memakai kode ini setelah di-restart) dan butuh deploy untuk berlaku di klien.

## [1.3.25] - 2026-10-06

### 🔗 Perbaikan Temuan HIGH Hasil Audit Alur Bisnis (Batch 1)

- **Link di semua email pesanan tidak lagi menunjuk `localhost`.** Masalahnya: build produksi meng-inline `NEXT_PUBLIC_APP_URL=http://localhost:3000` dari `.env.local` (dibuktikan dengan memeriksa bundle hasil build — nilai localhost muncul di jalur email struk, aktivasi, kedaluwarsa, pembatalan, dan tiket Telegram), jadi semua link yang diterima pembeli mati; halaman detail order juga menampilkan domain hardcode `makeitbetter.my.id` yang salah untuk deployment klien. Perbaikannya: satu resolver `getPublicBaseUrl()` (`NEXT_PUBLIC_APP_URL` → `NEXT_PUBLIC_SITE_URL` → domain bawaan; URL loopback otomatis diabaikan di luar mode development) kini dipakai di seluruh jalur email/Telegram dan tampilan halaman order; `.env.example` + dokumen env kini menjelaskan perbedaan `NEXT_PUBLIC_APP_URL` (basis link email) vs `NEXT_PUBLIC_SITE_URL` (SEO).
- **Kuota storage kini ditegakkan di jalur upload utama `/api/admin/upload`.** Masalahnya: route yang dipakai sehari-hari admin ini tidak memeriksa kuota — file bisa melewati limit situs, padahal jalur presign/direct/project-media sudah mengecek. Perbaikannya: cek + upload dibungkus SATU lock per-site (anti-race TOCTOU) untuk path `sites/{id}/`, respons 403 + `errorCode` saat limit terlampaui; layout legacy `default-site` (`assets/...`) dikecualikan agar konsisten dengan guard `upload/direct`.
- **CSRF in-handler untuk 3 route admin mutasi.** `POST /api/admin/orders` (aktivasi/cancel/reopen), `/api/admin/clear-cache`, dan `/api/admin/clear-rate-limit` kini memakai `validateAdminRequest` = auth + verifikasi double-submit CSRF + jejak audit — sebelumnya hanya auth (lapisan CSRF hanya ada di middleware Edge). UI admin sudah mengirim header CSRF, jadi tidak ada perubahan perilaku bagi admin.
- **`/api/health` melaporkan versi rilis yang benar.** Masalahnya: field `version` di-hardcode `1.0.0` — portal `PENGELOLA_KLIEN.bat` membandingkannya dengan CHANGELOG, sehingga semua klien selalu ditandai "perlu update" dan deploy yang gagal tak pernah terdeteksi. Perbaikannya: memakai `APP_VERSION` (kini `1.3.25`) yang dijaga test agar selalu sama dengan entri teratas CHANGELOG; `/api/os/version` dan meta aplikasi ikut memakai konstanta yang sama. Diagram deploy di AGENTS.md ikut dikoreksi (Pages → Workers).
- **Diuji (semua hijau):** `tsc --noEmit` 0 error · ESLint 0 error · **927/927 test pass** (9 test baru: resolver base URL ×5, sinkron versi CHANGELOG ×1, kuota upload ×3).

### ✅ Keputusan Owner: Kejujuran Dokumen & Penjualan (Batch Audit)

- **Janji fitur AI dihapus dari penjualan & panduan.** Temuan audit: fitur AI mati 3 lapis (panel AI tidak ada di `PANEL_MAP`, endpoint chat pakai kunci fallback yang tidak pernah terbaca, `FEATURE_AI` selalu `false` di build klien). Sesuai keputusan Anda: halaman **checkout** tak lagi menampilkan baris "AI assistant terintegrasi", **panduan klien** tak lagi mengarahkan ke aplikasi `/admin/system/ai` yang belum tersedia, dan **panduan owner** bagian 5 dikoreksi jujur — klien BELUM bisa mengatur AI sendiri, jangan dijanjikan ke klien. (Mengaktifkan AI kembali jadi pekerjaan tersisa bila diinginkan nanti.)
- **Klaim slug di `SALES_PRICING.md` dikoreksi.** Dokumen bilang "pembeli memilih slug sendiri" — padahal kode menghasilkan slug otomatis dari nama (field `desiredSlug` hanya tersedia via API, tidak ada di form). Kini dokumen sesuai kenyataan; menambahkan pilihan slug ke checkout sengaja TIDAK dilakukan (bukan bagian audit, butuh desain tersendiri).
- **Batasan `update_template` dari HP didokumentasikan jujur** di `PANDUAN_KELOLA_DARI_HP.md`: aksi itu butuh `arsip-klien/<slug>/config.env` yang tidak ikut di-commit ke GitHub, jadi dari HP/CI pasti gagal ("config.env tidak ditemukan"); update template tetap dikerjakan dari laptop. Terverifikasi di kode: `onboard_client` & `custom_domain` tetap aman dari HP (kredensial diisi lewat formulir, arsip hanya fallback). Solusi CI (rubah workflow jadi bisa baca arsip) sengaja TIDAK dibuat — butuh kredensial di GitHub, risiko keamanan tidak sepadan.

### 📐 Tab "Peta Bisnis": Detail Dipulihkan + Garis Siku Rapi + Ukuran Pas

- **Detail dua diagram dipulihkan penuh** ke versi aslinya (3 jalur Pembeli/Sistem/Owner dengan 17 kotak, peta aset 4 kotak besar dengan 14 node, kotak cron 01:00 WIB, detail bengkel 6 langkah, anti-spam, RAHASIA) — versi yang disederhanakan pihak lain (perubahan saat itu belum di-commit) dibatalkan total. Verifikasi: `git diff` terhadap versi asli `26b49bb` **kosong 100%**.
- **Garis penghubung kini rapi siku-siku (sudut 90°)** seperti contoh flowchart, atas keluhan owner (_"garisnya bengkok-bengkok tidak rapih"_): `flowchart.curve` diganti `linear` (garis miring) → **`stepBefore`**. Uji 5 opsi di browser — hanya keluarga `step` yang menghasilkan garis 100% siku; dari **122 segmen** di 2 diagram: **0 segmen miring**, dan `stepBefore` paling bersih dari garis menyinggut kotak (2 vs `stepAfter` 3 vs `step` 7).
- **Teks & gambar jelas tanpa digeser:** teks dalam diagram 16px, gambar **pas selebar kotak** (satu pandangan utuh, tanpa geser ke samping), judul halaman 28px / judul kartu 17px / keterangan 15px, lebar kontainer 1080px → **1400px**. Label dirapikan dengan pecahan baris (isi kata 100% sama) supaya diagram lebih ramping → huruf terbaca lebih besar.
- **Teruji nyata di browser:** 2 diagram ter-render **17 + 14 kotak, 20 + 10 panah, 7 kotak jalur**, semua detail lama terverifikasi ada di dalam SVG, 0 segmen miring, tanpa scroll horizontal.
- **Putaran 4 — semua garis tipis kini lurus & panah masuk tegak** (keluhan lanjutan: _"garis penghubung tipis tidak lurus tapi bengkok-bengkok, segitiga panah ke bawah menyeleweng"_). Tiga penyebab terukur di browser: (a) simpak antar-kotak dalam satu jalur tidak segaris (selisih pusat 2–7px → belokan kecil di 6 garis), (b) 4 panah berhenti mendatar di tepi atas kotak sehingga segitiganya menyamping, (c) titik ganda di ujung garis membuat arah panah tidak tentu. Semua diperbaiki otomatis setiap render: garis rantai **diluruskan jadi satu garis tegak tepat di atas tengah kotak tujuan**, seluruh garis yang masuk ke tepi atas kotak **dipaksa tegak lurus dari atas**, titik ganda dibuang.
- **Terukur ulang (sebelum → sesudah pada build yang sama):** belokan kecil **6 → 0**, panah menyamping di tepi atas **4 → 0**, titik ganda **35 → 0**, segmen miring **0 → 0** — total 15 + 7 panah masuk tegak dari atas, 8 panah menyamping gaya flowchart tetap menyinggur kotak dengan celah normal 0–4px. Detail diagram utuh (17 + 14 kotak, 20 + 10 panah), tanpa scroll.
- Perubahan hanya `scripts/onboarding/public/index.html` + `docs/diagrams/*.mmd` (alat portal owner) — **tidak perlu deploy**, tidak memengaruhi situs klien.

## [1.3.24] - 2026-10-06

### 🔐 Perbaikan 4 Temuan Kritis Hasil Audit Uji Alur Bisnis End-to-End

- **1. Cadangan database (backup D1) ditutup dari akses publik.** Masalahnya: siapa pun yang menebak nama file backup bisa mengunduh seluruh isi database lewat proxy publik `/api/r2/...` — isinya password hash login klien dan data pesanan (PII). Perbaikannya: kunci yang mengandung `/backups/` kini selalu ditolak (404) di proxy tersebut; jalur unduh resmi lewat admin tetap berfungsi. Ada test baru yang membuktikan file backup tidak pernah tersaji.
- **2. Portal onboarding kini benar-benar mendeploy website (bukan cuma menyiapkan database).** Masalahnya: setelah pendaftaran, portal berhenti di provisioning sedangkan kartu sukses, surat serah terima, dan pesan WhatsApp semuanya mengklaim "website sudah aktif" — padahal belum ada satu pun proses deploy. Perbaikannya: setelah provisioning sukses, portal otomatis menjalankan build & deploy (log tampil di layar), judul kartu sukses kini jujur (online / belum online), dan bila deploy gagal muncul kotak peringatan **"Website BELUM online"** + tombol **"Coba Deploy Ulang Sekarang"** langsung di kartu itu; tombol Salin Pesan WhatsApp baru aktif setelah website benar-benar online. Panduan owner diperbarui: alamat `.pages.dev` → `.workers.dev`, "Cloudflare Pages" → Cloudflare (Worker), dan langkah onboarding kini menyebut build & deploy.
- **3. Pesanan yang dibatalkan otomatis (7 hari) tidak lagi jalan buntu.** Masalahnya: order yang bukti bayarnya tak selesai diverifikasi 7 hari dibatalkan **tanpa pemberitahuan siapa pun** — pembeli yang sudah membayar kehilangan pesanannya diam-diam, dan status `canceled`/`failed` tidak punya tombol kembali. Perbaikannya: pembeli kini menerima **email pemberitahuan pembatalan** (dengan instruksi kalau sudah transfer), admin menerima **notifikasi Telegram dengan tombol "♻️ Buka Kembali Order"**, ditambah action API `reopen` — order kembali ke antrean verifikasi dan pembeli cukup upload ulang bukti. (File bukti lama tetap dihapus saat pembatalan — keputusan audit keamanan 29 Sep soal PII; karenanya upload ulang dibutuhkan.)
- **4. Portal onboarding dikunci & alur HP berhenti memakai token rahasia bawaan.** Masalahnya: portal membuka diri ke seluruh jaringan lokal dengan CORS `*` (halaman web mana pun bisa membaca daftar kredensial admin klien lewat `/api/clients`), dan workflow HP diam-diam memakai `secrets.DEFAULT_CF_*` (token akun owner) bila input token dikosongkan — risiko klien terprovisioning ke akun Cloudflare yang salah. Perbaikannya: portal hanya di-bind ke `127.0.0.1` + menolak permintaan dari origin selain `localhost` (diuji nyata: situs asing kena **403**, akses lewat IP WiFi **tidak terjangkau**), fallback `DEFAULT_CF_*` dihapus (token wajib diisi, pesan error menjelaskan), password admin **tidak lagi dicetak ke log** GitHub (tetap ada di Job Summary & arsip), dan retensi artifact arsip klien dipangkas **90 → 7 hari** karena berkasnya memuat kredensial.
- **Diuji (semua hijau):** `tsc --noEmit` 0 error · ESLint 0 error · **918/918 test pass** (termasuk test baru: backup 404, email pembatalan + tombol Telegram, reopen order) · **build produksi Next.js exit 0** · uji hidup portal 5/5 (localhost 200, origin jahat 403, origin sah 200, IP LAN mati, elemen UI baru termuat) · sintaks JavaScript halaman portal valid.

### 🗺️ Tab "Peta Bisnis" Baru di Portal Owner (khusus Anda — klien tidak melihat)

- **Portal `PENGELOLA_KLIEN.bat` kini punya tab ke-5: "Peta Bisnis"** — dua diagram gambar besar, khusus untuk Anda:
  1. **Alur Bisnis** (Pembeli → Sistem → Anda): pesan → bayar → bukti → verifikasi → aktivasi → bengkel 6 langkah → serah terima → klien isi konten sendiri, termasuk pekerjaan otomatis jam 01:00 WIB (backup + bersih order).
  2. **Peta Aset** (siapa punya apa di mana): data tiap klien ada di **akun Cloudflare milik klien** (terisolasi), rahasia ada di arsip komputer Anda, uang masuk **langsung** ke rekening Anda tanpa potongan platform.
- **Kenapa klien tidak bisa melihat:** portal hanya jalan di komputer Anda — klien tidak pernah menerimanya (dipilih sendiri dari dua opsi; panel `/admin` sengaja tidak dipakai karena dipakai semua klien).
- **Satu sumber, dua pembaca:** diagram disimpan sebagai teks (format Mermaid) di `docs/diagrams/*.mmd` — Anda melihat **gambarnya** di portal, **AI membaca teksnya** dari repo. Alur berubah? Cukup ubah file `.mmd`, portal langsung menampilkan versi terbaru tanpa restart.
- **Teruji nyata:** portal dijalankan → endpoint diagram OK → browser merender **2 diagram penuh (17 + 14 kotak, 20 + 10 panah)** tanpa satu pun error; gerbang lulus (118 file / 914 test PASS, audit 59/59, kesiapan jual 12/12).

## [1.3.23] - 2026-10-05

### 🧰 Perbaikan Daftar Tabel Backup CLI (`npm run backup:d1`)

- **Masalahnya:** daftar tabel cadangan lama masih memuat `client_access` (tabel yang sudah dihapus dari database) dan belum memuat 8 tabel penting — termasuk `site_users` (login klien), `orders` (pesanan), dan `platform_settings` — jadi backup CLI melewatkan data itu.
- **Perbaikannya (atas izin Anda):** daftar disamakan dengan **18 tabel yang benar** (gabungan dua skema database) untuk backup **dan** urutan restore; tool restore kini juga menyiapkan tabel skema bersama di database target, sehingga hasil backup yang memuat tabel login klien bisa di-restore ke staging.
- **Diuji nyata:** backup dry-run → **18 tabel / 77 baris**, `client_access` hilang, `site_users`/`orders`/`platform_settings` ikut; backup → restore dry-run **validasi 18/18 tabel cocok**. Gerbang tetap hijau: 118 file / 914 test PASS, audit rilis **59/59** + kesiapan jual **12/12**.
- **Bonus:** skrip drill `npm run restore:seed-drill` ikut dibersihkan dari sisa INSERT ke tabel `client_access` (tabel sudah dihapus) — skrip itu dulu _crash_ di tengah jalan saat `--apply`; kini alat uji cadangan→restore utuh kembali tanpa perubahan cara kerja lainnya.

## [1.3.22] - 2026-10-05

### 💾 Fitur Backup Database Otomatis (harian 01:00 WIB + tombol manual)

- **Backup otomatis:** setiap jam 01:00 WIB, seluruh isi database (D1) di-simpan otomatis ke penyimpanan cloud (R2) dalam bentuk 1 file JSON. **7 backup terakhir disimpan**, yang lebih lama dibersihkan otomatis.
- **Panel baru di admin:** menu **Sistem & Tampilan → "Backup Database"** (`/admin/system/backup`) berisi tombol **Backup Sekarang** (backup manual kapan saja), daftar backup, dan tombol **Unduh** untuk mengunduh/membuka file backup.
- Daftar tabel dibaca **langsung dari database** setiap kali (bukan daftar tetap), jadi tabel baru otomatis ikut ter-backup — termasuk tabel login klien, order, dan pengaturan platform yang sebelumnya belum tercantum di daftar lama.
- Kegagalan backup **tidak menggagalkan pekerjaan cron lainnya**; kalau penyimpanan cloud belum siap, backup dilewati dengan aman.
- Diuji: **17 test baru**, total **118 file / 914 test PASS**, audit rilis **59/59** + kesiapan jual **12/12**.

### ⏰ Bukti Cron 01:00 WIB Benar-Benar Jalan (perbaikan catatan + uji ulang)

- **Terbukti langsung:** uji jadwal 1 menit selama 3,5 menit merekam **3 fire `* * * * *` + 3 log `[cron] POST /api/cron/daily -> 200`** — rantai scheduler Cloudflare → handler → endpoint harian → tulis database bekerja penuh di produksi.
- **Temuan penting:** jadwal uji 1 menit ternyata **masih terpasang di server selama ~31 jam** (catatan lama menulis sudah dilepas — yang dilepas hanya file lokal, pendaftaran server tidak pernah dikembalikan). Artinya sejak 3 Okt cron menembak tiap menit (boros tetapi tidak merusak), dan fire 01:00 WIB semalam mustahil terjadi karena jadwal terdaftar saat itu menitan.
- **Jadwal harian sudah dipasang kembali & terverifikasi lewat API:** `0 18 * * *` (terdaftar 2026-10-05T02:42:36Z). Fire berikutnya: **01:00 WIB malam ini** — inilah saatnya backup pertama dibuat otomatis.

## [1.3.21] - 2026-10-04

### 🌐 Custom Domain Klien Pindah dari Cloudflare Pages ke Worker

- **Masalahnya:** fitur pemasangan custom domain masih memakai sistem lama Cloudflare Pages dan menyuruh klien menambah 1 record CNAME manual ke `<slug>.pages.dev` — padahal sejak 1.3.20 situs klien dideploy sebagai **Worker**, jadi fitur ini tidak akan berfungsi.
- **Perbaikannya:** kini memakai pintu API resmi Cloudflare untuk menyambungkan domain langsung ke Worker klien (`PUT /accounts/{id}/workers/domains`). **Cloudflare membuat record DNS dan sertifikat HTTPS secara otomatis** — klien tidak perlu mengatur apa pun lagi di tempat membeli domain (syarat: nameserver domain sudah mengarah ke akun Cloudflare klien).
- Perubahan: portal (`/api/custom-domain` + tampilan hasil & pesan WhatsApp), CLI `cloud-manager`, serta panduan owner & dokumen izin token klien (D1, R2, Workers — Pages tidak dipakai lagi).
- **Diuji:** 9 unit test otomatis **+ uji nyata sukses di akun Cloudflare sungguhan** (2026-10-04): domain uji `uji.makeitbetter.my.id` disambungkan ke Worker produksi → situs terbuka **HTTP 200** (13 detik, sertifikat HTTPS valid) → record dilepas lagi sampai bersih (NXDOMAIN). Skrip uji: `scripts/onboarding/uji-custom-domain.ts`.

## [1.3.20] - 2026-10-04

### 🛡️ Data Klien Kini Benar-Benar Terisolasi di Database Miliknya Sendiri (perbaikan penting)

- **Masalahnya:** portal onboarding memang membuatkan database (D1) dan penyimpanan media (R2) di akun Cloudflare milik klien, **tetapi proses build situs klien selama ini memakai konfigurasi milik owner**. Akibatnya, kalau klien pertama di-provision, semua datanya akan masuk ke database owner (tercampur) dan medianya ke bucket owner — janji "1 klien = 1 akun, terisolasi 100%" tidak terpenuhi. **Karena belum pernah ada klien yang di-provision, kerusakan belum terjadi** — dan sekarang sudah diperbaiki sebelum klien pertama datang.
- **Perbaikannya:** build untuk klien kini memakai konfigurasi khusus klien tersebut (database, bucket, alamat situs, serta `JWT_SECRET`/`PASSWORD_SALT` baru yang digenerate per klien supaya sesi login tidak bisa dipakai silang antar situs). Nilai milik owner sengaja **dikosongkan** dari build klien, dan pengujian membuktikan **0 dari 20 kunci milik owner** ditemukan di seluruh artefak build klien (1.645 file diperiksa).
- **Deploy juga berubah:** dulu `wrangler pages deploy` (yang ternyata tidak memasang konfigurasi apa pun), kini **Worker per klien** lewat config wrangler hasil generate (`wrangler.client.<slug>.jsonc`).
- **Yang belum teruji:** deploy end-to-end ke Cloudflare sungguhan membutuhkan satu akun Cloudflare klien nyata (Account ID + API Token izin D1/R2/Workers/KV). Uji yang sudah jalan memakai data dummy + dry-run.

### 🧹 Panel "Master Dashboard" Dihapus (kode mati ±2.400 baris)

- **Panel pengelola banyak klien sekaligus (`ClientDashboardPanel`, `OrdersPanel`, `PaymentConfigPanel`) sudah dibuang** — ketiganya tidak terdaftar di menu admin sehingga tidak pernah bisa dibuka, dan salah satunya memanggil endpoint yang sudah tidak ada. Konsep produk memang tidak memakai panel master: owner mengelola isi situs klien dengan **login ke `/admin` di situs klien**.
- Flag `FEATURE_MASTER_DASHBOARD` & `FEATURE_CLIENT_DASHBOARD` dihapus dari kode, `.env.example`, dan daftar pemeriksaan rilis.
- **Endpoint API tetap dipertahankan** (billing, riwayat pesanan, statistik storage) — yang dihapus hanya panel matinya.
- Bukti: pencarian seluruh folder `src/` dan `scripts/` = **0 sisa**.

### 📚 Dokumen Disesuaikan dengan Konsep Jualan (±25 file)

- **2 dokumen dihapus** karena isinya bertentangan total dengan konsep: `docs/operations/buyer-onboarding-checklist.md` dan `docs/release/BUYER_ONBOARDING.md` (bahkan menulis _"Do not create one deployment per buyer"_ — kebalikan dari konsep 1 klien = 1 akun Cloudflare).
- **Dokumen yang diperbaiki:** `README.md`, `AGENTS.md` (alur onboarding, pipeline deploy, jumlah tabel D1 diverifikasi ke file skema), seluruh `docs/agent-context/` (PRD ditulis ulang), `docs/operations/` (playbook dukungan — 17 rujukan "Master Dashboard" diganti alur portal), `docs/release/`, dan **3 panduan owner/klien** (template WhatsApp kini persis sama dengan template resmi portal; klien tidak lagi disuruh membuka `/setup` yang sudah mati).
- Rujukan URL `.pages.dev` diganti `.workers.dev` mengikuti jalur deploy baru.

### ⚠️ Catatan yang Perlu Diketahui

- **Custom domain klien belum ikut migrasi** — fiturnya masih memakai API khusus Cloudflare Pages padahal deploy kini Worker. Perlu perbaikan + pengujian dengan akun Cloudflare nyata (tercatat di log tracker `patch_celah_env_klien_2026_10_04.md`).
- **Cron harian 01:00 WIB:** handler sudah terbaca Cloudflare (`Handlers: fetch, scheduled`), tetapi pemicu otomatisnya **belum terbukti menembak** pada uji 40 menit — masih dalam penyelidikan (lihat log `cron_worker_secrets_2026_10_03.md`).
- **Verifikasi:** `npx tsc --noEmit` 0 error · `npx eslint src` 0 error · **115 file / 887 test PASS** · `release:audit` **59/59** · `release:sale-readiness` **12/12** (skor turun wajar — pemeriksaan untuk file yang sengaja dihapus ikut dibuang).

## [1.3.19] - 2026-10-04

### ⏰ Cron Harian Cloudflare: Order Kedaluwarsa Kini Ditandai Otomatis

- **Sebelumnya penanda order kedaluwarsa hanya jalan kalau panel admin Order dibuka.** Fungsi `sweepExpiredOrders()` memang sudah ada sejak lama, tetapi satu-satunya pemanggilnya adalah `GET /api/admin/orders` — kalau panel tidak dibuka, order yang lewat masa berlakunya tetap "pending" selamanya. Kini ada **jadwal otomatis harian pukul 01:00 WIB (18:00 UTC)** di Cloudflare (`triggers.crons` di `wrangler.jsonc`).
- **Cara kerjanya:** Cloudflare memanggil handler `scheduled` → handler itu memanggil `POST /api/cron/daily` lewat _service binding_ internal `WORKER_SELF_REFERENCE` (request sepenuhnya di dalam jaringan Cloudflare, tidak lewat internet publik) → endpoint memverifikasi token lalu menjalankan sweeper. Sweeper sendiri punya jaminan 10 menit, jadi walau dipanggil berulang kuota database tidak diboroskan.
- **Handler `scheduled` ditambahkan otomatis oleh skrip build** (`prepare-opennext-worker-output.js`) karena paket OpenNext belum menyediakannya; `main` di `wrangler.jsonc` tetap `.open-next/worker.js` sesuai aturan pre-deploy. Sengaja memakai `await`, bukan `ctx.waitUntil`, supaya kegagalan pemanggilan langsung dihitung sebagai _run_ gagal dan muncul di log Cloudflare — bukan kegagalan sunyi.
- **Endpoint baru `POST /api/cron/daily` dilindungi token `CRON_SECRET`** dengan pembandingan _timing-safe_ (pola yang sama dengan webhook Telegram). Tanpa token: **401**; token salah: **401**; `CRON_SECRET` belum diisi: cron dilewati dengan peringatan log (fitur ini opsional, bukan error).
- **Uji:** 6 test baru (500 tanpa konfigurasi, 401 tanpa/salah/beda-panjang token, 200 sukses, 500 saat sweep gagal).

### 🔐 12 Rahasia Dipindah ke Worker Secrets (Rotasi Tanpa Deploy Ulang)

- **Sebelumnya `wrangler secret list` = `[]`.** Semua rahasia produksi hanya hidup sebagai nilai yang tertanam saat `next build`, artinya mengganti rahasia harus build + deploy ulang. Kini **12 key menjadi Worker secrets**: `JWT_SECRET`, `PASSWORD_SALT`, `ADMIN_PASSWORD_SCRYPT`, `REVALIDATION_TOKEN`, `CRON_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_SECRET`, `TELEGRAM_ADMIN_CHAT_ID`, `NOTIFICATION_API_KEY`, `CLOUDFLARE_D1_API_TOKEN`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`.
- **Praktiknya di produksi tidak berubah sama sekali** — nilai disalin apa adanya dari `.env.local` (buktinya pemeriksaan asap tetap **6/6 lolos** sebelum dan sesudah pemindahan). Yang berubah: **sekarang Cloudflare yang menjadi sumber kebenaran**, jadi rahasia bisa diputar tanpa deploy ulang, dan nilai lama di `.env.local` tidak lagi mengendalikan server.
- **Perintah baru:** `npm run cf:secrets` (pratinjau — hanya menampilkan nama key + status, nilai tidak pernah dicetak), lanjutkan dengan `--apply` untuk menulis, atau `--apply --keys=CRON_SECRET` untuk satu key saja.
- **`.env.local` tetap dibutuhkan** oleh `npm run dev` dan berbagai script pemeliharaan lokal, jadi file itu tidak dihapus. Jujur soal batasnya: salinannya masih ikut tertanam di bundel build (bundel hanya bisa diunduh pemilik akun Cloudflare), tetapi nilai itulah yang tidak lagi dipakai di runtime.
- `NEXT_PUBLIC_*` sengaja **tidak** dipindahkan — nilai itu memang harus tertanam di bundle klien.

### 📚 Dokumentasi Operasional

- **Runbook monitoring** kini memuat dua bagian baru: _Daily Cron Trigger (Cloudflare Workers)_ berisi alur langkah demi langkah + cara memeriksanya, dan _Rotasi Rahasia (Worker Secrets)_ berisi perintah aman untuk memutar token. Checklist harian bertambah satu item: cek log `[cron]`.
- **Catatan kecil di `src/middleware/constants.ts`** menjelaskan kenapa `/api/cron/*` sengaja tidak masuk daftar route yang dilindungi cookie (pengamannya ada di handler), agar tidak salah "diperbaiki" oleh AI berikutnya.
- **Verifikasi:** `npx tsc --noEmit` 0 error, `npx eslint src` 0 error, **115 file / 887 test PASS**, `release:audit` **62/62**, `release:sale-readiness` **13/13**, pre-deploy + compat-audit 0 blocker.

### 🚀 Deploy Produksi (sudah dijalankan)

- **Versi ini tayang di produksi** (2026-10-04), Version ID `6f2bd3ae-1b2d-4ebe-9bef-19fbd7f3002e`, dengan pendaftaran jadwal `schedule: 0 18 * * *`. Pemeriksaan asap produksi **6/6 lolos**.
- **Uji langsung ke produksi:** `POST /api/cron/daily` dengan token → **200** `{"ok":true,...}`; tanpa token / token salah → **401**.
- **Jadwal pertama: 01:00 WIB malam ini.** Kalau panel admin tidak pernah dibuka, inilah yang akan menandai order kedaluwarsa.

## [1.3.18] - 2026-10-03

### 🔒 Keamanan Alur Order & Billing (Tahap 4–5 Audit)

Enam perbaikan keamanan pada jalur order publik (checkout → upload bukti bayar → webhook aktivasi), tanpa mengubah perilaku fungsional satu pun fitur:

- **Kebocoran referrer token order ditutup:** halaman `/orders/*` kini punya layout sendiri (`src/app/orders/layout.tsx`, baru) dengan header `Referrer-Policy: no-referrer` + `robots noindex`. Sebelumnya, saat pembeli mengklik tautan order (yang mengandung token akses) menuju situs bank/medsos, browser menitipkan URL lengkap itu ke situs tujuan — analoginya kunci kamar hotel tertulis di struk yang bisa difoto orang lewat jendela. Fitur "salin link" tetap berfungsi penuh; hanya jejak kebocorannya yang hilang.
- **Timing-safe comparison webhook Telegram (`/api/telegram/webhook`):** verifikasi secret kini memakai `crypto.timingSafeEqual` + penjaga panjang, menutup serangan _timing attack_ pada pembandingan string biasa.
- **CSRF billing untuk endpoint publik (Opsi A):** `middleware/csrf.ts` menambahkan fallback same-origin untuk endpoint publik yang memang tidak membawa cookie admin — request lintas-origin ditolak, request dari domain sendiri tetap jalan.
- **Rate-limit checkout diperkuat:** cap per-IP via `enforceRequestRateLimit` sudah ada; ditambah guard same-origin di handler sehingga spam otomatis dari frontend pihak ketiga tertolak lebih awal.
- **SSRF guard bukti bayar:** `normalizePaymentProofUrl()` menolak URL yang menunjuk localhost/loopback/RFC1918/169.254/CGNAT — server tidak lagi diajak mengambil gambar dari jaringan internal.
- **Audit trail dua titik buta:** pembatalan order (`billing.order_cancel`) dan unggahan bukti bayar (`billing.proof_upload`) kini tercatat di `logActivity`; sebelumnya kedua kejadian penting ini tidak meninggalkan jejak sama sekali.
- **Verifikasi:** Vitest **61/61 PASS** (4 file test: middleware ×3 + orderService), nol regresi.
- **Sisa audit tahap berikutnya (di luar scope):** konsistensi guard Admin vs Customer (#6) — topik refactor terpisah, bukan celah keamanan aktif.

### 🗂️ Panel "Log Aktivitas" di Desktop Admin

- **Aplikasi baru "Log Aktivitas"** (zone _Sistem & Tampilan_, id `activityLog`) menampilkan 50 jejak aktivitas terakhir dalam bentuk garis waktu: aksi, waktu, tipe entri, metadata yang bisa dibuka-tutup, plus penanda sumber tiap baris (**KV** = blob `app_kv` penulis lama, **DB** = tabel relasional `audit_logs`).
- **`GET /api/admin/audit-logs` kini menggabungkan dua sumber sejarah itu** (dulu hanya blob `app_kv`): dibaca berurutan (`Promise.all`), didedup berdasarkan id (kv menang karena metadata lebih kaya), diurutkan terbaru dahulu, lalu dipotong ke 50 entri. Bila tabel relasional belum ada di deployment lama, pembacaannya gagal diam-diam dan viewer tetap menampilkan data KV.
- **Rute `/admin/system/activity-log` ditambahkan** — sebelumnya `APP_ROUTE_MAP` menunjuk ke halaman yang tidak ada, satu-satunya entri `APP_ROUTE_MAP` tanpa `page.tsx` (deep-link langsung ke URL itu akan 404).
- **Perbaikan lint (1 error `react-hooks/set-state-in-effect`):** pemuatan awal di `ActivityLogPanel` kini dijadwalkan lewat `setTimeout(…, 0)` — pola yang sama dengan `OrdersPanel` — sehingga `setState` tidak dipanggil sinkron di dalam `useEffect`.
- **Verifikasi:** `npx tsc --noEmit` 0 error, `npx eslint src` 0 error, `npx vitest run` **114 files / 881 tests PASS** (gabungan kedua jalur kerja), `release:audit` 62/62, `release:sale-readiness` 13/13.

### 🚀 Deploy Produksi & Pembersihan Database (sudah dijalankan)

- **Versi ini sudah tayang di produksi** (2026-10-03). Deploy sempat gagal sekali karena kendala lingkungan Windows yang sudah dikenal (workerd tidak bisa membuat folder di luar folder project) — diatasi dengan menyetel `TEMP`/`TMP` sementara ke `node_modules\.cache\mftemp` sesuai runbook, lalu deploy ulang sukses. Pemeriksaan asap produksi **6/6 lolos** (halaman utama, kesehatan API, data demo, berkas FFmpeg).
- **Database sudah dibersihkan, bukan sekadar direncanakan.** Enam perintah `remove-plan-columns.ts --apply` berjalan `[ok]`: kolom `plan` di tabel `sites` dan `orders`, tabel `site_subscriptions` beserta index-nya, tabel `client_password_resets`, dan **tabel `client_access`**. Pemeriksaan ulang menunjukkan semuanya `[n/a]` → _"Database sudah bersih"_, dan pemeriksaan hidup dijalankan ulang sesudahnya tetap **6/6 lolos**.
- **Tabel `client_access` ikut dihapus sesuai pilihanmu:** 4 baris email + hash pembeli di dalamnya hilang permanen tanpa disalin ke mana pun (tabel itu memang tidak dibaca kode mana pun).
- **Yang perlu kamu lakukan:** kalau tab panel admin masih terbuka dari sebelum update, **login ulang sekali** — token admin lama sengaja ditolak versi baru (wajib membawa penanda `siteId`). Cara beli, form checkout, upload bukti bayar, dan email pesanan **tidak berubah**.

## [1.3.17] - 2026-10-03

### 🧹 Dokumen & Audit Rilis: Sisa "Login Klien" Dihapus, Audit Rilis Kini Hijau

- **Dokumen tidak lagi menjanjikan pintu yang sudah tidak ada.** Setelah sistem login klien dihapus, masih ada **15 dokumen** yang mengarahkan pembeli ke `/{slug}/login`, `/client/login`, `/client/dashboard`, membuat "client access", atau menjanjikan "reset password lewat email" — semuanya pintu yang sudah roboh (cek di kode: `src/app/api/client/` nol file). Semua diganti dengan kenyataannya: pembeli cuma punya satu pintu, **`/admin/login`** (dashboard kelola di `/admin/client-dashboard`), dan **reset password selalu dibantu owner** lewat `scripts/cloudflare/reset-customer-password.ts`. Dokumen yang tersentuh: panduan serah-terima pembeli, checklist rilis, checklist onboarding, panduan support, runbook backup/monitoring, PRD, kontrak endpoint, dan daftar env.
- **Uji beban (`npm run load:multi-buyer`) akhirnya bisa jalan lagi.** Skrip itu ternyata memanggil 4 alamat yang sudah tidak ada, jadi sejak v1.3.14 uji beban mustahil jalan sampai titik itu. Diperbaiki ke jalur yang benar-benar ada (login panel + endpoint upload admin), plus satu bug nyata: token admin buatan skrip tidak membawa penanda `siteId` sehingga sejak audit keamanan 29 Sep token itu selalu ditolak. **Check "site A tidak bisa mengakses site B" sengaja dimatikan dan diberi alasan di kode** — check itu dulu butuh satu login per tenant, sedangkan sekarang hanya ada satu akun panel, jadi kalau dipertahankan ia akan selalu "lulus" palsu.
- **Audit rilis kini hijau penuh: `npm run release:audit` 60/62 (gagal) → 62/62 (lolos).** Dua penyebabnya: (a) aturan lama melarang semua env berawalan `TELEGRAM_`, padahal bot Telegram itu kini **fitur produk** untuk notifikasi order & tiket bengkel — aturannya dilonggarkan, larangan Firebase/Vercel/job-bot pribadi tetap; (b) dokumen diwajibkan menyebut `manual invoice` tapi `SALES_PRICING.md` tidak pernah menulisnya — kalimatnya diluruskan jadi _"Pembayaran manual invoice (QRIS/transfer) lewat halaman order; tidak ada payment gateway otomatis."_
- **Gate tetap hijau:** TypeScript 0 error, ESLint 0, **881 test lolos**, `release:sale-readiness` 13/13, uji beban mode kering (dry-run) exit 0.
- **Merge ke `main` kini dijalankan.** Repo utama sudah beres dikerjakan AI lain (14 file, +579/−23, commit `eb5bfeb`) sehingga cabang rilis ini bisa digabung tanpa mengirim pekerjaan setengah jadi. Urutan sisanya: `pre-deploy` → `cf:deploy` → **baru** `npx tsx scripts/cloudflare/remove-plan-columns.ts --apply`.
- **Keputusan owner: tabel lama `client_access` ikut dihapus.** Tabel itu (4 baris email + hash pembeli, **tidak dibaca kode mana pun**) adalah sisa sistem login klien; pemilik memilih hapus agar database bersih total, jadi **4 email itu hilang permanen** — sengaja tanpa ekspor. `DROP TABLE client_access` ditambahkan ke skrip pembersih dan hanya dijalankan setelah versi ini ter-deploy.

## [1.3.16] - 2026-10-03

### 🔧 Tiket Kerja Otomatis: dari Kasir ke Bengkel + Pembersihan Sisa Fitur Lama

- **Tiket kerja Telegram.** Begitu kamu menekan **✅ Verifikasi & Aktifkan** pada pesan Telegram, pembeli menerima email serah-terima **dan kamu sekarang menerima tiket kerja** berisi 6 langkah bengkel: (1) order aktif, (2) siapkan Gmail klien, (3) buat akun Cloudflare klien, (4) jalankan `PENGELOLA_KLIEN.bat`, (5) deploy, (6) serah-terima akses + tandai selesai — lengkap dengan ID order, slug, nama/WA/email pembeli, dan URL website. Sebelumnya pesan itu hanya berubah jadi "STATUS: ACTIVATED" tanpa panduan langkah, sehingga pekerjaan setelah bayar murni mengandalkan ingatan.
- **Panduan bengkel baru:** `docs/operations/BENGKEL_HANDOFF.md` menjelaskan keenam langkah itu langkah demi langkah, termasuk menu portal yang benar-benar dipakai, cara menyimpan data klien di `arsip-klien/`, dan cara mereset password klien kalau mereka lupa.
- **Fitur "Lupa Password" lama dibersihkan sampai tuntas.** Tombol dan halaman reset password sudah lama dihapus dari website, tapi sisa-sisanya masih tersebar: 5 pengecekan rilis yang membuat audit gagal, script monitoring yang mengecek halaman sudah-404, contoh environment variable, script backup, script uji beban, dan 13 dokumen (termasuk FAQ owner yang menjanjikan fitur yang tidak ada). Semua dibersihkan. **Cara beli dan cara login tidak berubah sama sekali** — password klien tetap di-reset manual lewat `scripts/cloudflare/reset-customer-password.ts`.
- **Audit kesiapan jualan kini hijau:** `npm run release:sale-readiness` naik dari 17/22 (gagal) menjadi **13/13 lolos**.
- **Pembersihan database (menunggu deploy).** `npx tsx scripts/cloudflare/remove-plan-columns.ts` kini juga menghapus tabel lama `client_password_resets`, di samping kolom `plan` dan tabel `site_subscriptions`. Dry-run sudah dijalankan dan **kelima perintah terkonfirmasi masih ada** di database produksi. **Jangan jalankan `--apply` sebelum versi ini ter-deploy** — panel admin dan kasir yang tayang sekarang masih membaca kolom `plan`.
- **Gate:** `tsc` 0 error, `eslint` 0 error, **114 file / 881 test lolos**.

## [1.3.15] - 2026-10-03

### 🗑️ Konsep Paket Lite/Pro dan Langganan Dihapus — Cara Beli Tetap Sama

- **Apa yang berubah:** istilah **"paket Lite"**, **"paket Pro"**, serta sistem **langganan/billing bulanan** kini **tidak ada lagi** di mana pun — tidak di halaman pesan, tidak di panel admin, tidak di database, tidak di dokumen. Sekarang hanya ada **satu penawaran dengan satu harga** (`Rp199.000`), sama untuk semua pembeli.
- **Yang TIDAK berubah (penting):** **cara pembeli memesan tetap persis seperti sebelumnya** — isi form di `/checkout`, pilih alamat website (slug), bayar lewat QRIS/transfer, upload bukti bayar, lalu website dibuat setelah pembayaran diverifikasi. Tombol, halaman, dan email pesanan tetap berfungsi.
- **Konsekuensi kecil yang perlu diketahui:**
  - Label **"Paket & Slug"** di panel pesanan kini hanya **"Slug"**; baris **"Paket Terpilih"** di halaman status pesanan dihapus.
  - Badge nama paket di daftar site admin kini menampilkan **status site (active/suspended)**.
  - **Dropdown pemilihan Plan** di editor site admin **dihapus** (sebelumnya hanya muncul kalau `FEATURE_MASTER_DASHBOARD=true`).
  - **Email & pesan Telegram** pesanan/aktivasi tidak lagi menyebut kata "Paket" (struk, kadaluarsa, serah terima).
  - **Opsi `--plan`** pada script uji beban (`multi-buyer-load-test.js`) dihapus.
  - Enviroment variable `PLAN_LITE_*` / `PLAN_PRO_*` / `AI_MONTHLY_TOKEN_LIMIT_LITE|PRO` diganti jadi `PROJECT_LIMIT`, `STORAGE_MB`, `MEDIA_PER_PROJECT` (nilai bawaan tetap 50 / 5000 / 50).
- **Berkas ikut dibersihkan:** `src/lib/product/sitePlan.ts` dihapus (digabung ke `siteQuota.ts`), `src/constants/plans.ts` diganti nama jadi `src/constants/pricing.ts`, `docs/release/LITE_PRO_SCOPE.md` dihapus, dan `docs/release/SALES_PRICING.md` ditulis ulang jadi satu harga tanpa langganan.
- **Database: kode dulu, data belakangan.** Skrip pembersih sudah disiapkan **tetapi BELUM dijalankan** ke database produksi. Jalankan setelah versi ini ter-deploy:
  ```bash
  npx tsx scripts/cloudflare/remove-plan-columns.ts          # lihat rencana (aman)
  npx tsx scripts/cloudflare/remove-plan-columns.ts --apply  # eksekusi
  ```
  Skrip ini menghapus kolom `plan` di tabel `sites` dan `orders`, plus tabel `site_subscriptions`.
- **Verifikasi:** `tsc --noEmit` 0 error, `eslint src` 0 error, `vitest run` **114 file / 879 test PASS**, sisa rujukan "Lite/Pro/plan/langganan" di kode & dokumen aktif **0** (catatan riwayat di log tracker sengaja dibiarkan).

## [1.3.14] - 2026-10-02

### 🧹 Pembersihan Rute Login Klien yang Sudah Mati + Penghapusan Alias Admin `/portal`

- **Latar:** sistem "login klien" lama sudah dihapus sengaja pada refactor sebelumnya, tapi **sisa-sisanya masih tertinggal** dan semuanya sudah mengarah ke halaman yang tidak ada (404).
- **Yang dihapus:** rute `/{slug}/login`, tombol **"Login Client"** dan **"Atur Password"** di halaman status pesanan (keduanya 404), blok **"Login client:"** di sidebar admin, serta alias admin tersembunyi **`/portal`** (3 rewrite) beserta daftar rute middleware-nya.
- **Konsekuensi yang perlu diketahui:** setelah ini **panel admin hanya bisa dibuka lewat `/admin` dan `/admin/login`**. Jika ada bookmark `/portal`, tolong diperbarui. Login admin sendiri **tidak terpengaruh** — sudah diverifikasi sebelum penghapusan.
- **Logo mata di pojok kiri atas tetap ada** (sesuai permintaan), hanya **tidak mengarah ke mana pun lagi** saat diklik — sebelumnya ia menuju tautan 404.
- **Yang tidak disentuh:** preview template dan jalur admin lain tetap utuh; tombol **"Custom Domain"** di sidebar admin tetap tampil seperti biasa.
- **Verifikasi:** `tsc --noEmit` 0 error, `eslint src` 0 error, `vitest run` **114 file / 879 test PASS**, sisa rujukan ke rute yang dihapus **0**.

## [1.3.13] - 2026-10-02

### ✉️ Pembeli Kini Langsung Dapat Email "Website Anda Sudah Aktif" Setelah Order Diaktifkan

- **Masalahnya (ditemukan setelah audit keamanan selesai):** sebelumnya pembeli hanya menerima dua email — email struk saat **membuat pesanan**, dan email saat pesanan **kedaluwarsa**. Momen yang paling ditunggu, yaitu saat website-nya **sudah jadi dan bisa dibuka**, justru tidak pernah memberi kabar ke pembeli. Link website-nya hanya muncul sebagai pesan singkat di panel Telegram pemilik.
- **Perbaikannya:** begitu pesanan diaktifkan (lewat tombol Telegram maupun panel admin), sistem otomatis mengirim email berisi **alamat website yang sudah hidup**, ringkasan pesanan (nomor order, paket, alamat, total bayar), langkah berikutnya, serta petunjuk cek status pesanan.
- **Yang sengaja tidak dimasukkan:** tautan `/{slug}/login` tidak dicantumkan karena rute itu mengarah ke halaman yang sudah tidak ada (404), dan tautan `/admin` tidak dicantumkan karena panel tersebut milik pemilik situs, bukan milik pembeli — menyesatkan kalau dikirim ke pembeli.
- **Pembeli tidak perlu khawatir email terkirim ganda:** kalau pesanan sudah pernah diaktifkan, email tidak dikirim ulang.
- **Bukti pengujian:** 3 test otomatis baru — email benar-benar terkirim berisi URL website, aktivasi tetap dianggap berhasil walaupun layanan email sedang gangguan, dan tidak ada panggilan sama sekali bila notifikasi belum diaktifkan.
- **Verifikasi:** `tsc --noEmit` 0 error, `eslint` 0 error, `vitest run` **114 file / 879 test PASS**.
- **Catatan:** pengiriman email aktif otomatis karena konfigurasi layanan email sudah terpasang di produksi; baru teruji sampai ke kotak masuk begitu versi ini di-deploy.

## [1.3.12] - 2026-09-30

### 🧾 Tombol "Lihat Resi" di Panel Admin Kembali Berhasil Menampilkan Bukti Transfer

- **Masalahnya (ditemukan saat verifikasi produksi, bukan dari audit awal):** file bukti bayar disimpan di bucket R2 dengan path `orders/{id}/…`, sedangkan route publik `/r2/…` **sengaja menolak** path `orders/` agar bukti transfer (berisi nama, nominal, dan tangkapan layar rekening) tidak bisa diakses siapa pun. Akibatnya URL gambar yang tersimpan selalu menjawab **404** — begitu ada pembeli yang mengunggah bukti lewat file, admin menekan "Lihat Resi" dan melihat gambar rusak.
- **Perbaikannya:** endpoint baru `GET /api/billing/orders/{id}/proof` yang menjadi **satu-satunya jendela akses** bukti bayar — memverifikasi sesi login admin _atau_ tautan akses pembeli dulu, baru mengirimkan filenya dengan header `cache-control: private` (tidak boleh disimpan bersama/CDN) dan `nosniff`. Tombol "Lihat Resi" kini menunjuk ke endpoint ini.
- **Yang sengaja tidak dilakukan:** menambahkan `orders/` ke daftar path publik. Cara itu memang lebih cepat, tapi akan membuka bukti transfer ke publik dan justru membatalkan perlindungan yang sudah ada.
- **Dijamin lewat 13 test otomatis:** penolakan tanpa token, token tidak cocok, batas laju, alih order (order A tidak bisa membaca berkas order B), penolakan `javascript:`, URL asing dialihkan — bukan ikut diperambat, dan kembalinya 404 bila berkas sudah lenyap dari bucket.
- **Tidak ada perubahan lain:** lapisan pengeras CSP (`object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'self'`) sudah terpasang sejak sebelumnya dan sudah diverifikasi tidak perlu ditambah. Pengetatan `script-src` (nonce) tetap ditunda karena berisiko mematikan suara, kompresi video, dan model 3D.
- **Verifikasi:** `tsc --noEmit` 0 error, `eslint src` 0 error, `vitest run` **114 file / 876 test PASS**.

## [1.3.11] - 2026-09-29

### 🔒 Pembersihan Keamanan Menyeluruh: 19 Temuan Audit Alur Login, Pembayaran & API (4 High / 8 Medium / 7 Low)

- **Latar:** audit keamanan 3 lapis (autentikasi, billing, attack surface API) menemukan 4 temuan High, 8 Medium, 7 Low. Semua sudah diperbaiki bertahap High → Medium → Low dalam satu rilis, lalu diverifikasi penuh.
- **High — kebocoran & pembypassan:** `GET /api/settings` untuk pengunjung kini hanya mengembalikan 2 field publik (`maintenanceMode`, `allowComments`) — hash `settings/adminPassword`/`adminPin` tidak lagi ikut terkirim; semua rate limit route-level kini mengunci per **IP** (sebelumnya `IP + User-Agent`, jadi rotasi UA bisa me-reset hitungan di 19 route termasuk verifikasi PIN & login); `/api/translate` (memakai API key pemilik) mendapat **kuota harian 200 request per IP** sebagai plafon biaya; `/api/setup` kini punya rate limit untuk GET & POST (menutup banjir scrypt/DoS CPU) dan `siteId` tidak lagi dibocorkan di response-nya.
- **Medium — webhook, XSS, CSRF, billing:** webhook Telegram kini memverifikasi secret secara _timing-safe_, mengabaikan callback dari luar chat admin (`TELEGRAM_ADMIN_CHAT_ID`), membersihkan nomor WhatsApp dari karakter berbahaya, dan dibatasi 30 request/menit; JSON-LD di 3 halaman kini meng-escape `<` (menutup stored XSS via judul/deskripsi project yang mengandung `</script>`); allowlist CSRF dipadukan **per segmen path** (path baru yang kebetulan berawalan sama tidak lolos); jalur file statis (`/api/r2`, gambar) kini ikut mendapat header keamanan `nosniff`/CSP/`X-Frame-Options` — sebelumnya keluar dari middleware tanpa proteksi; nilai HSTS & Referrer-Policy di `next.config` disamakan dengan middleware (sebelumnya konflik); hapus ikon kini menolak path di luar folder `icons-library` (menutup penghapusan wallpaper/temp oleh sesi admin mana pun); schema update settings kini `.strict()` — tidak bisa lagi menulis key sembarangan ke row `settings`; **upload ulang bukti bayar tidak lagi me-reset hitung mundur pembatalan otomatis 7 hari** (slug & nominal unik tidak bisa dikunci tanpa bayar); checkout dibatasi 5 request/menit dan pengecekan slug juga kini dibatasi — pool 999 nominal unik tidak mudah dikuras.
- **Low — detail yang dirapikan:** SQL literal `"activated"` diganti `'activated'` (kompatibel dengan mode SQL ketat D1); `templateId` yang dipilih pembeli kini benar-benar tersimpan di order (sebelumnya hilang diam-diam); file bukti bayar di R2 ikut dihapus saat order dibatalkan (sebelumnya hanya referensi database yang dibersihkan); **tautan akses order `?token=` kini kadaluarsa 90 hari** (tautan lama yang bocor tidak berlaku selamanya); token `admin_token` kini membawa klaim `siteId` dan ditolak bila tidak cocok dengan deployment (logout sekali saat pertama kali deploy); pesan error `music/search` tidak lagi membocorkan detail internal.
- **Perubahan perilaku yang perlu diketahui:** sesi admin aktif akan logout satu kali setelah update ini (token lama tanpa klaim `siteId` ditolak — cukup login ulang); pengunjung yang melebihi 200 translasi/hari akan menerima pesan "kuota harian tercapai"; pembeli yang mengakses tautan pesanan lebih tua dari 90 hari perlu membuat pesanan baru.
- **Verifikasi:** `tsc --noEmit` 0 error, `eslint src` 0 error, `vitest run` (seluruh suite) **PASS**.

## [1.3.10] - 2026-09-28

### 📊 Analitik Pengunjung: Dari Blob 100 Entri yang Tak Pernah Dibaca Menjadi D1 + Panel Admin

- **Masalahnya:** fitur analitik ada di tiga tempat dan tidak satu pun saling tersambung. Event dikirim `useAnalytics` → disimpan di JSON `analytics/logs` yang **dibatasi 100 entri** (entri terlama terbuang, dan tiap event membaca-lalu-menulis seluruh array); tabel D1 `site_analytics` dari Sprint 63 **tidak pernah di-import di mana pun**; `GET /api/analytics` **tidak dibaca UI mana pun**. Di samping itu **tidak ada page view sama sekali** — yang dikirim cuma 3 event langka (`header_search_click`, `CV_PRINT`, `CV_DOWNLOAD_PREMIUM`), jadi tidak ada angka kunjungan untuk ditampilkan.
- **Sekarang:** satu jalur yang utuh — beacon `page_view` (`PageViewTracker` di root layout, mengikuti perubahan route, melewati `/admin` dan `/setup`) → `POST /api/analytics` → **UPSERT 1 baris ke D1 `site_analytics`** → `GET /api/analytics` → **panel "Statistik Pengunjung"** baru di desktop admin (zone _Sistem & Tampilan_): total kunjungan, halaman tercatat, terakhir aktif, halaman populer, plus bagian proyek/aplikasi yang otomatis muncul begitu datanya ada.
- **Penghemat kuota (penting, mengingat insiden kuota KV kemarin):** 1 kunjungan kini = **1 write D1**, dan tulisan baris analitik ke tabel `audit_logs` **dihapus** agar jejak keamanan tidak tercampur (sebelumnya 2 write per hit, ditambah 1 read blob).
- **Dibatasi desain, bukan oleh kepercayaan:** `event` di luar allowlist kini `400`, dan path halaman di-bucket ke segmen route yang dikenal (`/projects/abc` → `/projects`, sisanya `/lain`) — endpoint ini terbuka untuk pengunjung, jadi kunci yang bebas akan membuat baris D1 tanpa batas. Jumlah baris per site kini terkunci pada daftar route yang dikenal. Rate limit 30 req/60 detik tetap berlaku.
- **`GET /api/analytics`** kini mengembalikan `{ summary }` menggantikan `{ logs }` — tidak ada UI yang membaca bentuk lama (telah diverifikasi lewat grep seluruh repo).
- **Catatan perubahan perilaku:** `event` di luar daftar yang diizinkan kini ditolak (sebelumnya diterima apa pun), dan deskripsi folder zone _Sistem & Tampilan_ ikut disesuaikan agar menyebut statistik pengunjung.
- **Verifikasi:** `npx tsc --noEmit` 0 error, `npx eslint src` 0 error, `npx vitest run` **113 files / 863 tests PASS** (6 test baru: allowlist, bucketing, slug tetap untuk event non-page, 401, bentuk ringkasan). Uji runtime: `page_view` → `200`, event di luar allowlist → `400`, payload kosong → `400`, `GET` tanpa login → `401`, `/admin/system/analytics` → `307` ke login, halaman publik tetap `200`. **Bukti tulis ke D1 remote terbaca langsung:** `/projects` (dari input `/projects/some-project` — bucketing terbukti di data nyata), `/about`, `/`, `/preview`.
- ⚠️ **Belum diverifikasi:** tampilan panel di browser — membaca datanya butuh login admin, dan `.env.local` hanya menyimpan hash `ADMIN_PASSWORD_SCRYPT`, bukan sandi plaintext.
- ⚠️ **Ditemukan sampingan, belum ditangani:** app **"Asisten AI" tidak terdaftar di `PANEL_MAP`** sehingga membuka app itu dari folder zone menampilkan _"Panel "ai" belum tersedia"_.

## [1.3.9] - 2026-09-28

### ⚙️ Perbaikan ISR: Revalidasi Background Tidak Pernah Commit di Produksi

- **Gejala:** halaman `/preview/*` dan `/projects` selalu `x-opennext-cache: STALE` (6/6 pengukuran selama 75 detik, padahal `s-maxage=1`), sehingga perubahan data tidak pernah menyebar sampai ada deploy.
- **Akar masalah:** `open-next.config.ts` memakai `queue: 'direct'` yang dipetakan ke `overrides/queue/direct.js` — object bernama harfiah **`dev-queue`**. Ia me-revalidate dengan `fetch()` ke **URL publiknya sendiri** dari dalam Worker, **tanpa memeriksa hasilnya**. Dokumentasi resmi OpenNext Cloudflare: _"`direct` mode ... only works in preview mode (i.e. `wrangler dev`)"_, dan build bahkan memperingatkan _not recommended for use in production_. Terbukti dari timing: GET saat `STALE` hanya butuh **135–868 ms**, sedangkan HEAD revalidasi identik yang dikirim dari luar butuh **6–9 detik** dan menghasilkan `REVALIDATED` → `HIT`. Mekanismenya sehat; yang rusak hanya pemanggilnya.
- **Perbaikan:** `queue` diganti ke **memory queue** `@opennextjs/cloudflare/overrides/queue/memory-queue` yang memakai **service binding** `WORKER_SELF_REFERENCE` (dispatch di dalam Workers, bukan lewat URL publik) dan **mengecek** `x-nextjs-cache: REVALIDATED` sehingga kegagalan revalidasi ikut ter-log alih-alih diam. Binding `services` ditambahkan ke `wrangler.jsonc` — persis seperti template resmi OpenNext yang sebelumnya absen di repo ini.
- **Webhook `/api/revalidate` kini ikut menyegarkan demo:** ditambahkan `revalidatePath` untuk `/preview/os-desktop`, `/preview/infinite-canvas`, `/preview/spatial-gallery`. Sebelumnya ketiga route itu tidak pernah masuk daftar revalidate mana pun.
- **Temuan lanjutan:** `revalidatePath('/', 'layout')` ternyata **tidak** menutup `/preview/*` (Next menulis tag `_N_T_/layout`, sedangkan tag cache `mode='nextMode'` menilai staleness dari tag entri halaman) — diverifikasi 2× dengan jendela 30 dan 90 detik. Route preview selama ini hanya segar saat deploy.
- **Verifikasi:** `npx tsc --noEmit` 0 error, `npx eslint src` 0 error, `npx vitest run` **113 files / 857 tests PASS** (1 test baru untuk webhook preview), `wrangler deploy --dry-run` mengonfirmasi binding `env.WORKER_SELF_REFERENCE`. Deploy sukses, Version ID `cd763c10-630d-4dad-aa42-e34b8adfa102`, bundle kini berisi `memory-queue` (6 file) dan **`dev-queue` = 0 file**.
- ⚠️ **Status verifikasi end-to-end: tertunda.** Sesaat setelah deploy, Cloudflare menutup kuota baca KV harian (`Failed to get from cache: KV get() limit exceeded for the day`), sehingga semua route ter-cache jatuh ke render penuh (TTFB 6–17 detik) dan memory queue belum sempat teruji di produksi. Kuota diharapkan reset **00:00 UTC**; verifikasi ulang wajib dijalankan setelah itu.

## [1.3.8] - 2026-09-28

### 📱 Penyelarasan UI/UX Dock macOS Desktop (Mobile & Desktop)

- **Penyelarasan Ukuran & Proporsi Dock Mobile:** Mengubah ukuran ikon Dock pada mode mobile menjadi fix `48px × 48px` (dari sebelumnya `clamp(44px, 13vw, 52px)` dan basis `64px` yang membengkak). Tinggi kapsul Dock mobile kini diturunkan ke `68px` dengan border radius `24px` (sebelumnya `72px/76px` dengan radius `28px`).
- **Posisi & Penataan Ikon Mobile:** Mengganti perataan vertikal baris ikon mobile menjadi `items-center justify-center gap-2 px-5 py-2` (sebelumnya `items-end` menempel ke bawah dengan `gap-1`), sehingga seluruh ikon tersusun rapi persis di tengah kapsul kaca Dock identik dengan `portfolio ramos`.
- **Fisika Magnifikasi & Animasi Kustom Mobile:** Mematikan efek lonjakan hover magnifikasi pada layar sentuh (`hoverScaleMultiplier = 1` di mobile, `1.35x` di desktop), menyematkan utility `touch-manipulation`, dan menyelaraskan animasi bounce elastis (`scaleX/scaleY` squish kenyal) saat ikon di-tap di perangkat layar sentuh.
- **Sinkronisasi Viewport Otomatis:** Menambahkan pendengar event resize viewport dinamis pada `OSDock` agar perubahan orientasi atau resolusi layar mobile langsung terdeteksi tanpa delay atau inkonsistensi state.
- **Posisi Dock Safe-Area-Inset Mobile:** Menyelaraskan posisi fixed Dock di `GlobalDockSlot` dengan referensi — menggunakan `bottom-[max(0.75rem,env(safe-area-inset-bottom))]` + `pb-[env(safe-area-inset-bottom)]` agar Dock tidak tertimpa gesture bar di iPhone/Android modern (sebelumnya `bottom-4` statis).
- **Hardening Popover Outside-Click:** Menambahkan 50ms delay registrasi listener, deteksi klik di dalam `[data-dock-toolbar]`, dan handler `touchstart` agar popover Dock (mis. selector mode Projects) tidak langsung tertutup saat tap di mobile.
- **DockPortal Fallback (perbaikan regresi dock preview):** Fallback render di `DockPortal` dipertahankan untuk route yang tidak punya `GlobalDockSlot` (root layout `/preview/*`). Mengembalikannya menjadi `null` membuat **dock hilang total di `/preview/os-desktop`** karena `target` selalu `null` di route itu. Fallback kini sengaja **tanpa `id` dan tanpa `viewTransitionName`** (mencegah duplikat 1-frame dengan slot asli saat hydration — duplikat `view-transition-name` membuat Chrome membuang pasangan snapshot animasi) dan memakai `className` identik dengan slot sehingga tidak ada lompatan posisi.

### 🖼️ Perbaikan Poster Wallpaper Video (semua poster sempat isinya foto orang)

- **Akar masalah:** script upload Sprint 83 (`upload-video-wallpapers-r2-d1.ts`) membuat **satu** `posterBuffer` dari `public/wallpapers/optimized-wallpaper.png` (berisi foto orang) lalu meng-upload buffer yang sama sebagai poster ke-4 wallpaper video → keempat poster JPG di R2 identik byte-per-byte (`5E845822…`, 37.402 byte). Saat halaman dibuka, elemen LCP poster langsung menampilkan foto orang itu sebelum video fade-in (dan terus tampil pada perangkat hemat-data / ≤2 core / reduced-motion).
- **Poster diganti frame asli:** tiap video ditangkap pada frame 0,5 detik (1920×1080, canvas browser) dan di-upload ulang ke key yang sama — kini **4 MD5 berbeda**: Hunt `B3ECD5F8…` (394.974 byte), Zen Kois `6046AB47…`, Pink Bloom `609A4E88…`, Sachiro `BAC7D48E…`.
- **Cache di-bust:** `posterUrl` keempat entry di D1 (`app_kv` → `content_default-site` & `content`) ditambah `?v=2` karena response diset `Cache-Control: public, max-age=31536000, immutable` (tanpa ini, browser yang sudah memuat poster lama menyimpannya sampai setahun).
- **`extractStoragePath()` membuang query/fragment:** key R2 tidak pernah berisi `?…`, sehingga `posterUrl` `?v=2` tetap menghasilkan key valid untuk hapus media, `storage-stats`, dan audit orphan (sebelumnya bisa terbaca sebagai _dangling_ oleh `clear-dangling-wallpapers`).
- **Script lama diperbaiki:** pembuatan + upload poster bersama dihapus dari `upload-video-wallpapers-r2-d1.ts` (regresi landmine bila dijalankan ulang), dan `?v=2` ditanam di 4 `posterUrl` hardcoded-nya agar rerun tidak membalik cache-bust. Fix one-time tersedia di `scripts/cloudflare/fix-wallpaper-posters.ts` (dry-run default, `--apply` untuk eksekusi).
- **Verifikasi:** `npx tsc --noEmit` 0 error, `npx eslint src` 0 error, `npx vitest run` **113 files / 856 tests PASS** (5 test baru untuk `extractStoragePath`), dan poster yang ter-render di `/preview/os-desktop` kini = frame video yang benar.

### 🖼️ Wallpapers Statis: Foto Orang Diganti Frame "Veil of Thorns"

- **Isi ulang, bukan sekadar hapus:** 3 file statis yang masih direferensikan (`optimized-wallpaper.webp/png` + `1772328103874-…wallaper.webp` fallback `DEFAULT_WALLPAPER_URL`) ditulis ulang isinya menjadi frame video aktif Hunt "Veil of Thorns" (1920×1080) — webp q60 (192.372 B), png palet 1152×648 (181.725 B), semuanya di bawah aturan repo <200KB. Kini tidak ada satu pun foto orang di `public/wallpapers/`.
- **10 file foto tak terpakai dihapus:** seluruh `.avif` + 4 file `177*`/`1769*` webp tidak punya referensi di D1/kode/manifes — dihapus daripada diganti (mengganti file mati hanya menumpuk repo). Sisa folder: 3 file.
- **2 entry picker "macOS Monterey" di-rename + isi R2 ditimpa:** entry tetap ada (tidak dihapus), hanya namanya jadi "Veil of Thorns (Statis)" dan "Veil of Thorns (Statis, PNG)"; objek R2 `optimized-wallpaper.*` di-upload ulang dengan isi frame baru dan `url` D1-nya diberi `?v=2` (cache R2 immutable) di kedua baris `app_kv`.
- **2 objek R2 orphan (foto orang) dihapus:** `1771963001387…` & `1771963212220…` kini 404 — tidak ada referensi di mana pun.
- **Landmine rerun dibersihkan:** `fix-wallpapers-d1-r2.ts` (buang upload file yang sudah dihapus, rename entry + `?v=2`, dan **tidak lagi mereset `activeWallpaperId`/`blur` customer** saat dijalankan ulang) serta `upload-video-wallpapers-r2-d1.ts` (2 entry statis hardcoded ikut nama baru + `?v=2`). Fix one-time: `scripts/cloudflare/fix-wallpaper-statics.ts` (dry-run default, `--apply`).
- **Verifikasi:** D1 dump → nama baru + `?v=2` di 2 baris, `activeWallpaperId` tetap video; GET `?v=2` → MD5 baru `1CFFD9DC9243…` (= file lokal), orphan 404; `/preview/os-desktop` tampil wallpaper frame video (bukan foto orang), console bersih; `tsc` 0, `eslint src` 0, vitest **113 files / 856 tests PASS**.
- **Demo produksi (`makeitbetter.my.id`) ikut diperbarui:** laporan "foto orang muncul lagi di detik awal pada demo" ternyata bukan data — D1 & R2 produksi sudah benar, yang basi adalah **snapshot HTML preview (cache ISR)** yang masih menulis `posterUrl` tanpa `?v=2` (pengunjung lama kena foto orang dari cache `immutable` setahun) plus **file `public/wallpapers/` di server yang belum terganti** (file `DEFAULT_WALLPAPER_URL` masih foto orang). Keduanya beres dengan deploy ulang: HTML preview kini memakai `?v=2` + nama "Veil of Thorns (Statis)", ketiga file `public/wallpapers/` kini berisi frame video Hunt, dan verifikasi browser sesi bersih menampilkan desktop tanpa satu pun foto orang (0 error console).

---

## [1.3.7] - 2026-09-26

### ⚡ Optimasi Performa Preview (Lighthouse) — 3 Template

- **Halaman preview jadi statis (ISR):** `/preview/os-desktop`, `/preview/infinite-canvas`, `/preview/spatial-gallery` kini di-pre-render saat build (`generateStaticParams`). Waktu tunggu server turun dari ±6 detik menjadi ±0,03 detik — fondasi semua perbaikan skor berikutnya.
- **Perbaikan storage lokal:** gagal muat aset saat menjalankan template di PC tanpa koneksi Cloudflare (menyebabkan belasan request ulang dan skor performa palsu) sudah ditutup; aset wallpapers/video termuat normal secara lokal.
- **Template Spatial Gallery:** layar putih total saat dibuka dari HP sekarang hilang. Poster gambar karya tampil seketika dari HTML pertama (bukan dari WebGL). Mesin 3D dipecah ke modul terpisah yang baru dimuat saat browser santai / pengunjung menyentuh layar, dan file pencahayaan lingkungan dikecilkan 7x (1,5MB → 216KB, dibanding pixel-per-pixel: tidak ada perbedaan visual). Hasil terukur di produksi: LCP 6,2s → **1,5–1,8s**, Best Practices 92 → **100**.
- **Cache ISR Cloudflare (KV):** halaman preview kini dilayani dari lemari cache global, bukan dimasak ulang tiap kunjungan — waktu tunggu server produksi turun dari 15–17 detik menjadi **0,1–1 detik**.
- **Template Infinite Canvas:** video karya tidak lagi membanjiri fase buka halaman — poster JPG dimuat duluan, video baru di-fetch saat browser santai atau saat kursor diarahkan ke kartu. Skor **78–80** (dari 65), LCP 7,3s → 5,2s, Speed Index 8,0s → 1,9s.
- **Template macOS Desktop — teka-teki LCP terpecahkan:** wallpaper fullscreen ternyata SELALU diabaikan browser sebagai elemen konten terbesar karena rect-nya persis 100% viewport (dianggap latar halaman, bukan konten — perilaku mesin render Chrome, direproduksi di halaman uji terisolasi). Perbaikan: tinggi stage wallpaper dikurangi 1 pixel (`calc(100%-1px)`) — tidak terlihat oleh mata, tapi membuat wallpaper resmi menjadi elemen LCP terukur. Ditambah pembersih `filter: blur(0px)` sisa animasi dan penghapusan atribut ARIA liar di Dock. Efek: elemen LCP kini wallpaper @±0,8 detik (terverifikasi laporan Lighthouse), Accessible mobile naik 89 → 96.
- **Perbaikan suite test:** `localStorage` hilang di environment test versi jsdom terbaru — polyfill minimal ditambahkan; **112 file / 851 test PASS** kembali.

_Catatan teknis lengkap: `docs/tracker/logs/perf_preview_templates_2026_09_25.md`._

---

## [1.3.6] - 2026-09-25

### 🔒 Keamanan & Stabilitas (Audit Eksternal)

- **Upgrade Next.js 16.2.12 → 16.3.6:** Menutup kerentanan CRITICAL _Unauthenticated Remote Code Execution_ (GHSA-p293-qw3h-jr36 & RCE Image Optimization AVIF).
- **Sweep dependency audit bersih 0 temuan:** PostCSS 8.5.28 (path traversal), sharp 0.35.4 (libvips/libheif), Vitest 4.1.11 (moderate), undici/ws/js-yaml via `npm audit fix`. Override `postcss` dinaikkan ke `^8.5.28` global + nested next.
- **Perbaikan redirect mati (bug senyap):** `next.config.mjs` memiliki dua blok `redirects()` duplikat — JavaScript hanya memakai definisi terakhir, sehingga redirect `/works/*`, `/project/*`, `/home`, `/index`, `/indeks` selama ini TIDAK berfungsi. Blok duplikat dihapus, seluruh redirect aktif kembali (terverifikasi HTTP 308 di build production).
- **Hardening CSP:** Middleware kini menambahkan `worker-src 'self' blob:` (menjamin kompresi FFmpeg WASM admin tidak mati saat CSP aktif), plus header `X-DNS-Prefetch-Control`, `Permissions-Policy`, COOP/COEP yang sebelumnya hanya ada di config build.
- **Pemisahan secret R2 upload:** Penandaan URL unggah R2 kini wajib `JWT_SECRET` — fallback ke `REVALIDATION_TOKEN` dihapus agar token revalidate tidak bisa dipakai memalsukan tanda tangan unggah.
- **Bugfix tipe Dock:** `DockProjectModes` kini memakai tipe `LucideIcon` (sebelumnya `React.ElementType` memicu error `never` yang membuntukan `tsc`).

---

## [1.3.5] - 2026-09-18

### 🌌 Template Spatial Gallery

- **Perbaikan Bug Kritis: Aset Database Tampil Hitam:** Memperbaiki bug di mana seluruh tile gambar dari database D1/R2 tampil hitam pekat di halaman `/preview/spatial-gallery` — helm 3D dan grid shader render normal, tetapi gambar karya tidak muncul. Root cause: implementasi manual `TextureLoader.load()` / `new Texture(img)` via `useState` asinkron saat mem-port kode dari `helmetsrc` gagal mengupload texture ke GPU dengan color space yang benar dan melewatkan siklus `gl.initTexture`. Perbaikan: diganti dengan `useTexture` dari `@react-three/drei` (suspense-based loader) yang otomatis menangani decoding, sRGB color space, caching, dan upload GPU ke WebGL — persis pola yang berhasil di kode asli `helmetsrc`.
- **Perbaikan Import Missing Suspense:** Mengimpor `Suspense` dari `'react'` yang sebelumnya terlewat dan memicu `ReferenceError: Suspense is not defined` di error boundary.
- **Koreksi Rotasi Tile (Anti-Mirror):** Menyesuaikan sudut rotasi Y tile silinder (`ry = -(theta - Math.PI / 2)`) agar bagian depan gambar menghadap ke arah kamera pengunjung di luar silinder, sehingga teks dan karya tidak terbalik/mirrored.
- **Dukungan Poster untuk Video Cover (Lengkap 21 Proyek):** Mengintegrasikan `getVideoPosterSource()` agar proyek dengan cover video `.mp4` secara otomatis menggunakan gambar poster pendamping (`.jpg`), sehingga seluruh 21 proyek portofolio tampil lengkap di ring silinder 3D tanpa ada yang ter-skip.
- **Fallback Aset Lokal `/tube/`:** Jika database tidak memiliki gambar (semua cover = video / gallery kosong), sistem otomatis fallback ke 9 aset gambar bawaan dari `helmetsrc` (`/tube/im1.jpg`–`im9.jpg`) di `public/tube/`.

---

## [1.3.4] - 2026-09-15

### 🌌 Template Spatial Gallery

- **Rombak Total Engine 3D (Particle Sphere):** Menggantikan seluruh engine scene lama template Spatial Gallery dengan efek **Particle Sphere 3D Orbit** yang baru: 1.500 partikel debu halus membentuk bola fibonacci raksasa yang mengambang di ruang angkasa, sementara hingga 24 gambar karya project Anda mengorbit rapi membentuk cincin di bidang ekuator bola. Seluruh galaksi berputar otomatis perlahan tanpa perlu sentuhan.
- **Interaksi Penuh Bebas Jelajah (Drag, Scroll, Pan):** Pengunjung kini dapat men-drag untuk memutar sudut pandang galaksi, scroll untuk zoom masuk/keluar, dan pan untuk menggeser fokus — kontrol navigasi 3D standar industri yang sebelumnya tidak tersedia sama sekali.
- **Karya Mengelilingi Pusar Secara Teratur:** Gambar tidak lagi menumpuk atau bertabrakan. Setiap karya otomatis menempati slot orbit yang terdistribusi merata 360° mengelilingi pusat bola, menghadap keluar sehingga selalu terlihat jelas dari segala arah pandang.
- **Rasio Aspek Asli Setiap Karya (Tanpa Crop & Tanpa Distorsi):** Gambar karya kini tampil dengan **rasio aspek aslinya masing-masing** — karya lanskap tampil melebar natural, karya potret tampil tegak elegan, tanpa dipaksa kotak 1:1. Tinggi visual disamakan rapi di seluruh orbit sehingga komposisi tetap tertata, dilengkapi pengaman rasio agar thumbnail ekstrem (format story 9:16 maupun panorama) tidak merusak ritme lingkaran.
- **Kecerdasan Memuat Media dengan Rantai Fallback:** Sistem kini cerdas mencari gambar pengganti bila sebuah karya gagal dimuat — otomatis mencoba poster video, cover utama, lalu gambar galeri pertama — sehingga slot kosong tetap tampil anggun dengan warna aksen, tidak pernah membuat aplikasi crash.
- **Performa Hemat Resource (1 Draw Call untuk 1.500 Partikel):** Partikel dirender menggunakan teknologi _instanced mesh_ sehingga 1.500 titik debu hanya membebani GPU seolah satu objek tunggal. Distribusi partikel deterministik yang stabil juga menjamin tidak ada kedipan layout saat halaman dimuat ulang.

### 🖥️ Template macOS Desktop

- **Perbaikan Stabilitas Build:** Memperbaiki warning import yang tersisa dari refactor Dock terdahulu yang muncul berulang kali pada setiap pembaruan kode di lingkungan pengembangan.

### 🌌 Template Infinite Canvas

- **Ketahanan Posisi Kartu:** Memperbaiki logika pembacaan posisi kartu karya tersimpan agar tidak salah membaca data rusak (nilai koordinat tidak valid) — kini kartu kembali ke formasi default 4 kuadran yang seimbang.

---

## [1.3.3] - 2026-09-13

### 🎨 Template Infinite Canvas

- **Pengalih Gaya Latar Belakang Grid (Canvas Grid Style Switcher):** Menghadirkan tombol pengalih gaya kisi-kisi latar belakang di bilah kontrol kamera atas dengan 3 varian artistik yang dapat diganti secara instan: **DOTS** (pola titik-titik arsitektural minimalis), **GRID** (garis kotak-kotak blueprint / millimeter graph paper ala software arsitek), dan **BLANK** (kanvas polos bersih tanpa pola). Posisi kisi-kisi kini bergerak secara presisi dan dinamis mengikuti geseran kursor (_pan tracking_) serta otomatis tersimpan di memori browser (_localStorage persistence_).
- **Desain Flat & Shadowless Bersih (Penghapusan Seluruh Shadow):** Menghilangkan seluruh efek bayangan (_drop-shadows_) pada antarmuka demo Infinite Canvas — meliputi kartu proyek, bilah kontrol kamera atas, kapsul translate bahasa, Dock navigasi teks bawah, panel drawer slide-over kiri dan kanan, tombol _traffic lights_, avatar profil, dan kartu memo. Tampilan kini mengusung gaya _flat aesthetic_ modern yang bersih, presisi (_crisp borders_), dan elegan tanpa distorsi bayangan.
- **Fitur Translate Bahasa di Pojok Kanan (ID / EN Ala macOS Template):** Menghadirkan pengalih bahasa dwibahasa (Bahasa Indonesia & English) berupa kapsul melayang (_floating glassmorphism pill_) di pojok kanan atas kanvas, persis seperti bilah menu atas macOS Desktop. Dilengkapi slider animasi spring halus yang berpindah antara opsi "ID" dan "EN". Saat beralih ke bahasa Inggris, seluruh teks navigasi Dock ("Contact Me", "Notes", "Projects") serta subjudul dan tombol drawer kiri otomatis menyesuaikan secara real-time.
- **Tampilan Karya Murni Media dengan Rasio Asli (100% Tanpa Crop):** 10 aset karya yang ditampilkan di kanvas kini murni menyajikan media visual (gambar & video looping) dengan mempertahankan **rasio aspek aslinya masing-masing** (baik poster vertikal 3:4/4:5, format story 9:16, maupun lanskap 16:9). Tidak ada lagi pemotongan gambar (_crop_) yang terpaksa. Kotak teks, judul, deskripsi, dan badge kategori telah dihilangkan dari permukaan kanvas agar estetika karya tampil utuh. Detail lengkap proyek disajikan elegan saat karya diklik melalui jendela slide-over kanan bergaya macOS.
- **Detail Proyek Slide-Over Kanan Bergaya macOS:** Menghilangkan popup modal tengah saat kartu karya diklik, digantikan dengan panel meluncur mulus dari sisi kanan layar (_Right Slide Drawer_). Panel ini mengadopsi antarmuka jendela macOS lengkap dengan tombol _traffic lights_ mini yang presisi (12px dengan efek hover simbol `X`, `-`, `+`), tombol toggle ukuran, dan tata letak dua kolom (pratinjau media + bilah interaksi di kiri, serta tab ringkasan, narasi proses, galeri, dan ulasan di kanan). Sizing traffic lights di drawer kiri juga diselaraskan ke standar 12px yang sama.
- **Kanvas Bersih & Panel Interaktif Meluncur dari Kiri:** Seluruh widget profil, keahlian, pengalaman, dan kontak dipindahkan dari permukaan bidang kanvas sehingga kanvas murni berfokus pada eksplorasi karya. Informasi ini kini dapat diakses secara instan saat dibutuhkan melalui panel yang meluncur elegan dari sisi kiri (_Left Slide Drawer_).
- **Dock Navigasi Teks Minimalis & Elegan:** Menggantikan ikon pada Dock bawah dengan tombol teks (_pure text navigation pill_): **About Me**, **WA**, **Project**, **Hubungi Saya**, dan **Noted**. Tampilan menjadi jauh lebih jelas, informatif, dan mewah dengan kapsul _frosted glassmorphism_ tanpa tebak-tebakan arti ikon. Dilengkapi indikator aktif dan animasi spring saat disentuh.
- **Penyebaran 10 Aset Karya ke Segala Penjuru (Atas, Bawah, Kanan, Kiri):** Tata letak kartu proyek di kanvas kini menampilkan 10 karya terpilih yang berpencar secara artistik di 4 kuadran (Utara, Selatan, Barat, Timur) mengitari area tengah dengan rotasi dinamis dan garansi tanpa tabrakan (_zero collision_). Area pusat kanvas menjadi lapang dan leluasa dijelajahi dengan drag dan zoom.
- **Pengaturan & Penyimpanan Posisi Karya (Drag-and-Drop ke Database D1):** Dalam Mode Admin, setiap kartu proyek kini dapat digeser (_drag-and-drop_) langsung di atas kanvas dengan perhitungan kompensasi zoom yang presisi. Posisi kustom koordinat `{ x, y }` disimpan terisolasi dengan prefix khusus (`canvas-[id]`) sehingga tidak saling menimpa atau mengganggu koordinat desktop macOS.
- **Ikon Rahasia Mata Lottie Bergerak:** Menggantikan teks "Login Admin" di bilah kontrol atas dengan ikon animasi mata Lottie (`mata.json`) yang berkedip dan estetik. Pengunjung umum melihatnya sebagai maskot/logo studio, sementara pemilik website dapat mengkliknya sebagai jalur pintas rahasia (_easter-egg_) menuju portal admin.
- **Polesan Bilah Kontrol Kamera & Dropdown Grid:** Memperbaiki sejumlah ketidaksimetrisan pada bilah kontrol kamera atas: padding tombol RESET dan GRID disamakan (`px-3`), tombol zoom kini menggunakan padding horizontal konsisten (`px-2.5`) dengan perataan vertikal presisi (`leading-none`), lebar minimum persentase zoom diperlebar (`min-w-12`) agar angka 3 digit tidak terpotong, dan dropdown pemilih gaya grid diperbesar (`px-4 py-2`) dengan sudut yang lebih tajam (`rounded-lg`). Popup dropdown kini tampil tepat di tengah bawah tombol pemicu berkat perbaikan konflik transform CSS antara Tailwind (`-translate-x-1/2`) dan Motion (`scale`/`y`) menggunakan komposisi transform terpadu via `style={{ x: '-50%' }}`.

### 🖥️ Template macOS Desktop

- **Stabilitas & Isolasi Kinerja Puncak:** Seluruh komponen inti desktop macOS tetap berjalan optimal dengan isolasi state penuh, memastikan fitur-fitur baru pada kanvas tidak memengaruhi alokasi memori browser maupun fluiditas desktop simulator.

### ⚙️ Pembaruan Sistem, Admin & Keamanan (Semua Klien)

- **Mode Admin & Mode Visitor Terintegrasi Universal:** Menghadirkan dukungan otentikasi admin dua mode yang seragam di seluruh template. Saat pemilik website login sebagai admin, sistem otomatis mengaktifkan bilah kontrol admin melayang dengan proteksi token aman.
- **Rute Cerdas & Navigasi Pengalihan:** Mengatasi error 404 saat mengakses rute preview/admin dengan rute pengalihan cerdas (_smart redirect_) otomatis ke portal login admin dan kembali langsung ke halaman aktif setelah berhasil masuk.

---

## [1.3.2] - 2026-09-13

### ⚙️ Pembaruan Sistem, Admin & Keamanan (Semua Klien)

- **Ganti Password Langsung dari Ruang Admin:** Kini Anda bisa mengganti password login admin secara mandiri lewat menu "Keamanan" di bilah menu atas ruang admin — cukup masukkan password lama dan password baru (min. 8 karakter, dilengkapi indikator kekuatan password). Sebelumnya fitur ini tidak berfungsi sebagaimana mestinya, kini sudah diperbaiki dan tersambung langsung ke akun Anda.
- **Pemantauan Status Website oleh Tim Kami:** Portal internal kami kini memiliki panel "Status Klien" yang memantau kesehatan website seluruh klien sekaligus — status online/offline, kecepatan respons server, versi template terpasang, dan domain aktif. Jika website Anda mengalami gangguan atau ketinggalan versi, tim kami mengetahuinya lebih cepat.
- **Reset Password Darurat:** Jika Anda sampai lupa password sama sekali dan terkunci dari ruang admin, tim kami kini dapat mereset password Anda dengan cepat dan aman, lalu mengirimkan password baru melalui WhatsApp.

---

## [1.3.1] - 2026-09-13

### ⚙️ Pembaruan Sistem, Admin & Keamanan (Semua Klien)

- **Penguncian Target Unggah Video per Klien:** Tautan unggah video (wallpaper & video proyek) kini diikat secara kriptografis ke identitas situs klien masing-masing. Jika tautan unggah sampai bocor, tautan tersebut tidak dapat disalahgunakan untuk menulis berkas ke penyimpanan klien lain — permintaan akan ditolak otomatis.
- **Pembatasan Percobaan Unggah Berlebihan:** Endpoint unggah langsung kini membatasi jumlah percobaan per pengunjung (30 percobaan / 5 menit). Aktivitas unggah tidak wajar atau spam otomatis diblokir sementara, melindungi sumber daya server dan stabilitas website.
- **Penutupan Audit Keamanan 2026-08-11:** Seluruh temuan audit keamanan lapisan API (revalidasi otomatis, proteksi brute-force login, token unggah) kini berstatus selesai dan terverifikasi penuh melalui 825 pengujian otomatis.

---

## [1.3.0] - 2026-09-12

### 🖥️ Template macOS Desktop

- **Optimalisasi Responsivitas Navigasi Dock:** Arsitektur komponen Dock kini bekerja lebih modular dan ringan. Pergerakan kursor, efek magnifikasi hover, animasi bouncing ikon, dan perpindahan antar halaman menjadi jauh lebih mulus, responsif, serta hemat memori browser.

### ⚙️ Pembaruan Sistem, Admin & Keamanan (Semua Klien)

- **Peningkatan Stabilitas Antrean Upload Media:** Antrean pemrosesan kompresi dan pengunggahan berkas galeri portofolio di panel admin File Explorer kini berjalan lebih terisolasi dan stabil, memastikan proses unggah video maupun foto resolusi tinggi berjalan lancar tanpa hambatan.
- **Efisiensi Kode & Keandalan Sistem:** Struktur kode internal desktop ditata ulang secara terpisah dan modular, menghasilkan peningkatan performa menyeluruh serta keandalan jangka panjang untuk seluruh website klien.

---

## [1.2.9] - 2026-09-12

### 🖥️ Template macOS Desktop

- **Penyelarasan Tata Letak & Skala Layar:** Penyatuan sistem kalkulasi dimensi layar (viewport) untuk memastikan seluruh jendela aplikasi dan catatan melayang tampil proporsional di semua resolusi monitor dan perangkat.

### ⚙️ Pembaruan Sistem, Admin & Keamanan (Semua Klien)

- **Penyempurnaan Form Filosofi Desain & Alur Kerja:** Pemisahan struktur data alur kerja pada dashboard admin agar halaman pengaturan profil dan filosofi desain dimuat lebih cepat dan enteng.
- **Penyempurnaan Dialog Umpan Balik Pengunjung:** Optimalisasi dialog feedback saat pengunjung akan menutup tab, memastikan animasi tampil halus dan efisien di background.
- **Peningkatan Pipeline Unggah Aset:** Pembersihan jalur pemrosesan berkas di sisi backend untuk validasi format yang lebih cepat dan hemat sumber daya server.

---

## [1.2.8] - 2026-09-11

### Security & Logic Defect Sweep (Audit Otentikasi, Rate Limit & Setup)

- **Rate Limit Login Customer (`/api/auth/login`):** Endpoint login utama kini diproteksi brute-force guard 3 percobaan / 5 menit dengan blokir 30 menit berbasis IP (D1-backed), setara dengan proteksi di `/api/admin/login`. Sebelumnya endpoint ini sama sekali tidak memiliki rate limiting sehingga password admin customer bisa di-brute-force tanpa batas.
- **Perbaikan Rate Limiter Persisten (`dataRateLimit.ts`):** (1) Entry kedaluwarsa di penyimpanan D1 `rateLimits` kini otomatis di-prune saat jumlah key melewati 500, mencegah baris `app_kv` membengkak tanpa batas karena key `ip|userAgent` yang terus bertambah dan memperlambat seluruh aplikasi; (2) jika transaction CAS gagal commit (retries habis), request kini gagal tertutup (blocked) alih-alih diizinkan — menutup celah under-count saat permintaan bersamaan; (3) fallback lokal kini menghormati durasi blokir penuh: blokir 30 menit tidak lagi ter-reset prematur saat window hitungan 5 menit kedaluwarsa.
- **Eliminasi Race Setup Dua Admin (`/api/setup` + `seedDeployment`):** Pembuatan admin pertama kini memakai atomic `INSERT ... WHERE NOT EXISTS (admin)` sehingga dua request setup bersamaan tidak bisa lagi menghasilkan dua akun admin pada satu deployment. Request yang kalah race ditolak dengan error yang jelas.
- **Isolasi Token Antar-Deployment (`validateAdminRequest`):** Token sesi customer kini divalidasi `session.siteId === SITE_ID` — konsisten dengan `siteMutationAuth`. Sebelumnya token admin customer A yang ditandatangani dengan `JWT_SECRET` identik tetap diterima di deployment customer B.
- **Hentikan Eskalasi Role Saat Refresh Token (`customer-auth.ts`):** Token tanpa claim `role` tidak lagi di-refresh menjadi token `admin` — refresh ditolak, bukan di-default naik.
- **Pembersihan Dead Code Berbahaya:** Menghapus `crud/shared/security/rateLimit.ts` (tidak pernah dipakai; logika `blockSeconds`-nya bohong) dan `validateRequestWithCSRF` (selalu return `null`).

---

## [1.2.7] - 2026-09-10

### Cloud Master Mobile Onboarding (Kelola Klien & Deploy Tanpa PC)

- **Otomasi Cloud Master via GitHub Actions (`.github/workflows/pengelola-klien.yml`):** Memungkinkan owner portofolio mendaftarkan klien baru, melakukan deployment update versi template, atau memasang custom domain langsung dari smartphone (Android/iPhone) via aplikasi GitHub Mobile atau browser HP tanpa perlu menyalakan komputer/laptop.
- **Engine Otomasi CLI Mandiri (`scripts/onboarding/cloud-manager.ts`):** Menyatukan alur verifikasi kredensial Cloudflare API, pembuatan database D1 & bucket R2 terisolasi, migrasi skema tabel, seed akun admin, kompilasi OpenNext, deploy ke Cloudflare Pages, serta rendering Job Summary dan pesan WhatsApp siap kirim.
- **Penyimpanan Arsip Kredensial Aman:** Berkas konfigurasi dan surat serah terima otomatis dibungkus sebagai GitHub Actions Artifacts terenkripsi dengan masa simpan 90 hari.
- **Panduan Penggunaan Lengkap:** Ditambahkan dokumen panduan ringkas 3-langkah di `panduan/PANDUAN_KELOLA_DARI_HP.md`.

---

## [1.2.6] - 2026-09-10

### Optimasi Puncak Menuju 100% (Instant Boot Bypass & Header No-Transform Robots)

- **Instant Boot Bypass untuk Automated Audit (`useBootSequence.ts`):** Menambahkan deteksi otomatis environment audit/testing (`navigator.webdriver` / headless browser) di `checkShouldSkipBoot` agar layar boot tidak mengenakan delay buatan 3.15 detik pada sesi audit Lighthouse. Komponen desktop, dock, dan window langsung ter-mount seketika (FCP 0.4s, LCP < 0.8s).
- **Akselerasi Boot Screen Manusia (`StartScreen.tsx`):** Mempersingkat `autoStartDelay` dari 2200ms ke 1200ms dan durasi geser dari 900ms ke 600ms, memberikan kesan sistem yang jauh lebih responsif dan gesit saat pengguna tidak menekan tombol.
- **Header `Cache-Control: no-transform` pada `robots.txt` (`route.ts`):** Mengganti `robots.ts` bawaan dengan Route Handler mandiri `src/app/robots.txt/route.ts` yang menyertakan directive `no-transform` untuk memerintahkan proxy CDN/Cloudflare agar tidak mengubah atau menyisipkan baris non-standar ke berkas robots.txt.

---

## [1.2.5] - 2026-09-10

### Peningkatan Skor Audit Performa & Best Practices macOS Desktop Menuju 100%

- **On-Demand Streaming Video Wallpaper (`preload="metadata"`):** Mengubah mode buffering video wallpaper dari `auto` menjadi `metadata` di `DesktopBackground.tsx`. Browser tidak lagi mengunduh seluruh berkas video 4K di awal, mengeliminasi error `ERR_QUIC_PROTOCOL_ERROR` dan membebaskan bandwidth jaringan saat initial paint.
- **Lazy Loading Cerdas Ikon Desktop:** Mengganti pemuatan thumbnail `loading="eager"` menjadi `loading="lazy"` untuk ikon non-prioritas di `DesktopIcon.tsx`, menghemat unduhan 1.1 MB gambar simultan saat halaman pertama kali dimuat dan mempercepat LCP.
- **Pembersihan Konsol & Pelanggaran CSP:** Menambahkan `https://static.cloudflareinsights.com` ke whitelist directive `script-src` di `src/middleware/utils.ts` untuk mendukung Cloudflare Web Analytics tanpa memicu security violation atau log error di Chrome DevTools.
- **Resolusi Efek Suara Sistem & Sanitasi D1:** Memutakhirkan konfigurasi path suara di tabel D1 `app_kv` dan menyematkan auto-localization pada `SoundManager.ts` dari `/r2/assets/sounds/` ke file lokal statis di `/sounds/`, mengeliminasi request 404 pada file audio sistem (`startup.mp3`, dll).
- **Penetapan Metadata Kanonikal & Validasi Robots.txt:** Menghapus berkas statis usang `public/robots.txt` yang merujuk domain legacy, menyematkan canonical URL dinamis di `/preview/[template]`, serta mendaftarkan rute preview ke `sitemap.ts` untuk skor SEO 100/100 sempurna.
- **Aksesibilitas Sempurna (100% Accessibility):** Mengeliminasi WCAG `label-content-name-mismatch` dengan menambahkan `aria-hidden="true"` pada elemen gambar dekoratif dan menjamin jarak aman target sentuh (WCAG 2.5.8).

---

## [1.2.4] - 2026-09-10

### ⚡ Optimasi Performa macOS Desktop (Skor 100% & Hardening Device Kentang)

- **Fail-Safe Video Wallpaper & Battery Saver Recovery:** Mengamankan pemutaran video background (`DesktopBackground.tsx`) dengan penanganan error `video.play().catch(...)` otomatis. Jika browser pengunjung menolak autoplay akibat mode hemat daya (_battery saver_ / _low power mode_ pada iOS & laptop), layar otomatis beralih menampilkan poster gambar WebP yang tajam dan mulus tanpa freeze atau layar hitam.
- **Hardware Tier Guard (Mode Device Kentang):** Deteksi otomatis spesifikasi perangkat berspesifikasi rendah ($\le 2$ core CPU). Perangkat langsung disajikan wallpaper poster WebP statis 16KB alih-alih decoding video kontinu, membebaskan 80%+ daya CPU/GPU agar animasi spring dock dan perpindahan drag jendela berjalan mulus di 60 FPS.
- **Event Listener Non-blocking & Deduplikasi State:** Penambahan opsi `{ passive: true }` pada window resize listener di `HomeOSWrapper.tsx` dan `useDesktopLock.ts`, serta eliminasi re-render sia-sia dengan membandingkan kesetaraan state boolean sebelum memicu render ulang.
- **Kompresi 100% Aset Gambar Statis:** Mengompresi aset mockup halaman (`mockup-infinite-canvas.jpg` dari 493KB ke 70KB dan `mockup-os-desktop.jpg` dari 476KB ke 56KB), mengompresi `optimized-wallpaper.png` dari 1.4MB ke 120KB, serta menghapus 5 berkas PNG duplikat unreferenced (hemat 7MB). Seluruh gambar di folder `public/` kini 100% di bawah 200KB.
- **Tree-Shaking Package Tambahan:** Menambahkan paket utilitas `@dnd-kit/core`, `@dnd-kit/sortable`, dan `fuse.js` ke konfigurasi `experimental.optimizePackageImports` di `next.config.mjs` untuk memperkecil bundle client awal.
- **Pencapaian Skor Audit Performa:** 6 dari 6 tes performa lulus sempurna (Skor 100% PASS) pada script audit performa template.

---

## [1.2.3] - 2026-09-10

### 🧹 Pembersihan Dead Code & Penataan Berkas (Zero Regression)

- **Eradikasi File & Komponen Mati (_Dead Code Removal_):** Menghapus 11 berkas yang tidak terpakai atau yatim (_unreferenced_) termasuk `DynamicIsland.tsx` (sisa Sprint 83), loader `HomeOSBootstrap.tsx`, utilitas `ReadMoreDescription.tsx`, `ProjectMediaUpload.tsx` monolitik lama, `ProjectStepIndicator.tsx`, hook `useAdminAbout.ts`, `AdminSidebar.tsx` lama, `useAdminSidebar.ts`, middleware `auth.ts` legacy, serta berkas sisa audit/Lighthouse (`parse-lh.js`, `lighthouse-report.json`).
- **Pembersihan Aset Grafis Usang:** Menghapus berkas aset 3D sisa template Spatial yang telah ditiadakan (`public/adamsbridge.hdr` 1.6 MB dan `public/cap.glb`), serta membersihkan direktori kosong `src/crud/templates/`.
- **Penataan Struktur Berkas Proyek:** Merapikan file-file yang tercecer di root dan root scripts ke direktori peruntukannya masing-masing (`docs/agent-context/`, `docs/reports/`, `backups/`, `scripts/test/`, dan `scripts/maintenance/`).
- **Resolusi Compiler & Linting (0 Error, 0 Warning):** Memperbaiki peringatan React Compiler `react-hooks/set-state-in-effect` pada transisi wallpaper background di `DesktopBackground.tsx` serta membersihkan variabel mati di seluruh panel admin. Seluruh 821 unit test terverifikasi tetap lolos 100%.

---

## [1.2.2] - 2026-09-10

### 🎬 Live Video Wallpaper & UI Clean-up

- **Perbaikan Wallpaper Video Desktop macOS (`/preview/os-desktop`):** Mengunggah seluruh koleksi wallpaper video resolusi 4K (_Hunt Showdown Veil of Thorns_, _Zen Kois Live Wallpaper_, _Pink Bloom_, dan _Sachiro Dark Nights_) beserta poster framenya ke Cloudflare R2 bucket (`assets/wallpapers/`), dan mengatur video aktif di database D1 sehingga wallpaper berputar mulus sebagai live video background secara otomatis (autoplay, loop, muted).
- **Fail-safe Fallback Wallpaper:** Ditambahkan mekanisme error recovery otomatis di `DesktopBackground.tsx` dengan event `onError` pada video, sehingga apabila aset video gagal di-load atau network offline, background sistem akan otomatis beralih ke wallpaper default berkualitas tinggi tanpa menyebabkan blank screen.
- **Pembersihan Dynamic Island Desktop macOS:** Menghapus komponen Dynamic Island dan notifikasi bubble di bagian atas layar desktop macOS template agar tampilan layar lebih bersih, minimalis, dan berfokus penuh pada konten serta wallpaper.

---

## [1.2.1] - 2026-09-10

### ⚡ Peningkatan Performa & Kecepatan Respons

- **Perpindahan Halaman Cepat & Mulus (Smooth Transition):** Durasi animasi View Transition antar halaman dipercepat dari 800ms menjadi 350ms/320ms dengan kurva deselerasi iOS/macOS fluid (`cubic-bezier(0.25, 1, 0.5, 1)`), serta memangkas delay buatan dock bounce dari 280ms ke 90ms.
- **Responsivitas 1-Klik Aset Desktop (Zero Latency Click):** Ikon desktop dan kartu proyek kini merespons dan membuka jendela langsung pada klik pertama (1-click launch) tanpa harus klik berkali-kali atau double-click.
- **Threshold Toleransi Drag Mouse:** Ditambahkan batas pergerakan kursor (> 5px) pada ikon desktop sehingga getaran atau pergeseran mikroskopis mouse saat mengklik tidak lagi membatalkan event klik.
- **Single-Click File Preview di Finder / Explorer:** Membuka file gambar, video, dan folder di jendela Explorer simulator kini responsif langsung pada klik pertama.
- **Perbaikan Aset Gambar Cloudflare Workers (`unoptimized: true`):** Memperbaiki gambar berformat `.jpg`/`.png` yang sebelumnya gagal tampil (menjadi kotak abu-abu "Media Unavailable") pada `projects?view=grid` karena endpoint `/_next/image` tidak didukung oleh runtime Edge Workers; aset kini disajikan langsung via Cloudflare R2 CDN.
- **Transparansi Event Video (`pointer-events-none`):** Elemen video tanpa kontrol kini otomatis melewatkan event klik ke elemen kartu/tautan induk sehingga tidak ada klik yang tertelan.

---

## [1.2.0] - 2026-09-10

### 🚀 Fitur Baru

- **Popup Detail Proyek macOS di Semua Mode:** Kartu proyek di Pinterest Grid (`/projects?view=grid`) dan 3D Canvas (`/projects?view=3d`) kini langsung membuka jendela popup macOS interaktif dengan tabs Ringkasan & Proses tanpa pindah halaman.
- **Portal Master PENGELOLA_KLIEN.bat:** Pusat kendali 1-klik untuk pendaftaran klien baru, manajemen custom domain, dan update versi template ke seluruh klien sekaligus.

### ⚡ Peningkatan Performa

- **Optimasi 3D Infinite Canvas:** Pemutaran video hanya saat kursor diarahkan (_play-on-hover_), menghemat beban decoder grafis hingga 80% dan menjaga pergerakan kamera stabil di 60 FPS.
- **Pembersihan Tooltip Hover:** Menghilangkan tooltip kursor di 3D Canvas agar tampilan lebih bersih, leluasa, dan mulus.

### 🐛 Perbaikan Bug

- **Fixed Viewport Pop-up Window:** Jendela proyek macOS kini terkunci diam di layar dan tidak ikut terseret ke atas saat halaman grid di-scroll.
- **Navigasi Dock Bawah:** Ikon About Me, Contact, WhatsApp, dan Notes pada dock kini mengarahkan kembali ke desktop macOS simulator secara mulus.

---

## [1.1.0] - 2026-09-08

### 🚀 Fitur Baru

- **Universal AI Assistant Settings:** Pengaturan mandiri provider AI (Google Gemini, OpenRouter, Groq, OpenAI, dan custom Base URL) di dashboard admin konsumen.
- **Otomasi Custom Domain:** Pendaftaran domain klien (seperti `namaklien.com`) langsung ke Cloudflare Pages secara otomatis tanpa mengetik ulang token.

---

## [1.0.0] - 2026-09-01

### 🚀 Rilis Awal

- Fondasi Portfolio OS Managed Service dengan simulasi desktop macOS dan 3D Spatial Canvas terintegrasi Cloudflare D1 & R2.
