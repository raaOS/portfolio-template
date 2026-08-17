# RC1 Release Notes

Release candidate: `Portfolio OS Template RC1`

Date: 2026-07-01

## Status

RC1 is a Cloudflare-only multi-site portfolio template candidate.

This is not a Vercel release. The intended runtime is Cloudflare Workers/OpenNext with D1 and R2.

## Included

- Multi-site / multi-tenant data model.
- Master site management.
- Lite/Pro plan metadata and quota guard.
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
- Validate client login manually.
- Validate real upload against production R2.
- Confirm custom domain if used.
- Record final release details in the release record template.

## Known Limitations

- Billing is metadata only; no payment provider integration is active.
- AI and notification providers are feature-flagged optional integrations and should remain disabled unless product-owned credentials are configured.
- Custom domain and analytics are product flags/docs level; final implementation should be verified before selling those as active Pro features.
- Browser video compression depends on FFmpeg assets in R2 under `ffmpeg/*`.

## Upgrade Notes For Buyers

- Rotate all generated secrets after ownership transfer.
- Keep `.env.local` private and untracked.
- Keep media under `sites/{siteId}/...`.
- Run `npm run cf:readiness` after changing Cloudflare resources.
- Run `npm run r2:upload-ffmpeg` after changing R2 bucket/account.
