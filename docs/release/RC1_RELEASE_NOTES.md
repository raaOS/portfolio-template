# RC1 Release Notes

> **⚠️ ARSIP RILIS LAMA — jangan dipakai sebagai acuan konsep.**
> Dokumen ini ditulis 2026-07-01 dan merefleksikan model lama: **multi-site / multi-tenant
> single platform** dengan "Master admin" yang mengelola banyak site dari satu panel.
> Model saat ini adalah **managed service — 1 klien = 1 akun Cloudflare milik klien**, tanpa
> Master Dashboard, tanpa paket/langganan (harga tunggal Rp199.000), onboarding lewat portal
> `PENGELOLA_KLIEN.bat`, dan panel `clientDashboard`/`orders`/`paymentConfig` sudah dihapus.
> Isi di bawah dipertahankan apa adanya sebagai catatan rilis.

Release candidate: `Portfolio OS Template RC1`

Date: 2026-07-01

## Status

RC1 is a Cloudflare-only multi-site portfolio template candidate.

This is not a Vercel release. The intended runtime is Cloudflare Workers/OpenNext with D1 and R2.

## Included

- Multi-site / multi-tenant data model.
- Master site management.
- Site quota guard (project/storage/media).
- Client login and self-service dashboard.
- Project CRUD scoped by site.
- Cover, gallery image, and gallery video upload flows.
- Site-scoped R2 media lifecycle cleanup.
- Safe hard delete for sites.
- D1/R2 product bootstrap scripts.
- FFmpeg browser asset upload to R2.
- Production readiness gate.
- Release package audit.
- Buyer onboarding docs.
- Seller release checklist.
- Production deploy runbook.

## Validation Summary

Latest validation from Sprint 22:

- `npm run cf:readiness` -> `22/22` checks passed.
- `npm run release:audit` -> `59/59` checks passed.
- `npm run lint` -> pass.
- `npx tsc --noEmit --pretty false` -> pass.
- Targeted tenant/media/auth tests -> pass.
- Cloudflare build -> pass.
- Cloudflare production deploy -> pass.
- Production Worker upload size -> gzip `2643.83 KiB`.
- Production URL -> `https://portfolio-os-template.m4keitbetter.workers.dev`.
- Production Version ID -> `210f2cbc-7103-4265-ac2a-86c2b896d995`.
- Production smoke -> `8/8` checks passed.

## Required Before Marking Stable

- Production deploy through `docs/release/PRODUCTION_DEPLOY_RUNBOOK.md` is complete for the Workers URL above.
- Automated production smoke is complete for `demo-designer`.
- Validate Master admin login manually.
- Validate panel login manually (`/admin/login` as the buyer).
- Validate real upload against production R2.
- Confirm custom domain if used.
- Record final release details in the release record template.

## Known Limitations

- Payment is manual (QRIS/transfer + admin verification); no payment provider integration is active.
- AI and notification providers are feature-flagged optional integrations and should remain disabled unless product-owned credentials are configured.
- Custom domain and analytics are product flags/docs level; final implementation should be verified before selling them as active features.
- Browser video compression depends on FFmpeg assets in R2 under `ffmpeg/*`.

## Upgrade Notes For Buyers

- Rotate all generated secrets after ownership transfer.
- Keep `.env.local` private and untracked.
- Keep media under `sites/{siteId}/...`.
- Run `npm run cf:readiness` after changing Cloudflare resources.
- Run `npm run r2:upload-ffmpeg` after changing R2 bucket/account.
