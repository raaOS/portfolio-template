# Alur Order Chat-First (Alur B): Buat Order dari Panel + Link Checkout Sekali Salin

- **Status:** 🟢 Completed
- **Tanggal:** 2026-10-12
- **Versi:** 1.3.40

## Latar & Keputusan Owner

Kajian kepercayaan pembeli (diskusi 2026-10-12): untuk jasa Rp199.000 yang dijual lewat
percakapan, **trust dibangun sebelum bayar**, bukan oleh mekanisme bayarnya. Payment
gateway dinilai belum perlu (volume satuan, settlement T+1/T+2, tidak menambah proteksi
ala escrow); QRIS manual dipertahankan. Keputusan: penjualan lewat **chat WhatsApp dulu →
deal → order dibuat owner → link checkout dikirim ke pembeli** ("Alur B").

Alternatif yang dipertimbangkan & ditolak sementara:

- **Payment gateway (Midtrans/Xendit/Flip):** berguna untuk otomasi (webhook →
  `activating` → deploy mandiri) dan channel VA/kartu, TAPI tidak memberi proteksi
  escrow. Ditunda sampai trigger kena: klien korporat butuh VA/faktur, atau volume > 5
  order/bulan, atau mau onboarding tanpa owner.
- **Escrow / milestone 50-50 manual:** cacat logika — bergantung pada kejujuran pihak
  yang perlu diproteksi. Milestone hanya valid kalau diberi tuas otomatis (preview URL
  vs production handover), itu belum dibangun.
- **Menutup checkout publik:** ditolak. Biaya nol, dan tetap dibutuhkan sebagai fondasi
  otomasi masa depan + jalur pembeli yang tidak mau chat.

## Perubahan Kode

| File | Perubahan |
|---|---|
| `src/app/api/admin/orders/route.ts` | Aksi baru `create`: terima `buyerName`/`buyerEmail`/`buyerWhatsapp` (wajib) + `desiredSlug`/`templateId` (opsional), panggil `createOrder` dengan env Telegram + `APP_BASE_URL`, balas `order` + `checkoutUrl` (berisi token mentah). Slug auto-generate dari nama bila kosong (sama dengan checkout publik). Sengaja TIDAK kena rate-limit publik `billing_checkout` (5/menit per IP) — pemanggil owner, route sudah `requireOwnerMode()` + `validateAdminRequest` (auth+CSRF). Validasi `orderId` di-skip untuk aksi ini (belum ada order). |
| `src/app/admin/desktop/panels/OrdersPanel.tsx` | Tombol **Buat Pesanan** di toolbar → form ringkas (nama, email, WA, slug, select template macOS Desktop / Infinite Canvas / 3D Spatial Gallery). Setelah sukses: kotak hijau berisi link checkout + tombol **Salin Link** (clipboard API) + penanda "link hanya tampil sekali". Icon baru: `Plus`, `Copy`, `Link2`, `X`. |
| `src/app/api/admin/orders/route.test.ts` | +3 test aksi `create` (sukses + slug auto-generate + `checkoutUrl` berisi token, validasi data wajib tanpa memanggil `createOrder`, error service diteruskan 400). Mock `createOrder` ditambahkan. **10/10 PASS.** |
| `src/lib/constants.ts` | `APP_VERSION` 1.3.39 → 1.3.40 |

## Keamanan & Catatan Desain

- **Token checkout sekali tampil.** `createOrder` menyimpan `access_token_hash` (SHA-256)
  di D1 — token mentah tidak pernah bisa dibaca ulang, sehingga link checkout hanya bisa
  ditampilkan di momen pembuatan. Respons admin dibatasi owner-mode + auth + CSRF.
  Pembeli yang kehilangan link tetap punya tautan sama lewat email struk.
- **Jalur admin tidak melewati proteksi apa pun** — hanya rate-limit publik yang tidak
  relevan (anti-spam untuk orang asing, bukan untuk owner).
- **Perilaku checkout publik tidak berubah** — `/checkout` tetap terbuka.
- **Mekanisme pembayaran tidak disentuh:** nominal unik, QRIS, upload bukti, sweep
  24 jam/7 hari, aktivasi, semuanya sama.

## Dokumentasi (wajib §0)

| File | Perubahan |
|---|---|
| `CHANGELOG.md` | Entri 1.3.40 di baris teratas |
| `docs/diagrams/alur-bisnis.mmd` | Node P1/P2/S1/O1–O6 ditulis ulang: pembeli chat dulu, order dibuat owner, link dikirim WA, **cek mutasi → aktifkan → deploy**. Tanpa kutip lurus (jebakan Mermaid v1.3.39) |
| `docs/operations/support-playbook.md` | §0 baru "Alur Order & Pembayaran (Chat-First)" — alur 6 langkah, kotak peringatan **cek mutasi → aktifkan → deploy**, penanganan bayar telat (Buka Kembali / aktivasi telat), larangan ubah D1 langsung. 2 kalimat usang diperbaiki (panel Pesanan disebut "sudah dihapus" — padahal dibuat ulang v1.3.29) |
| `docs/operations/support-response-templates.md` | Bagian Billing diganti dari placeholder Sprint 47 jadi 3 template nyata: kirim link checkout, bukti diterima-menunggu verifikasi, pembayaran telat |
| `docs/release/SALES_PRICING.md` | Bagian "Model Jual" ditulis ulang ke alur chat-first |
| `panduan/PANDUAN_UNTUK_KAMU_OWNER.md` | Alur kerja 3 → **4 langkah** (Chat & Deal → Buat Order + Link → Pasang → Serahkan) + kotak "Aturan emas pembayaran" + Template WA baru (kirim link checkout) |
| `docs/operations/GLADI_RESIK_KLIEN_PERDANA.md` | Tahap A dipecah: A1 jalur chat-first (wajib), A2 checkout publik (sekunder), A3 verifikasi & aktivasi dengan urutan mutasi-dulu |
| `AGENTS.md` | Catatan alur order chat-first di §12 dekat zona admin & endpoint orders |

## Verifikasi

- `npx vitest run src/app/api/admin/orders/route.test.ts` → **10/10 PASS** (jalur worktree
  dengan `node_modules` junction ke repo utama — HEAD sama, tidak ada install ulang).
- Perubahan hanya menyentuh route admin + panel admin owner + dokumen — **tidak
  menyentuh** 8 Protected Cores, schema D1, maupun alur billing publik.

## Sisa Pekerjaan (tidak dikerjakan — di luar scope, belum diminta)

- Kwitansi PDF setelah aktivasi (`jspdf` sudah ada di dependencies) — nilai trust besar.
- Tombol Telegram `verify_{id}` (saat ini inline button baru ada `reopen_{id}`).
- Milestone 50/50 dengan tuas otomatis (preview URL vs production) bila harga naik.
- Integrasi payment gateway bila trigger kena (VA/faktur korporat, volume > 5/bln,
  onboarding mandiri).

## File yang Dimodifikasi

- `src/app/api/admin/orders/route.ts`
- `src/app/api/admin/orders/route.test.ts`
- `src/app/admin/desktop/panels/OrdersPanel.tsx`
- `src/lib/constants.ts`
- `CHANGELOG.md`
- `AGENTS.md`
- `docs/diagrams/alur-bisnis.mmd`
- `docs/operations/support-playbook.md`
- `docs/operations/support-response-templates.md`
- `docs/operations/GLADI_RESIK_KLIEN_PERDANA.md`
- `docs/release/SALES_PRICING.md`
- `panduan/PANDUAN_UNTUK_KAMU_OWNER.md`
- `docs/tracker/logs/alur_order_chat_first_v1_3_40_2026_10_12.md` (baru)
- `docs/tracker/INDEX_TRACKER.md`
