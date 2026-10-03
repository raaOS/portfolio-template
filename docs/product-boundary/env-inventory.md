# Environment Inventory - Product Boundary Cleanup

Status: Sprint 1 baseline for the sellable Portfolio OS Template.

This document records environment variable **names only**. Do not paste secret values here.

## Product Required

Use these with the new Cloudflare account dedicated to the sellable template product.

- `CLOUDFLARE_ACCOUNT_ID`
- `PRODUCT_CLOUDFLARE_ENV_CONFIRMED`
- `CLOUDFLARE_D1_DATABASE_ID`
- `CLOUDFLARE_D1_API_TOKEN`
- `CLOUDFLARE_R2_ACCOUNT_ID`
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_R2_BUCKET`
- `CLOUDFLARE_R2_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_SITE_URL`
- `JWT_SECRET`
- `PASSWORD_SALT`
- `ADMIN_PASSWORD_SCRYPT`
- `REVALIDATION_TOKEN`
- `NOTIFICATION_PROVIDER`
- `NOTIFICATION_API_KEY`
- `NOTIFICATION_DEFAULT_FROM`

## Product Feature Flags

These define what the product enables for every deployment. Keep defaults conservative.

- `FEATURE_CLIENT_DASHBOARD`
- `FEATURE_MASTER_DASHBOARD`
- `FEATURE_AI`
- `FEATURE_NOTIFICATIONS`
- `FEATURE_CUSTOM_DOMAIN`
- `FEATURE_ANALYTICS`
- `PROJECT_LIMIT`
- `STORAGE_MB`
- `MEDIA_PER_PROJECT`

## Product Optional

These are platform-owned product integrations, not personal portfolio integrations.

- `AI_PROVIDER`
- `AI_API_KEY`
- Additional notification-specific variables if another provider is added later.
- `CLOUDFLARE_R2_BINDING` (default `MEDIA_BUCKET`; only needed if the Worker binding name differs from `wrangler.jsonc`)
- `NEXT_PUBLIC_FFMPEG_BASE_URL` (default `/r2/ffmpeg`; browser FFmpeg core files are stored in R2 keys `ffmpeg/*` and served through the app proxy)
- `CLOUDFLARE_D1_RESTORE_DATABASE_ID` (optional staging/restore D1 target for backup/restore drill; never point this to production during normal drills)
- `CRON_SECRET` (optional token for the daily Worker cron trigger; when set, `scheduled` calls `POST /api/cron/daily` with header `x-cron-secret`, when empty the daily run is skipped with a warning)
- `MONITORING_TARGET_URL` (optional synthetic monitor target URL)
- `MONITORING_SITE_SLUG` (optional public site slug used by synthetic monitor)
- `MONITORING_HTTP_TIMEOUT_MS` (optional synthetic request timeout)
- `MONITORING_STORAGE_WARN_RATIO` (optional storage/quota warning threshold, default `0.8`)
- `MONITORING_ALERT_PROVIDER` (optional: `none`, `console`, `webhook`, or `resend`)
- `MONITORING_ALERT_WEBHOOK_URL` (optional generic webhook alert target)
- `MONITORING_ALERT_RESEND_API_KEY` (optional Resend key override for monitoring alerts)
- `MONITORING_ALERT_FROM` (optional alert sender)
- `MONITORING_ALERT_TO` (optional alert recipients)
- `LOAD_TEST_TARGET_URL` (optional Sprint 46 load-test target URL)
- `LOAD_TEST_CONFIRM_HOST` (optional host confirmation for live load-test writes)
- `LOAD_TEST_RUN_ID` (optional load-test run id)
- `LOAD_TEST_TENANTS` (optional load-test tenant count)
- `LOAD_TEST_CONCURRENCY` (optional load-test concurrency)
- `LOAD_TEST_EMAIL_DOMAIN` (optional test client email domain)
- `LOAD_TEST_TIMEOUT_MS` (optional load-test request timeout)
- `LOAD_TEST_ADMIN_TOKEN` (optional admin bearer token for load-test tooling; do not log value)
- `LOAD_TEST_ADMIN_PASSWORD` (optional admin password for load-test tooling; do not log value)
- `LOAD_TEST_SITE_USER_EMAIL` (panel account email used by live load-test project/media mutations; do not log value)
- `LOAD_TEST_SITE_USER_PASSWORD` (panel account password for the same session; do not log value)

## Removed Personal Defaults

Old single-portfolio env names for private messaging, personal automation, private contact,
and direct personal AI keys were removed from the product template contract.

## Cleanup Decisions

- `.env.example` is now the source of truth for product env names.
- `.env.local` is being cleaned to match the product contract.
- `package.json` no longer exposes personal automation commands as template scripts.
- Future notification work must use provider-generic product flows scoped by `site_id`.
