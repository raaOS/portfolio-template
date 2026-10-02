# Buyer Onboarding - Portfolio OS Template

This guide is for setting up a fresh buyer/product Cloudflare environment.

## 1. Prerequisites

- Node.js 20.9 or newer.
- npm.
- Cloudflare account dedicated to this product.
- Cloudflare Workers, D1, and R2 enabled.
- Repository dependencies installed with `npm install`.

## 2. Create Cloudflare Resources

### D1

1. Open Cloudflare Dashboard.
2. Go to `Storage & Databases` -> `D1 SQL Database`.
3. Create a database, for example:

   ```text
   portfolio-template-prod
   ```

4. Choose a location hint close to the target audience, for example Asia Pacific when serving Indonesia/SEA.
5. Copy the database ID into:

   ```env
   CLOUDFLARE_D1_DATABASE_ID=""
   ```

### R2

1. Open Cloudflare Dashboard.
2. Go to `R2 Object Storage`.
3. Enable R2 subscription if Cloudflare asks.
4. Create a bucket, for example:

   ```text
   portfolio-template-media
   ```

5. Keep `Standard` storage class for normal portfolio media.
6. Put the bucket name into:

   ```env
   CLOUDFLARE_R2_BUCKET="portfolio-template-media"
   ```

7. Make sure `wrangler.jsonc` uses the same bucket name:

   ```jsonc
   "r2_buckets": [
     {
       "binding": "MEDIA_BUCKET",
       "bucket_name": "portfolio-template-media"
     }
   ]
   ```

## 3. Create Cloudflare Credentials

### D1 API Token

Create a custom Cloudflare API token with permission to query and manage the product D1 database.

Use it in:

```env
CLOUDFLARE_D1_API_TOKEN=""
```

### R2 Access Key

Create an Account API token / S3-compatible R2 access key with:

- Permission: `Object Read & Write`.
- Bucket scope: the product media bucket only.
- TTL: `Forever` for production server credentials, or a planned rotation period if your team has a rotation process.

Use the S3 client credentials in:

```env
CLOUDFLARE_R2_ACCESS_KEY_ID=""
CLOUDFLARE_R2_SECRET_ACCESS_KEY=""
```

The Cloudflare account ID goes into:

```env
CLOUDFLARE_ACCOUNT_ID=""
CLOUDFLARE_R2_ACCOUNT_ID=""
```

`CLOUDFLARE_R2_ACCOUNT_ID` can match `CLOUDFLARE_ACCOUNT_ID` unless R2 lives in a separate account.

## 4. Configure Env

Copy:

```bash
copy .env.example .env.local
```

Fill required values:

```env
CLOUDFLARE_ACCOUNT_ID=""
PRODUCT_CLOUDFLARE_ENV_CONFIRMED="true"
CLOUDFLARE_D1_DATABASE_ID=""
CLOUDFLARE_D1_API_TOKEN=""
CLOUDFLARE_R2_ACCOUNT_ID=""
CLOUDFLARE_R2_ACCESS_KEY_ID=""
CLOUDFLARE_R2_SECRET_ACCESS_KEY=""
CLOUDFLARE_R2_BUCKET=""
CLOUDFLARE_R2_PUBLIC_BASE_URL=""
NEXT_PUBLIC_SITE_URL="https://your-production-domain.example"
DATA_BACKEND="cloudflare-d1"
NEXT_PUBLIC_DATA_BACKEND="cloudflare-d1"
NEXT_PUBLIC_FFMPEG_BASE_URL="/r2/ffmpeg"
JWT_SECRET=""
PASSWORD_SALT=""
ADMIN_PASSWORD_SCRYPT=""
REVALIDATION_TOKEN=""
FEATURE_CLIENT_PASSWORD_RESET="true"
CLIENT_PASSWORD_RESET_TOKEN_TTL_MINUTES="30"
```

Generate fresh secrets per product install. Do not reuse personal portfolio secrets.

For production client password reset, configure email delivery:

```env
NOTIFICATION_PROVIDER="resend"
NOTIFICATION_API_KEY=""
NOTIFICATION_DEFAULT_FROM=""
NEXT_PUBLIC_SITE_URL="https://your-production-domain.example"
```

Without those values, client reset password cannot be considered self-service in production.

## 5. Bootstrap Product Data

Apply schema:

```bash
npm run cf:bootstrap
```

Upload browser FFmpeg assets to R2:

```bash
npm run r2:upload-ffmpeg
```

Seed clean demo site/project data:

```bash
npm run cf:seed-demo
```

Run readiness:

```bash
npm run cf:readiness
```

Expected result:

```text
Summary: all checks passed.
```

## 6. Local Smoke Test

Start the app:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
http://localhost:3000/client/login
http://localhost:3000/client/dashboard
```

For Cloudflare Worker local runtime:

```bash
npm run cf:build
npx wrangler dev --env-file .env.local --port 8788
```

Smoke URLs:

```text
http://localhost:8788/api/health
http://localhost:8788/client/login
http://localhost:8788/api/public/sites/demo-designer/projects
```

Stop `wrangler dev` after testing so `.open-next` is not locked on Windows.

## 7. Deploy

Run:

```bash
npm run cf:deploy
```

After deploy:

1. Open the Cloudflare Worker URL or custom domain.
2. Run production smoke:

   ```bash
   npm run release:smoke -- --url https://your-production-domain.example --site-slug demo-designer
   ```

3. Check `/api/health`.
4. Check public site route.
5. Login to Master admin.
6. Create a new site.
7. Create a client access account.
8. Send the client `/[siteSlug]/login`, email, and initial password.
9. Login as client at `/[siteSlug]/login`.
10. Test `Lupa Password` and confirm the reset email is delivered.
11. Upload a cover/gallery media file.
12. Verify media appears and R2 usage updates.

## 8. Operating Model

- Master admin creates and manages sites.
- Master admin sets site status and optional quota overrides.
- Client dashboard is self-service per site.
- Client password reset is self-service only when email delivery is configured.
- All clients are limited by project, storage, and media-per-project quota.
- Higher quota is sold as an add-on when needed.

## 9. Do Not Do

- Do not deploy to Vercel.
- Do not create one deployment per buyer.
- Do not store media outside `sites/{siteId}/...` unless it is shared product asset such as `ffmpeg/*`.
- Do not paste secret values into docs, tracker logs, or issue comments.
- Do not reintroduce personal Telegram/job-hunter/contact credentials into the product template.
- Do not sell reset password as self-service until `NOTIFICATION_PROVIDER`, `NOTIFICATION_API_KEY`, `NOTIFICATION_DEFAULT_FROM`, and `NEXT_PUBLIC_SITE_URL` are configured.
