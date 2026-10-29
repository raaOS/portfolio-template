# Dokumentasi Script Proyek

Direktori ini berisi berbagai script utilitas dan alat bantu untuk Portfolio OS Template.

## 📂 Struktur Folder

| Folder         | Tujuan                                   | Script Utama                                        |
| -------------- | ---------------------------------------- | --------------------------------------------------- |
| `core/`        | Alat bantu pengembangan utama            | `dev.js`                                            |
| `deploy/`      | Pengecekan sebelum deployment            | `pre-deploy-check.js`                               |
| `explorer/`    | Pengelolaan data Explorer                | `seed-explorer.ts`, `cleanup-explorer.ts`           |
| `generators/`  | Generator konten dan data testing        | `seed-testimonials.js`, `magic-caption.js`          |
| `maintenance/` | Kesehatan sistem, audit, dan pembersihan | `audit.ts`, `check-db.mjs`, `check-urls.js`         |
| `media/`       | Alat bantu aset (Gambar/Video)           | `optimize-assets.js`                                |
| `performance/` | Pemantauan dan analisis performa         | `analyze-bundle.js`, `lighthouse.js`, `monitor.js`  |
| `security/`    | Validasi keamanan dan environment        | `admin-hash.js`, `validate-env.js`                  |
| `test/`        | Utilitas testing khusus                  | `storage-stats-smoke.mjs`                           |
| `utils/`       | Utilitas script umum                     | `clear-cache.js`, `ensure-next-dev-not-running.js`  |

## 🚀 Perintah Utama

### Optimasi Performa

Jalankan satu per satu sesuai kebutuhan (mis. `node scripts/performance/lighthouse.js <url>`).

### Audit Sistem

Untuk menjalankan audit proyek menyeluruh (lint, types, health):

```bash
npm run audit
```

### Pengelolaan Password Admin

Untuk membuat hash Scrypt baru untuk password admin:

```bash
node scripts/security/admin-hash.js generate "password-baru-anda"
```

### Optimasi Aset

Untuk mengoptimasi gambar dan video yang ada di repository:

```bash
node scripts/media/optimize-assets.js
```

### Audit Media Project Cloudflare

Untuk memeriksa sinkronisasi D1/R2 media project multi-site:

```bash
npm run media:audit-projects
```

## ⚠️ Catatan

- Selalu jalankan script dari root (folder utama) proyek.
- Sebagian besar script membutuhkan variabel environment yang sudah dikonfigurasi di `.env.local`.
- Gunakan `maintenance/audit.ts` secara berkala untuk memastikan integritas proyek.
