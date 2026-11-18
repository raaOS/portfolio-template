# Tracker Log: Alat Owner — Ganti Template Klien Tanpa Deploy Ulang

**Status:** 🟢 Completed (alat siap dipakai dari repo; tidak perlu deploy)
**Mulai:** 2026-11-18
**Selesai:** 2026-11-18 (rilis catatan v1.3.91)

## 📌 STATUS TERAKHIR — WAJIB DIBACA & DIUPDATE AI BERIKUTNYA

- **Tanggal update:** 2026-11-18
- **Progress:** Selesai penuh. Perintah permanen `set-client-template` ada dan sudah
  diuji nyata terhadap D1 gladi (tulis → baca balik → dikembalikan).
- **Deploy:** ❌ tidak perlu. Alat ini owner-side (jalan dari repo), hanya menulis
  `sites.active_template_key` di D1 klien + `ACTIVE_TEMPLATE_KEY` di
  `arsip-klien/<folder>/config.env`. `APP_VERSION` dinaikkan ke `1.3.91` semata
  untuk menjaga test `src/lib/constants.test.ts` (wajib sama dengan entri CHANGELOG
  teratas); angka itu baru terlihat di produksi saat deploy berikutnya.
- **Langkah berikutnya:** tidak ada. Kalau klien minta pindah template, jalankan
  `npm run client:template -- <folder-klien> <template-key>` (tanpa `template-key` =
  mode baca).
- **Kaitan:** jawaban jujur di sesi sebelumnya — "bisa ganti template tanpa deploy,
  tapi belum ada tombolnya". Owner memilih dibuatkan perintah permanen (bukan hanya
  dicatat di dokumentasi). Lihat juga
  `fitur_template_scope_admin_2026_11_15.md` (dashboard admin yang menyesuaikan
  template aktif secara runtime).

## 🎯 Tujuan (Objective)

Menjadikan "klien pindah template" pekerjaan satu perintah yang aman, bukan UPDATE
manual buta ke D1 klien:

1. Validasi nama template ke registry sebelum menyentuh kredensial/network.
2. Ambil kredensial dari arsip klien (`arsip-klien/<folder>/config.env`), bukan
   `.env.local` owner — supaya tidak salah database.
3. Tulis hanya `sites.active_template_key`, lalu **verifikasi baca balik**.
4. Sinkronkan `ACTIVE_TEMPLATE_KEY` di arsip klien agar re-provision/portal tidak
   mengembalikan template lama.
5. Mode baca (tanpa argumen template) untuk memeriksa keadaan sekarang.

## 🔒 Keputusan Desain (jangan dibalik tanpa izin owner)

- **Kenapa tanpa deploy?** Ketiga renderer (`os-desktop`, `infinite-canvas`,
  `spatial-gallery`) selalu ikut ter-build di setiap deployment klien. Yang menentukan
  tampilan hanya `sites.active_template_key`: `src/app/page.tsx` membacanya tiap request
  dengan `revalidate = 60`, dan desktop admin membacanya via
  `GET /api/admin/site-template`. Jadi ganti template = satu kolom D1.
- **Kenapa CLI, bukan tombol admin?** Belum ada kebutuhan klien self-service untuk
  pindah template; permintaan owner eksplisit = perintah kecil owner-side. Tombol admin
  bisa ditambahkan kelak tanpa membatalkan alat ini.
- **Fail-closed:** template asing ditolak sebelum baca config/network; D1 klien wajib
  berisi **tepat 1 baris `sites`** (invarian 1 klien = 1 D1); `CUSTOMER_SITE_ID` di arsip
  wajib cocok dengan baris itu — kalau tidak → berhenti tanpa menulis apa pun; hasil UPDATE
  wajib lolos pembacaan ulang, kalau tidak → exit 1.
- **Arsip ikut disinkronkan (`ACTIVE_TEMPLATE_KEY`).** Server onboarding/portal membaca
  kunci ini (`scripts/onboarding/server.ts:1910`, `cloud-manager.ts:450`) saat re-provision
  / update template; kalau arsip dibiarkan, template bisa kembali ke nilai lama tanpa
  disadari. Ditulis lewat `upsertEnvFile()` bersama (bukan regex lokal) supaya nilai
  berkutip/tanpa kutip sama-sama tertangani dan baris lain tidak tersentuh.
- **Entitlement TIDAK disentuh:** `site_template_entitlements` hanya dipakai alur
  marketplace/seed, bukan renderer publik (diverifikasi: `src/app/page.tsx` hanya membaca
  `active_template_key`). Menyentuhnya akan menambah efek samping tanpa manfaat.
- **Pengaturan tampilan tidak ikut pindah:** wallpaper desktop macOS vs objek 3D spatial
  adalah milik template masing-masing. Konten CRUD aman (sejak v1.3.88 ketiga template
  merender konten yang sama); template baru mulai dari default tampilannya.

## 📋 Task List

- [x] `scripts/cloudflare/set-client-template.ts` (baru): mode baca + mode tulis,
      validasi registry, invariant 1 baris `sites` + cek `CUSTOMER_SITE_ID`, override
      kredensial dari `config.env`, UPDATE + verifikasi baca balik, sinkronisasi
      `ACTIVE_TEMPLATE_KEY` lewat `upsertEnvFile()`, pesan konsekuensi (ISR ≤60 detik,
      admin refresh, tampilan default).
- [x] `package.json`: alias `client:template` (berdampingan dengan `client:new`).
- [x] `src/lib/constants.ts`: `APP_VERSION` → `1.3.91`.
- [x] `CHANGELOG.md`: entri `[1.3.91]`.
- [x] `docs/operations/support-playbook.md`: §11 prosedur "klien pindah template".
- [x] `docs/tracker/INDEX_TRACKER.md`: entri log ini.

## ✅ Verifikasi (bukti nyata, bukan asumsi)

Dijalankan dengan `tsx` dari repo ini. Node modules memakai junction sementara ke working
copy utama (dihapus setelah tes); **arsip gladi disalin** ke folder uji sementara di dalam
repo agar `config.env` asli klien tidak tersentuh — folder uji dihapus setelah tes.

1. Tanpa argumen → usage + exit 1.
2. `--help` → usage + exit 0.
3. `klien-tidak-ada` → `✗ config.env tidak ditemukan ...` (dites sebelum revisi final;
   perilaku sama di versi final) + exit 1.
4. `<folder> ngawur` → `✗ Template "ngawur" tidak dikenal. Key valid: ...` + exit 1
   (tanpa network).
5. Mode baca → `... template aktif: os-desktop (OS Desktop)`.
6. Round-trip tulis di D1 gladi memakai salinan arsip:
   - `os-desktop → infinite-canvas` → `✓ ... terverifikasi baca balik` +
     `config.env arsip disinkronkan`;
   - baca ulang → `infinite-canvas`, baris arsip `ACTIVE_TEMPLATE_KEY=infinite-canvas`;
   - `infinite-canvas → os-desktop` → `✓ ... terverifikasi baca balik`;
   - baca ulang → `os-desktop`, baris arsip `ACTIVE_TEMPLATE_KEY=os-desktop`
     (**state akhir D1 gladi kembali seperti semula**).
7. Jalur "sudah aktif" (`os-desktop` diminta saat D1 sudah `os-desktop`) → `D1 tidak
   diubah` + arsip tetap disinkronkan + exit 0.
8. `src/lib/constants.test.ts` PASS setelah `APP_VERSION` naik (6 test).

Catatan verifikasi: `tsconfig.json` mengecualikan `scripts/`, jadi `tsc --noEmit` tidak
memeriksa skrip ini — verifikasi yang sah adalah eksekusi `tsx` di atas.

## ⚠️ Batasan / Catatan untuk AI Berikutnya

- Jangan menambah penulisan tabel lain di skrip ini tanpa alasan kuat; satu kolom =
  satu tanggung jawab.
- Kalau kelak template baru ditambahkan, cukup daftarkan di
  `src/lib/templates/registry.ts`; skrip otomatis menerima key baru dan menolak yang lain.
- Jangan mengubah `CUSTOMER_SITE_ID` di arsip klien lewat skrip ini — itu urusan onboarding.
- Alat ini tidak membersihkan `site_template_settings` template lama; pengaturan tampilan
  template lama tetap tersimpan (tidak mengganggu) bila klien kembali lagi.
