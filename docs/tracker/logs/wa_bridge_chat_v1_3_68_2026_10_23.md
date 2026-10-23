# Log: Jembatan WhatsApp di Jendela Contact (v1.3.68)

Tanggal: 2026-10-23 · Mode: implementasi (owner: "lakukan, dan test mungkin pakai nomor dummy")

## Latar

Owner bertanya arah fitur chat: matikan di demo, aktif sesuai nomor HP pengunjung, atau hapus?
Penyelidikan read-only dulu (semua klaim ada angkanya):

- `FEATURE_AI=false`, `AI_PROVIDER`/`AI_API_KEY` kosong → bot AI sudah mati.
- `TELEGRAM_BOT_TOKEN` dipakai HANYA domain order/tiket (`orderService.ts`, webhook) — bukan chat.
- app_kv demo D1: **0** baris chat (`sessions`, `sessions/%`, `messages`, `messages/%`, `typing`, `chat%` semua dicek) → chat belum pernah terkirim siapa pun; storage sendiri sehat.
- `chatStore.addAdminReply`/`setAiMode` (chatStore.ts:76,97) **orphan** — tidak dipanggil route/UI mana pun → tidak ada jalur balasan admin.
- App admin "Messages" membaca `/api/leads` (form kontak) — bukan chat.
- Dock app "whatsapp" (`ChatWindow.tsx`) = mock tanpa jaringan. Satu-satunya chat nyata = jendela Contact (`FullPageChat` + `useChatSync`).

## Keputusan owner

**Chat = jembatan WhatsApp** (opsi rekomendasi): jendela chat tetap sebagai tampilan; kirim → `wa.me` milik klien dengan pesan prefilled. Percakapan nyata di luar template (app WA klien). Rencana "jalur balasan admin" **batal**.

## File diubah

| File | Perubahan |
|---|---|
| `src/utils/whatsappLink.ts` | BARU — `normalizeWhatsAppNumber` (08→62, +62, paste URL wa.me; 8–15 digit) + `buildWhatsAppLink` teks ter-encode |
| `src/utils/whatsappLink.test.ts` | BARU — 12 test, nomor DUMMY `081234567890` |
| `src/hooks/useChatSync.ts` | Param baru `whatsappNumber` → mode WA: polling mati (SWR key null), `sendMessage` → `window.open(wa.me)`, balon lokal centang biru; nomor kosong/invalid → jalur lama utuh; ekspor `isWhatsAppBridge` |
| `src/components/chat/FullPageChat.tsx` | Ambil `contactInfo.socialMedia.whatsapp` → hook + footer; banner error hilang di mode WA |
| `src/components/chat/_components/FullPageChatFooter.tsx` | Prop `whatsappMode`: sembunyikan mic & `+`, tombol kirim selalu tampil (disabled saat kosong) |
| `src/components/templates/infinite-canvas/components/CanvasLeftDrawer.tsx` | Builder WA inline dipindah ke helper bersama — memperbaiki bug `wa.me/0812…` (nomor 0-prefix sebelumnya rusak) |
| `src/hooks/__tests__/useChatSync.test.tsx` | BARU — mode WA nol fetch; mode lama tetap POST /api/chat/send |
| `CHANGELOG.md` | Entri `[1.3.68]` |

## Gerbang

- `npm run cf:typegen` → `tsc --noEmit`: 0 error
- `npm run lint`: 0
- `npm test`: **145 file / 1204 test PASS** (+2 file, +12 tes)

## Uji nyata (nomor dummy)

1. Back-up baris `content_default-site` (32.177 char) → file `contact_seed_backup.json`.
2. Tulis node `contact` ke baris itu dengan `socialMedia.whatsapp = 081234567890` (dummy). (Dev REST D1 memengaruhi DB produksi yang sama → jejak singkat di situs live, khusus kolom WA dummy.)
3. `npm run dev` + agent-browser → `http://localhost:3000/preview/os-desktop?app=contact`.
   - Footer: mic & `+` hilang; tombol kirim tampil — mode WA aktif.
   - Ketik "Tes dari agent - nomor dummy 6281234567890" → Enter → **popup tab ke WhatsApp asli**: "Chat on WhatsApp with +62 812-3456-7890" (dummy dinormalisasi `6281234567890`), teks pesan terbawa penuh (`api.whatsapp.com/send/?phone=6281234567890&text=Tes+dari+agent…`).
   - Balon pengunjung muncul centang biru; input kembali bersih.
4. Bukti tanpa jaringan: log dev **nol** request `/api/chat/send` & `/api/chat/sync`; D1 nol tulisan dari uji ini.
5. Restore DB dari back-up — **identik byte-per-byte** (dicek dengan perbandingan string penuh + panjang 32177).

## Temuan samping

- Pesan `"daad"` (pengunjung asli, 21:37 WIB) tersimpan lewat jalur lama pada situs produksi (belum deploy jembatan). Bukan dari uji (teks/waktu tidak cocok). Ditinggal di D1; setelah deploy, chat baru tidak akan menulis apa pun selama nomor WA terisi.
- `GET /?app=contact` di landing storefront tetap landing (desktop hanya di `/preview/os-desktop`).

## Gagal / risiko yang diterima (lakukan jika suatu saat dibutuhkan)

- Klien yang belum isi nomor WA → chat berjalan jalur lama (simpan D1 + polling): D1 jadi berhimpun pesan yang mungkin tak dibaca. Mitigasi: edukasi onboarding "isi Nomor WhatsApp di Contacts".
- Admin Contact form: kolom WhatsApp sudah ada (`AdminContactClient.tsx:294-330`) — tidak ada pekerjaan form.
- `addAdminReply`/`setAiMode` tetap orphan dipertahankan (tidak dihapus, tidak berbahaya, dipakai bila suatu hari admin reply dibangun).
