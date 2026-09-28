# Log: Pipeline Analitik Pengunjung — dari blob 100 entri ke D1 site-scoped + Panel Admin (v1.3.10)

**Tanggal:** 2026-09-28
**Status:** 🟡 Selesai (kode + verifikasi runtime); **panel UI belum dilihat di browser** karena butuh kredensial login admin
**Permintaan owner:** "lalu apa lagi ya yg bisa dikerjakan di project ini? fitur lain" → dari tiga opsi yang ditawarkan, owner memilih **"Rapikan analitik tamu"**

---

## 1. Temuan Awal (audit sebelum menulis kode)

Backlog resmi di `docs/tracker/INDEX_TRACKER.md` **kosong** (baris 15), jadi ini pekerjaan baru, bukan antrean. Audit menemukan **tiga lapis analitik yang tidak saling tersambung**:

| Lapisan | Kondisi (bukti) |
|---|---|
| **Capture** | `useAnalytics` → `POST /api/analytics` → menumpuk di JSON `analytics/logs` dengan **kapak `MAX_LOGS = 100`** (read-modify-write: 1 read + 1 write per event, entri terlama terbuang). Hanya **3 event di seluruh app**: `header_search_click` (`src/components/shared/Header.tsx:160`), `CV_PRINT` (`src/app/(site)/cv/_components/hooks/useCvExport.ts:31`), `CV_DOWNLOAD_PREMIUM` (`useCvExport.ts:41`). **Tidak ada `page_view` sama sekali.** |
| **Aggregate** | `src/lib/services/analyticsService.ts` + tabel D1 `site_analytics` (UPSERT per `site_id`, Sprint 63) — grep seluruh repo: **0 importer**. Klasifikasinya mengharapkan `page_view`/`project_view`/`app_view`, sedangkan tidak ada kode yang mengirim ketiganya. |
| **Tampil** | `GET /api/analytics` ada (admin-only) tapi **0 UI membacanya**; `SiteAnalyticsSummary` 0 konsumen; `features.analytics` di `config/route.ts:29` 0 konsumen. |

Bukan analitik: `/api/metrics` = **like/share** project (`likes`/`shares`) — di luar lingkup, tidak disentuh.

## 2. Keputusan Owner

1. **Hitung page view** (opsi yang direkomendasikan) — tanpa ini dashboard hanya berisi 3 angka langka.
2. **Panel baru di desktop admin** (bukan popout, bukan client dashboard).
3. **Ganti total ke D1** — blob 100 entri dibuang (isinya hanya 3 jenis event langka, tidak ada nilai historis).

Owner juga disampaikan lebih dulu bahwa `recordHit` apa adanya menulis **2 baris D1** per hit (UPSERT `site_analytics` + `INSERT audit_logs`), sehingga jejak keamanan tercampur baris analitik. Owner menerima rencana pembuangan tulisan `audit_logs` tersebut.

## 3. Perubahan Kode

### Backend
- **`src/lib/services/analyticsService.ts`**
  - Tulisan `audit_logs` **dihapus** → 1 kunjungan = **1 write D1** (sebelumnya 2) dan `audit_logs` murni jejak keamanan lagi.
  - `VALID_EVENT_TYPES` kini daftar tertutup berisi hanya event yang benar-benar dipancarkan app: `page_view`, `header_search_click`, `CV_PRINT`, `CV_DOWNLOAD_PREMIUM` (+ komentar "tambahkan di sini saat menambah event baru").
  - Penambahan `bucketPagePath()`: path diambil segmennya (`/projects/abc` → `/projects`) dan hanya diizinkan untuk route publik yang dikenal (`/`, `/about`, `/contact`, `/cv`, `/projects`, `/preview`, `/checkout`, `/orders`); sisanya → `/lain`.
  - `getSummary()` kini juga mengembalikan `topPages` (halaman populer) dan `otherEvents`; baris di luar tiga kategori tidak lagi hilang begitu saja.
- **`src/app/api/analytics/route.ts`** — ditulis ulang:
  - `POST`: validasi Zod (tetap) → cek allowlist → `analyticsService.recordHit(SITE_ID, event, details.path)`. Rate limit **30 req/60 dtk dipertahankan**.
  - `GET`: `validateAdminRequest` (tetap) → `{ summary }` menggantikan `{ logs }`.
  - `catch` kini **melog** error sebelum membalas 500 (sebelumnya menelan; inilah yang membuat bug diam sulit ditemukan).

### Frontend
- **`src/components/layout/PageViewTracker.tsx`** (baru) — beacon `page_view` reaktif terhadap `usePathname()`, dengan guard ref agar React StrictMode tidak menghitung dua, `keepalive: true`, gagal diam, dan melewati `/admin` + `/setup`.
- **`src/app/layout.tsx`** — memasang `PageViewTracker` di root layout. Sengaja **bukan** di route-group `(site)`: berkas `page.tsx` homepage ada di root `src/app/`, jadi dipasang di `(site)` akan melewatkan `/`.
- **`src/app/admin/desktop/panels/AnalyticsPanel.tsx`** (baru) — ringkasan memakai pola React Query yang sudah dipakai admin (`useQuery` + `ADMIN_QUERY_KEYS` + `fetchAdminAnalytics`). Bagian yang datanya kosong (proyek terpopuler / aplikasi populer) **tidak dirender**, bukan menampilkan angka nol yang membingungkan.
- **`src/app/admin/lib/adminQueries.ts`** — menambah `ADMIN_QUERY_KEYS.analytics` dan `fetchAdminAnalytics()` (memakai helper `fetchJson` yang sudah ada).
- **`src/app/admin/desktop/registry.ts`** — app `analytics` ("Statistik Pengunjung", `BarChart3`) di zone `system` + entri `APP_ROUTE_MAP.analytics = '/admin/system/analytics'`.
- **`src/app/admin/desktop/WindowContentRenderer.tsx`** — dynamic import + `PANEL_MAP.analytics`.
- **`src/app/admin/system/analytics/page.tsx`** (baru) — route standalone mengikuti pola `sounds` (deep-link `AdminAuthGuard` + `AdminHeader`).

## 4. Perubahan Logika / Perilaku yang Sudah Ada (laporan ke owner)

| # | Perubahan | Alasan |
|---|---|---|
| 1 | `recordHit` tidak lagi menulis ke `audit_logs` | 1 hit = 1 write D1; jejak keamanan tidak boleh tercampur baris analitik |
| 2 | `GET /api/analytics` mengembalikan `{ summary }`, bukan `{ logs }` | grep repo: **0 konsumen** endpoint lama |
| 3 | `event` di luar allowlist kini **400** (dulu diterima apa pun) | endpoint terbuka untuk pengunjung; `event_type` bebas = baris D1 tak terbatas |
| 4 | `target_slug` `page_view` di-bucket ke segmen pertama route yang dikenal | mencegah pembuatan baris tak terbatas lewat `path` bebas |
| 5 | Deskripsi zone `system` kini menyebut "statistik pengunjung" | teks agar tidak kedustaan setelah app ditambahkan |

**Keamanan/kuaota:** jumlah baris `site_analytics` per site kini **dibatasi desain** — maksimal 8 bucket halaman + 1 baris per event non-page (`main`) + bucket `/lain`, bukan tumbuh mengikuti path apa pun yang bisa dikirim pihak luar. Rate limit 30/60 dtk tetap menjadi pelindung kedua.

**Catatan kuota (pengingat setelah insiden KV kemarin):** setiap kunjungan kini = **1 write D1**. Kuota harian D1 gratis jauh lebih longgar daripada KV, dan write ini jauh lebih murah daripada pola lama (1 read + 1 write blob per event). Bila trafik naik drastis, inilah yang perlu dipantau.

## 5. Verifikasi

**Gate:** `npx tsc --noEmit` **0**, `npm run lint` **0**, `npx vitest run` **113 files / 863 tests PASS** (6 test baru: allowlist, bucketing, slug tetap untuk event non-page, 401, bentuk ringkasan).

**Runtime (dev server `localhost:3000`):**

| Uji | Hasil |
|---|---|
| `POST` `page_view` path `/projects/some-project` | `200 {"success":true}` |
| `POST` event di luar allowlist | `400 "Unsupported analytics event"` |
| `POST` payload kosong | `400 "Invalid analytics payload"` |
| `GET` tanpa login | `401 {"error":"Unauthorized"}` |
| `GET /admin/system/analytics` | `307` → `/admin/login?redirect=...` (route + deep-link hidup) |
| `/`, `/about`, `/preview/os-desktop` | `200` |

**Bukti tulisan ke D1 remote (dibaca langsung lewat Cloudflare API, bukan asumsi):**

```
event_type  target_slug  hit_count  last_active
page_view   /projects            1  2026-09-28T14:55:20Z   <- curl, path /projects/some-project
page_view   /projects            2  2026-09-28T14:59:02Z   <- + browser
page_view   /about               1  2026-09-28T14:57:52Z   <- beacon browser
page_view   /                    1  2026-09-28T14:57:02Z   <- beacon browser
page_view   /preview             4  2026-09-28T14:57:53Z   <- tab dev lain kena HMR reload
```

Bucketing terbukti di data nyata: input `/projects/some-project` tersimpan sebagai **`/projects`**.

**Belum diverifikasi:** tampilan panel di browser — `GET` diblokir `validateAdminRequest`, dan `.env.local` hanya berisi `ADMIN_PASSWORD_SCRYPT` (hash), bukan sandi plaintext, sehingga login tidak bisa dilakukan dari sesi ini.

## 6. Temuan Sampingan (belum ditindaklanjuti, perlu persetujuan)

1. **App "Asisten AI" kemungkinan rusak**: `ai` ada di `ADMIN_ZONES` + `APP_ROUTE_MAP`, tapi **tidak ada di `PANEL_MAP`** `WindowContentRenderer.tsx` → klik dari folder zone akan menampilkan teks *"Panel "ai" belum tersedia"*.
2. **`FEATURE_ANALYTICS="false"`** di `.env.example:69` dan `.env.local:58` tetap **tidak dipakai** di mana pun (hanya diiklankan di `config/route.ts:29`). Panel dan endpoint tidak digate; bila kelak ingin bisa dimatikan per customer, gate-nya harus disambungkan.
3. **Beacon hanya menjangkau root layout** → route `[siteSlug]` (`/{slug}`, dipakai bila `FEATURE_CUSTOM_DOMAIN=true`) **belum terhitung**.
4. **`project_view` / `app_view` belum punya emitter**, sehingga bagian "Proyek terpopuler" dan "Aplikasi paling sering dibuka" baru muncul setelah beacon-nya ditambahkan (`useProjectDetail` / `useWindowActions.openWindow`).
5. `src/app/admin/components/AdminConstants.ts` (`NAV_ITEMS`) **dead code** — tidak diimpor di mana pun.

## 7. File Dimodifikasi

**Baru (4 kode + 1 dokumen):**
- `src/components/layout/PageViewTracker.tsx`
- `src/app/admin/desktop/panels/AnalyticsPanel.tsx`
- `src/app/admin/system/analytics/page.tsx`
- `docs/tracker/logs/visitor_analytics_pipeline_2026_09_28.md`

**Diubah (7):**
- `src/lib/services/analyticsService.ts`
- `src/app/api/analytics/route.ts`
- `src/app/api/analytics/route.test.ts`
- `src/app/layout.tsx`
- `src/app/admin/lib/adminQueries.ts`
- `src/app/admin/desktop/registry.ts`
- `src/app/admin/desktop/WindowContentRenderer.tsx`
