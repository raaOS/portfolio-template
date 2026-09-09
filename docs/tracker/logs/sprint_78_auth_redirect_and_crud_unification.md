# Sprint 78 — Auth Redirect, CRUD Unification & 1-Click Zero-Terminal Onboarding

**Tanggal:** 2026-09-08 / 2026-09-09  
**Status:** 🟢 Completed  

---

## 🎯 Tujuan Sprint
1. **Perbaikan Alur Autentikasi Admin:** Menghilangkan *stealth 404 trap* di middleware saat mengakses `/admin` tanpa login. Menggantinya dengan HTTP 307 redirect bersih ke `/admin/login?redirect=...`.
2. **Eradikasi Fragmentasi CRUD & Pembersihan Template Hub:**
   - Menghapus tombol `"Template Hub (2 Template)"` di MenuBar desktop admin tanpa sisa.
   - Menghapus folder rute redundant `src/app/admin/templates/` dan mengalihkan seluruh rute template legacy ke rute CRUD desktop sentral via `next.config.mjs`.
   - Mengarahkan seluruh `adminPath` di `registry.ts` langsung ke modul resmi desktop (`/admin/projects`, `/admin/content/profile`, dll.).
3. **Penyatuan Penuh Template Infinite Canvas (Opsi 1):**
   - Menghubungkan 100% data CRUD admin (Projects, Profile, Skills, Experience, Contact, Testimonials) ke dalam kluster spasial di atas kanvas 2D/3D interaktif.
   - Mengatasi broken image modal dengan graceful image error fallback (`CanvasProjectModal.tsx`).
   - Menyediakan HUD Navigasi cepat (*Quick Jump Navigator*) dan kontrol zoom/pan halus.
4. **Asisten Onboarding Klien Visual 1-Klik (Zero-Terminal):**
   - Mengatasi kendala Master non-koder yang lupa perintah terminal dan khawatir terjadi kesalahan manusia (*human error*).
   - Menyediakan launcher desktop `BUAT_KLIEN_BARU.bat` yang otomatis membuka browser lokal (`http://localhost:4567`).
   - Otomasi pembuatan Cloudflare D1 (`db-<slug>`), R2 (`media-<slug>`), migrasi skema tabel, dan pengarsipan lokal di `arsip-klien/<order>_<slug>/` dengan isolasi 100% antar-klien (mencegah data bercampur).
   - Menyediakan tombol salin pesan serah terima WhatsApp siap kirim ke klien.
5. **Pembaruan Panduan Operasional:**
   - Menyempurnakan `panduan/PANDUAN_UNTUK_KAMU_OWNER.md` dengan instruksi 1-klik `BUAT_KLIEN_BARU.bat`.
   - Menyempurnakan `panduan/PANDUAN_UNTUK_KLIEN.md` dengan penjelasan satu pusat CRUD untuk kedua tema visual.

---

## 🛠️ Perubahan File & Solusi

### A. Autentikasi & Navigasi Admin
1. **`src/middleware/customer-auth.ts`**:
   - Menghapus stealth rewrite ke `/404` untuk rute `/admin`.
   - Mengalihkan unauthenticated request secara konsisten ke `/admin/login?redirect=${encodeURIComponent(pathname)}`.
2. **`src/middleware/__tests__/customerAuth.test.ts`**:
   - Menyesuaikan unit test customer auth untuk memastikan request `/admin` unauthenticated menerima HTTP 307 ke `/admin/login`.
3. **`src/app/admin/desktop/AdminMenuBar.tsx`**:
   - Tombol `"Template Hub (2 Template)"` pada header menu bar admin dihapus bersih tanpa jejak.
4. **`src/app/admin/components/ClientAdminLayout.tsx`**:
   - Menghapus state dan logika render khusus template sub-page `isTemplatePage`.
5. **`next.config.mjs`**:
   - Menambahkan aturan redirect HTTP 307 permanen untuk `/admin/templates` dan `/admin/templates/:path*` langsung ke `/admin`.
6. **`src/crud/templates/registry.ts`**:
   - Memperbarui registry template: seluruh properti `adminPath` kini menunjuk langsung ke modul resmi desktop (`/admin/projects`, `/admin/content/profile`, dll.).
7. **Pembersihan Berkas Redundant**:
   - Menghapus folder `src/app/admin/templates/` (beserta `os-desktop/` dan `infinite-canvas/`).

### B. Penyatuan Penuh Template Infinite Canvas (Opsi 1)
8. **`src/components/templates/infinite-canvas/CanvasProfile.tsx`**:
   - Menampilkan kartu profil elegan di posisi tengah `(0, 0)` dengan avatar, nama, bio, peran, statistik proyek & skill, serta status availability.
9. **`src/components/templates/infinite-canvas/CanvasProject.tsx`**:
   - Menampilkan galeri kartu proyek di kluster kanan atas dengan tag kategori, tech stack pills, efek hover glow, dan pemicu modal detail.
10. **`src/components/templates/infinite-canvas/CanvasProjectModal.tsx`**:
    - Modal popup interaktif saat kartu proyek diklik, dilengkapi penanganan aman gambar rusak (*broken image fallback* `imgError`).
11. **`src/components/templates/infinite-canvas/CanvasSkills.tsx`**:
    - Menampilkan kluster keahlian di kiri atas dengan kelompok kategori (Core, Frontend, Tools, dll.) dan tingkat kemahiran (level).
12. **`src/components/templates/infinite-canvas/CanvasExperience.tsx`**:
    - Menampilkan timeline riwayat karir/pengalaman kerja di kiri bawah dengan tanggal periode, perusahaan, dan deskripsi tanggung jawab.
13. **`src/components/templates/infinite-canvas/CanvasContact.tsx`**:
    - Menampilkan kluster kontak dan saluran sosial di kanan bawah dengan tombol direct WhatsApp, email, dan link profil.
14. **`src/components/templates/infinite-canvas/CanvasNavigator.tsx`**:
    - Heads-Up Display (HUD) navigasi di pojok kanan bawah dengan mini-map kompas dan tombol lompat instan (*Quick Jump*) ke kluster mana pun.
15. **`src/components/templates/infinite-canvas/useCanvasControls.ts`**:
    - Hook interaksi kontrol gesture: pan (drag mouse), zoom (wheel kursor & tombol +/-), pinch, dan reset pandangan.
16. **`src/components/templates/infinite-canvas/InfiniteCanvasRenderer.tsx` & `index.ts`**:
    - Integrasi seluruh kluster di atas canvas tanpa batas dengan grid latar belakang dinamis yang merespons posisi pan/zoom.
17. **`src/app/[siteSlug]/page.tsx` & `src/lib/adapters/siteDataAdapter.ts`**:
    - Adaptasi rendering template dinamis berbasis `active_template_key` (`os-desktop` atau `infinite-canvas`).

### C. 1-Click Zero-Terminal Visual Onboarding & Custom Domain Manager
18. **`BUAT_KLIEN_BARU.bat`**:
    - File batch launcher di root proyek. Cukup didobel-klik di Windows Explorer untuk menyalakan server onboarding dan membuka browser.
19. **`scripts/onboarding/server.ts`**:
    - Server API lokal (port 4567) yang menjalankan automasi terisolasi:
      - Validasi input & normalisasi slug unik klien.
      - Otomasi pembuatan Cloudflare D1 (`db-<slug>`) dan R2 (`media-<slug>`).
      - Menjalankan migrasi D1 schema otomatis (`migrations/0001_initial_schema.sql` dan `0002_add_app_kv.sql`).
      - Menyimpan catatan arsip terisolasi di `arsip-klien/<nomor>_<slug>/config.env` dan `SURAT_SERAH_TERIMA.txt`.
      - **Fitur Baru:** Endpoint `GET /api/clients` membaca seluruh arsip klien di laptop.
      - **Fitur Baru:** Endpoint `POST /api/custom-domain` menghubungkan domain baru klien ke Cloudflare Pages lewat API v4 resmi menggunakan token yang tersimpan di laptop, serta menyinkronkan `config.env` dan dokumen serah terima.
      - **Fitur Baru:** Endpoint `POST /api/custom-domain/status` untuk pengecekan status verifikasi domain.
20. **`scripts/onboarding/public/index.html`**:
    - Antarmuka web lokal bergaya **clean minimalis, light-mode, nol emoji, dan bebas efek glow/AI-slop**.
    - Dilengkapi sistem tab navigasi: **"Pendaftaran Klien Baru"** dan **"Kelola Custom Domain"**.
    - Dropdown klien dinamis dari arsip laptop, form input domain cepat, instruksi 1-baris CNAME, dan tombol salin pesan WhatsApp otomatis.
21. **`package.json`**:
    - Menambahkan script `"client:new": "npx tsx scripts/onboarding/server.ts"`.
22. **`.gitignore`**:
    - Menambahkan folder `arsip-klien/` ke `.gitignore` untuk melindungi data pribadi dan token klien dari kebocoran commit Git.


### D. Dokumentasi & Panduan
23. **`panduan/PANDUAN_UNTUK_KAMU_OWNER.md`**:
    - Memperbarui Langkah 2 menjadi instruksi 1-klik `BUAT_KLIEN_BARU.bat` tanpa terminal.
    - Menjelaskan jaminan isolasi database dan struktur arsip klien.
24. **`panduan/PANDUAN_UNTUK_KLIEN.md`**:
    - Menyempurnakan penjelasan satu pusat data CRUD desktop untuk kedua tema visual.
25. **`docs/tracker/INDEX_TRACKER.md`**:
    - Memperbarui entri Sprint 78 dengan ringkasan komprehensif.

---

## 🧪 Verifikasi & Kualitas Kode
- **Unit Tests:** 109 test files / 818 tests PASS (`npm test`).
- **TypeScript:** `npx tsc --noEmit` PASS (0 errors).
- **ESLint:** `npm run lint` PASS (0 errors).
- **Onboarding Server:** `GET http://localhost:4567` return HTTP 200.
- **Preview Endpoints:** `GET /preview/infinite-canvas` & `GET /preview/os-desktop` return HTTP 200.
- **Isolasi Data:** Terverifikasi 100% terpisah per klien (1 Cloudflare Account = 1 D1 + 1 R2 + 1 folder arsip terisolasi).

