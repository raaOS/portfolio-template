# Portfolio OS Template

Sellable managed-service portfolio template powered by Cloudflare — one deployment per buyer, inside that buyer's own Cloudflare account.

This repository targets a full Cloudflare stack:

- Cloudflare Workers/OpenNext for the app and API runtime.
- Cloudflare D1 for relational tenant/project data.
- Cloudflare R2 for media storage.
- One Cloudflare account per buyer: the owner provisions and deploys each client's site into the Cloudflare account owned by that client.

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

4. Fill `.env.local` with the owner's Cloudflare account values (tooling/bootstrap account owned by the seller — not the client's account; each client site is provisioned and deployed into that client's own Cloudflare account).

5. Confirm the env points to the owner's tooling account:

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

- Client onboarding & handoff: [docs/operations/BENGKEL_HANDOFF.md](docs/operations/BENGKEL_HANDOFF.md)
- Seller release checklist: [docs/release/RELEASE_CHECKLIST.md](docs/release/RELEASE_CHECKLIST.md)
- Production deploy runbook: [docs/release/PRODUCTION_DEPLOY_RUNBOOK.md](docs/release/PRODUCTION_DEPLOY_RUNBOOK.md)
- RC1 release notes: [docs/release/RC1_RELEASE_NOTES.md](docs/release/RC1_RELEASE_NOTES.md)
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

- Owner provisions every new client through the `PENGELOLA_KLIEN.bat` portal (`localhost:4567`): the client's Gmail is registered, the client's Cloudflare Account ID + API Token are entered, and the portal provisions D1 + R2 inside the client's own Cloudflare account, seeds the admin user, and deploys the site there.
- Each client manages their own site content by signing in to `/admin` on their own site. The credentials are stored in `arsip-klien/<slug>/config.env` on the owner's machine.
- There is no master dashboard for managing many clients from inside the admin panel: sites are not bought, created, or managed from `/admin`, and there is one Cloudflare account per buyer.

## Important Notes

- Media keys must stay scoped under `sites/{siteId}/...`.
- Browser FFmpeg assets are served from R2 at `/r2/ffmpeg/*`.
- Keep `src/middleware.ts` for OpenNext Cloudflare. Do not rename it to `src/proxy.ts` unless OpenNext support changes and the Cloudflare build is revalidated.
- Never commit `.env.local` or buyer secrets.
