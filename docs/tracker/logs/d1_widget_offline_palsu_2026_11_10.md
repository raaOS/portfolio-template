# Widget "Cloudflare D1" Memerah Palsu — `navigator.onLine` Dipakai Sebagai Penentu

**Tanggal:** 2026-11-10
**Versi:** 1.3.79
**Pelapor:** owner (tangkapan layar popout status di menubar desktop admin)

## Gejala

Popout **Cloudflare D1** di menubar admin menampilkan:

- Judul: `Cloudflare D1` · titik merah · **Bermasalah**
- `Backend`, `D1 latency`, `API latency` semuanya `-`
- Kotak penjelasan: *"Merah karena browser tidak bisa membaca /api/health."*
- Kotak merah: **"Browser sedang offline"**

Padahal bagian **Storage breakdown** di popout yang sama menampilkan angka nyata
(D1 database `10 0 0 4`, R2 bucket `10 6 0 4`) dengan badge **SYNC** hijau — artinya
request ke origin yang sama (`/api/admin/storage-stats`) **berhasil**.

## Bukti D1 sehat

```
GET http://localhost:3000/api/health  →  200
{"status":"ok","database":"connected","databaseBackend":"cloudflare-d1",
 "databaseLatencyMs":207,...}
```

Jadi D1 tidak bermasalah sama sekali. Widgetnya yang berbohong.

## Akar masalah

`src/app/admin/hooks/useDataStatus.ts` — `checkStatusInternal()`:

```ts
if (!navigator.onLine) {
  publish({ connectionStatus: 'error', serverStatus: 'offline',
            errorMessage: 'Browser sedang offline', ... });
  return;                        // ← request TIDAK PERNAH dikirim
}
```

`navigator.onLine` hanyalah **dugaan OS/browser**, bukan bukti konektivitas:

- `false` saat Wi-Fi tersambung tapi tanpa internet (hotspot HP, captive portal, VPN, adapter baru bangun dari sleep);
- tetap `true` saat internet mati tapi ada interface aktif.

Kasus owner: admin dibuka dari HP/iPad lewat **LAN** (`http://192.168.100.57:3000`).
Perangkat melaporkan `navigator.onLine === false`, padahal request ke dev server di
jaringan lokal tetap jalan. Karena hook me-*return* lebih awal, widget memerah
tanpa pernah bertanya ke server — dan pesan "Browser sedang offline" menyalahkan
browser, bukan melaporkan apa yang sebenarnya gagal.

## Perbaikan

`src/app/admin/hooks/useDataStatus.ts`:

1. Short-circuit `navigator.onLine` **dihapus**. Probe `fetch('/api/health')`
   **selalu** dijalankan dan menjadi satu-satunya sumber kebenaran.
2. Status offline browser hanya dipakai di cabang `catch`, sebagai keterangan
   tambahan pada pesan asli:
   `Browser melaporkan offline · <pesan error asli>`.

Tidak ada perubahan pada route `/api/health`, pada D1, atau pada endpoint lain.

## Regresi test (baru)

`src/app/admin/hooks/useDataStatus.test.ts` — 4 kasus:

| Kasus | Harapan |
|---|---|
| `navigator.onLine=false` + health 200 `connected` | `connectionStatus === 'connected'`, `errorMessage === null`, fetch **dipanggil** |
| fetch reject + browser online | `error`, pesan = `Failed to fetch` (bukan "Browser sedang offline") |
| fetch reject + browser offline | `error`, pesan = `Browser melaporkan offline · Failed to fetch` |
| health 200 tapi `database: 'disconnected'` | `disconnected` + `D1 tidak berhasil dibaca dari /api/health` |

## Bug versi yang ikut ketemu

`src/lib/constants.ts` masih `APP_VERSION = '1.3.78'` padahal entri teratas
`CHANGELOG.md` sudah `[1.3.79]`. Test penjaga `src/lib/constants.test.ts`
("sama dengan entri teratas CHANGELOG.md") **gagal**:

```
AssertionError: expected '1.3.78' to be '1.3.79'
```

Diperbaiki: `APP_VERSION = '1.3.79'`. Diverifikasi lewat
`GET /api/health` → `version: 1.3.79`.

## Tombol Refresh (susulan, permintaan owner)

Owner bertanya apakah perlu tombol refresh/update. **Ya** — probe otomatis hanya
tiap `POLL_INTERVAL_MS = 30_000`, jadi sebelumnya tidak ada cara memaksa periksa
ulang (justru inilah yang bikin status merah palsu terasa "nyangkut").

- `DatabasePopout.tsx`: prop baru `onRefresh?: () => void`; tombol kecil di header
  popout (ikon `RefreshCw`) → `onRefresh()` + `refreshStorage(false)`. Saat
  `status === 'checking'` tombol `disabled`, ikon `animate-spin`, label "Memeriksa…".
- `AdminMenuBar.tsx`: `checkStatus` diambil dari `useDataStatus()` dan diteruskan
  sebagai `onRefresh={() => void checkStatus()}`.
- Tombol `Refresh` lama di dalam bagian Storage breakdown **tetap ada** dan tetap
  beda fungsi: itu memakai `?fresh=true` (memaksa R2 `ListObjectsV2`), sedangkan
  tombol header memakai endpoint cache.

**Catatan performa (bukan bug):** `API latency` 1288 ms yang terlihat owner adalah
kompilasi awal Turbopack. Diukur 3× berturut-turut: 8834 ms (cold), lalu
**776 ms** dan **754 ms**; `D1 latency` stabil **162–177 ms**. Di dev, D1 diakses
lewat REST API dari mesin lokal (bukan binding Worker), jadi ratusan ms itu wajar.

## File yang diubah

| File | Perubahan |
|---|---|
| `src/app/admin/hooks/useDataStatus.ts` | hapus short-circuit `navigator.onLine`; pesan `catch` memuat sebab asli |
| `src/app/admin/hooks/useDataStatus.test.ts` | **baru** — 4 test regresi |
| `src/lib/constants.ts` | `APP_VERSION` 1.3.78 → 1.3.79 |
| `src/app/admin/desktop/status-popouts/DatabasePopout.tsx` | prop `onRefresh` + tombol `Refresh` di header (spin saat `checking`) |
| `src/app/admin/desktop/AdminMenuBar.tsx` | teruskan `checkStatus` dari `useDataStatus()` sebagai `onRefresh` |
| `CHANGELOG.md` | sub-bagian "Widget Cloudflare D1 Memerah Palsu" di `[1.3.79]` |

## Verifikasi

- `npx vitest run src/app/admin/hooks/useDataStatus.test.ts src/lib/constants.test.ts src/app/admin/desktop/useAdminDesktop.test.ts src/app/admin/desktop/registry.test.ts` → **22/22 PASS**
- `npx tsc --noEmit` → 0 error
- `npx eslint` pada 5 file berubah → bersih
- `GET /api/health` (dev server owner, port 3000) → **200**, `version 1.3.79`,
  `database connected`, `cloudflare-d1`, latency 226 ms
- Latency diukur 3×: 8834 ms (cold compile), 776 ms, 754 ms; `databaseLatencyMs` 162–177 ms
- `GET /admin/login` → 200 (modul admin tetap terkompilasi)

## Catatan untuk AI berikutnya

- **Jangan** mengembalikan `navigator.onLine` sebagai penentu status data. Kalau butuh
  indikator offline instan, pakai untuk *teks penjelas* saja — probe request tetap wajib.
- `isOnline` di `AdminMenuBar.tsx` (dipakai `netColorClass` + prop `browserOnline` pada
  `NetworkPopout`) sengaja **tidak diubah** di patch ini; ia memberi umpan balik instan
  saat benar-benar offline. Kalau owner melaporkan titik jaringan memerah palsu juga,
  batasi `!isOnline` ke kasus "belum ada probe sukses".
- Setiap menambah entri `## [x.y.z]` di `CHANGELOG.md`, **wajib** menaikkan
  `APP_VERSION` di `src/lib/constants.ts` — kalau tidak, `constants.test.ts` gagal
  dan `/api/health` melaporkan versi lama.
