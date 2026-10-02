# Log Pekerjaan: Email Serah-Terima Saat Order Diaktifkan

- **Tanggal:** 2026-10-02
- **Tipe:** Fitur baru (bug fungsional bisnis)
- **Versi:** v1.3.13
- **Status:** 🟢 Selesai (tsc 0, eslint 0, `114 file / 879 test PASS`)
- **Cabang:** `fix/security-audit-2026-09-29`
- **Sumber usulan:** tiga usulan fitur yang diajukan AI setelah audit keamanan (entri 122); owner memilih **"1. Email serah-terima"**.

---

## 1. Latar & Temuan (terverifikasi ke kode)

Audit internal menemukan **momen serah-terima tidak pernah memberi kabar ke pembeli.**

Panggilan fungsi email di `src/lib/services/orderService.ts` sebelum perubahan:

| Fungsi | Dipanggil dari | Kapan terkirim |
|---|---|---|
| `sendOrderEmail` | `createOrder` (baris 661) | Pembeli **membuat** order → struk |
| `sendOrderExpiredEmail` | `expireOrderIfStale` (136, 175) | Order **kedaluwarsa** |
| *(tidak ada)* | `activateOrder` (838–990) | Order **diaktifkan** ❌ |

`activateOrder` sebelumnya hanya:

```ts
await queryD1("UPDATE orders SET status = 'activated', site_id = ?, ...");
...
return { success: true, message: `Berhasil mengaktifkan pesanan ${order.id}. Site URL: ${siteUrl}` };
```

Pesan `Site URL` itu hanya muncul sebagai **popup/pesan Telegram di sisi admin** (jalur webhook `POST /api/telegram/webhook` baris 79 dan aksi panel `POST /api/admin/orders` baris 49 — keduanya memanggil `activateOrder` yang sama).

> **Akibatnya:** pembeli sudah bayar → admin klik "Aktifkan" → **pembeli tidak menerima apa-apa.** Momen paling penting dalam jualan justru bisu.

### Penelusuran pendukung (agar tidak salah menaruh tautan di email)

- `/admin/login` (`src/app/api/admin/login/route.ts`) = login **password-only** untuk **operator deployment ini**, mengambil `SITE_ID = process.env.CUSTOMER_SITE_ID || 'default-site'` (`src/crud/shared/config.ts:9`) → **bukan** panel pembeli. Tautan ini sengaja **tidak** dimasukkan ke email.
- `src/app/[siteSlug]/login/page.tsx` hanya melakukan `redirect('/client/login?site=...')`, tetapi folder **`src/app/client` tidak ada** → rute ini **mati (404)**. Sisa dari sistem login klien yang dihapus pada commit `686f762 refactor: remove old client auth system + multi-template infrastructure`. Tautan ini juga sengaja **tidak** dimasukkan ke email. *(Dilaporkan, tidak diperbaiki — lihat §5.)*
- Tabel `client_access` (4 baris) dan `client_password_resets` (0 baris) juga sisa dari sistem itu; **tidak ada kode yang membacanya** (riwayat: `bed0e19` menambah, `686f762` menghapus). Tidak dibangun ulang.

---

## 2. Perubahan yang dilakukan

### `src/lib/services/orderService.ts`

1. **Fungsi baru `sendActivationEmail({ to, orderId, buyerName, plan, amount, siteSlug, siteUrl })`** — mengikuti pola persis `sendOrderEmail`/`sendOrderExpiredEmail` (guard `NOTIFICATION_PROVIDER === 'resend'`, `NOTIFICATION_API_KEY` + `NOTIFICATION_DEFAULT_FROM` wajib ada, `try/catch` + `return false`).
   - **Isi email:** URL website yang sudah live, ringkasan (order ID, paket, alamat `/{slug}`, total bayar), langkah berikutnya, dan petunjuk cek status lewat link halaman pesanan dari email struk sebelumnya.
   - **Validasi input:** `to`/`orderId`/`siteUrl` kosong → tidak kirim apa pun.
   - **Escaping:** nilai dari pengguna (nama pembeli, slug, order ID, URL) di-escape memakai helper **yang sudah ada** `escapeTelegramHtml` (baris 242) untuk bagian HTML; versi `text` tetap memakai nilai mentah agar `&amp;` tidak tampil aneh.
   - **`amount` defensif:** `typeof amount === 'number' && amount > 0` — bila nol/hilang, baris nominal dihilangkan dari teks dan tabel HTML (mencegah `undefined.toLocaleString()` melempar error; baris order di test juga tidak selalu punya `amount`).
2. **Satu panggilan baru di `activateOrder`** — tepat setelah `siteUrl` dihitung, **dibungkus `try/catch`**. Alasannya: baris `UPDATE orders ... status='activated'` sudah ter-commit ke D1, kegagalan email **tidak boleh** membuat aktivasi dianggap gagal.

### `src/lib/services/orderService.test.ts`

3 test baru di `describe('activateOrder (email serah-terima)')`:

1. **Sukses kirim** — `NOTIFICATION_PROVIDER=resend` + `vi.stubGlobal('fetch')`, meng-assert `POST https://api.resend.com/emails`, `to`, subject, `text` memuat URL `…/nanda-design`, `ORD-123`, `Rp 1.500.000`, dan `html` memuat `/{slug}` + tombol "Buka Website Anda".
2. **Provider gagal** — `fetch` menolak (`resend down`) → `activateOrder` tetap `{ success: true, siteId terdefinisi }`.
3. **Provider belum dikonfigurasi** → `fetch` **tidak dipanggil sama sekali**.

`afterEach` di dalam describe itu: `vi.unstubAllGlobals()` + mengembalikan `NOTIFICATION_PROVIDER` / `NOTIFICATION_API_KEY` / `NOTIFICATION_DEFAULT_FROM` ke nilai semula (disimpan saat evaluate), supaya bocor ke test lain.

---

## 3. Yang sengaja TIDAK dilakukan

| Tidak dilakukan | Alasan |
|---|---|
| Memasukkan tautan `/admin` | Panel itu milik **operator**, bukan pembeli — menyesatkan dan tak perlu mengarahkan pembeli ke halaman login yang bukan miliknya. |
| Memasukkan tautan `/{slug}/login` | Rutenya **mati** (redirect ke `/client/login` yang tidak ada) → pasti 404. |
| Merombak/mengaktifkan ulang portal klien | Sistem login klien **sengaja dihapus** (`686f762`). Butuh keputusan produk, bukan efek samping dari fitur email. |
| Mengirim email di jalur "sudah diaktifkan sebelumnya" | `activateOrder` return awal saat `status === 'activated'` → **tidak ada email ganda**. |
| Notifikasi Telegram pembeli | Di luar ruang lingkup; jalur admin sudah ada. |

---

## 4. Verifikasi

| Gate | Hasil |
|---|---|
| `npx tsc --noEmit` | **0 error** |
| `npx eslint` (2 file berubah) | **0 error** |
| `npx vitest run` (file orderService) | **27 test PASS** (sebelumnya 24) |
| `npx vitest run` (seluruh suite) | **114 file / 879 test PASS** (sebelumnya 876) |

**Catatan produksi:** `NOTIFICATION_PROVIDER=resend`, `NOTIFICATION_API_KEY`, dan `NOTIFICATION_DEFAULT_FROM` sudah **tertanam di bundel produksi** (diverifikasi 2026-09-30 terhadap bundel 12.105.545 byte) → email akan benar-benar terkirim begitu kode ini di-deploy. Belum diuji end-to-end ke kotak masuk sungguhan karena butuh order aktivasi sungguhan.

---

## 5. Temuan tambahan / Handoff

1. **Rute mati `/{slug}/login`.** `src/app/[siteSlug]/login/page.tsx` → redirect ke `/client/login` yang tidak ada → 404. Tidak diperbaiki di rilis ini karena perbaikannya menyentuh logika yang sudah ada (perlu izin owner): pilihan wajar = (a) hapus rute alias itu, atau (b) arahkan ke halaman yang memang ada. Sementara ini **tidak ada yang menautkannya** dari email/ UI aktif, jadi dampaknya terbatas.
2. **Email serah-terima hanya terkirim setelah kode ini di-deploy.** Order yang sudah teraktivasi sebelum deploy tidak dikirimi ulang (tidak ada mekanisme kirim ulang — disengaja).
3. **Usulan berikutnya yang belum dikerjakan** (dari daftar yang sama): (a) **cron harian Wrangler** untuk `sweepExpiredOrders` + backup D1/R2 + audit media yatim — saat ini `wrangler.jsonc` **tidak punya `crons` sama sekali**, sehingga order kedaluwarsa hanya ditutup ketika admin membuka panel Order; (b) pemindahan `JWT_SECRET`/`PASSWORD_SALT`/`TELEGRAM_BOT_TOKEN` ke Worker secrets.

---

_Terakhir Diperbarui: 2026-10-02_
