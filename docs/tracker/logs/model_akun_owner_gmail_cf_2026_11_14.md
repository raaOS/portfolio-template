# Model Akun Final: Gmail + Cloudflare Dibuat Owner, Klien Hanya Aktivasi R2 (v1.3.86, 2026-11-14)

## Latar Belakang

Cacat audit #5 (2026-11-13): tiga versi "siapa punya akun Cloudflare" — T&C §5 bilang pembeli menyerahkan Account ID + API Token sendiri, `/cara-pesan` bilang "kalau belum punya kami bantu buatkan", kenyataan bengkel membuat akun atas Gmail pembeli. Owner memutuskan FINAL 2026-11-14 (dicatat permanen supaya AI tidak bertanya ulang):

- **Owner sendiri** membuat akun Gmail dan akun Cloudflare klien, dan **owner sendiri** menjalankan build + deploy.
- Klien TIDAK membuat akun apa pun, TIDAK menyerahkan Account ID/API Token.
- Satu-satunya langkah wajib klien: **aktivasi R2 sendiri** via wizard `?onboard=<token>` — verifikasi R2 Cloudflare butuh kartu kredit/debit/PayPal atas nama klien, dan owner melarang kartu owner dipakai di akun klien. Deploy "setengah jadi" (site online tanpa media sampai klien aktivasi) = **by design**, konsisten dengan Deferred R2 Mode (v1.3.78).

## Yang Dikerjakan

### 1. Nomor WhatsApp owner diisi di produksi

- Script baru `scripts/cloudflare/set-owner-whatsapp.ts` (upsert `platform_settings.owner_whatsapp`, JSON `{number, updatedAt}`, normalisasi 08xx → 62xxx, verifikasi baca balik; tanpa argumen = tampilkan nilai saat ini).
- Dijalankan: `npx tsx scripts/cloudflare/set-owner-whatsapp.ts 08817472310` → terpasang `628817472310`, **terverifikasi baca balik dari D1 produksi**. Tanpa deploy — `getOwnerWhatsapp` membaca runtime (cache 60 detik). Tombol "Chat Admin", "Bantuan WA (Terlanjur Bayar)", dan wizard R2 tidak lagi jatuh ke nomor contoh `628123456789`.
- **Nomor ini SEMENTARA** — owner akan mengganti suatu saat. Cara ganti: jalankan ulang script itu dengan nomor baru. Jangan hardcode nomor di kode/dokumen lain.

### 2. T&C §5 diselaraskan dengan kenyataan

`src/app/syarat-ketentuan/page.tsx`:

- §1 "Tentang layanan": "deployment ke Cloudflare di atas akun Cloudflare milik Anda" → akun email + Cloudflare **dibuatkan dan dirawat studio**.
- §5 bullet pertama dihapus klaim "pembeli menyerahkan Account ID & API Token" → "Setup awal kami urus sepenuhnya… Anda tidak perlu membuat akun Cloudflare sendiri."
- §5 bullet baru (jujur soal R2): verifikasi kartu/debit/PayPal atas nama klien **wajib** diselesaikan klien sendiri (kami tidak bisa menyediakan metode pembayaran di akun Anda), dipandu via tautan khusus; website tetap online tanpa R2, hanya unggah media yang tertunda.

### 3. `/cara-pesan` diselaraskan

`src/app/(storefront)/cara-pesan/page.tsx`:

- Langkah "Onboarding akun Cloudflare": tidak lagi "di akun Cloudflare milikmu" → "kami yang membuatkan email dan akun Cloudflare… satu-satunya langkah wajib kamu: aktivasi R2 (butuh kartu/PayPal milikmu), kami pandu lewat tautan khusus."
- Daftar persiapan: "Akun Cloudflare (gratis). Kalau belum punya, kami bantu buatkan." → "Tidak perlu membuat akun Cloudflare sendiri — kami yang buatkan saat onboarding."; baris kartu/PayPal diperjelas "atas namamu — hanya untuk verifikasi R2".

### 4. Dokumentasi permanen (agar AI tidak bertanya ulang)

- `AGENTS.md` — dua bullet baru di **Keputusan Produk Terkunci**: model akun (owner buat Gmail+CF, klien hanya aktivasi R2) + aturan nomor WA owner (script CLI, runtime, jangan hardcode).
- `docs/agent-context/09_PRODUCT_BOUNDARY_CONTEXT.md` — subseksi baru "Model Akun Cloudflare Klien (Keputusan Owner 2026-11-14 — FINAL)".

## Verifikasi

- Nomor WA: dijalankan + terverifikasi baca balik dari D1 produksi (`628817472310`).
- `npx tsc --noEmit` 0 error; `npm run lint` bersih; suite penuh PASS.
- Deploy produksi: `/api/health` `version: "1.3.86"`.

## File Dimodifikasi

- `src/app/syarat-ketentuan/page.tsx`, `src/app/(storefront)/cara-pesan/page.tsx`
- `scripts/cloudflare/set-owner-whatsapp.ts` (baru)
- `src/lib/constants.ts` (APP_VERSION 1.3.86), `CHANGELOG.md`
- `AGENTS.md`, `docs/agent-context/09_PRODUCT_BOUNDARY_CONTEXT.md`
- `docs/tracker/INDEX_TRACKER.md` (#189)

## Bug yang Diperbaiki

1. Cacat audit #5: T&C menuntut pembeli menyerahkan akun Cloudflare padahal kenyataannya studio membuatkan — kontrak kini sama dengan kenyataan.
2. `adminWhatsapp` produksi selalu fallback nomor contoh `628123456789` — kini nomor owner asli di `platform_settings` (blocker data dari v1.3.84 tutup).

## Belum Ditutup

- Nomor WA sementara — owner ganti suatu saat via `set-owner-whatsapp.ts`.
- Sisa cacat audit 2026-11-13: #8 bukti bayar post-expired, #9 janji waktu & jendela refund T&C.
