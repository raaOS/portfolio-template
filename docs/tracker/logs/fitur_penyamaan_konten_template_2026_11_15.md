# Tracker Log: Penyamaan Konten CRUD Template (canvas & spatial → setara demo macOS)

**Status:** 🟢 Completed
**Mulai:** 2026-11-15
**Selesai:** 2026-11-15 (rilis v1.3.88 — belum di-deploy ke produksi)

## 📌 STATUS TERAKHIR — WAJIB DIBACA & DIUPDATE AI BERIKUTNYA

> **Aturan:** Setiap AI yang melanjutkan pekerjaan ini WAJIB: (1) cek checklist di bawah,
> (2) lanjutkan item pertama yang masih `- [ ]`, (3) update section ini + checklist + daftar
> file saat sesi selesai. Jangan bertanya ulang keputusan owner — sudah terkunci.

- **Tanggal update:** 2026-11-15
- **Fase terakhir dikerjakan:** Semua fase selesai (0–3). Rilis v1.3.88 tercatat di
  `CHANGELOG.md` + `APP_VERSION` (`src/lib/constants.ts`).
- **Langkah berikutnya:** **Deploy** ke produksi oleh owner (`npm run deploy` untuk site
  owner; template klien mendapat fitur ini saat deploy berikutnya). Tidak ada pekerjaan kode
  tersisa untuk fitur ini.
- **Progress keseluruhan:** 10/10 item selesai.

## 🎯 Tujuan (Objective)

CRUD admin dashboard dibangun di atas demo template macOS (os-desktop), tapi 2 template lain
hanya merender sebagian konten admin. Tujuan: setiap template menampilkan **konten inti CRUD
yang sama** sehingga klien yang memilih template apa pun tetap mendapat nilai penuh panel admin.

## 🔒 Keputusan Owner (TERKUNCI — jangan tanyakan ulang)

1. **Dock menu TIDAK disamakan** — fitur eksklusif demo macOS saja.
2. Scope = **konten inti**: Profil/About (hero, bio, motto, availability), Skills (hard + soft),
   Pengalaman kerja/CV, Testimoni, Kontak (chat macOS yang masuk sistem chat admin),
   Filosofi design, Bahasa ID/EN di spatial.
3. Kontak canvas diganti **FullPageChat macOS penuh** (bukan mailto).
4. Spatial pakai **tab bar mini floating (kanan-atas) + panel slide-over gelap** dari kanan.
5. Fitur khas OS (Explorer VFS, event pages, wallpaper, notes DB, musik, spotlight) **tidak
   disamakan**.
6. Data mati di OS (statistics hardcode, events tanpa konsumen) dicatat di bawah, **tidak
   dikerjakan** — jangan sentuh OS renderer.

## 📋 Task List

### Fase 0 — Tracker
- [x] Buat log tracker ini
- [x] Daftarkan di `docs/tracker/INDEX_TRACKER.md`

### Fase 1 — Infinite Canvas (`src/components/templates/infinite-canvas/`)
- [x] **1a.** Kontak → chat macOS: `CanvasLeftDrawer.tsx` — form mailto (state
      `contactSubject/contactMessage/contactSent`, `handleSendMessage`) dihapus, diganti
      `<FullPageChat embedded contactInfo={...} />` (mapping `toContactInfo` pola
      `ContactWindow.tsx`, data dari prop `contact` — tanpa SWR karena data sudah server-loaded)
- [x] **1b.** Panel About diperkaya: section **Keahlian Interpersonal** (soft skills,
      normalisasi pola `InterestsTab`) setelah hard skills + section **Design Philosophy**
      (reuse `FlowchartProcess` + `localizeWorkflowSteps`) setelah pengalaman kerja
- [x] **1c.** Test diupdate: mock `FullPageChat` + `FlowchartProcess`, fixture
      `softSkills.items` + `designPhilosophy`, assert baru di test About & Kontak — **13/13 PASS**

### Fase 2 — Spatial Gallery (`src/components/templates/spatial-gallery/`)
- [x] **2a.** `SpatialGalleryRenderer.tsx`: props diperluas ke `PortfolioTemplateData` penuh
      (dari `{ projects?, about? }`); overlay dipasang; brand overlay dilokalisasi
- [x] **2b.** `SpatialInfoOverlay.tsx` (baru): tab bar mini (5 ikon lucide + `LanguageSwitch`),
      panel slide-over gelap (pola `CanvasProjectSlideOver`), 5 tab: About, Kontak
      (info + sosmed + FullPageChat), Testimoni, Skills (hard+soft), CV. Escape menutup
      (dengan guard lightbox `z-[100]`). **`SpatialScene.tsx` TIDAK disentuh**
- [x] **2c.** Test baru `SpatialInfoOverlay.test.tsx` — **8/8 PASS**

### Fase 3 — Verifikasi & Rilis
- [x] `npx vitest run src/components/templates` → 21/21 PASS (+ `constants.test.ts` 6 PASS
      setelah bump APP_VERSION)
- [x] `npm run lint` bersih + `npx tsc --noEmit` 0 error
- [x] Manual browser (dev server + IAB): `/preview/spatial-gallery` — tab bar, About (profil
      + availability + bio), Kontak (info + FullPageChat), Testimoni (5 item data asli),
      Keahlian (4 hard + 5 soft), CV (pengalaman asli) semuanya tampil; pesan uji terkirim
      via chat (mode demo owner = balasan simulasi, sesuai desain v1.3.70; di build klien
      OWNER_MODE=false → POST `/api/chat/send` masuk sistem chat admin). `/preview/infinite-canvas`
      — kontak + chat + soft skills + philosophy tampil. `/preview/os-desktop` — tidak berubah.
      `/` storefront — tidak berubah.
- [x] Entry `[1.3.88]` di atas `CHANGELOG.md` + `APP_VERSION = '1.3.88'` di
      `src/lib/constants.ts` (dijaga test `constants.test.ts`)
- [x] STATUS TERAKHIR + checklist + daftar file di log ini diupdate; status 🟢 Completed

## 🚫 Temuan yang Sengaja TIDAK Dikerjakan (jangan diubah tanpa izin owner)

- `statistics` experience di-hardcode di `src/components/templates/os-desktop/OSDesktopRenderer.tsx:14-19`
  ('5+','20+','10+','100%') — tidak dibaca dari D1, tidak dirender di UI mana pun.
- `events` di-pass ke `experienceData` OS renderer tapi tidak ada satu pun konsumen di
  `src/components/os`.
- `/api/leads` (panel admin "Pesan Masuk") tidak punya writer di repo — hanya GET. Jangan
  disentuh di pekerjaan ini.
- Dock macOS (dockConfig, susun ikon) = fitur eksklusif macOS, tidak diporting.

## 📂 File yang Dimodifikasi (Modified Files)

- `docs/tracker/logs/fitur_penyamaan_konten_template_2026_11_15.md` -> dibuat (log ini)
- `docs/tracker/INDEX_TRACKER.md` -> entri #8 log ini didaftarkan
- `src/components/templates/infinite-canvas/components/CanvasLeftDrawer.tsx` -> kontak mailto
  diganti FullPageChat embedded; + section soft skills & philosophy (imports: FullPageChat,
  FlowchartProcess, localizeText, localizeWorkflowSteps, ikon Lightbulb/Sparkles)
- `src/components/templates/infinite-canvas/__tests__/InfiniteCanvasRenderer.test.tsx` ->
  mock FullPageChat & FlowchartProcess, fixture diperkaya, assert baru
- `src/components/templates/spatial-gallery/SpatialGalleryRenderer.tsx` -> props
  `PortfolioTemplateData` penuh, `<SpatialInfoOverlay/>` dipasang, brand overlay dilokalisasi
- `src/components/templates/spatial-gallery/SpatialInfoOverlay.tsx` -> **file baru**
  (tab bar mini + 5 panel slide-over gelap)
- `src/components/templates/spatial-gallery/__tests__/SpatialInfoOverlay.test.tsx` -> **file baru**
- `src/lib/constants.ts` -> `APP_VERSION` 1.3.87 → 1.3.88
- `CHANGELOG.md` -> entry `[1.3.88]` di baris teratas

## 🐛 Observasi Dev-Mode (bukan bug produksi, dicatat agar AI berikutnya tidak bingung)

- Saat verifikasi browser, satu tab IAB pernah masuk kondisi boundary suspense `hidden`
  (`BAILOUT_TO_CLIENT_SIDE_RENDERING` di HelloIntro) + WebGL mati → layar hitam. Tab baru
  langsung sehat. Ini artifact tab dev yang menyala lama, bukan regression kode — HTML/DOM
  selalu benar.
- Animasi opacity `FullPageChat` di dalam panel spatial sempat tertunda beberapa detik
  (motion rAF berebut dengan render scene 3D) lalu sampai 1 normal. Di canvas (tanpa 3D)
  tidak terjadi.

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)

Fitur selesai penuh dan terverifikasi. Tidak ada kode tersisa. Yang tersisa hanya **deploy**
(milik owner). Jika owner minta penyamaan lanjutan (event pages / wallpaper / notes DB ke
canvas & spatial), buka log baru — jangan ekspasi scope di log ini tanpa keputusan owner.
