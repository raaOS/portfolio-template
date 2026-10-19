# Fitur Lupa Password — Tautan Reset Lewat Email + Pencabutan Sesi Login Lama (v1.3.45)

**Tanggal:** 2026-10-19
**Status:** ✅ Selesai & LIVE (`/api/health` = **1.3.45**, Version ID `6fe849bc-b0b4-498f-8d3a-38bcf421aac1`); email reset sungguhan sudah terkirim ke inbox owner dan token terverifikasi ter-hash di produksi.
**Pemicu:** Owner bertanya *"apa client gak bisa ganti password sendiri?"* → ternyata ganti-password mandiri SUDAH bisa, tapi **lupa password** belum ada; owner mengajukan alur OTP-dulu-baru-link, minta direvisi bila ada cacat logika.

## Hasil review alur yang diajukan owner (dan revisinya)

Alur diajukan: klik lupa password → OTP ke email → masukkan OTP → baru kirim link reset → klik → ganti password.
**Verdict: aman tapi REDUNDAN** — OTP via email dan link via email membuktikan hal yang SAMA (pemilik kotak masuk): 2 email, 3 langkah, bukti identik, keamanan tidak bertambah. Website lain (Gmail/GitHub/Tokopedia) kirim **1 email link**. Owner memilih: **link saja**, cakupan **fitur reset saja** (orderService tidak disentuh), **site owner dulu** (klien dapat pesan "belum aktif — hubungi owner").

## 7 cacat logika dari review → semuanya ditangani

1. **Email-enumeration** → respons layar IDENTIK semua kasus: *"Jika email terdaftar, tautan sudah dikirim…"* (`forgot-password/route.ts`); kegagalan internal juga dibungkus jadi 200 generik.
2. **Token lemah** → acak 32 byte (`crypto.randomBytes`), disimpan **ter-hash SHA-256** di `app_kv.passwordResets` (bukti live: kunci = 64 hex, teks mentah tidak pernah tersimpan), kadaluarsa **30 menit**, **sekali pakai** lewat transaksi CAS, permintaan baru membatalkan token lama milik user sama.
3. **Email-bombing / pemborosan kuota Resend** → rate-limit `resetpwd_<ip>` 3 kirim/10 menit, blokir 60 menit; tebak token `resetpwd_try_<ip>` 5/10 menit, blokir 30 menit.
4. **Sesi lama tetap hidup setelah password diganti (celah nyata)** → JWT stateless 2 jam tak bisa dicabut dari server. Kini setiap ganti password (reset **maupun** ganti mandiri `changePassword.ts`) menulis tanda `securityNotBefore` (app_kv); `getSiteUserSession` menolak sesi terbit sebelum tanda (baca lewat cache 60 detik — tanpa menambah panggilan D1 per request; toleransi 5 detik anti salah-tolak login tepat-setelah-reset; fail-open terbatas agar login tidak ikut mati saat D1 sesat).
5. **Sliding-refresh bisa menghidupkan lagi sesi yang sudah dicabut (celah kritis, ditemukan saat implementasi)** → `maybeRefreshToken` di `middleware/customer-auth.ts` menerbitkan token baru dengan `iat` BARU → token hasil pencabutan bisa "diperpanjang" selamanya dan lolos guard. **Perbaikan 1 baris:** pertahankan `iat` ASLI saat memperpanjang (`setIssuedAt(payload.iat || nowSec)`).
6. **Provider email mati** → cek konfigurasi SEBELUM menyentuh data; 503 jujur *"Fitur … belum aktif. Hubungi owner Anda."* — global, tidak membocorkan apa pun. Deployment **klien otomatis dapat jalur ini** (kunci Resend tidak ikut pipeline deploy klien) — sesuai keputusan "site owner dulu", tanpa menyentuh pipeline.
7. **Route baru dimakan middleware** → didaftarkan di `publicRoutes` (`middleware/constants.ts`, termasuk2 halaman `/admin/lupa-password` & `/admin/reset-password`) + allowlist CSRF (`csrf.ts`). Jalur reset via owner (`reset-customer-password.ts`) TETAP ada sebagai fallback (email klien bisa salah ketik — belum pernah diverifikasi).

## File

**Baru:** `src/lib/services/passwordResetService.ts` (token+email+securityNotBefore; pola Resend disalin dari orderService — orderService tidak disentuh), `src/app/api/auth/{forgot-password,reset-password}/route.ts`, `src/app/admin/lupa-password/{page,LupaPasswordForm}.tsx`, `src/app/admin/reset-password/{page,ResetPasswordForm}.tsx`, test: `passwordResetService.test.ts`, `guard.test.ts`, 2 route test.
**Diubah:** `guard.ts` (+`isSessionRevoked`, cek di `getSiteUserSession`), `session.ts` (+`issuedAt` di `SiteUserSession` & return `iat`), `changePassword.ts` (+`setSessionNotBefore`), `customer-auth.ts` (iat asli dipertahankan), `middleware/constants.ts`, `csrf.ts`, `LoginForm.tsx` (tautan "Lupa password?"), `login/page.tsx` (sesi tercabut tidak dianggap login), `constants.ts` (1.3.45), `CHANGELOG.md`.

## Verifikasi

- `tsc --noEmit` 0; `npm run lint` 0 masalah; `npm test` **138 file / 1.107 test PASS** (+4 file, +30 test baru; nol patah). Pre-commit audit lolos. Commit `cedf6e4` → `origin/main`.
- **Uji hidup produksi (2026-10-19):** `/admin/lupa-password` & `/admin/reset-password` → 200; token ngawur → 400 *"Minta tautan baru"*; email pemilik → **200 generik + email sungguhan terkirim**; baris `app_kv.passwordResets` terverifikasi: kunci = hash SHA-256 64 hex, milik `user-1788710124625-ok5awf`, sisa 29,5 menit.
- **Catatan alat uji:** 2 probe pertama via `curl.exe -d` dari PowerShell rusak tanda kutipnya → badan JSON tak terbaca → server balas 400 "Email wajib diisi" (perilaku benar; jangan ulangi kesalahan escaping ini — pakai `Invoke-WebRequest -Body`). Probe itu memakan 2 dari 3 jatah rate-limit window-nya owner; permintaan email asli memakai jatah ke-3 — window habis, tidak ada blokir.

## Tindak lanjut owner

- Cek inbox (& spam) email *"Atur Ulang Password Admin"* → klik tautan (30 menit) → buat password baru → login. Semua sesi lama otomatis mati.
- Untuk klien kelak: siapkan kunci `NOTIFICATION_*` di `config.env` per klien bila fitur ingin diaktifkan di deployment mereka (keputusan terpisah).

## Catatan untuk AI berikutnya

- Jangan pernah menampilkan pesan berbeda untuk email terdaftar vs tidak di jalur publik mana pun (enumeration).
- `securityNotBefore` = satu-satunya mekanisme pencabutan sesi; jika kelak ada endpoint logout-semua-device, tulis tanda yang sama untuk semua user.
- Sliding refresh WAJIB mempertahankan `iat` asli — kembalikan ke `nowSec` = membuka kembali celah #5.

---

## Audit Ulang (v1.3.46, 2026-10-19) � permintaan owner "cek lagi cacat logika"

Audit ulang menyeluruh dengan membaca ulang kode terpasang (guard, session, middleware, kedua route, service, halaman admin). **3 cacat NYATA ditemukan & diperbaiki**, beberapa risiko ditinjau dan diterima:

### Diperbaiki (semua teruji, suite 138 file / 1.110 test PASS)

1. **Tautan mati bisa terkirim lewat email** � `storeResetToken` mengabaikan hasil transaksi; `database.ts:272` bisa mengembalikan `committed:false` (CAS sibuk, 3 kali gagal-saing) ? token tidak pernah tersimpan padahal dikembalikan untuk di-email. **Fix:** cek `result.committed`; gagal ? return null ? `requestPasswordReset` tidak mengirim email (log error, respons generik tetap 200). Test baru: CAS gagal ? email tidak dikirim.
2. **Dua halaman admin lolos pencabutan sesi** � `src/app/admin/page.tsx` & `src/app/admin/projects/explorer/page.tsx` memanggil `verifySiteUserJWT` **langsung** tanpa `isSessionRevoked` (hanya `guard.ts` + `login/page.tsx` yang sudah benar; `check-auth` lewat guard juga benar) ? sesi tercabut masih me-render kerangka dashboard. **Fix:** kedua halaman kini cek `isSessionRevoked` (3 baris tiap halaman).
3. **Ganti password sendiri = langsung logout (regresi UX)** � `setSessionNotBefore` di `changePassword.ts` menangkap SEMUA sesi lama termasuk pelaku; sebelum v1.3.45 pemilik tetap login setelah sukses. **Fix:** `POST /api/auth/change-password` menerbitkan **cookie segar** (`signSiteUserJWT` + `AUTH_COOKIE_NAME`/`AUTH_COOKIE_OPTIONS`) setelah sukses � pelaku lanjut mulus, sesi LAIN tetap mati (iat token baru = tanda pencabutan ? lolos guard). Test baru: sukses ? cookie segar; gagal ? tanpa cookie.

### Ditinjau & DITERIMA (dicatat, tanpa perbaikan)

- **Sisi-waktu (timing) forgot-password:** email terdaftar = SELECT+transaksi+fetch lebih berat dari cabang awal. Rate-limit 3/10 menit membuat sampling statistik tidak praktis ? risiko rendah diterima (industri juga umum begini).
- **Token tanpa klaim `iat` dianggap tidak tercabut** (`isSessionRevoked`: `issuedAt === undefined ? false`) � token selalu terbit dengan iat; memalsukan butuh `JWT_SECRET`.
- **Jendela =60 detik** akibat cache per-isolat `securityNotBefore` � by design, sudah didokumentasi.

### Backlog (belum dikerjakan)

- **`scripts/cloudflare/reset-customer-password.ts` tidak menulis `securityNotBefore`** � reset password via jalur owner (script) tidak mencabut sesi lama korban (jendela maksimum = sisa TTL cookie 2 jam). Perlu penulisan baris `app_kv.securityNotBefore` dari script bila owner ingin jalur ini juga mencabut sesi.

### File yang diubah pada audit ini (v1.3.46)

- `src/lib/services/passwordResetService.ts` � `storeResetToken` cek `committed`, return `string | null`.
- `src/app/admin/page.tsx`, `src/app/admin/projects/explorer/page.tsx` � cek `isSessionRevoked`.
- `src/app/api/auth/change-password/route.ts` � terbitkan cookie segar setelah sukses.
- `src/app/api/auth/change-password/route.test.ts` � mock modul sesi + 2 test baru.
- `src/lib/services/passwordResetService.test.ts` � sakelar `forceCasFail` + 1 test baru.
- `src/middleware/customer-auth.ts` � anotasi tipe `verifiedPayload` ikutkan `iat` (murni kejelasan).
- `src/lib/constants.ts` � APP_VERSION 1.3.46.
