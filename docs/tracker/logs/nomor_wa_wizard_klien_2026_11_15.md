# Nomor WA Owner di Wizard R2 Klien: Gladi Kosong → Terpasang + Env Onboarding (2026-11-15)

## Latar Belakang

Owner melapor nomor WA-nya "belum dipasang". Verifikasi anti-halusinasi (angka, bukan asumsi):

- **D1 owner** (`platform_settings.owner_whatsapp`): sudah berisi `{"number":"628817472310","updatedAt":"2026-11-13T17:15:22Z"}` — terpasang sejak v1.3.86.
- **Endpoint live site owner** `GET /api/billing/payment-info`: mengembalikan `"adminWhatsapp":"628817472310"` — halaman order pembeli di site owner SUDAH memakai nomor asli.
- **D1 klien gladi** (`01_gladi-2026-10-24`): `owner_whatsapp` **belum diisi** → tombol "Kabari Owner via WA" di wizard R2 gladi kosong. Inilah kemungkinan besar yang dilihat owner.

Akar masalah: wizard R2 berjalan di deployment klien dan membaca `platform_settings` milik **D1 klien** (bukan D1 owner). Nilai itu hanya ditanam saat onboarding bila `ADMIN_WHATSAPP`/`NEXT_PUBLIC_ADMIN_WA` ada di `.env.local` owner (`scripts/onboarding/server.ts:500-516`) — dan keduanya tidak pernah di-set, plus gladi di-onboard sebelum nomor tercatat di mana pun.

## Yang Dikerjakan

1. **`scripts/cloudflare/set-owner-whatsapp.ts`** — mode baru `--client <folder-arsip>`: membaca kredensial D1 klien dari `arsip-klien/<folder>/config.env` (CLOUDFLARE_ACCOUNT_ID / API_TOKEN / D1_DATABASE_ID), override env proses lalu upsert + verifikasi baca balik. Tanpa nomor = tampilkan nilai saat ini (read-only). Dokumentasi header diupdate (kenapa mode klien ada).
2. **Nomor dipasang ke D1 gladi**: `npx tsx scripts/cloudflare/set-owner-whatsapp.ts 08817472310 --client 01_gladi-2026-10-24` → `✓ terpasang … (terverifikasi baca balik)`. Tombol WA wizard gladi kini hidup — tanpa deploy (dibaca runtime D1).
3. **`.env.local` owner** — `ADMIN_WHATSAPP="628817472310"` ditambahkan (file gitignored, tidak ter-commit) → onboarding klien BERIKUTNYA otomatis menanam nomor ke D1 klien.
4. **`.env.example`** — kunci `ADMIN_WHATSAPP` didokumentasikan (owner-side, format 628xx, cara ganti).
5. Read-only check sebelum tulis: gladi memang kosong (bukti di atas).

## Verifikasi

- D1 gladi read-only SEBELUM: `owner_whatsapp belum diisi` → SESUDAH tulis: terverifikasi baca balik `628817472310`.
- D1 owner + endpoint live payment-info tetap benar (tidak disentuh, dicheck ulang).
- `npx tsc --noEmit` 0 error, `npm run lint` bersih.

## File Dimodifikasi

- `scripts/cloudflare/set-owner-whatsapp.ts` (mode --client)
- `.env.example` (dokumentasi ADMIN_WHATSAPP)
- `.env.local` (data owner, tidak ter-commit)
- `docs/tracker/INDEX_TRACKER.md` (#191)

## Bug yang Diperbaiki

1. Tombol "Kabari Owner via WA" di wizard R2 klien yang di-onboard tanpa `ADMIN_WHATSAPP` kosong diam-diam (gladi) — kini terisi; klien baru otomatis benar lewat env.

## Catatan Operasional (untuk owner)

- Ganti nomor WA suatu saat: jalankan untuk D1 owner **dan setiap arsip klien aktif**:
  `npx tsx scripts/cloudflare/set-owner-whatsapp.ts <nomor-baru>`
  `npx tsx scripts/cloudflare/set-owner-whatsapp.ts <nomor-baru> --client <folder-arsip>`
  (jangan lupa update `ADMIN_WHATSAPP` di `.env.local` juga) — tanpa deploy.
