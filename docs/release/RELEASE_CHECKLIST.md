# Seller Release Checklist

Use this checklist before deploying an instance for a client (managed service: 1 client = 1 Cloudflare account belonging to the client, provisioned by the `PENGELOLA_KLIEN.bat` portal).

## Preflight

- [ ] Confirm `.env.local` points to the owner's own Cloudflare account used for template development and smoke tests (each client deployment lives in the client's own Cloudflare account, provisioned by the portal).
- [ ] Confirm `.env.local` exists locally and is not committed.
- [ ] Confirm `PRODUCT_CLOUDFLARE_ENV_CONFIRMED="true"` only after product Cloudflare values are set.
- [ ] Confirm `wrangler.jsonc` R2 bucket name matches `CLOUDFLARE_R2_BUCKET`.
- [ ] Confirm `NEXT_PUBLIC_FFMPEG_BASE_URL="/r2/ffmpeg"`.
- [ ] Confirm notification email env is configured: `NOTIFICATION_PROVIDER`, `NOTIFICATION_API_KEY`, `NOTIFICATION_DEFAULT_FROM`, and `NEXT_PUBLIC_APP_URL` (domain di dalam link email; `NEXT_PUBLIC_SITE_URL` hanya fallback).

## Cloudflare Resources

- [ ] D1 database exists in the client's Cloudflare account (portal creates `db-<slug>`).
- [ ] R2 bucket exists in the client's Cloudflare account (portal creates `media-<slug>`).
- [ ] API token is scoped to the client's account (D1, R2, Workers (Edit)) and stored only in `arsip-klien/<slug>/config.env`.
- [ ] R2 S3 access key scoped to the client's media bucket.
- [ ] R2 CORS applied if direct browser upload is used:

  ```bash
  npm run r2:set-cors
  ```

## Bootstrap

Run:

```bash
npm run cf:doctor
npm run cf:bootstrap
npm run r2:upload-ffmpeg
npm run cf:seed-demo
npm run cf:readiness
```

Expected:

```text
Summary: all checks passed.
```

## Quality Gate

Run:

```bash
npm run release:audit
npm run release:sale-readiness
npm run site-scope:audit
npm run lint
npx tsc --noEmit --pretty false
npm run cf:build
```

Recommended targeted regression:

```bash
npx vitest run "src/app/api/admin/sites/route.test.ts" "src/app/api/admin/sites/[siteId]/project-cover/route.test.ts" "src/app/api/admin/sites/[siteId]/project-media/route.test.ts" "src/app/api/admin/sites/[siteId]/project-video/presign/route.test.ts" "src/app/api/r2/[...key]/route.test.ts" "src/lib/product/siteStorageUsage.test.ts" "src/lib/services/project/projectStorage.test.ts" "src/lib/services/project/projectSqlService.test.ts"
```

## Worker Smoke Test

Stop local dev server first if it uses port 3000, then:

```bash
npm run cf:build
npx wrangler dev --env-file .env.local --port 8788
```

Check:

- [ ] `GET /api/health` -> 200.
- [ ] `GET /` -> 200.
- [ ] `GET /admin/login` -> 200.
- [ ] `GET /api/public/sites/demo-designer/projects` -> 200.

Stop `wrangler dev` after testing.

## Deploy

Follow the production runbook:

```text
docs/release/PRODUCTION_DEPLOY_RUNBOOK.md
```

```bash
npm run cf:deploy
```

After deploy:

- [ ] Run production smoke:

  ```bash
  npm run release:smoke -- --url https://your-production-domain.example --site-slug demo-designer
  ```

- [ ] Health endpoint returns 200.
- [ ] Public site route loads.
- [ ] Panel login works (`/admin/login` with the client's seeded email + password from `arsip-klien/<slug>/config.env`).
- [ ] Owner can create/update/suspend/delete a site via `POST/PUT/DELETE /api/admin/sites` (no central dashboard panel exists).
- [ ] Owner can set site status and quota override (`site_quota_overrides`).
- [ ] Owner-assisted password reset works (`npx tsx scripts/cloudflare/reset-customer-password.ts`).
- [ ] Client can create/edit projects within quota via `/admin`.
- [ ] Cover/gallery/video upload works.
- [ ] R2 media keys are under `sites/{siteId}/...`.
- [ ] Browser video compression loads FFmpeg from `/r2/ffmpeg`.
- [ ] Optional features follow their `FEATURE_*` flags.
- [ ] Data from one site does not appear in another site.

## Package Hygiene

- [ ] No `.env.local`.
- [ ] No personal data.
- [ ] No personal Telegram/job-hunter scripts exposed as npm scripts.
- [ ] No Vercel deploy path.
- [ ] README and release docs included.
- [ ] Client operations guide included.
- [ ] Sales/pricing guide included.
- [ ] Tracker updated after the release sprint.

## Handoff To Client

Give the client:

- The live URL (`https://<slug>.workers.dev`, or their custom domain once connected).
- Their panel login URL: `https://<slug>.workers.dev/admin/login` (there is no per-site login page).
- Their admin email + password — already recorded in `arsip-klien/<slug>/config.env`; send it over a private channel, never publicly.
- The client guide: `panduan/PANDUAN_UNTUK_KLIEN.md` (how to fill in their own projects, profile, and contact).
- Their password reset process (owner-assisted via `reset-customer-password.ts`; no self-service reset).
- Support contact for future content changes or template updates.

Do **not** hand over: the repository/archive, Cloudflare setup instructions, or the API token — the deployment runs in the client's Cloudflare account while the token stays in `arsip-klien/<slug>/config.env`.
