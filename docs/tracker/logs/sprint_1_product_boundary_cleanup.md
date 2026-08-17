# Tracker Log: Sprint 1 - Product Boundary Cleanup

**Status:** Completed
**Mulai:** 2026-06-27
**Selesai:** 2026-06-27

## Tujuan (Objective)
- Membersihkan repo template jual dari integrasi bot personal lama, automation pencarian kerja pribadi, webhook lama, script lama, dan kontrak env personal.
- Menjaga arah produk tetap full Cloudflare, multi-site, dan self-service Lite/Pro.

## Task List
- [x] Hapus route webhook, watchdog, service, handler, sender, script, dan test khusus integrasi personal lama.
- [x] Ubah chat visitor agar hanya persist ke D1 dan optional AI, tanpa channel eksternal personal.
- [x] Ubah feedback endpoint agar hanya simpan ke D1 untuk moderasi admin.
- [x] Ubah admin login/password/PIN agar tidak memakai approval eksternal.
- [x] Hapus popout watchdog dari admin menubar.
- [x] Bersihkan `.env.local` dari key dan komentar integrasi personal lama tanpa mencetak secret.
- [x] Bersihkan `.env.example`, AGENTS, product boundary docs, dan tracker index.
- [x] Jalankan verifikasi TypeScript, lint, unit test, dan pencarian repo.

## File yang Dimodifikasi (Modified Files)
- `.env.local` -> Menghapus key dan komentar integrasi personal lama tanpa menampilkan secret.
- `.env.example` -> Kontrak env produk generic full Cloudflare.
- `AGENTS.md` -> Menghapus instruksi/entry legacy dan mengunci integrasi produk generic.
- `package.json` -> Menghapus script personal lama dari kontrak command template.
- `scripts/core/dev.js` -> Dev server hanya menjalankan Next.js.
- `scripts/deploy/deploy-vercel.mjs` -> Dihapus karena obsolete untuk arah full Cloudflare dan masih membawa checklist lama.
- Script integrasi personal lama dan script test channel eksternal lama -> Dihapus.
- Library wrapper integrasi personal lama dan automation pribadi lama -> Dihapus.
- `src/lib/services/jobHuntService.ts`, `src/lib/services/jobApplyService.ts`, `src/lib/services/jobstreetService.ts`, `src/lib/services/glintsBrowserService.ts` -> Dihapus.
- Route webhook, cron watchdog, dan status watchdog personal lama -> Dihapus.
- `src/app/api/chat/send/route.ts` -> Chat visitor tidak lagi mengirim ke channel eksternal personal.
- `src/lib/chatStore.ts` -> Session chat tidak lagi menyimpan thread eksternal personal.
- `src/app/api/feedback/route.ts` -> Feedback hanya persist ke D1 dan dimoderasi admin.
- `src/app/api/admin/login/route.ts` -> Login hanya audit internal, tanpa notifikasi personal.
- `src/app/api/admin/password/route.ts`, `src/app/api/admin/pin/route.ts` -> Flow update langsung dengan sandi lama + CSRF, tanpa OTP eksternal.
- `src/app/admin/components/ChangePasswordModal.tsx` -> UI disederhanakan ke flow lokal.
- `src/app/admin/desktop/AdminMenuBar.tsx`, `src/app/admin/desktop/status-popouts/index.ts`, dan popout watchdog lama -> Status watchdog lama dihapus.
- `src/middleware/csrf.ts` dan test terkait -> Allowlist route lama dihapus.
- `src/lib/validations/index.ts`, `src/lib/validations/schemas.ts`, `src/lib/utils/env.ts` -> Schema/comment legacy dihapus.
- Test terkait API chat, auth, feedback, projects, security -> Disesuaikan atau dihapus sesuai fitur yang tersisa.
- `docs/agent-context/09_PRODUCT_BOUNDARY_CONTEXT.md`, `docs/product-boundary/env-inventory.md`, `docs/tracker/INDEX_TRACKER.md` -> Updated handoff.

## Bug & Perbaikan (Bug Tracker)
- **Bug:** Unit test `/api/projects` masih mock service lama setelah route sudah memakai SQL service.
  - **Penyebab:** Migrasi backend sebelumnya mengubah source data, tetapi test belum ikut pindah.
  - **Perbaikan:** `src/app/api/projects/route.test.ts` sekarang mock `projectSqlService.getProjectsSql`; variabel query `fresh` yang tidak dipakai dihapus dari route.

## Verifikasi
- `rg` keyword legacy repo: no matches.
- `.env.local` keyword legacy: no matches, secret tidak dicetak.
- Folder browser-session automation pribadi lama: sudah tidak ada.
- `npx tsc --noEmit --pretty false`: pass.
- `npm run lint`: pass.
- `npm test`: 90 test files passed, 685 tests passed.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Jangan menghidupkan kembali integrasi personal lama. Jika produk butuh notifikasi, buat provider generic scoped `site_id` dan dikontrol oleh `FEATURE_NOTIFICATIONS`.
- AI provider lama masih perlu migrasi produk terpisah ke `AI_PROVIDER` / `AI_API_KEY` bila fitur Pro AI akan diaktifkan.
