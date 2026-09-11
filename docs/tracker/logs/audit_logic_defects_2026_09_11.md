# Tracker Log: Audit Logic Defect & Security Sweep (Auth, Rate Limit, Setup)

**Status:** 🟢 Completed
**Mulai:** 2026-09-11
**Selesai:** 2026-09-11

## 🎯 Tujuan (Objective)
- Mencari cacat logika nyata (bukan spekulasi) di lapisan auth, rate limiting, setup, dan dead code, lalu memperbaiki semuanya.

## 📋 Task List
- [x] Audit manual lapisan: `crud/shared/auth/*`, `middleware/*`, `lib/auth.ts`, `lib/dataRateLimit.ts`, `crud/shared/security/*`, `lib/database.ts`, `api/setup`, `api/auth/*`, `api/admin/login`.
- [x] Fix #1: Rate limit `/api/auth/login` (HIGH — brute force).
- [x] Fix #2: Prune D1 `rateLimits` + fail-closed saat CAS gagal commit (HIGH).
- [x] Fix #3: Fallback lokal menghormati blokir aktif setelah window habis (MEDIUM).
- [x] Fix #4: Atomic INSERT admin di `seedDeployment` — race setup 2 admin (MEDIUM).
- [x] Fix #5: `validateAdminRequest` cek `session.siteId === SITE_ID` (MEDIUM — escape lintas deployment).
- [x] Fix #6: `maybeRefreshToken` tidak default role ke `admin` (LOW).
- [x] Fix #7: Hapus dead code `crud/shared/security/rateLimit.ts` (LOW).
- [x] Fix #8: Hapus dead code `validateRequestWithCSRF` (LOW).
- [x] Verifikasi: tsc 0 error, eslint 0 error, 109 files / 821 tests PASS.
- [x] CHANGELOG v1.2.8.

## 📂 File yang Dimodifikasi (Modified Files)
- `src/app/api/auth/login/route.ts` -> Tambah rate limit 3 attempt/5 menit, blokir 30 menit, berbasis IP (D1-backed).
- `src/lib/dataRateLimit.ts` -> Transaksi kini pada level map `rateLimits` (CAS whole-row), prune entry kedaluwarsa saat >500 key, fail-closed bila `result.committed === false`, fallback lokal menghormati `blockedUntil` aktif.
- `src/crud/shared/db/seed.ts` -> INSERT admin memakai `INSERT ... WHERE NOT EXISTS (admin) RETURNING id`; cek admin by role, bukan by email.
- `src/app/api/setup/route.ts` -> Tolak setup bila kalah race (`adminCreated === false`).
- `src/lib/auth.ts` -> `validateAdminRequest` kini mensyaratkan `session.siteId === SITE_ID && session.role === 'admin'`.
- `src/middleware/customer-auth.ts` -> `maybeRefreshToken` menolak refresh token tanpa claim `role`; tidak lagi default `'admin'`.
- `src/crud/shared/security/rateLimit.ts` -> DIHAPUS (dead code, logika block bohong).
- `src/crud/shared/security/index.ts` -> Hapus re-export `checkRateLimit`.
- `src/crud/shared/auth/login.ts` -> Hapus `validateRequestWithCSRF` (selalu return null); bersihkan import.
- `CHANGELOG.md` -> Entri versi 1.2.8.

## 🐛 Bug & Perbaikan (Bug Tracker)
- **Bug 1 (HIGH):** `/api/auth/login` (login customer managed service) tanpa rate limit → brute force password admin tanpa batas.
  - **Penyebab:** Rate limiting dipindah ke level handler (lihat `middleware/constants.ts`), tapi handler ini tak pernah memanggil `checkDataRateLimit`.
  - **Perbaikan:** Route kini memanggil `checkDataRateLimit('login_<ip>', 3, 5m, 30m)` dengan 429 + Retry-After.
- **Bug 2 (HIGH):** Row D1 `rateLimits` tumbuh permanen (key `ip|userAgent` tak terbatas) tanpa pernah di-prune; tiap check baca/tulis seluruh row. Selain itu, bila CAS gagal 3x, `decision` dari callback terakhir dipakai padahal attempt tak tercatat.
  - **Penyebab:** `cleanupExpiredEntries` hanya jalan di fallback lokal; return value `transaction()` (`committed`) diabaikan.
  - **Perbaikan:** Transaksi pindah ke `db.ref('rateLimits')` (level map) + `prunePersistedEntries` (max 500 key, selalu keep key aktif); bila `!result.committed` → return blocked (fail-closed).
- **Bug 3 (MEDIUM):** Fallback lokal: `now > resetAt` dievaluasi sebelum check `blockedUntil` → blokir 30 menit ter-reset saat window 5 menit habis.
  - **Penyebab:** Urutan kondisi di `checkLocalRateLimit`.
  - **Perbaikan:** Cek `blockedUntil` aktif lebih dulu sebelum reset window.
- **Bug 4 (MEDIUM):** TOCTOU di `/api/setup` — dua POST bersamaan bisa membuat 2 user admin (unique index hanya per email, tidak mencegah email berbeda).
  - **Penyebab:** Check-then-insert non-atomik di `seedDeployment`.
  - **Perbaikan:** `INSERT ... SELECT ... WHERE NOT EXISTS (SELECT 1 FROM site_users WHERE site_id=? AND role='admin') RETURNING id`; route menolak hasil race.
- **Bug 5 (MEDIUM):** `validateAdminRequest` menerima token customer `site_user_token` dari site mana pun (hanya cek `role`), sedangkan `siteMutationAuth` cek `siteId`. Dengan `JWT_SECRET` sama antar deployment, token admin customer A valid di deployment B.
  - **Penyebab:** SiteId tidak diverifikasi di jalur fallback sesi customer.
  - **Perbaikan:** Tambah syarat `session.siteId === SITE_ID` (mirror `siteMutationAuth`).
- **Bug 6 (LOW):** `maybeRefreshToken` me-refresh token tanpa claim role menjadi `role: 'admin'`.
  - **Perbaikan:** Bila `payload.role` kosong, tolak refresh.
- **Bug 7 (LOW):** `crud/shared/security/rateLimit.ts` dead code dengan logika `blockSeconds` yang diabaikan.
  - **Perbaikan:** File dihapus; re-export dibersihkan. (`checkRateLimit` yang dipakai app/test adalah versi `src/lib/security/rate-limit.ts`, tidak terdampak.)
- **Bug 8 (LOW):** `validateRequestWithCSRF` selalu return `null` di semua cabang — menyesatkan pemanggil.
  - **Perbaikan:** Fungsi dihapus (tidak pernah dipanggil).

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)
- Verifikasi penuh: `npx tsc --noEmit` 0 error, `npm run lint` bersih, `npm test` 109 files / 821 tests PASS (2026-09-11).
- `transaksi db.ref('rateLimits')` kini di level map — CAS whole-row; jangan turunkan kembali ke level per-key karena prune butuh atomicity dengan increment attempt.
- Deploy lintas customer: pastikan `JWT_SECRET` unik per deployment. Fix #5 menutup celah token lintas-site, tapi secret unik tetap best practice.
- Unit test `src/lib/__tests__/security.test.ts` memakai `checkRateLimit` dari `lib/security` (bukan crud) — tidak ada referensi ke file yang dihapus.
