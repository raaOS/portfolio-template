# Fitur: Deferred R2 — Onboarding Tanpa Media + Wizard Aktivasi Klien (v1.3.78)

**Tanggal:** 2026-11-09 · **Status:** 🟢 Selesai (gladi end-to-end DITUNDA owner 2026-11-12)
**Pemicu:** Owner tidak bisa mengaktifkan R2 di akun Cloudflare klien tanpa kartu
(CF error 10042), dan menolak memakai 1 kartu untuk puluhan akun (risiko suspend
massal oleh sistem anti-abuse Cloudflare yang mengorelasikan metode pembayaran).

---

## 1. Keputusan Desain (hasil diskusi owner + 3 ronde red-team)

**Flow yang disepakati:**

```
Deploy hari-1 TANPA R2 (situs online, konten teks jalan, 0 request R2)
  → owner kirim WA: link wizard (?onboard=<token>) + kredensial Cloudflare
  → klien aktivasi R2 sendiri di dashboard Cloudflare (PayPal/debit, GRATIS)
  → owner klik "Selesaikan Setup" (= deploy ulang via /api/deploy-client)
  → bucket dibuat + binding ditulis + build ulang + D1 flag media_pending=false
```

**Prinsip yang dijaga:**
- Arsitektur "1 klien = 1 R2" **tetap** — hanya timing-nya yang diubah.
- Klien tanpa token wizard **tidak melihat apa pun baru** di situsnya.
- Kredensial & kartu klien hanya menyentuh halaman resmi Cloudflare.
- Error 10042 **tanpa** flag `R2_PENDING` (klien lama) tetap fail-closed (kontrak K8).

**Temuan red-team terpenting yang sudah ditutup (semua file:line di commit ini):**
| # | Temuan | Fix |
|---|---|---|
| F1/F2 (r2) | Fallback `\|\| media-${slug}` / `\|\| '/r2'` menghidupkan ulang nilai kosong → posture pending mustahil tercapai | `buildClientEnvPlan` membaca `R2_PENDING` dan **memaksa** `''` |
| F1 (r3) | Probe R2 di bawah perhitungan env → finalisasi publish build tanpa media | Probe di-hoist di atas `buildClientEnvPlan`; flag in-memory dihapus sebelum plan |
| F3 (r2) | Finish buntu: bucket tak pernah dibuat + probe `create:false` → 404 | Probe `create:true` saat flag aktif (PUT idempoten) |
| F4 (r2) | Tulis D1 raw (bukan JSON) dibaca `null` oleh `getSiteSetting` | Semua nilai `JSON.stringify`, bentuk INSERT mirror `setSiteSetting` (kolom `id`, FK `sites`) |
| #2 (r3) | `upsertConfigEnv` tidak mengubah objek in-memory → deploy finalisasi tetap media-off | `delete config.R2_PENDING` sebelum plan |
| F9 (r3) | Placement lock provision setelah header SSE → `ERR_HTTP_HEADERS_SENT` | Cek+set lock di paling atas handler |
| F6 (r2) | `NEXT_PUBLIC_ADMIN_WA` selalu kosong di build klien | Seed `platform_settings.owner_whatsapp` dari portal env (`ADMIN_WHATSAPP`/`NEXT_PUBLIC_ADMIN_WA`), wizard baca via `getOwnerWhatsapp()` |
| #4 (r2) | Gate pada flag saja = flag tak pernah ke-clear → media mati selamanya | Finalisasi tulis D1 **dulu**, baru hapus flag config.env (self-healing) |
| #2 (r2) | Half-deferred (binding dihapus, env masih terisi) → 502 ke pengunjung | Kedua kunci R2 dipaksa kosong di plan pending |
| F5/F10/F11 (r3) | Gate bolong: backup GET 500 mentah, direct gate salah posisi, proof-upload match-by-message | Semua gate diseragamkan via `mediaDisabled()`; posisi direct = setelah token & sebelum body |

Detail lengkap 3 ronde: ronde 1 (runtime & graceful degradation), ronde 2
(provisioning/deploy), ronde 3 (delta perbaikan + inventaris test).

## 2. Daftar File yang Diubah / Dibuat

**Onboarding (portal & deploy):**
| File | Perubahan |
|---|---|
| `scripts/onboarding/client-deploy.ts` | `R2BucketCheck.pending` (10042); `buildClientEnvPlan` posture pending (paksa kosong 2 kunci R2); `WranglerClientInput.skipR2` + binding kondisional; probe R2 hoisted di `deployClient` (`create:true` saat flag, hapus flag in-memory saat sukses, fail-loud tanpa flag); log `[CONFIG]` baru |
| `scripts/onboarding/server.ts` | STEP 3 lanjut pada 10042 (pending); STEP 4d seed `site_settings` (`media_pending`, `wizard_token_hash`, `wizard_token_created_at`) + `platform_settings.owner_whatsapp` + verifikasi baca-balik; `controlledEnv` + `R2_PENDING`/`WIZARD_TOKEN`, filter `R2_PENDING` dari `leftoverKeys`; surat serah terima + WA message berisi seksi wizard; return `r2Pending`/`wizardUrl`; lock provision (atas handler, release di finally); finalisasi di loop `/api/deploy-client` (`finalizeDeferredMediaInD1` → hapus flag config.env); endpoint baru `POST /api/r2-pending/check` |
| `scripts/onboarding/portal-clients.ts` | `ClientSummary.r2Pending` + `wizardUrl`; `buildWizardUrl()`; `readClientDetail` ikut |
| `scripts/onboarding/cloud-manager.ts` | **Tidak diubah** — CLI sengaja tetap fail-closed di 10042 (pending flow portal-only) |

**Runtime aplikasi:**
| File | Perubahan |
|---|---|
| `src/lib/api-response.ts` | Helper `mediaDisabled()` (503) |
| `src/lib/r2Storage.ts` | Normalisasi kegagalan import S3-fallback di `getR2BucketOrFallback` |
| `src/app/api/admin/upload/route.ts` | Gate ×2 → `mediaDisabled()` |
| `src/app/api/admin/upload/presign/route.ts` | idem |
| `src/app/api/admin/upload/direct/route.ts` | Gate baru: setelah token+target, sebelum body |
| `src/app/api/admin/backup/route.ts` | GET: R2 off → `backups: []` (bukan 500) |
| `src/app/api/admin/backup/download/route.ts` | Gate `mediaDisabled()` |
| `src/app/api/admin/sites/[siteId]/project-cover/route.ts` | idem |
| `src/app/api/admin/sites/[siteId]/project-media/route.ts` | idem |
| `src/app/api/admin/sites/[siteId]/project-video/presign/route.ts` | idem |
| `src/app/api/admin/wallpaper-poster-backfill/route.ts` | idem |
| `src/app/api/billing/orders/[orderId]/proof-upload/route.ts` | Gate eksplisit sebelum `uploadToR2` |
| `src/app/api/r2/[...key]/route.ts` | Pesan 503 → `Media belum diaktifkan` |
| `src/app/api/onboarding/r2-status/route.ts` | **BARU** — status wizard (selesai/menunggu), sha256+timing-safe Web Crypto, umur 30 hari, rate limit 30/menit, deep-link & WA hanya untuk token valid |
| `src/components/onboarding/R2ActivationWizard.tsx` | **BARU** — overlay wizard (baca `window.location.search`, tanpa `useSearchParams`) |
| `src/app/layout.tsx` | Mount `<R2ActivationWizard />` |
| `src/lib/constants.ts` | `APP_VERSION` → 1.3.78 |

**Test:**
- Update ekspektasi 500→503: `upload/route.test.ts`, `upload/presign/route.test.ts`, `project-cover/route.test.ts`, `project-media/route.test.ts`, `wallpaper-poster-backfill/__tests__/route.test.ts`, `api/r2/[...key]/route.test.ts`.
- `upload/direct/route.test.ts`: mock `isR2StorageConfigured` + test 503 baru.
- `client-deploy.test.ts`: 5 test baru (posture pending, perilaku lama, skipR2, binding lama, `pending:true`).
- `src/app/api/onboarding/r2-status/route.test.ts`: **BARU** (6 skenario).

**Docs:** `CHANGELOG.md` (1.3.78), `docs/operations/GLADI_RESIK_KLIEN_PERDANA.md` §10 (SOP), `AGENTS.md` §12, `docs/tracker/INDEX_TRACKER.md`, file ini.

## 3. Kata Kunci Baru (bacaan AI agent berikutnya)

| Kunci | Lokasi | Arti |
|---|---|---|
| `R2_PENDING="true"` | `arsip-klien/<slug>/config.env` (owner-side) | Media belum aktif; `buildClientEnvPlan` memaksa env R2 kosong; dihapus otomatis setelah finalisasi D1 sukses |
| `WIZARD_TOKEN` | config.env (owner-side, tidak pernah ke Worker) | Token mentah wizard — untuk "salin ulang link" |
| `media_pending` | D1 klien `site_settings` (JSON) | Dibaca runtime oleh `r2-status`; `false` setelah finalisasi |
| `wizard_token_hash` / `wizard_token_created_at` | D1 klien `site_settings` (JSON) | sha256 hex token + ISO timestamp; umur 30 hari |
| `wizard_completed` | D1 klien `site_settings` (JSON) | `true` setelah finalisasi — dicek PERTAMA oleh `r2-status` |
| `owner_whatsapp` | D1 klien `platform_settings` (JSON `{number}`) | Sumber nomor WA tombol wizard (chain `getOwnerWhatsapp`) |

## 4. Verifikasi

- `npx tsc --noEmit` — bersih.
- `npm run lint` — bersih.
- `npm test` — **1277 test PASS** (setelah fix fixture test pending).
- **Belum dilakukan (wajib sebelum dipakai klien nyata):** gladi end-to-end di akun uji
  (deploy pending → wizard tampil via link → aktivasi manual → Cek Pending → Selesaikan
  Setup → upload media → wizard "selesai"). Checklist: `GLADI_RESIK_KLIEN_PERDANA.md` §10.

### 4a. Update 2026-11-12 — penundaan gladi (keputusan owner)

- Deploy template **1.3.82 ke gladi TERVERIFIKASI selesai**: `deployClient()` menulis
  `arsip-klien/01_gladi-2026-10-24/CATATAN_SERAH_TERIMA.md` pukul 15:40:05Z (22:40 WIB);
  `https://makeitbatter.my.id/api/health` → `version: 1.3.82`, `database: connected`;
  root `/admin/login` `/fitur` HTTP 200, `/admin` 307 (redirect login).
- Portal onboarding lokal sudah tidak berjalan (port 4567 kosong) — tidak ada proses
  latar yang perlu dimatikan.
- **Blocker gladi deferred R2 tetap sama:** akun `gladi-2026-10-24` R2-nya **sudah aktif**
  (`config.env` berisi `CLOUDFLARE_R2_BUCKET="media-gladi-2026-10-24"`, tanpa
  `R2_PENDING`/`WIZARD_TOKEN`), jadi tidak bisa dipakai menguji postur "tanpa media".
  Jalur ini butuh **akun Cloudflare uji baru yang R2-nya sengaja belum diaktifkan**.
- **Keputusan owner 2026-11-12:** gladi deferred R2 **ditunda** ("tunda dulu"). Opsi yang
  ditolak saat itu: (a) buat akun uji baru + API Token D1+R2+Workers, (b) simulasi
  `R2_PENDING=true` + `WIZARD_TOKEN` di `config.env` gladi (gladi jadi tanpa media
  sementara, dan tidak menguji error 10042 asli). **Jangan dijalankan tanpa izin owner.**
  Kode v1.3.78 tetap seperti teruji unit (1277 test PASS); yang belum ada hanya bukti
  end-to-end di akun Cloudflare nyata.

## 5. Sisa Risiko (diputuskan owner — SOP, bukan kode)

1. Klien bisa menghapus bucket/Worker-nya sendiri di dashboard (akun milik klien) →
   buat ulang via Selesaikan Setup + upload ulang.
2. Kartu klien kadaluarsa belakangan → media suspend; klien update kartu.
3. Backup harian D1 klien skip selama pending (butuh R2) — menyala otomatis setelah finalisasi.
