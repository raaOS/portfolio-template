# Production Deploy Runbook

Use this runbook for the first release candidate and future production deploys.

## Scope

Target platform:

- Cloudflare Workers/OpenNext for runtime.
- Cloudflare D1 for relational data.
- Cloudflare R2 for media and browser FFmpeg assets.
- Managed service: one deployment per client, running in that client's own Cloudflare account (provisioned by the `PENGELOLA_KLIEN.bat` portal).

Out of scope:

- Vercel deployment.
- A shared multi-tenant platform that hosts many clients in one deployment/account.
- Personal Telegram/job-hunter/contact integrations.

## Pre-Deploy Gate

Stop local dev server if it is running on port 3000, then run:

```bash
npm run release:audit
npm run site-scope:audit
npm run cf:doctor
npm run cf:readiness
npm run lint
npx tsc --noEmit --pretty false
npm run cf:build
```

Expected:

- `release:audit` passes all checks.
- `site-scope:audit` confirms tenant content routes/helpers are scoped.
- `cf:readiness` shows all checks passed, including notification provider config for order and activation emails.
- `cf:build` exits `0` without actionable warning/error output.
- `wrangler.jsonc` keeps `minify: true` so the Worker stays below the Cloudflare Free 3 MiB limit.

## Local Worker Smoke

Run:

```bash
npx wrangler dev --env-file .env.local --port 8788
```

Check:

```text
http://localhost:8788/api/health
http://localhost:8788/
http://localhost:8788/admin/login
http://localhost:8788/projects
```

Stop `wrangler dev` after testing. On Windows, also make sure no `workerd` process keeps `.open-next` locked.

## Deploy

Run:

```bash
npm run cf:deploy
```

Record:

- Deployment date/time.
- Git commit or archive version.
- Cloudflare Worker URL.
- Custom domain if configured.
- D1 database name/ID, without API token.
- R2 bucket name, without access key/secret.

## Post-Deploy Smoke

Run the automated smoke script with the production URL:

```bash
npm run release:smoke -- --url https://your-production-domain.example --site-slug demo-designer
```

The smoke script checks:

- `/api/health`
- `/`
- `/projects`
- `/r2/ffmpeg/ffmpeg-core.js`
- `/r2/ffmpeg/ffmpeg-core.wasm`

Rute public per-slug (`/api/public/sites/{siteSlug}`) sudah dihapus bersama konsep tenant; `--site-slug` kini hanya informasi.

## Manual Acceptance

After automated smoke passes:

- [ ] Open homepage.
- [ ] Open admin login.
- [ ] Login as admin with the seeded email + password (`/admin/login`).
- [ ] Confirm the site row exists for this deployment (`GET /api/admin/sites`).
- [ ] Confirm `site_users` holds the seeded admin row for this deployment.
- [ ] Create a draft project.
- [ ] Upload a cover image.
- [ ] Upload gallery image.
- [ ] Upload gallery video if the video feature is enabled.
- [ ] Confirm R2 keys are under `sites/{siteId}/...`.
- [ ] Confirm storage usage changes after upload.
- [ ] Confirm quota blocks over-limit action.
- [ ] Confirm a site quota override raises the limit.
- [ ] Isolation check (staging only): create a second test site and confirm data from site A does not appear in site B — a production deployment serves exactly one client site.

## Rollback

If deploy fails before traffic switch:

1. Keep previous production deployment active.
2. Do not run destructive D1/R2 cleanup.
3. Re-run:

   ```bash
   npm run cf:readiness
   npm run cf:build
   ```

4. Fix the blocker.
5. Deploy again.

If deploy is already live and broken:

1. Restore the previous Cloudflare Worker deployment from Cloudflare dashboard if available.
2. Do not rotate secrets unless compromise is suspected.
3. Preserve D1/R2 data.
4. Capture error logs and failed URL.
5. Reproduce locally with `wrangler dev`.

## Release Record Template

```text
Release:
Date:
Commit/archive:
Worker URL:
Custom domain:
D1 database:
R2 bucket:
cf:readiness result:
cf:build result:
release:smoke result:
Known limitations:
Sale readiness decision:
Next sprint:
```

## Known Constraints

- Browser FFmpeg assets must stay in R2 under `ffmpeg/*`; `ffmpeg-core.wasm` is too large for Worker assets.
- `wrangler.jsonc` must keep `minify: true`; otherwise the OpenNext Worker can exceed the Cloudflare Workers Free script size limit.
- `src/middleware.ts` is intentional for OpenNext Cloudflare. Do not rename to `src/proxy.ts` without revalidating OpenNext support.
- Build on Windows may need process cleanup if `wrangler dev` leaves `workerd` running.
