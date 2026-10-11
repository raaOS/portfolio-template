# Gladi Resik Klien Perdana

> **Tujuan:** menguji SELURUH alur (order → verifikasi → portal → deploy → serah terima)
> SEBELUM ada klien pertama yang membayar. Gladi memakai data TEST — order buatan sendiri,
> slug test, dan akun Cloudflare latihan (akun Anda sendiri, tier gratis). Hari-H klien
> pertama tinggal mengulang urutan yang sama dengan data asli.
>
> Dibuat untuk v1.3.27 (rencana PK7). Prinsip: **nol biaya tambahan** — semua alat sudah
> ada di repo ini. Rincian teknis tidak diduplikasi di sini; tiap tahap menunjuk dokumen
> yang sudah ada.

---

## 1. Prasyarat (centang dulu semua)

- [ ] `npm ci` selesai dan gerbang dasar hijau: `npm run pre-deploy`
      (lint + types + audit dependensi).
- [ ] Portal onboarding jalan: `npm run client:new` → buka **http://localhost:4567**
      (port sibuk → `npx kill-port 4567` lalu ulangi).
- [ ] Data test disiapkan:
      - slug test, misalnya `gladi-resik-okt` (cek ketersediaan lewat form portal),
      - email Anda sendiri (untuk menerima semua email alur),
      - gambar apa pun (untuk diunggah sebagai "bukti bayar" order test).
- [ ] Akun Cloudflare **latihan** siap (akun Anda sendiri): catat **Account ID** +
      **API Token** dengan cakupan **D1 Edit + R2 Edit + Workers Edit** (ikuti
      panduan portal STEP 2 — template *Edit Cloudflare Workers*) — dipakai portal
      STEP 1-3. Ini akun palsu-klien, bukan milik klien.
- [ ] Harga jual sudah sesuai: login `/admin` → panel **Harga Jual** (zona
      Sistem) → pastikan angkanya benar, karena nominal order dihitung dari
      sana.
- [ ] Baca ulang `docs/operations/support-playbook.md` §8 (refund) — daftar janji yang
      **boleh** dikatakan ke klien, dan yang tidak.

## 2. Tahap A — Uji alur jualan di storefront

1. Buka `https://<domain-storefront>/checkout` (atau `npm run dev` → `/checkout` bila
   ingin menguji lokal; alur servernya sama).
2. Buat order test: nama bebas, **email Anda sendiri**, slug test, submit.
3. Centang:
   - [ ] Halaman order terbuka dengan nominal + instruksi pembayaran.
   - [ ] Email **Struk Pesanan** masuk — ada link halaman order **dan** footer
         Syarat & Ketentuan + Kebijakan Privasi.
   - [ ] Tombol "Pesan" di checkout menampilkan harga dari **Harga Jual** (bukan angka
         lama yang tertinggal).
4. Upload gambar sebagai bukti bayar test, lalu verifikasi lewat jalur owner
   (tombol Telegram / alur yang tercantum di `docs/operations/BENGKEL_HANDOFF.md`).
5. Centang:
   - [ ] Email **"Pembayaran Terverifikasi — Website Sedang Disiapkan"** masuk,
         **tanpa satu pun link** di dalamnya (jaminan kejujuran v1.3.27 — memang
         disengaja; link baru muncul di email tahap online).
   - [ ] Status order di halaman order berubah sesuai.

## 3. Tahap B — Uji alur portal (provisioning → deploy)

Ikuti portal `PENGELOLA_KLIEN.bat` / `http://localhost:4567`, Tab **Pendaftaran Klien
Baru** — detail langkah ada di `docs/release/CLIENT_OPERATIONS.md`:

1. STEP 1-3: masukkan Account ID + API Token akun latihan → verifikasi → D1
   `db-<slug>` dan R2 `media-<slug>` terbentuk di akun latihan.
2. STEP 4: skema tabel terpasang, row site + admin user ter-seed — **catat email &
   password admin** (tersimpan di `arsip-klien/<slug>/config.env`).
3. STEP 5: build + deploy berjalan sampai selesai.
4. Centang:
   - [ ] `https://<slug>.workers.dev` terbuka dan menampilkan desktop portfolio.
   - [ ] Email **"Website Sudah Online"** masuk berisi URL live yang benar
         (kirim otomatis setelah deploy pertama sukses; kalau deploy sempat gagal lalu
         di-retry dari kartu sukses, email menyusul lewat retry itu).
   - [ ] Dropdown saran slug di form portal menampilkan order test Anda
         (tetap bisa ketik manual).

## 4. Tahap C — Verifikasi isi & data (deployment hasil gladi)

- [ ] Login `https://<slug>.workers.dev/admin/login` memakai kredensial dari
      `config.env` — berhasil.
- [ ] Ubah Info Profil di `/admin` → simpan → buka situs di jendela incognito →
      perubahan tampil (bukti tulis-baca D1 jalan).
- [ ] Ganti wallpaper / unggah media → file masuk R2 dan tampil (pipeline upload +
      kompresi jalan).
- [ ] Tambah 1 proyek + gambar → tampil di site.
- [ ] Smoke check endpoint: `npm run release:smoke -- --url=https://<slug>.workers.dev`
      (atau set `PRODUCTION_SMOKE_URL`). Bila butuh pemeriksaan siap-jual lebih
      lengkap: `npm run release:sale-readiness` dan `npm run release:audit`.

## 5. Tahap D — Simulasi serah terima ke klien

- [ ] `CATATAN_SERAH_TERIMA.md` terbentuk otomatis di folder hasil deploy (dibuat
      `deployClient()` — v1.3.27) dan isinya sesuai klien itu.
- [ ] Paket kirim ke "klien" (diri sendiri dulu, lewat jalur privat seperti aslinya):
      link site, link `/admin/login`, email + password admin, dan pengingat singkat
      cara ganti konten (ringkasan `docs/release/CLIENT_OPERATIONS.md`).
- [ ] Uji jalur lupa password: `npx tsx scripts/cloudflare/reset-customer-password.ts`
      (lihat `--help`/komentar skrip untuk argumen).

## 6. Pembersihan setelah gladi

- [ ] **Order test:** batalkan lewat flow yang ada, atau biarkan kedaluwarsa otomatis
      (7 hari). Jangan dibiarkan terverifikasi sebagai order palsu yang aktif.
- [ ] **Arsip latihan** `arsip-klien/<slug-gladi>/`: beri tanda jelas (misal folder
      diganti nama `GLADI-<slug>`) supaya tidak tertukar dengan arsip klien asli —
      atau hapus bila sudah tidak perlu.
- [ ] **Resource akun latihan** (D1/R2 akun CF sendiri): boleh dikosongkan kapan saja;
      ingat resource klien ASLI tidak boleh disentuh tanpa alasan.
- [ ] `git status` bersih — tidak ada file latihan yang ikut ter-commit.

## 7. Gerbang final sebelum klien pertama (hari-H minus 1)

- [ ] `npm run pre-deploy` hijau.
- [ ] `npm run release:audit` + `npm run release:sale-readiness` semua hijau.
- [ ] `npm run audit` (integritas data relasi) bersih.
- [ ] `npm test` hijau (skrip gerbang: tsc 0, eslint 0, seluruh test lolos).
- [ ] Backup terakhir ada di `backups\` dan **sudah disalin** ke flashdisk lewat
      `SALIN_CADANGAN.bat` (petunjuk: `cadangan-flashdisk/README.txt`).
- [ ] Backup otomatis harian (cron Worker 01:00 WIB) terpasang & terverifikasi —
      jadwal dan cara cek ada di `docs/operations/backup-restore-runbook.md`
      (bagian "Backup Otomatis Harian").
- [ ] Harga final terkonfirmasi di panel **Harga Jual**.
- [ ] Support playbook §8 (refund) + `docs/operations/support-response-templates.md`
      siap dipakai saat klien bertanya.

## 8. Bila ada yang gagal selama gladi

| Gejala | Tindakan cepat |
|---|---|
| Port 4567/3000 sibuk | `npx kill-port 4567` / `npx kill-port 3000` |
| Build error aneh / cache | `npm run clear-cache` lalu `npm run fix-webpack` |
| Deploy STEP 5 gagal | Baca log di portal, perbaiki penyebabnya, ulangi; email "Sudah Online" mengikuti status deploy |
| Email tidak masuk | Cek `NOTIFICATION_PROVIDER` + `NOTIFICATION_API_KEY` di env portal; kartu hasil deploy menampilkan catatan status email |
| Login admin gagal | Cek `arsip-klien/<slug>/config.env`; lupa password → `reset-customer-password.ts` |
| Ada yang belum tahu harus ke mana | `docs/operations/support-playbook.md` §9 (Daftar Eskalasi) |

## 9. SOP Khusus: Akun Cloudflare Klien & Verifikasi Pembayaran (keputusan owner 2026-10-11)

### 9a. Siapa mendaftarkan akun Cloudflare klien

**Keputusan: owner yang membuatkan** akun Cloudflare baru untuk tiap klien (target
awal 50–100 klien, semuanya tier gratis — 1 klien = 1 akun).

Prosedur per klien:

1. Pakai **email asli milik klien** — akun legal milik klien sejak awal dan bisa
   diserahkan kelak bila klien memintanya.
2. Daftar lewat jendela **Incognito / profil browser terpisah**, tutup setelah selesai.
3. **Jeda wajar: 1–2 akun per hari.** Yang diblokir Cloudflare adalah pola massal
   (puluhan akun beruntun dari 1 IP) — bukan pembuatan akun satu per satu saat ada order.
4. Setelah akun jadi, owner membuat **API Token** (template *Edit Cloudflare Workers*:
   D1 Edit + R2 Edit + Workers Edit) + mencatat **Account ID** → langsung dipakai di
   portal STEP 1–3 seperti gladi resik.
5. Saat serah terima, sertakan juga **akses login akun Cloudflare** (email + password
   yang tadi dibuat) bila klien menginginkannya — kredensial website `/admin` tetap
   dibahas terpisah seperti biasa.

Jalur alternatif untuk skala di atas ±100 klien atau klien yang melek teknis: klien
**mendaftar sendiri** — owner mengirim panduan 3 langkah bergambar (1. daftar akun
gratis, 2. buat API Token dari template yang sama, 3. kirim balik Account ID + Token).

### 9b. Checklist verifikasi pembayaran manual (anti struk palsu)

Gambar bukti transfer bisa diedit di HP — **hanya mutasi rekening asli yang jadi
sumber kebenaran.** Sebelum menekan "Verifikasi & Aktifkan":

- [ ] Buka **mutasi rekening asli** di m-Banking (jangan melihat gambar struk yang
      diunggah pembeli).
- [ ] Cocokkan **nominal persis** (termasuk 3 digit kode unik), tanggal/jam, dan
      nama pengirim.
- [ ] Nominal tidak ada di mutasi / meleset → **jangan aktifkan**; minta bukti ulang
      atau biarkan order kedaluwarsa otomatis.

---

**Selesai gladi = semua centang di atas terpenuhi dua kali berturut-turut (sekali dengan
data lokal, sekali dengan deployment latihan).** Klien pertama boleh di-order hanya
setelah §7 hijau semua.
