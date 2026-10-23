# Bengkel Handoff — Dari Kasir ke Kerjaan

Status: v1.3.16.

Panduan ini untuk owner. Isinya urutan kerja setelah **pembeli sudah bayar**, sampai
website klien tayang dan akses diserahkan. Ini adalah "otot" yang menyambungkan kasir
(`/checkout` → order → verifikasi) ke bengkel (provisioning + deploy).

## Pemicu

Order berstatus `activated` (kamu menekan **✅ Verifikasi & Aktifkan** di Telegram
setelah cek mutasi) akan otomatis mengirim **tiket kerja** ke chat Telegram admin.
Isi tiket: ID order, slug, nama/WA/email pembeli, URL website, dan daftar 6 langkah
di bawah ini.

Pesan itu pengingat, bukan sistem kerja — pekerjaan tetap dijalankan kamu.

## 6 Langkah

### 1. Order aktif → tiket masuk

- Cek mutasi m-Banking / QRIS dulu, **baru** tekan tombol aktivasi.
- Tunggu tiket kerja masuk di Telegram. Catat slug dan nominalnya.
- Kalau tiket tidak masuk, order tetap aktif — tiket hanya pengingat.

### 2. Buat Gmail untuk klien

- Buat satu akun email klien (dipakai untuk komunikasi, notifikasi, dan keperluan
  akun cloud milik klien).
- Simpan kredensialnya di catatan klien kamu. **Jangan** tempelkan password ke chat
  atau ke dokumen publik.

### 3. Buat akun Cloudflare klien

- Klien mendaftar Cloudflare, atau kamu daftarkan atas nama klien.
- Ambil **Account ID** dan buat **API Token** dengan izin **D1, R2, dan Workers (Edit)**.
- (Izin **Pages** tidak lagi dipakai — deploy & custom domain klien sudah pindah ke Worker; izin Workers dibutuhkan untuk deploy dan penyambungan custom domain.)
- Token inilah yang dipakai portal di langkah berikutnya; portal akan menolak token
  yang tidak valid atau tidak cocok dengan Account ID.

### 4. Jalankan `PENGELOLA_KLIEN.bat`

Dari folder repo, jalankan `PENGELOLA_KLIEN.bat` (portal terbuka di
`http://localhost:4567`). Menu yang dipakai:

| Menu | Fungsi |
|---|---|
| `[1]` Pendaftaran Klien Baru | Verifikasi Account ID + API Token, lalu provisioning **D1**, **R2**, dan file konfigurasi klien |
| `[2]` Status Klien | Pantau online/offline, versi template, dan domain semua klien |
| `[3]` Kelola Custom Domain Klien | Pasang domain sendiri untuk klien |
| `[4]` Update Versi Template ke Klien | Terapkan bugfix/fitur baru ke klien yang sudah jalan |

Jangan tutup jendela terminal selama portal dipakai.

### 5. Deploy ke akun klien

- Selesaikan provisioning lewat portal (menu `[1]`), lalu deploy.
- Di balik layar portal memanggil `deployClient()` (`scripts/onboarding/client-deploy.ts`):
  build dengan env klien dari `arsip-klien/<slug>/config.env`, lalu
  `npx wrangler deploy --config .open-next/wrangler.client.<slug>.jsonc`
  ke akun klien. (Script lama `scripts/deploy/deploy-customer.sh` sudah dihapus
  pada audit 2026-10-08 — memang tidak pernah dipanggil portal.)
- Hasil akhir: `https://<slug>.workers.dev` (atau custom domain klien).

### 6. Serah terima + tandai selesai

- Kirim ke klien: URL website, cara login panel (`/admin` → `/admin/login`), dan
  kredensial yang sudah kamu siapkan.
- Simpan semua data klien di folder `arsip-klien/<folder-arsip>/`
  (`config.env` berisi kredensial Cloudflare milik klien — file ini tidak boleh
  masuk git).
- Tandai order/tugasnya selesai **manual di catatan/tracker kamu** — panel Orders di `/admin`
  sudah dihapus.

## Kalau Klien Lupa Password

Tidak ada reset password self-service. Reset manual dari komputermu:

```bash
npx tsx scripts/cloudflare/reset-customer-password.ts <folder-arsip> --email admin@klien.com --generate
```

`--generate` membuat password baru yang tinggal kamu kirimkan ke klien.

## Referensi

- [support-playbook.md](./support-playbook.md) — penanganan tiket support.
- [backup-restore-runbook.md](./backup-restore-runbook.md) — backup & restore D1/R2.
- `docs/release/PRODUCTION_DEPLOY_RUNBOOK.md` — checklist rilis ke produksi.
