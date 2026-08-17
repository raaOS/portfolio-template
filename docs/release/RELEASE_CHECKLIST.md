# Seller Release Checklist

Use this checklist before packaging, selling, or deploying a buyer instance.

## Preflight

- [ ] Confirm this repo points to the product Cloudflare account, not a personal portfolio account.
- [ ] Confirm `.env.local` exists locally and is not committed.
- [ ] Confirm `PRODUCT_CLOUDFLARE_ENV_CONFIRMED="true"` only after product Cloudflare values are set.
- [ ] Confirm `wrangler.jsonc` R2 bucket name matches `CLOUDFLARE_R2_BUCKET`.
- [ ] Confirm `NEXT_PUBLIC_FFMPEG_BASE_URL="/r2/ffmpeg"`.
- [ ] Confirm `FEATURE_CLIENT_PASSWORD_RESET="true"` for sale-ready builds.
- [ ] Confirm password reset email env is configured: `NOTIFICATION_PROVIDER`, `NOTIFICATION_API_KEY`, `NOTIFICATION_DEFAULT_FROM`, and `NEXT_PUBLIC_SITE_URL`.

## Cloudflare Resources

- [ ] D1 database created.
- [ ] R2 bucket created.
- [ ] D1 token created and scoped to the product account/database.
- [ ] R2 S3 access key created and scoped to the product media bucket.
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
npx vitest run "src/app/api/admin/sites/route.test.ts" "src/app/api/admin/sites/[siteId]/client-access/route.test.ts" "src/app/api/admin/sites/[siteId]/project-cover/route.test.ts" "src/app/api/admin/sites/[siteId]/project-media/route.test.ts" "src/app/api/admin/sites/[siteId]/project-video/presign/route.test.ts" "src/app/api/r2/[...key]/route.test.ts" "src/lib/product/siteStorageUsage.test.ts" "src/lib/services/project/projectStorage.test.ts" "src/lib/services/project/projectSqlService.test.ts"
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
- [ ] `GET /client/login` -> 200.
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
- [ ] Master admin login works.
- [ ] Master can create/update/suspend/delete a site.
- [ ] Master can set Lite/Pro plan and billing metadata.
- [ ] Client login works.
- [ ] Client password reset email is delivered and reset token can set a new password.
- [ ] Client can create/edit projects within quota.
- [ ] Cover/gallery/video upload works.
- [ ] R2 media keys are under `sites/{siteId}/...`.
- [ ] Browser video compression loads FFmpeg from `/r2/ffmpeg`.
- [ ] Lite cannot access Pro-only testimonial manager.
- [ ] Pro testimonial manager works after plan upgrade.
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

## Handoff To Buyer

Give the buyer:

- Repository or archive.
- Cloudflare setup instructions.
- Their generated admin password or reset process.
- Their client login URL pattern: `https://domain.com/[siteSlug]/login`.
- Their client password reset process.
- Their Cloudflare resource naming convention.
- The final production URL.
- A reminder to rotate all generated secrets after ownership transfer.
