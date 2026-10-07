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
      **API Token** — dipakai portal STEP 1-3. Ini akun palsu-klien, bukan milik klien.
- [ ] Harga jual sudah sesuai: login `/admin` → panel **Harga Jual** (zona
      Sistem & Tampilan) → pastikan angkanya benar, karena nominal order dihitung dari
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

---

**Selesai gladi = semua centang di atas terpenuhi dua kali berturut-turut (sekali dengan
data lokal, sekali dengan deployment latihan).** Klien pertama boleh di-order hanya
setelah §7 hijau semua.
