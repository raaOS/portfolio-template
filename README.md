# Portfolio OS Template

Sellable multi-site portfolio template powered by Cloudflare.

This repository targets a full Cloudflare stack:

- Cloudflare Workers/OpenNext for the app and API runtime.
- Cloudflare D1 for relational tenant/project data.
- Cloudflare R2 for media storage.
- One multi-site platform, not one deployment per buyer.

Do not deploy this as a Vercel project. Any remaining Vercel references are legacy migration context, not the product target.

## Quick Start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template:

   ```bash
   copy .env.example .env.local
   ```

3. Create Cloudflare resources:

   - D1 database.
   - R2 bucket.
   - D1 API token.
   - R2 S3-compatible access key.

4. Fill `.env.local` with the product Cloudflare account values.

5. Confirm the env points to the product account:

   ```env
   PRODUCT_CLOUDFLARE_ENV_CONFIRMED="true"
   ```

6. Bootstrap and verify:

   ```bash
   npm run cf:bootstrap
   npm run r2:upload-ffmpeg
   npm run cf:seed-demo
   npm run cf:readiness
   ```

7. Run locally:

   ```bash
   npm run dev
   ```

8. Build for Cloudflare:

   ```bash
   npm run cf:build
   ```

9. Deploy to Cloudflare:

   ```bash
   npm run cf:deploy
   ```

## Main Docs

- Buyer setup: [docs/release/BUYER_ONBOARDING.md](docs/release/BUYER_ONBOARDING.md)
- Seller release checklist: [docs/release/RELEASE_CHECKLIST.md](docs/release/RELEASE_CHECKLIST.md)
- Production deploy runbook: [docs/release/PRODUCTION_DEPLOY_RUNBOOK.md](docs/release/PRODUCTION_DEPLOY_RUNBOOK.md)
- RC1 release notes: [docs/release/RC1_RELEASE_NOTES.md](docs/release/RC1_RELEASE_NOTES.md)
- Lite/Pro product scope: [docs/release/LITE_PRO_SCOPE.md](docs/release/LITE_PRO_SCOPE.md)
- Client operations: [docs/release/CLIENT_OPERATIONS.md](docs/release/CLIENT_OPERATIONS.md)
- Sales/pricing guide: [docs/release/SALES_PRICING.md](docs/release/SALES_PRICING.md)
- Product env inventory: [docs/product-boundary/env-inventory.md](docs/product-boundary/env-inventory.md)

## Useful Commands

```bash
npm run dev              # Local development server
npm run cf:doctor        # Safe env presence check
npm run cf:bootstrap     # Apply D1 schema to the configured product DB
npm run r2:upload-ffmpeg # Upload browser FFmpeg assets to R2
npm run cf:seed-demo     # Seed clean demo content
npm run cf:readiness     # Read-only production readiness gate
npm run cf:build         # Build OpenNext Cloudflare output
npm run cf:deploy        # Build and deploy to Cloudflare
npm run release:audit    # Check sellable package docs/env/script contract
npm run release:sale-readiness # Check sales/reset/demo-data readiness
npm run release:smoke    # Smoke-test a deployed production URL
```

## Access Model

- Master admin manages sites, plans, quotas, billing metadata, client access, and safe deletion.
- Clients use self-service dashboard access scoped to their own site.
- Clients can request password reset by email when `FEATURE_CLIENT_PASSWORD_RESET=true` and a notification/email provider is configured.
- Lite and Pro are both self-service. Lite is limited by quota/features; Pro unlocks higher quota and optional integrations.

## Important Notes

- Media keys must stay scoped under `sites/{siteId}/...`.
- Browser FFmpeg assets are served from R2 at `/r2/ffmpeg/*`.
- Keep `src/middleware.ts` for OpenNext Cloudflare. Do not rename it to `src/proxy.ts` unless OpenNext support changes and the Cloudflare build is revalidated.
- Never commit `.env.local` or buyer secrets.
