# Perbaikan Login: Login Sukses Kini Mengembalikan Saldo Percobaan Rate-Limit (v1.3.44)

**Tanggal:** 2026-10-16
**Status:** ✅ Selesai & LIVE (`/api/health` = **1.3.44**, Version ID `d3b604e0-2f9a-476f-888d-f41269a8359e`); IP pemilik sudah dibersihkan dari blokir uji.
**Pemicu:** Keluhan owner: *"masa pas ganti password lama ke baru berhasil, klik logout, coba masuk kembali malah ada notif 'Terlalu banyak percobaan login'… dan ketika masih pakai password lama ada notif kesalahan database harus tunggu dulu baru bisa login."*

## Bukti dari produksi (bukan tebakan — baris `app_kv.rateLimits` dibaca langsung)

| Key | Isi saat dibaca (00:54 WIB, 16 Okt) |
|---|---|
| `login_114_12_6_45` (IP pemilik) | `attempts=3`, **BLOKIR s/d 00:50:47 WIB** |
| `chpwd_114_12_6_45_user-…` | `attempts=1` → ganti password sukses ±00:19:48 WIB |

Garis waktu pemilik (seluruh rangkaian hanya ±3 menit): login tercatat ~00:17:46 → ganti password sukses ~00:19:48 → logout → coba login lagi + 1–2 kali coba password lama → **00:20:47 permintaan ke-4 memicu blokir 30 menit** → mencoba lagi 00:49:55 (masih diblokir, jejak terakhir di baris) → blokir berakhir 00:50:47. Tepat sesuai keluhan "gak masuk akal".

> Catatan: IP pemilik berputar (`114.12.6.58` kemarin → `114.12.6.45` hari ini, jaringan seluler). Key rate-limit mengikuti IP, jadi pergantian IP justru "menyelamatkan" tanpa disadari — dan di IP yang sama, penguncian terasa sewenang-wenang.

## Tiga cacat yang ditemukan (dicek berulang di kode)

1. **Login SUKSES ikut dihitung dan tidak pernah di-reset.** `POST /api/auth/login` memanggil `checkDataRateLimit` (mode catat) **sebelum** password diperiksa; jalur sukses hanya `createLoginResponse` — pencarian `resetDataRateLimit|clearDataRateLimit` di seluruh `src/` = **nol kemunculan**. Jadi "3 percobaan / 5 menit" = "3 kali menekan tombol login apa pun hasilnya". Alur normal (login → ganti password → uji login baru) = 2 slot terpakai; satu kali coba password lama → blokir 30 menit.
2. **Pesan 500 menyesatkan.** `useAdminLogin.ts` menerjemahkan semua 500 jadi *"⚠️ Backend Error: Masalah koneksi database (Internal Server Error). Pastikan server stabil."* Route membalas 500 untuk segala exception setelah rate limit lolos (badan JSON tidak valid, kegagalan sesaat REST D1 saat SELECT/UPDATE, dsb.).
3. **Dua situasi 429 tampil identik.** "Diblokir 30 menit" vs "transaksi pencatatan gagal menulis ke D1, coba lagi 60 detik" (fail-closed `dataRateLimit.ts:196-208`) sama-sama *"Terlalu banyak percobaan login. Coba lagi nanti."* — `retryAfter` dikirim API tapi tidak pernah ditampilkan.

## Perbaikan (disetujui owner: "Perbaiki ketiganya")

1. `src/lib/dataRateLimit.ts` — **`resetDataRateLimit(key)` baru**: menghapus catatan satu key via transaksi CAS `db.ref('rateLimits')` (best-effort; kembalikan `undefined` dari callback = batal tanpa menulis).
2. `src/app/api/auth/login/route.ts` — reset dipanggil **hanya saat `authenticateUser` sukses** (dibungkus `try/catch`: kegagalan reset tidak boleh menggagalkan login sah). Pesan 429 kini menyebut lamanya: *"Coba lagi dalam ±X menit"* (dibulatkan ke atas, minimum 1 menit). Pesan 500 diringkas: *"Layanan login sedang bermasalah. Coba lagi beberapa saat."*
3. `src/app/admin/login/_hooks/useAdminLogin.ts` — pesan 500 layar → *"Layanan login sedang bermasalah di sisi server. Coba lagi beberapa saat lagi."* (berhenti menuduh "database" dan menyuruh pengguna "membuat server stabil").
4. `src/crud/shared/auth/login.ts` — UPDATE `last_login_at` dan upgrade hash password (sha256→scrypt) jadi **best-effort** (`try/catch` + `console.error`): tulisan audit sampingan tidak boleh menggagalkan login yang passwordnya benar.
5. `src/app/api/auth/login/route.test.ts` — **test baru (route ini sebelumnya NOL test)**: 6 kasus — 429 menyebut lamanya waktu; retryAfter 60 dtk → "±1 menit"; 401 tidak mereset counter; sukses mereset dengan key yang benar (`login_<ip>`); reset gagal tetap sukses login; 500 tidak menyebut "database".
6. `src/lib/constants.ts` — `APP_VERSION` → **1.3.44**; CHANGELOG 1.3.44 ditulis (penjaga `constants.test.ts` memaksa sinkron).

**Hasil perilaku:** perdasar tetap terhambat (3 kegagalan berturut-turut → blokir 30 menit); pemilik yang login sukses langsung kembali dengan saldo penuh — alur "ganti password lalu uji login" tidak bisa mengunci dirinya sendiri lagi.

## Verifikasi

- `tsc --noEmit` 0 error; `npm run lint` bersih; `npm test` **134 file / 1.077 test PASS** (+6 test baru; nol patah). Pre-commit + pre-push audit lolos. Commit `d51a75f` → `origin/main`.
- **Deploy sukses**, Version ID `d3b604e0-2f9a-476f-888d-f41269a8359e`.
- **Uji hidup pasca-deploy (semua dari IP pemilik):**
  - Probe dengan badan JSON TIDAK valid (kesalahan escaping pada perintah uji) → **500 dengan pesan baru** — mereproduksi persis keluhan "kesalahan database" pemilik: kekacauan badan request apa pun dulu tampil sebagai "Masalah koneksi database". (Root cause 500 pemilik sendiri di ±00:20 tidak bisa dipulihkan dari log — `wrangler tail` hanya streaming; kini jalur itu sudah dicatat + pesan sudah jujur + tulisan audit tak lagi mematikan login.)
  - Percobaan berikutnya hingga jatah habis → **429 dengan pesan BARU**: *"Terlalu banyak percobaan login. Coba lagi dalam ±30 menit."* + header `Retry-After: 1800` — format durasi terbukti live.
  - **Konsekuensi uji & mitigasi:** probe menghabiskan kuota IP yang sama dengan pemilik → IP terkunci 28 menit; segera dibersihkan dengan `json_remove` (sesuai presedensi persetujuan pemilik 2026-10-14/15): `login_114_12_6_45` **terverifikasi hilang**, JSON valid, key `chpwd_` pemilik utuh.

## Tindak lanjut untuk pemilik

- **Silakan login sekarang** (`makeitbetter.my.id/admin`) — IP sudah bersih. Alur yang dulu mengunci: login → ganti password → logout → uji login baru, kini aman karena login sukses mereset hitungan.
- Verifikasi pasca-login (opsional, atas permintaan): baris `rateLimits` akan menunjukkan key `login_<ip>` hilang/bersih setelah login sukses — bukti reset bekerja di produksi, bukan hanya di test.

## Catatan untuk AI berikutnya

- Jangan pernah "memperbaiki" rate limit login dengan menghapus penghitungan kegagalan — yang diperbaiki adalah **reset saat sukses**, bukan penghapusan guard.
- `checkDataRateLimit` punya mode `record: false` (intip) untuk jalur checkout; login sengaja memakai mode catat + reset sukses.
- Pola serupa: `/api/auth/change-password` memakai key terpisah `chpwd_<ip>_<userId>` (5/5 mnt, blokir 15 mnt) — tidak terlibat insiden ini dan tidak perlu diubah.
