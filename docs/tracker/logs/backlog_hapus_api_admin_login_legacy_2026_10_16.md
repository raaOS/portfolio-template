# Backlog: Hapus Jalur Login Legacy `/api/admin/login` (Identitas Operator) — JANGAN Dihapus Tanpa Migrasi

**Tanggal keputusan:** 2026-10-16
**Status:** 📌 **BACKLOG — dibiarkan aktif atas keputusan owner.** Ini bukan dead code dan **tidak boleh dihapus tanpa migrasi 5 pemakai hidup** di bawah.
**Pemicu:** Owner bertanya apakah `makeitbetter.my.id/admin` vs `/admin/login` saling duplikat, lalu menindaklanjuti dengan: *"kalau aku pikir hapus duplikasinya… apa ada yang rusak nanti jika ada yang dihapus salah satunya?"*

## Keputusan Owner

> **Biarkan, catat sebagai backlog.**

Alasan yang disepakati: manfaat penghapusan kecil (jalur lama sudah dijaga rate limit + scrypt + audit + geolocation), sementara biayanya nyata (5 pemakai operasional harus dimigrasi) — dan penghapusan dilakukan **tepat setelah** login produksi distabilkan (hotfix v1.3.42), urutan kerja yang buruk.

## Temuan #1 — Ini BUKAN duplikat murni, melainkan dua IDENTITAS berbeda

Owner sempat mengira `/api/admin/login` = saudara kembar `/api/auth/login`. Setelah dibaca, keduanya melayani identitas berbeda:

| | `/api/auth/login` (dipakai form login) | `/api/admin/login` (legacy) |
|---|---|---|
| Identitas | **Klien pemilik site** — email + password dari tabel `site_users` (D1) | **Operator deployment** — satu password bawaan server (`ADMIN_PASSWORD_SCRYPT`) |
| Cookie diterbitkan | `site_user_token` (jose, 2h TTL) | `admin_token` — **penerbit tunggal/satu-satunya** |
| Fitur tambahan | — | `auditLogin` + geolocation + `parseUserAgent` |
| Pemanggil di frontend | `useAdminLogin.ts:71` | **Nol** — tidak ada kode frontend yang memanggilnya |

Jadi menghapus `/api/admin/login` = **menghapus identitas operator**, bukan membuang salinan.

## Temuan #2 — Siapa yang benar-benar memakainya (bukti grep, bukan dugaan)

Referensi di `src/` **hanya**: daftar publik middleware (`middleware/constants.ts:36`), pengecualian CSRF (`middleware/csrf.ts:71` + test-nya), komentar (`lib/security/constants.ts:14,24`; `api/auth/login/route.ts:21`), dan test miliknya sendiri (`api/admin/login/route.test.ts`).

**Pemakai hidup (5) — inilah yang akan PATAH kalau route dihapus begitu saja:**

| # | File | Peran |
|---|---|---|
| 1 | `tests/e2e/crud-flow.spec.ts:8,13` | Login E2E Playwright → **seluruh suite E2E merah** |
| 2 | `tests/e2e/admin-crud.spec.ts:16,21` | Login E2E Playwright → sama |
| 3 | `scripts/load/multi-buyer-load-test.js:529,541,564` | Uji beban owner (`refreshCsrf` + `POST`) |
| 4 | `scripts/load/cleanup-load-test-tenants.js:205,207,309` | Pembersihan data uji beban |
| 5 | `scripts/test/storage-stats-smoke.mjs:22,26` | Smoke cek status storage R2/D1 |

Kelimanya memakai dua hal dari route ini: **`GET /api/admin/login` sebagai bootstrap CSRF** dan **`POST /api/admin/login` sebagai login**.

## Temuan #3 — `admin_token` masih dibaca di 4 tempat (penerbitnya jangan dihapus dulu)

| File | Baris | Peran |
|---|---|---|
| `src/app/admin/page.tsx` | 12, 19-21 | Guard halaman: terima `site_user_token` **atau** fallback `admin_token`/`admin-token` |
| `src/app/admin/projects/explorer/page.tsx` | 17 | Pola guard sama |
| `src/lib/auth.ts` | 132-133 | `validateAdminRequest` → cek `checkAdminAuth` (legacy) dulu, baru fallback `site_user_token` |
| `src/app/api/admin/logout/route.ts` | 14 | Membersihkan `admin_token` |

Semua bersifat **fallback** (jalur modern tetap jalan tanpa `admin_token`), jadi penghapusan tidak akan mematikan login klien — tapi meninggalkan 4 pembaca yang merujuk cookie yang tak lagi pernah diterbitkan.

## Fakta penyelamat untuk migrasi (sudah terverifikasi)

Pengganti lengkap untuk keduanya **sudah ada** di jalur modern:

- **Bootstrap CSRF:** `GET /api/auth/check-auth` → `NextResponse.json({ …, csrfToken })` + set cookie CSRF (`src/app/api/auth/check-auth/route.ts:12-25`). Terbukti dipakai form login sendiri (`useAdminLogin.ts:52-58`).
- **Login:** `POST /api/auth/login` (sudah punya rate limit 3 percobaan/5 menit + blokir 30 menit, IP-only).
- **Logout:** `POST /api/auth/logout`.

Artinya migrasi adalah **penukaran dua URL**, bukan penulisan fitur baru.

## Checklist Migrasi (jalankan berurutan; JANGAN lompati)

1. **Alihkan 5 pemakai** di tabel Temuan #2 ke `GET /api/auth/check-auth` (csrfToken) + `POST /api/auth/login` (`site_user_token`). Verifikasi tiap script jalan sungguhan sebelum lanjut — jangan berasumsi.
2. **Hapus** `src/app/api/admin/login/route.ts` + `route.test.ts`.
3. **Bersihkan pembaca `admin_token`:** `src/app/admin/page.tsx:12,19-21`, `src/app/admin/projects/explorer/page.tsx:17`, jalur legacy di `src/lib/auth.ts:132-133` (pastikan `checkAdminAuth` tidak dipakai route lain), `src/app/api/admin/logout/route.ts:14` + test-nya (`logout/route.test.ts:65` memastikan cookie `admin_token=;` terhapus).
4. **Bersihkan middleware & dokumen:** `middleware/constants.ts:36` (`publicRoutes`), `middleware/csrf.ts:71` + `middleware/__tests__/csrf.test.ts:55`, baris tabel §3 AGENTS.md yang menyebut file itu, referensi di `lib/security/constants.ts:14,24` dan komentar `api/auth/login/route.ts:21`.
5. **Gerbang verifikasi (semua wajib hijau):** `tsc --noEmit` 0 error → `npm run lint` bersih → `npm test` seluruhnya hijau (nol test patah) → `npm run test:e2e` hijau → jalankan ulang `scripts/test/storage-stats-smoke.mjs` → deploy + smoke `/api/health` + login sungguhan.
6. **Catat di CHANGELOG + tracker** sebagai penghapusan permukaan keamanan, dengan alasan "dua identitas disatukan ke satu jalur site_user_token".

> Perkiraan: **±10 file**. Risiko terpusat pada tooling operasional (E2E + script owner), **bukan** halaman klien.

## Konteks Tambahan untuk AI Berikutnya

- **Jangan pernah menghapus route ini "karena terlihat dobel"** hanya dengan membaca satu file. Buktinya: lima pemakai hidup di atas tidak terlihat dari dalam folder `src/app/api/admin/` (mereka ada di `tests/` dan `scripts/`). Pola ini sama dengan kasus `billing/qris.ts` (nyaris dihapus 2026-10-14, ternyata hidup) — selalu grep lintas `src/`, `tests/`, `scripts/`, `docs/`.
- Terkait tapi terpisah: `src/app/api/admin/password/route.ts` (ubah password legacy via `validateAdminRequest` + `verifyAdminPassword`) adalah **permukaan legacy serupa** yang tidak ikut dalam keputusan ini — audit terpisah diperlukan sebelum menyentuhnya.
- Terkait tapi terpisah: pola `schemaPromise` (poison-on-reject) yang sama dengan bug login v1.3.42 masih ada di `src/lib/cloudflareD1.ts:173` — lihat log `fix_login_admin_bootstrap_poison_2026_10_14.md`.
