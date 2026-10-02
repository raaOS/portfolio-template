# Log Pekerjaan: Pembersihan Rute Login Klien Mati + Penghapusan Alias Admin `/portal`

- **Tanggal:** 2026-10-02
- **Tipe:** Penghapusan rute/tautan mati (cleanup) — permintaan owner
- **Versi:** v1.3.14
- **Status:** 🟢 Selesai (tsc 0, eslint 0, `114 file / 879 test PASS`)
- **Cabang:** `fix/security-audit-2026-09-29`
- **Instruksi owner:** *"/{slug}/login hapus, oya kalau gak salah /portal juga hapus aja"*

---

## 1. Temuan penelusuran (sebelum menghapus)

### A. `/portal` — ternyata **bukan** rute mati

`/portal` adalah **alias tersembunyi untuk `/admin`**, dibuat pada Sprint 60 supaya URL admin tidak mudah ditebak:

```js
// next.config.mjs (sebelum dihapus)
{ source: '/portal',        destination: '/admin' },
{ source: '/portal/login',  destination: '/admin/login' },
{ source: '/portal/:path*', destination: '/admin/:path*' },
```

**Risiko yang sudah diperiksa sebelum eksekusi:** apakah menghapusnya mengunci owner? **Tidak.** Unauthenticated ke `/admin` dijawab *redirect* ke `/admin/login` oleh `src/middleware/customer-auth.ts:118` (bukan 404), jadi jalur login admin `/admin` + `/admin/login` tetap utuh. Konsekuensi nyatanya hanya: **bookmark `/portal` owner akan mati** — sudah dikonfirmasi ke owner sebelum dihapus.

### B. `/{slug}/login` — rute alias yang sudah 404, dengan **5 penunjuk**

Rutenya sendiri hanya berisi redirect:

```tsx
// src/app/[siteSlug]/login/page.tsx
redirect(`/client/login?${query.toString()}`);
```

dan **`src/app/client` tidak ada** (ikut terhapus pada commit `686f762 refactor: remove old client auth system + multi-template infrastructure`). Jadi seluruh rantai login klien sudah mati. Penunjuk yang ditemukan:

| # | Lokasi | Yang menunjuk | Kondisi |
|---|---|---|---|
| 1 | `src/components/os/core/MenuBar.tsx:46-52,143` | **Logo mata** (Lottie) di kiri atas situs publik → `/{slug}/login`, `/{siteId}/login`, fallback `/client/login` | 404 |
| 2 | `MasterSiteEditorSidebar.tsx:209-221` | Blok **"Login client:"** di sidebar admin → `/{slug}/login` | 404 |
| 3 | `src/app/orders/[orderId]/page.tsx:715` | Tombol **"Login Client"** → `/client/login?site=…` | 404 |
| 4 | `src/app/orders/[orderId]/page.tsx:721` | Tombol **"Atur Password"** → `/client/reset-password?site=…` | 404 |
| 5 | `src/app/[siteSlug]/login/page.tsx` | rute alias itu sendiri | 404 |

**Catatan:** `loginUrl` di `MenuBar` ternyata **tidak pernah diisi oleh halaman mana pun** (satu-satunya penerima adalah komponen desktop), jadi rantai fallback-nya selalu jatuh ke URL mati — bukan hanya pada kondisi tertentu.

---

## 2. Perubahan yang dilakukan (10 file, +18 / −98)

### Rute & rewrite

| File | Perubahan |
|---|---|
| `src/app/[siteSlug]/login/page.tsx` | **Dihapus** (folder `login/` ikut hilang) |
| `next.config.mjs` | 3 rewrite `/portal` **dihapus**; diganti komentar penanda kenapa |
| `src/middleware/constants.ts` | `protectedRoutes`: `'/portal'` dihapus · `publicRoutes`: `'/portal/login'` dihapus |
| `src/app/admin/components/ClientAdminLayout.tsx` | `isLoginPage` tinggal `pathname === '/admin/login'` |

### Tautan mati dihapus

| File | Perubahan |
|---|---|
| `src/app/orders/[orderId]/page.tsx` | Tombol **"Login Client"** dan **"Atur Password"** dihapus; tinggal **"Buka Website"**. Impor ikon `KeyRound` ikut dihapus (tidak terpakai) |
| `ClientDashboardPanel.tsx` + `MasterSiteEditorSidebar.tsx` | `clientLoginPath` dihapus dari definisi, props, dan pemakaian. Blok **"Login client:"** dihapus; pembungkus `custom domain` diganti kondisinya sendiri (`activeSiteDraft.customDomain?.trim()`) supaya **Custom Domain tetap tampil** meski `clientLoginPath` sudah tidak ada |

### Logo mata (permintaan owner: *"icon mata tetap ada, hapus mengarahnya"*)

- `MenuBar.tsx`: `<Link href={effectiveLoginUrl}>` diganti `<div role="img" aria-label=…>` — **ikon tetap persis sama, tidak ada lagi navigasi saat diklik**. Seluruh perhitungan `effectiveLoginUrl` dihapus, prop `siteId`/`siteSlug`/`loginUrl` dihapus dari `MenuBarProps`, impor `Link` (`next-view-transitions`) dihapus karena tidak terpakai.
- `role="img"` dipertahankan agar pembaca layar tetap mengenali logo sebagai penanda merek (bukan tautan yang sudah tidak ada).
- Rantai prop `loginUrl` ikut dibersihkan sampai ke sumber agar tidak menyisakan kode mati: `UIOverlaysLayer` (hapus `siteSlug`+`loginUrl`), `DesktopEnvironment` (hapus `loginUrl` dari `DesktopEnvironmentProps` & `DesktopMainBaseProps`, hapus pemakaian di 4 titik, hapus `siteSlug` dari `DesktopMain`).
  - `DesktopEnvironmentProps.siteSlug` **tetap ada** karena masih diteruskan oleh `OSDesktopRenderer.tsx:40` (pemakaian eksternal, di luar scope pembersihan ini).

---

## 3. Yang sengaja TIDAK dilakukan

| Tidak dilakukan | Alasan |
|---|---|
| Membangun ulang login klien (`/client/login`, `client_access`, `client_password_resets`) | Sistem itu **sengaja dihapus** owner (`686f762`). Membersihkan sisa ≠ menghidupkan lagi. |
| Menghapus prop `siteSlug` dari `DesktopEnvironmentProps` | Masih dipakai `OSDesktopRenderer` — menghapusnya menyentuh berkas template di luar topik. |
| Menyentuh `SecretEyeLogin` di `CanvasControls.tsx` | Mata itu bagian dari template **preview** dengan `loginUrl` default `/admin/login?redirect=/preview/infinite-canvas` yang **masih berfungsi**. |
| Mengubah `PLATFORM_PATH_PREFIXES` (`src/middleware.ts:44`) yang memuat `/client` | Prefiks itu hanya menahan rewrite domain kustom ke path yang memang sudah tidak ada — dampaknya nol, mengubahnya menambah risiko tanpa untung. |

---

## 4. Verifikasi

| Gate | Hasil |
|---|---|
| `npx tsc --noEmit` | **0 error** |
| `npx eslint src` | **0 error** |
| `npx vitest run` | **114 file / 879 test PASS** |
| Sisa rujukan mati di `src/` (grep `/client/login`, `client/reset-password`, `/portal`, `}/login`) | **0** (hanya tersisa komentar penjelasan di `MenuBar.tsx`) |

**Belum diverifikasi (butuh browser / deploy):** tampilan logo mata setelah diganti `div` (harus identik — markup CSS dipertahankan apa adanya) dan perilaku logout admin yang sebelumnya mengenali `/portal/login`.

---

## 5. Handoff / Catatan

1. **Owner wajib tahu:** setelah rilis ini admin **hanya** bisa dibuka lewat `/admin` dan `/admin/login`. Kalau ada bookmark `/portal`, perbarui.
2. **Tombol "Login Client" & "Atur Password" hilang dari halaman order.** Kalau kelak portal klien dihidupkan lagi, tombol itu harus dikembalikan bersama rutenya — bukan sebaliknya.
3. Masih tersisa dari daftar usulan sebelumnya (entri 123): **cron harian Wrangler** dan pemindahan rahasia ke Worker secrets.

---

_Terakhir Diperbarui: 2026-10-02_
