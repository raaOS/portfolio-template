# Sprint 35 - Mass Sale Readiness

Tanggal: 2026-07-05

## Status

Blocked on production env.

Implementasi kode, dokumen, audit, test, dan build sudah selesai. Production deploy ulang dan production smoke final belum boleh diklaim selesai karena `.env.local` belum memiliki konfigurasi email reset password client.

## Tujuan

Menaikkan produk dari beta terbatas menuju siap jual massal dengan menyelesaikan 7 poin sale readiness:

1. Deploy production ulang setelah Sprint 34.
2. Buyer onboarding terbaru.
3. Client reset password self-service.
4. Demo data bersih.
5. Dokumentasi jual lebih matang.
6. Payment/licensing baseline.
7. Production smoke test final.

## Selesai

- Menambahkan self-service reset password client:
  - `src/lib/clientPasswordReset.ts`
  - `src/app/api/client/password-reset/request/route.ts`
  - `src/app/api/client/password-reset/confirm/route.ts`
  - `src/app/client/reset-password/page.tsx`
  - `src/app/client/reset-password/ResetPasswordForm.tsx`
  - update `src/app/client/login/ClientLoginForm.tsx`
- Menambahkan tabel D1:
  - `client_password_resets`
  - index `idx_client_password_resets_token`
  - index `idx_client_password_resets_access_status`
- Menambahkan test endpoint reset:
  - `src/app/api/client/password-reset/request/route.test.ts`
  - `src/app/api/client/password-reset/confirm/route.test.ts`
- Menambahkan/memperbarui dokumentasi:
  - `docs/release/CLIENT_OPERATIONS.md`
  - `docs/release/SALES_PRICING.md`
  - `docs/release/BUYER_ONBOARDING.md`
  - `docs/release/RELEASE_CHECKLIST.md`
  - `docs/release/LITE_PRO_SCOPE.md`
  - `docs/release/PRODUCTION_DEPLOY_RUNBOOK.md`
  - `README.md`
  - `docs/agent-context/02_BACKEND_D1_CONTEXT.md`
  - `docs/agent-context/04_ENDPOINT_CONTRACT.md`
  - `docs/agent-context/05_UI_TEMPLATE_CONTEXT.md`
  - `docs/product-boundary/env-inventory.md`
- Menambahkan audit sale readiness:
  - `scripts/release/audit-sale-readiness.js`
  - `package.json` script `release:sale-readiness`
- Memperluas release smoke:
  - `/client/reset-password`
  - `/{siteSlug}/login`
- Memperketat production readiness:
  - `NEXT_PUBLIC_SITE_URL`
  - `FEATURE_CLIENT_PASSWORD_RESET`
  - `CLIENT_PASSWORD_RESET_TOKEN_TTL_MINUTES`
  - `NOTIFICATION_PROVIDER`
  - `NOTIFICATION_API_KEY`
  - `NOTIFICATION_DEFAULT_FROM`

## Verifikasi yang Lolos

- `npm run release:audit` -> pass, 70/70 checks.
- `npm run release:sale-readiness` -> pass, 24/24 checks.
- `npm run site-scope:audit` -> pass.
- `npm run lint -- --quiet` -> pass.
- `npx tsc --noEmit --pretty false` -> pass.
- Targeted tests -> pass, 11 files / 62 tests.
- `npm run cf:build` -> pass.
- Local smoke:
  - `http://localhost:3000/client/reset-password` -> HTTP 200.
  - `http://localhost:3000/urgent/login` -> HTTP 200 after redirect handling.

## Blocker

`npm run cf:readiness` gagal karena env production reset password belum diisi:

- `NEXT_PUBLIC_SITE_URL`
- `FEATURE_CLIENT_PASSWORD_RESET`
- `CLIENT_PASSWORD_RESET_TOKEN_TTL_MINUTES`
- `NOTIFICATION_PROVIDER`
- `NOTIFICATION_API_KEY`
- `NOTIFICATION_DEFAULT_FROM`

Readiness result saat ini: 19/25 checks passed.

## Status 7 Poin

| Poin | Status |
| --- | --- |
| Production deploy ulang setelah Sprint 34 | Blocked sampai env reset email lengkap |
| Buyer onboarding | Completed |
| Client reset password self-service | Code completed, production delivery blocked by email env |
| Demo data bersih | Completed via `release:sale-readiness` |
| Dokumentasi jual | Completed |
| Payment/licensing baseline | Completed via `SALES_PRICING.md` |
| Production smoke test final | Blocked sampai deploy production ulang |

## Langkah Lanjut

Isi env berikut di `.env.local` dan Cloudflare production env:

```env
NEXT_PUBLIC_SITE_URL="https://domain-production-kamu"
FEATURE_CLIENT_PASSWORD_RESET="true"
CLIENT_PASSWORD_RESET_TOKEN_TTL_MINUTES="30"
NOTIFICATION_PROVIDER="resend"
NOTIFICATION_API_KEY=""
NOTIFICATION_DEFAULT_FROM=""
```

Setelah env diisi:

1. `npm run cf:bootstrap`
2. `npm run cf:readiness`
3. `npm run cf:deploy`
4. `npm run release:smoke -- --url https://domain-production-kamu --site-slug <slug>`
5. Manual acceptance reset email, create site, client login, project/media upload, Lite/Pro gating, dan cross-site isolation.

## Handoff Domain Baru

Domain yang sudah dibeli:

```text
makeitbetter.my.id
```

Status terakhir:

- Domain sudah ditambahkan ke Cloudflare.
- Cloudflare meminta nameserver berikut:

```text
jasmine.ns.cloudflare.com
osmar.ns.cloudflare.com
```

- Registrar/domain provider sedang propagasi nameserver.
- Cloudflare masih menampilkan status waiting/propagation.

Jangan sambungkan domain ke Worker/app sampai zone Cloudflare berubah menjadi `Active`.

Urutan setelah domain `Active`:

1. Buka Cloudflare `Workers & Pages`.
2. Pilih Worker app Portfolio OS.
3. Masuk `Settings` -> `Domains & Routes` / `Custom Domains`.
4. Tambahkan custom domain:

```text
makeitbetter.my.id
```

5. Setelah domain Worker connected, isi env:

```env
NEXT_PUBLIC_SITE_URL="https://makeitbetter.my.id"
FEATURE_CLIENT_PASSWORD_RESET="true"
CLIENT_PASSWORD_RESET_TOKEN_TTL_MINUTES="30"
NOTIFICATION_PROVIDER="resend"
NOTIFICATION_API_KEY=""
NOTIFICATION_DEFAULT_FROM="Portfolio OS <noreply@makeitbetter.my.id>"
```

6. Di Resend, tambahkan domain `makeitbetter.my.id`, lalu copy semua DNS record Resend ke Cloudflare DNS.
7. Tunggu Resend domain `Verified`.
8. Baru jalankan:

```bash
npm run cf:readiness
npm run cf:deploy
npm run release:smoke -- --url https://makeitbetter.my.id --site-slug urgent
```

Catatan: jangan tulis API key Resend di tracker, docs, atau chat. Isi hanya di `.env.local` dan Cloudflare production env.

## Recheck 2026-07-07 - Mass Sale Readiness

Kesimpulan jujur: belum siap diklaim jual massal. Kode dan paket rilis menunjukkan banyak gate lokal sudah sehat, tetapi production readiness dan smoke produksi final masih gagal.

Verifikasi yang dijalankan:

- `npm run release:audit` -> pass, 70/70 checks.
- `npm run release:sale-readiness` -> pass, 24/24 checks.
- `npm run site-scope:audit` -> pass.
- `npx tsc --noEmit --pretty false` -> pass.
- `npm run lint -- --quiet` -> pass.
- Targeted tests reset password/site/quota -> pass, 4 files / 27 tests.
- `npm run cf:build` -> pass. Ada warning cache `.next/cache/fetch-cache` JSON parse, tetapi command exit 0.

Blocker yang masih ada:

- `npm run cf:readiness` -> fail, 19/25 checks.
- Env yang masih belum lengkap untuk readiness:
  - `NEXT_PUBLIC_SITE_URL`
  - `FEATURE_CLIENT_PASSWORD_RESET`
  - `CLIENT_PASSWORD_RESET_TOKEN_TTL_MINUTES`
  - `NOTIFICATION_PROVIDER`
  - `NOTIFICATION_API_KEY`
  - `NOTIFICATION_DEFAULT_FROM`
- Smoke ke production Worker lama gagal pada alias tenant login:
  - `npm run release:smoke -- --url https://portfolio-os-template.m4keitbetter.workers.dev --site-slug demo-designer` -> fail, `/demo-designer/login` 404.
  - `npm run release:smoke -- --url https://portfolio-os-template.m4keitbetter.workers.dev --site-slug urgent` -> fail, `/urgent/login` 404.

Implikasi:

- Production yang bisa diakses belum boleh dianggap merepresentasikan sprint terbaru.
- Jangan klaim mass sale readiness sebelum env reset password/email lengkap, deploy production ulang selesai, smoke production lulus, dan manual acceptance utama selesai.

File yang dimodifikasi pada recheck ini:

- `docs/tracker/logs/sprint_35_mass_sale_readiness.md`

## Recheck 2026-07-07 - Env Completed, Deploy, Smoke

Status: production env blocker untuk reset password sudah selesai, deploy Worker berhasil, dan automated smoke Worker lulus. Manual acceptance production tetap belum selesai.

Verifikasi yang dijalankan:

- `npm run cf:readiness` -> pass, 28/28 checks.
- `npm run cf:deploy` -> pass.
- Deployed Worker URL: `https://portfolio-os-template.m4keitbetter.workers.dev`
- Current Version ID: `5e4296c6-21f3-4abb-b61e-51e2c9ab3563`
- Worker upload size: `10998.41 KiB`, gzip `2783.96 KiB`.
- `npm run release:smoke -- --url https://portfolio-os-template.m4keitbetter.workers.dev --site-slug urgent` -> pass, 10/10 checks.

Smoke script update:

- `scripts/release/smoke-production.js` diperbarui agar tenant login alias menerima HTTP `200` dengan marker redirect `/client/login?site=<slug>` atau HTTP `307`.
- Alasan: pada OpenNext Cloudflare, route `/urgent/login` mengirim HTML `200` yang memuat digest `NEXT_REDIRECT;replace;/client/login?site=urgent;307;`, bukan header `Location` 307 langsung.

Catatan custom domain:

- `npm run release:smoke -- --url https://makeitbetter.my.id --site-slug urgent` dari mesin lokal gagal dengan `fetch failed`.
- Diagnosa lokal menunjukkan resolver router hanya mengembalikan AAAA record, sedangkan public DNS `1.1.1.1` sudah mengembalikan A record Cloudflare.
- Verifikasi manual dengan `curl --resolve makeitbetter.my.id:443:104.21.32.101` berhasil untuk:
  - `/api/health` -> HTTP 200.
  - `/urgent/login` -> HTTP 200.
  - `/r2/ffmpeg/ffmpeg-core.js` -> HTTP 200.

Langkah lanjut:

- Ulang smoke custom domain setelah DNS lokal/ISP propagation stabil.
- Lanjutkan manual acceptance: master admin login, client login, reset password email, create site, upload media, Lite/Pro quota, dan cross-site isolation.

File yang dimodifikasi pada recheck/deploy ini:

- `docs/tracker/INDEX_TRACKER.md`
- `docs/tracker/logs/sprint_35_mass_sale_readiness.md`
- `scripts/release/smoke-production.js`

## Recheck 2026-07-07 - Custom Domain Root Blank Report

Masalah yang dilaporkan: user membuka `http://makeitbetter.my.id/` dan melihat halaman kosong.

Verifikasi:

- `curl http://makeitbetter.my.id/` dan `curl https://makeitbetter.my.id/` dari mesin lokal gagal resolve domain (`Could not resolve host`).
- Resolver lokal hanya mengembalikan AAAA record untuk `makeitbetter.my.id`.
- Resolver publik `1.1.1.1` mengembalikan A record Cloudflare:
  - `172.67.150.193`
  - `104.21.32.101`
- `curl --resolve makeitbetter.my.id:80:104.21.32.101 http://makeitbetter.my.id/` -> HTTP 200, HTML non-kosong.
- `curl --resolve makeitbetter.my.id:443:104.21.32.101 https://makeitbetter.my.id/` -> HTTP 200, HTML non-kosong.
- Playwright direct normal gagal `net::ERR_NAME_NOT_RESOLVED`.
- Playwright dengan host resolver paksa ke `104.21.32.101` berhasil render halaman root normal di HTTP dan HTTPS.
- Visual render diverifikasi via Playwright dengan host resolver paksa ke IP Cloudflare.

Interpretasi:

- Root app production tidak kosong; response HTML dan render browser valid ketika DNS mengarah ke Cloudflare.
- Masalah paling mungkin adalah DNS lokal/ISP propagation/cache atau akses via HTTP tanpa redirect HTTPS.

Rekomendasi:

- Gunakan `https://makeitbetter.my.id/` sebagai URL publik.
- Aktifkan redirect HTTP -> HTTPS di Cloudflare (`Always Use HTTPS` atau Redirect Rule).
- Flush DNS lokal/browser dan ulangi setelah propagasi.

## Fix 2026-07-07 - Force HTTPS Redirect

Masalah keamanan: browser menandai `http://makeitbetter.my.id/` sebagai tidak aman. Ini expected untuk HTTP, tetapi tidak bagus untuk URL publik produk.

Perbaikan:

- Menambahkan guard middleware production untuk redirect HTTP non-localhost ke HTTPS dengan status `308`.
- Redirect dijalankan sebelum static/auth/CSRF middleware branch agar semua public route masuk HTTPS.
- Menambahkan unit test helper HTTPS redirect.

File yang dimodifikasi:

- `src/middleware.ts`
- `src/middleware/utils.ts`
- `src/middleware/__tests__/utils.test.ts`
- `docs/tracker/logs/sprint_35_mass_sale_readiness.md`

Verifikasi:

- `npx vitest run src/middleware/__tests__/utils.test.ts src/middleware/__tests__/csrf.test.ts` -> pass, 2 files / 28 tests.
- `npx eslint src/middleware.ts src/middleware/utils.ts src/middleware/__tests__/utils.test.ts --quiet` -> pass.
- `npx tsc --noEmit --pretty false` -> pass.
- `npm run cf:deploy` -> pass.
- Current Version ID: `0b42239d-ae47-4af2-97e9-065999934ca1`.
- `npm run release:smoke -- --url https://portfolio-os-template.m4keitbetter.workers.dev --site-slug urgent` -> pass, 10/10 checks.
- `curl --resolve makeitbetter.my.id:80:104.21.32.101 http://makeitbetter.my.id/` -> HTTP `308`, `Location: https://makeitbetter.my.id/`.
- `curl --resolve makeitbetter.my.id:443:104.21.32.101 https://makeitbetter.my.id/` -> HTTP `200`.

Catatan:

- Jika browser masih menampilkan "Tidak aman", kemungkinan tab masih berada di URL `http://` lama atau cache/HSTS/Service Worker browser belum refresh. Buka ulang langsung ke `https://makeitbetter.my.id/`, hard refresh, atau clear site data.

## Recheck 2026-07-07 - Custom Domain Smoke Passed

Status: automated production gate untuk env dan smoke domain final sudah lulus. Produk sudah layak untuk pilot/penjualan terbatas, tetapi belum boleh diklaim siap jual massal penuh sebelum manual acceptance selesai.

Verifikasi:

- `npm run cf:readiness` -> pass, 28/28 checks.
- `npm run release:smoke -- --url https://makeitbetter.my.id --site-slug urgent` -> pass, 10/10 checks.
- `npm run release:smoke -- --url https://portfolio-os-template.m4keitbetter.workers.dev --site-slug urgent` -> pass, 10/10 checks.

Sisa sebelum klaim jual massal:

- Manual acceptance master admin login.
- Manual acceptance client login.
- Manual acceptance reset password email sampai email benar-benar diterima dan token bisa dipakai.
- Manual acceptance create site dan publish project.
- Manual acceptance upload cover/gallery/video.
- Manual acceptance Lite/Pro gating dan quota.
- Manual acceptance cross-site isolation.

## Manual Acceptance 2026-07-07 - Production RC1 Passed

Status: manual acceptance production untuk flow inti RC1 sudah lulus di domain final `https://makeitbetter.my.id`.

Bug production yang ditemukan dan diperbaiki saat acceptance:

- Direct video upload gagal di Cloudflare R2 dengan error known-length stream. Penyebabnya route `/api/admin/upload/direct` membungkus `req.body` dengan `TransformStream`, sehingga R2 menerima stream tanpa known length. Perbaikan: gunakan `FixedLengthStream` saat runtime Cloudflare menyediakan `Content-Length`, dan fallback buffer dengan hard size limit untuk request tanpa header tersebut.
- Hard delete site belum membersihkan tabel `client_password_resets`, sehingga reset row acceptance bisa orphan setelah site dihapus. Perbaikan: tambahkan `client_password_resets` ke daftar cleanup D1 saat delete site.

Verifikasi manual production:

- Master admin browser login -> pass, dashboard admin terbuka, console error 0.
- Master admin API login + CSRF cookie -> pass.
- Create Lite site dan Pro site sementara -> pass.
- Save client access Lite/Pro -> pass.
- Client API login Lite/Pro -> pass.
- Client browser login Lite -> pass, console error 0.
- Upload cover image ke R2 site-scoped -> pass.
- Upload gallery image ke R2 site-scoped -> pass.
- Upload video via presign + direct upload -> pass, sample MP4 234,926 bytes.
- Publish project -> pass, public API site menampilkan project published.
- Create draft project untuk uji isolation -> pass.
- Lite media quota reject -> pass, HTTP 400 untuk media per project di atas limit.
- Lite feature gating -> pass, testimonial manager ditolak dengan Pro-only gate.
- Pro feature gating -> pass, testimonial bisa dibuat lalu dihapus via API.
- Cross-site mutation Pro client ke Lite site -> pass, HTTP 401.
- Cross-site draft read isolation -> pass, draft Lite tidak dikembalikan ke Pro client.
- Reset password client -> pass: email ditemukan di Resend sent-email log dengan event `delivered`, token dari email berhasil dipakai, dan client login dengan password baru berhasil.
- Cleanup acceptance site/reset rows -> pass, tidak ada site acceptance tersisa.

Verifikasi automated setelah patch:

- `npx vitest run src/app/api/admin/upload/direct/route.test.ts` -> pass, 1 file / 3 tests.
- `npx vitest run src/app/api/admin/sites/route.test.ts src/app/api/admin/upload/direct/route.test.ts` -> pass, 2 files / 16 tests.
- `npm run cf:deploy` -> pass.
- Current Version ID setelah patch final: `bb31cb7e-a5fa-45eb-821c-08da44905b0a`.
- `npm run release:smoke -- --url https://makeitbetter.my.id --site-slug urgent` -> pass, 10/10 checks.

Catatan jujur:

- Functional acceptance inti sudah lulus untuk RC1 dan cukup untuk mulai pilot/penjualan terbatas.
- Ini belum sama dengan bukti scale massal besar. Belum ada load test multi-buyer, monitoring produksi jangka panjang, backup/restore drill, billing automation penuh, atau playbook support pasca-pembelian yang diverifikasi di sesi ini.

File yang dimodifikasi pada manual acceptance ini:

- `src/app/api/admin/upload/direct/route.ts`
- `src/app/api/admin/upload/direct/route.test.ts`
- `src/app/api/admin/sites/route.ts`
- `src/app/api/admin/sites/route.test.ts`
- `docs/tracker/INDEX_TRACKER.md`
- `docs/tracker/logs/sprint_35_mass_sale_readiness.md`
