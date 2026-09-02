# Tracker Log: Sprint 75 — Customer CRUD Foundation (Managed Service)

**Status:** 🟢 Completed
**Mulai:** 2026-09-01
**Selesai:** 2026-09-01
**Commit:** `5b662a2` on `origin/main`
**Verified:** tsc 0 error, eslint 0 warning, 104 files / 791 tests PASS

---

## 🎯 Tujuan (Objective)

Membangun fondasi **Managed Service** di mana:
- 1 customer = 1 Cloudflare account → 1 D1 + 1 R2 + 1 deployment
- Owner deploy template + CRUD ke akun customer
- Customer dapat admin panel (macOS desktop style) untuk kelola konten
- Tidak ada multi-tenant resolution — SITE_ID hardcoded per deployment

**Mengapa perubahan ini?**
Arsitektur sebelumnya (multi-tenant single platform) terlalu kompleks untuk target customer <50 dengan harga premium (Rp 500rb-2jt per setup). Managed service lebih sederhana, lebih aman (isolasi total per customer), dan lebih mudah di-maintain.

---

## 📋 Task List (6 Fase)

### Fase 1: Customer Auth System ✅
- [x] Buat `src/crud/shared/config.ts` — SITE_ID hardcoded dari env `CUSTOMER_SITE_ID`
- [x] Buat `src/app/api/auth/login/route.ts` — POST login endpoint (email+password)
- [x] Buat `src/app/api/auth/logout/route.ts` — POST logout endpoint (clear cookies)
- [x] Buat `src/app/api/auth/check-auth/route.ts` — GET auth check + CSRF token
- [x] Buat `src/middleware/customer-auth.ts` — JWT verification via jose (Edge-compatible)
- [x] Modifikasi `src/middleware.ts` — switch dari owner auth ke customer auth
- [x] Modifikasi `src/middleware/constants.ts` — tambah `/api/auth/*` ke publicRoutes
- [x] Modifikasi `src/app/admin/login/page.tsx` — pakai `verifySiteUserJWT` bukan `verifyAdminToken`
- [x] Modifikasi `src/app/admin/login/_hooks/useAdminLogin.ts` — tambah email field, POST ke `/api/auth/login`
- [x] Modifikasi `src/app/admin/login/_components/LoginForm.tsx` — tambah email input field
- [x] Modifikasi `src/app/admin/login/_components/AdminLoginClient.tsx` — pass email props
- [x] Modifikasi `src/hooks/useAdminAuth.ts` — point ke `/api/auth/check-auth` dan `/api/auth/logout`

### Fase 2: API Routes — Hardcode SITE_ID ✅
- [x] Modifikasi `src/lib/admin/siteRequestContext.ts` — import SITE_ID dari shared config
- [x] Modifikasi `src/lib/admin/projectSiteContext.ts` — import SITE_ID dari shared config
- [x] Modifikasi `src/lib/admin/siteMutationAuth.ts` — pakai shared core auth (`getSiteUserSession`) bukan owner auth

### Fase 3: Simplify Admin UI ✅
- [x] Modifikasi `src/app/admin/desktop/registry.ts` — hapus zone "Manajemen Sistem & Klien" (clientDashboard, paymentConfig, orders)
- [x] Hapus import icon yang tidak dipakai (Building2, PanelTop, CreditCard, ReceiptText)
- [x] Hapus `clientDashboard` dari `APP_ROUTE_MAP`

### Fase 4: Schema + Seed ✅
- [x] Modifikasi `src/crud/shared/db/schema.ts` — tambah tabel `app_kv` (key-value untuk konten legacy)
- [x] Buat `src/crud/shared/db/seed.ts` — fungsi `seedDeployment()` dan `verifyDeployment()`
- [x] Buat `src/app/api/setup/route.ts` — GET (check status) + POST (seed data)
- [x] Buat `src/app/setup/page.tsx` — setup wizard UI (site name, admin email, password)

### Fase 5: Build + Deploy Scripts ✅
- [x] Buat `scripts/deploy/build-customer.sh` — build script untuk customer deployment
- [x] Buat `scripts/deploy/deploy-customer.sh` — deploy script via Wrangler CLI
- [x] Buat `wrangler.customer.toml` — config template untuk Cloudflare Pages
- [x] Buat `.env.customer.example` — env template untuk customer deployment

### Fase 6: Verify ✅
- [x] tsc --noEmit: 0 error
- [x] eslint: 0 error, 0 warning
- [x] vitest run: 104 files, 791 tests PASS
- [x] Update 24 test files untuk mock auth baru (`validateSiteMutationRequest`)

---

## 🏗️ Arsitektur Managed Service (Detail)

### Model Deployment

```
┌─────────────────────────────────────────────────┐
│  OWNER (kita)                                   │
│  - Deploy template ke akun Cloudflare customer  │
│  - Setup awal: /setup wizard                    │
│  - Maintenance: Wrangler CLI                    │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│  CUSTOMER (1 Cloudflare account)                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ D1 DB    │  │ R2 Bucket│  │ Pages    │      │
│  │ (8 tabel)│  │ (media)  │  │ (deploy) │      │
│  └──────────┘  └──────────┘  └──────────┘      │
│                                                  │
│  Admin Panel: /admin (macOS desktop style)       │
│  Setup Wizard: /setup (first-time only)          │
└─────────────────────────────────────────────────┘
```

### Auth Flow

```
Customer Login:
  /admin/login → email + password → POST /api/auth/login
  → authenticateUser(SITE_ID, {email, password})
  → verifyStoredPassword (scrypt)
  → signSiteUserJWT (jose, Edge-compatible)
  → Set cookie: site_user_token (HTTP-only, 2h TTL)

Middleware:
  /admin/* → checkCustomerAuth()
  → verifySiteUserJWT(token)
  → deriveSiteSecret(baseSecret, SITEId)
  → jwtVerify (jose)
  → Sliding refresh jika sisa < 30 menit

API Mutations:
  POST/PUT/DELETE /api/projects → validateSiteMutationRequest()
  → getSiteUserSession(request)
  → Check: session.siteId === SITE_ID && session.role === 'admin'
```

### D1 Schema (8 Tabel)

```sql
-- 1. Sites — informasi site
CREATE TABLE sites (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL DEFAULT 'pro',
  status TEXT NOT NULL DEFAULT 'active',
  active_template_key TEXT DEFAULT 'os-desktop',
  ...
);

-- 2. Site Users — login credentials
CREATE TABLE site_users (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT,
  password_algorithm TEXT DEFAULT 'scrypt',
  role TEXT NOT NULL DEFAULT 'admin',
  ...
);

-- 3. Projects — data project portfolio
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  cover_url TEXT DEFAULT '',
  gallery TEXT DEFAULT '[]',
  tags TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  ...
);

-- 4. Media Assets — referensi file di R2
CREATE TABLE media_assets (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  project_id TEXT,
  r2_key TEXT NOT NULL,
  public_url TEXT NOT NULL DEFAULT '',
  content_type TEXT DEFAULT '',
  size INTEGER DEFAULT 0,
  ...
);

-- 5. Site Settings — pengaturan site (key-value)
CREATE TABLE site_settings (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  setting_key TEXT NOT NULL,
  setting_value TEXT NOT NULL DEFAULT '{}',
  ...
);

-- 6. Audit Logs — jejak aktivitas
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT DEFAULT 'site',
  entity_id TEXT,
  ...
);

-- 7. Rate Limit — proteksi brute force
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  window_start TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 8. App KV — key-value store untuk konten legacy
CREATE TABLE app_kv (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '[]',
  ...
);
-- Keys: about, experience, skills, contact, testimonials, interests, philosophy
```

### Content Storage (app_kv)

Konten legacy (about, experience, skills, contact, testimonials) disimpan di tabel `app_kv` sebagai JSON string. Ini karena:
1. Data ini tidak relasional (nested objects, arrays)
2. Frontend sudah punya `ContentService` yang handle read/write ke app_kv
3. Migrasi ke relational tables terlalu besar untuk scope ini

**Keys di app_kv:**
| Key | Tipe | Default |
|---|---|---|
| `about` | `{headline, description, bio, ...}` | `{}` |
| `experience` | `Array<ExperienceItem>` | `[]` |
| `skills` | `Array<SkillCategory>` | `[]` |
| `contact` | `{email, phone, location, ...}` | `{}` |
| `testimonials` | `Array<Testimonial>` | `[]` |
| `interests` | `Array<Interest>` | `[]` |
| `philosophy` | `{quote, principles: [...]}` | `{}` |

### Setup Flow

```
1. Owner deploy ke akun customer (Wrangler CLI)
2. Customer buka /setup
3. Form: site name, admin email, admin password
4. POST /api/setup → seedDeployment()
   → Create site row di D1
   → Create admin user (scrypt password)
   → Seed content keys di app_kv
5. Redirect ke /admin/login
6. Customer login dengan email + password
```

### Deploy Pipeline

```bash
# 1. Build
CUSTOMER_SITE_ID=my-customer \
CLOUDFLARE_API_TOKEN=xxx \
CLOUDFLARE_ACCOUNT_ID=xxx \
./scripts/deploy/build-customer.sh

# 2. Deploy
./scripts/deploy/deploy-customer.sh my-customer <api-token> <account-id>

# 3. Customer akses: https://my-customer.pages.dev
# 4. Customer buka: https://my-customer.pages.dev/setup
```

---

## 📂 File yang Dimodifikasi (Modified Files)

### File Baru (11 files)
- `src/crud/shared/config.ts` — SITE_ID hardcoded
- `src/crud/shared/db/seed.ts` — seedDeployment(), verifyDeployment()
- `src/middleware/customer-auth.ts` — JWT verification (jose/Edge)
- `src/app/api/auth/login/route.ts` — POST /api/auth/login
- `src/app/api/auth/logout/route.ts` — POST /api/auth/logout
- `src/app/api/auth/check-auth/route.ts` — GET /api/auth/check-auth
- `src/app/api/setup/route.ts` — GET/POST /api/setup
- `src/app/setup/page.tsx` — Setup wizard UI
- `scripts/deploy/build-customer.sh` — Build script
- `scripts/deploy/deploy-customer.sh` — Deploy script
- `wrangler.customer.toml` — Cloudflare config template

### File Modifikasi (32 files)
- `src/middleware.ts` — switch ke customer auth
- `src/middleware/constants.ts` — tambah /api/auth/* ke publicRoutes
- `src/crud/shared/db/schema.ts` — tambah tabel app_kv
- `src/crud/shared/index.ts` — tambah config export
- `src/app/admin/login/page.tsx` — pakai verifySiteUserJWT
- `src/app/admin/login/_hooks/useAdminLogin.ts` — tambah email, POST ke /api/auth/login
- `src/app/admin/login/_components/LoginForm.tsx` — tambah email input
- `src/app/admin/login/_components/AdminLoginClient.tsx` — pass email props
- `src/hooks/useAdminAuth.ts` — point ke /api/auth/* endpoints
- `src/app/admin/desktop/registry.ts` — hapus owner zones
- `src/lib/admin/siteMutationAuth.ts` — pakai shared core auth
- `src/lib/admin/siteRequestContext.ts` — import SITE_ID
- `src/lib/admin/projectSiteContext.ts` — import SITE_ID
- 24 test files — update auth mocks

### File Tidak Disentuh (Fragile — Jangan Dimodifikasi)
Lihat AGENTS.md Section 3 untuk daftar file yang tidak boleh direfaktor.

---

## 🐛 Bug & Perbaikan (Bug Tracker)

### Bug 1: TypeScript error di seed.ts
- **Penyebab:** Import path salah (`./db/connection` seharusnya `./connection`), `hashPassword` tidak ada (seharusnya `createScryptPasswordRecord`), `passwordAlgorithm` bisa undefined
- **Perbaikan:** Fix import path, gunakan `createScryptPasswordRecord`, fallback `'scrypt'`

### Bug 2: TypeScript error di customer-auth.ts
- **Penyebab:** Type payload terlalu sempit (`{exp?, siteId?}`) — tidak include `email`, `role`, `sub`
- **Perbaikan:** Extend type payload untuk include semua field JWT

### Bug 3: 24 test files gagal setelah auth change
- **Penyebab:** Test mock `@/lib/auth` tapi route sekarang pakai `@/lib/admin/siteMutationAuth`
- **Perbaikan:** Tambah mock `validateSiteMutationRequest` di semua test files

---

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)

### Yang Sudah Selesai
1. Fondasi managed service sudah lengkap (auth, schema, setup, deploy)
2. Admin panel sudah bisa dipakai customer (login, CRUD projects, manage content)
3. Semua test pass (791 tests)

### Yang Belum / Backlog
1. **Content migration** — Data about/experience/skills masih pakai `app_kv` (legacy). Pertimbangkan migrasi ke relational tables di masa depan.
2. **Owner admin panel** — Panel owner untuk manage multiple customers belum dibangun. Saat ini owner deploy manual via Wrangler CLI.
3. **Customer dashboard** — Customer saat ini langsung masuk ke admin desktop. Pertimbangkan tambah dashboard sederhana sebelum masuk ke desktop.
4. **Password reset** — Belum ada alur reset password untuk customer.
5. **Rate limiting** — Rate limit login belum diimplementasi di `/api/auth/login`.
6. **Audit logging** — Audit log untuk login/logout belum diimplementasi.

### Konsep Kunci untuk AI Selanjutnya
- **SITE_ID** = `process.env.CUSTOMER_SITE_ID || 'default-site'` — hardcoded, tidak ada multi-site resolution
- **Auth cookie** = `site_user_token` (bukan `admin_token`)
- **Auth library** = `jose` (Edge-compatible, bukan `jsonwebtoken`)
- **Content storage** = `app_kv` table (key-value JSON) — bukan relational tables
- **Admin UI** = 3 zones: content, system, communications (owner zones sudah dihapus)
- **Test mock** = Mock `@/lib/admin/siteMutationAuth` bukan `@/lib/auth`
