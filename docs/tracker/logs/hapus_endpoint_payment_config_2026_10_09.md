# Log: Hapus Endpoint `/api/admin/payment-config` (v1.3.29)

**Tanggal:** 2026-10-09
**Status:** ✅ Selesai & tervalidasi penuh (gerbang: `tsc --noEmit` 0, ESLint 0 error, seluruh test PASS)
**Izin owner:** _"ya hapus"_ (pertanyaan awal: _"orders dan payment-config → panelnya sudah dihapus, tapi endpoint masih hidup ini sebaiknya dihapus atau gmna?"_)

---

## Konteks & Temuan Verifikasi

Pertanyaan owner muncul dari catatan lama `AGENTS.md` §12 & `patch_celah_env_klien_2026_10_04.md:70` (keputusan 4 Okt: "endpoint orders/payment-config/sites tetap hidup untuk billing & tooling"). Hasil penelusuran ulang di kondisi kode 2026-10-09:

### `/api/admin/orders` → TIDAK dihapus (alasan berubah: hidup lagi)

- **Panel Pesanan baru** `src/app/admin/desktop/panels/OrdersPanel.tsx` + `/admin/system/orders` (commit `e5a3ab4`, v1.3.29, temuan 🔴 #3 audit alur bisnis) memanggil `GET` (daftar/filter/cari) dan `POST` (Aktifkan/Batalkan/Buka Kembali).
- `scripts/load/multi-buyer-load-test.js:1057` memakai POST untuk cleanup order uji.
- `docs/operations/support-playbook.md:103,322` mengarahkan cek order via `GET /api/admin/orders`.
- Menghapus = merusak panel baru. **Keputusan: dipertahankan.**

### `/api/admin/payment-config` → DIHAPUS (alasan lama terbukti salah)

| Pemeriksaan pemanggil | Hasil |
|---|---|
| Panel/UI fetch | ❌ nol (panel `PaymentConfigPanel` dihapus v1.3.20) |
| Script portal/owner (`scripts/**`) | ❌ nol |
| Test | ❌ nol (tak ada test route maupun `paymentConfigService`) |
| Billing (`checkout`, `qris`, `payment-info`) | ❌ **tidak lewat route API** — import `paymentConfigService` (`getPaymentConfig`/`getPublicPaymentInfo`) langsung |
| `middleware/*.ts` | ❌ path tidak terdaftar di mana pun |

Alasan "dipertahankan untuk billing & tooling" hanya berlaku untuk **service**-nya (`paymentConfigService`), bukan route HTTP-nya.

## Perubahan

1. **Dihapus:** `src/app/api/admin/payment-config/` (route GET/PUT, 2 file).
2. **`src/lib/services/paymentConfigService.ts`:** hapus `getAdminPaymentConfig()` & `updatePaymentConfig()` (hanya dipakai route itu) + impor `maskQRISPayload` yang ikut mati. **Tetap:** `getPaymentConfig`, `getPublicPaymentInfo`, `validatePaymentConfig`, `normalizeConfig`, tipe `PaymentConfig` (dipakai billing/orderService).
3. **`AGENTS.md` §12:** catatan zone dikoreksi — panel `OrdersPanel` dibuat ulang v1.3.29, endpoint `orders` hidup (dipakai panel Pesanan), endpoint `payment-config` dihapus total, `sites` tetap.
4. **`CHANGELOG.md`:** entri `[1.3.29]` diperbarui.

## File yang Dimodifikasi

- `src/app/api/admin/payment-config/` (HAPUS — route.ts)
- `src/lib/services/paymentConfigService.ts`
- `AGENTS.md`
- `CHANGELOG.md`
- `docs/tracker/INDEX_TRACKER.md` (entri 145)

## Sisa / Catatan

- `maskQRISPayload()` di `src/lib/billing/qris.ts` kini tanpa pemanggil (dibiarkan — helper umum billing, bisa diuji/dipakai lagi; kalau mau dibuang, minta izin terpisah).
- `validatePaymentConfig()` di `paymentConfigService` kini tanpa pemanggil langsung (dibiarkan — fungsi validasi domain yang diekspor).
- Endpoint `api/admin/sites` belum diaudit pemakainya (pertanyaan terbuka dari diskusi yang sama).
- **Worktree `sunny-moon` sudah tertinggal** (repo utama bergerak ke `f85fd59`+`e5a3ab4`); semua kerja dilanjutkan di repo utama `Documents\tamplate-portofolio`.

## Bug/Debt yang Dibereskan

- Kode mati menyesatkan: endpoint admin tanpa pemanggil + catatan dokumentasi yang keliru (sebab salah klaim "panel sudah dihapus" saat diskusi).
