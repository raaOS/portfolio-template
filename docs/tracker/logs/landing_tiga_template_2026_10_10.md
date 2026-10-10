# Landing Storefront: Spatial Gallery Dicantumkan — 3 dari 3 Template Demo Tampil di Alur Bisnis (2026-10-10)

**Status:** ✅ Selesai — produksi live **v1.3.31**.
**Perintah owner:** _"masih belum ketahap onboarding klien pertama, karena sebenarnya ada 3 template demo, dan tinggal 1 belum dicantumkan di website, alur bisnis"_.

---

## 1. Diagnosis (diverifikasi langsung, bukan tebakan)

- Tiga template demo resmi: `os-desktop`, `infinite-canvas`, `spatial-gallery` — `PREVIEW_SLUGS` (`src/app/preview/[template]/page.tsx`), registry (`src/lib/templates/registry.ts`), halaman `/preview/<slug>` SSG ketiganya ada dan ikut ter-build (72/72 halaman statis).
- **Checkout sudah lengkap** (`src/app/checkout/page.tsx`): ketiga template terdaftar — pembeli bisa memilih Spatial Gallery.
- **Landing/storefront `/` hanya menampilkan 2:** `src/components/landing/LandingPage.tsx` array `TEMPLATES` berhenti di os-desktop + infinite-canvas; hero juga menulis "Dua pilihan template".
- Terverifikasi di **situs live sebelum perubahan**: "Spatial Gallery" = **0** kemunculan di homepage, "Dua pilihan" = 1.

Jadi satu-satunya celah di alur bisnis = showcase landing (alur: landing → checkout). Akar: `spatial-gallery` ditambahkan ke preview/registry/checkout pada rilis lalu, tetapi kartu di array `TEMPLATES` landing tidak ikut ditambahkan.

## 2. Perubahan (3 file kode + 1 dokumen versi)

| File | Perubahan |
|---|---|
| `src/components/landing/LandingPage.tsx` | + kartu `spatial-gallery` di array `TEMPLATES` (iframe `/preview/spatial-gallery` + link "Live Preview", deskripsi selaras checkout: "curved grid dan orbital artwork"); hero "Dua pilihan template" → "Tiga pilihan template" |
| `src/components/landing/landing.css` | grid kartu `1fr 1fr` (hardcode 2 kolom) → `repeat(auto-fit, minmax(300px, 1fr))` — 3 kolom di layar lebar, otomatis menyusut ke 2/1; media query 720px dipertahankan |
| `src/lib/constants.ts` | `APP_VERSION` 1.3.30 → **1.3.31** |
| `CHANGELOG.md` | entri `[1.3.31]` - 2026-10-10 di baris teratas |

Tidak ada perubahan lain yang diperlukan: halaman preview, registry, endpoint revalidate, panel admin, dan checkout sudah mendukung ketiga template sejak awal.

## 3. Verifikasi (terverifikasi langsung)

- `npx vitest run src/lib/constants.test.ts` → **6/6 PASS** (test mengunci `APP_VERSION` = entri CHANGELOG teratas).
- `npm run deploy` penuh — **membuktikan kebiasaan baru**: tanpa set `TEMP` manual (wrapper `run-opennext-cloudflare-deploy.js` dari sesi sebelumnya otomatis menangani) → **exit 0**, gate pre-deploy lolos, build 72/72, `Successfully populated cache with 62 entries`, 7 aset baru terupload, **Version ID `89368922-b3e0-4d4e-9228-827d719300f1`**, cron `0 18 * * *` tetap.
- Live pasca-deploy: `/api/health` **1.3.31 + connected**; homepage **200** dengan "Spatial Gallery" **×2** (judul kartu + link), `preview/spatial-gallery` **×2** (iframe + href), "Tiga pilihan" ×1, "Dua pilihan" **×0**; `/checkout` **200**.

## 4. Catatan

- Perubahan tampilan pertama sejak v1.3.30; sekaligus deploy pertama yang sepenuhnya memakai `npm run deploy` murni tanpa kendala.
- iframe Spatial Gallery memuat scene 3D (three.js) di dalam kartu — mengikuti pola `loading="lazy"` yang sama dengan dua kartu existing.
- Sisa roadmap owner: onboarding klien pertama (`docs/operations/GLADI_RESIK_KLIEN_PERDANA.md`).
