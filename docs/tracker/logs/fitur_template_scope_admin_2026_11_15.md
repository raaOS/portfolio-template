# Tracker Log: templateScope — Dashboard Admin Menyesuaikan Template Ter-Deploy

**Status:** 🟢 Completed
**Mulai:** 2026-11-15
**Selesai:** 2026-11-15 (rilis v1.3.90; **deploy produksi 2026-11-18** — commit `9ea331b`, produksi terverifikasi `1.3.90`)

## 📌 STATUS TERAKHIR — WAJIB DIBACA & DIUPDATE AI BERIKUTNYA

- **Tanggal update:** 2026-11-18
- **Progress:** Selesai penuh. Badge cakupan + filter runtime + app Peta Fitur terpasang.
- **Deploy:** ✅ sudah di-deploy ke site owner 2026-11-18; endpoint baru
  `GET /api/admin/site-template` di produksi membalas **401** (ada & auth-gated),
  `/api/health` `1.3.90`. **Gladi (`gladi-2026-10-24`, template `os-desktop`) juga sudah
  di-update 2026-11-18 ke `1.3.90`** via `cloud-manager --action update_template`
  (backup D1 pre-update otomatis; terverifikasi `/api/health` di `makeitbatter.my.id` &
  `gladi.makeitbatter.my.id` = 1.3.90) — verifikasi visual dashboard klien (badge cakupan +
  app Peta Fitur) kini bisa langsung dilakukan saat login gladi.
- **Langkah berikutnya:** tidak ada pekerjaan kode/deploy tersisa; opsional cek visual saat
  login admin gladi berikutnya (badge cakupan + app Peta Fitur).
- **Kaitan:** lahir dari diskusi owner (2026-11-15): "kalau buat fitur baru di canvas, CRUD-nya
  muncul di mana?" + pertanyaan "deploy 1 template, CRUD menyesuaikan?" (jawaban jujur saat
  itu: belum ada; kini ada).

## 🎯 Tujuan (Objective)

Dashboard admin sebelumnya buta template: satu set 20 app tampil di SEMUA deployment apapun
template aktifnya. Owner & klien jadi bingung "CRUD ini punya template mana". Kini:

1. Setiap app registry punya `templateScope` (cakupan template yang menampilkan kontennya).
2. Desktop admin menyaring app RUNTIME berdasarkan `sites.active_template_key` deployment —
   klien infinite-canvas hanya melihat CRUD canvas, klien macOS hanya CRUD macOS.
3. Badge kecil menunjukkan cakupan; app "Peta Fitur & Template" mendokumentasikan pemetaan.

## 🔒 Keputusan Desain (jangan dibalik tanpa izin owner)

- **Filter RUNTIME, bukan build per-template:** satu bundle tetap memuat semua template/app;
  penyaringan terjadi di desktop admin via endpoint. Ganti `active_template_key` kelak cukup
  ubah D1 — dashboard menyesuaikan tanpa deploy ulang.
- **FAIL-OPEN:** `GET /api/admin/site-template` gagal / D1 down / nilai asing →
  `activeTemplateKey: null` → SEMUA app tampil. Error tidak boleh menyembunyikan CRUD.
- **Ubin zona dibentuk setelah template diketahui** (gate `isTemplateLoaded` di
  `useAdminDesktop`) — tidak ada app yang sempat muncul lalu hilang (flash).
- **Badge hanya untuk app ber-scope** — app "Semua template" tanpa chip (mengurangi noise).
- **Sumber pemetaan scope** = audit konten CRUD 2026-11-15
  (`fitur_penyamaan_konten_template_2026_11_15.md`). App BARU kelak: tulis `templateScope`
  satu baris di registry saat app-nya tidak lintas template.

## 📋 Task List

- [x] `types.ts`: type `TemplateScope` + field `templateScope?` di `AdminApp`
- [x] Registry: scope untuk 8 app (archive, labels, explorer, eventPages, dock, widgets,
      feedback = `['os-desktop']`; appearance = `['os-desktop','spatial-gallery']`)
- [x] `templateScope.ts` (baru, murni): `filterZonesByTemplate` (fail-open, tanpa mutasi,
      zona kosong ikut hilang) + `getTemplateScopeLabel`
- [x] Endpoint `GET /api/admin/site-template` (admin-only `validateAdminRequest`, baca D1
      `sites.active_template_key` dengan SITE_ID, fail-open 200/null, nilai asing dinetralkan)
- [x] Hook `useActiveTemplate.ts` (SWR, cache dibagi semua pemakai, fail-open)
- [x] `useAdminDesktop.ts`: zona tersaring untuk openApp/openFolder/layoutZones; ubin digate
      `isTemplateLoaded`; deps callback diperbarui
- [x] `WindowContentRenderer.tsx`: folder grid memakai zona tersaring + badge chip per app
- [x] Panel baru `panels/PetaFiturPanel.tsx` + halaman `/admin/system/peta-fitur` + entry
      registry (zona Sistem) + PANEL_MAP + APP_ROUTE_MAP
- [x] Test: `templateScope.test.ts` (8), registry.test +3, endpoint route.test (4),
      stub fail-open di useAdminDesktop.test — total 33/33 PASS
- [x] `tsc --noEmit` 0 error, ESLint bersih
- [x] `CHANGELOG.md` [1.3.90] + `APP_VERSION` bump
- [x] Log ini + entri `INDEX_TRACKER.md`

## 🚫 Sengaja TIDAK Dikerjakan

- Verifikasi visual desktop admin via browser (butuh login admin dev yang kredensialnya tidak
  dipublikasikan di repo) — logika tertutup test; cek visual saat gladi/deploy berikutnya.
- Build per-template / memangkas bundle (ditolak: 3 varian build rawan meleset; filter runtime
  memberi perilaku sama tanpa risiko).
- Membuat app baru per fitur template di masa depan — BUKAN pekerjaan ini; panduan: tulis
  `templateScope` di registry saat fitur baru tidak lintas template.

## 📂 File yang Dimodifikasi (Modified Files)

- `src/app/admin/desktop/types.ts` -> TemplateScope + templateScope field
- `src/app/admin/desktop/registry.ts` -> scope 8 app + app `petaFitur` + APP_ROUTE_MAP
- `src/app/admin/desktop/templateScope.ts` -> **baru** (filter + label)
- `src/app/admin/desktop/templateScope.test.ts` -> **baru** (8 test)
- `src/app/admin/desktop/useActiveTemplate.ts` -> **baru** (SWR hook, fail-open)
- `src/app/admin/desktop/useAdminDesktop.ts` -> filter runtime + gate isTemplateLoaded
- `src/app/admin/desktop/useAdminDesktop.test.ts` -> stub useActiveTemplate (fail-open)
- `src/app/admin/desktop/WindowContentRenderer.tsx` -> folder tersaring + badge + PANEL_MAP
- `src/app/admin/desktop/panels/PetaFiturPanel.tsx` -> **baru** (tabel referensi)
- `src/app/admin/system/peta-fitur/page.tsx` -> **baru** (halaman app)
- `src/app/api/admin/site-template/route.ts` + `route.test.ts` -> **baru** (endpoint)
- `src/app/admin/desktop/registry.test.ts` -> +3 test scope
- `src/lib/constants.ts` -> APP_VERSION 1.3.89 → 1.3.90
- `CHANGELOG.md` -> entry [1.3.90]
- `docs/tracker/INDEX_TRACKER.md` -> entri log ini

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)

Fitur selesai. Saat membuat app admin baru: TANYA dulu "kontennya tampil di template mana?"
lalu tulis `templateScope` bila tidak lintas template — jangan biarkan undefined untuk app
yang khas satu template. Badge & filter akan mengikuti otomatis.
