# Tracker Log: Verifikasi Audit Eksternal — 403 Forbidden & D1 Binding

**Status:** 🟢 Selesai (read-only, 0 file source diubah)
**Tanggal:** 2026-10-02

## 🎯 Tujuan (Objective)
Membuktikan atau membantah 3 temuan audit eksternal pada deployment produksi `makeitbetter.my.id`:
1. Situs mengembalikan 403 Forbidden (blocker publish).
2. D1 `portfolio-template-prod` tidak ter-binding ke Worker → perlu tambah `d1_databases`.
3. D1 Read Replication disabled → perlu diaktifkan.

## 📋 Task List
- [x] Cari sumber pesan 403 di seluruh repo (grep literal `are not allowed` / `requests to ... are not allowed` / `Forbidden`) — **tidak ada satupun di source** → pesan itu bukan buatan aplikasi.
- [x] Baca `wrangler.jsonc` (binding: `ASSETS`, `MEDIA_BUCKET`, `NEXT_INC_CACHE_KV`, `NEXT_TAG_CACHE_KV`, `WORKER_SELF_REFERENCE`, tanpa `vars`/`secrets`).
- [x] Telusuri jalur akses D1 runtime.
- [x] Cek respons live produksi.

## 🔎 Temuan

### 1. 403 TIDAK REPRODUCIBLE (false positive)
- `GET https://makeitbetter.my.id/` → **200**, HTML homepage lengkap (Marketplace "Make it Better Studio", harga Rp 199.000).
- `GET https://makeitbetter.my.id/api/health` → **200**
  `{"status":"ok","database":"connected","databaseBackend":"cloudflare-d1","databaseLatencyMs":145}` (timestamp `2026-10-02T16:49:21Z`).
- `https://www.makeitbetter.my.id/` → transport error (tidak ada DNS record `www`; Custom Domain Workers hanya cocok hostname persis — dokumen Cloudflare `custom-domains`).
- Kesimpulan: tidak ada block aktif di edge maupun di aplikasi saat diuji. Pesan `Forbidden: requests to … are not allowed` tidak berasal dari kode repo.

### 2. Binding D1: TIDAK DIPERLUKAN (arsitektur by-design pakai REST API)
- `db` (`src/lib/database.ts:385`) → `D1Database`/`D1Reference` → `src/lib/cloudflareD1.ts` → `queryD1()` = `fetch()` ke `https://api.cloudflare.com/client/v4/accounts/{acc}/d1/database/{id}/query`.
- Env yang dibutuhkan: `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_D1_DATABASE_ID` + `CLOUDFLARE_D1_API_TOKEN` (ditanam saat build dari `.env.local`, lihat log `security_audit_flow_2026_09_29`).
- Grep `env.DB` / `D1Database` binding / `d1_databases` di `src/` = **0 pemakaian**. `wrangler.customer.toml` punya `[[d1_databases]]` hanya sebagai **template komentar untuk customer**.
- Bukti empiris: health check menjalankan read nyata (`db.ref('_healthCheck').once('value')`) dan lulus 145 ms → D1 terjangkau dari Worker tanpa binding.
- Menambah blok `d1_databases` ke `wrangler.jsonc` saat ini = **dead config** (tak ada kode yang membacanya) kecuali disertai migrasi `queryD1()` ke `env.DB.prepare()`.

### 3. Read Replication: tidak berpengaruh pada jalur akses sekarang
Replika baca D1 dipakai lewat binding + `db.withSession()`; endpoint REST `/query` selalu membaca primer. Jadi menyalakan replication sekarang tidak menambah performa apa pun.

## 📂 File yang Dimodifikasi (Modified Files)
- `docs/tracker/logs/audit_403_d1_binding_2026_10_02.md` (baru)
- `docs/tracker/INDEX_TRACKER.md` (entri 124)

## 🐛 Bug & Perbaikan (Bug Tracker)
Tidak ada bug aplikasi yang ditemukan/diperbaiki. Dua temuan audit **dibantah dengan bukti**, satu (`www.` tidak resolve) adalah informasional.

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)
- **Jangan** menambahkan `d1_databases` ke `wrangler.jsonc` tanpa keputusan owner — itu memicu asumsi binding padahal kode tetap pakai REST API.
- Kalau kelak ingin migrasi ke binding `env.DB`: keuntungan = tiap query tidak lagi jadi subrequest keluar ke `api.cloudflare.com` (hemat latensi 100+ ms & kuota subrequest Workers Free per request), token D1 tak perlu tertanam di bundel. Cost = rewrite `src/lib/cloudflareD1.ts` + `src/crud/shared/db/connection.ts` + semua script yang memakai REST, plus uji ulang. Butuh persetujuan owner (perubahan logika inti).
- Jika 403 benar-benar terulang di browser: minta `cf-ray` dari respons, lalu cek Security Events pada jam yang sama; kalau dari klien non-browser (curl/datacenter IP) itu profil khas Bot Fight Mode, bukan WAF rule.
