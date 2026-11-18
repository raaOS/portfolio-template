# Tracker Log: Hapus Panel "Pesan Masuk" (leads tanpa writer)

**Status:** 🟢 Completed
**Mulai:** 2026-11-15
**Selesai:** 2026-11-15 (rilis v1.3.89 — belum deploy)

## 📌 STATUS TERAKHIR — WAJIB DIBACA & DIUPDATE AI BERIKUTNYA

- **Tanggal update:** 2026-11-15
- **Progress:** Selesai penuh. Panel "Pesan Masuk" dihapus total atas keputusan owner
  (percakapan 2026-11-15, lanjutan audit CRUD dashboard).
- **Langkah berikutnya:** Deploy oleh owner. Tidak ada kode tersisa.
- **Kaitan:** lanjutan konteks dari `fitur_penyamaan_konten_template_2026_11_15.md`
  (audit 16 CRUD konten; "Pesan Masuk" = satu-satunya CRUD yang mati di SEMUA template).

## 🎯 Tujuan (Objective)

Panel admin **Pesan Masuk** (`/admin/communications/messages`) membaca `GET /api/leads`
(`db.ref('leads')`) yang **tidak punya writer di seluruh repo** — panel selamanya kosong dan
menyesatkan klien (kesan pesan hilang). Pesan visitor asli masuk sistem chat
(`POST /api/chat/send` → `chatStore` → D1 `sessions/{visitorId}` & `messages/{visitorId}`),
bukan ke leads. Owner memilih **hapus**, bukan tambal.

## 🔒 Fakta Terverifikasi (jangan dilupakan AI berikutnya)

- `chatStore.addAdminReply(visitorId, text)` (`src/lib/chatStore.ts:76`) ADA di data layer
  tapi **nol pemanggil** — tidak ada API/panel yang menulis balasan admin. Bila kelau dibangun
  **inbox chat sungguhan**, fondasinya sudah siap; itu fitur BARU dengan log sendiri.
- Jalur pesan yang hidup: visitor chat → **jembatan WhatsApp** (aktif bila klien mengisi
  `contact.info.socialMedia.whatsapp`) → WA klien (jalur utama, chat-first v1.3.40); mode demo
  di situs owner (`OWNER_MODE=true`); AI auto-reply bila `FEATURE_AI=true`.
- `leads` TIDAK berhubungan dengan chat visitor. Jangan pernah menghubungkan keduanya lagi
  tanpa keputusan owner.

## 📋 Task List

- [x] Petakan semua referensi (`AdminLeadsClient`, `fetchAdminLeads`, `/api/leads`,
      `ADMIN_QUERY_KEYS.leads`, `id: 'messages'`) — 9 file teridentifikasi
- [x] Registry: hapus app `messages` + `APP_ROUTE_MAP.messages` + import `Users` tak terpakai
      (`src/app/admin/desktop/registry.ts`)
- [x] `WindowContentRenderer.tsx`: hapus `MessagesPanel` + map entry
- [x] `src/app/admin/communications/page.tsx`: redirect → `/admin/communications/notifications`
- [x] Hapus folder `src/app/admin/communications/messages/` (page + AdminLeadsClient)
- [x] Hapus `src/app/api/leads/` (route.ts + route.test.ts)
- [x] `adminQueries.ts`: hapus key `leads`, interface `Lead`, placeholder `leads`,
      `fetchAdminLeads`, prefetch line
- [x] `csrf.test.ts`: hapus kasus `/api/leads`
- [x] `AGENTS.md`: tabel zona diselaraskan — Komunikasi = Notifications, Feedback, Contacts;
      Tampilan + Loader (sebelumnya tertinggal); catatan penghapusan ditambahkan
- [x] Verifikasi: `tsc --noEmit` 0 error, ESLint bersih, test registry + CSRF 31/31 PASS,
      nol referensi tersisa (`grep leads|AdminLeadsClient|fetchAdminLeads` bersih di `src`)
- [x] `CHANGELOG.md` [1.3.89] + `APP_VERSION` bump (`src/lib/constants.ts`)
- [x] Log ini + entri `INDEX_TRACKER.md`

## 🚫 Sengaja TIDAK Dikerjakan

- Inbox chat admin (baca + balas chat visitor di dashboard) — fitur baru, butuh keputusan &
  log terpisah; data model (`chatStore.addAdminReply`) sudah siap.
- Data `leads` lama di D1 produksi TIDAK dihapus (aturan: resource/data klien tidak pernah
  dihapus oleh kita). Panel-nya saja yang hilang; kalau ada data leads lama dari seed/eksternal,
  tetap aman di D1.

## 📂 File yang Dimodifikasi (Modified Files)

- `src/app/admin/desktop/registry.ts` -> hapus app `messages` + route map + import Users
- `src/app/admin/desktop/WindowContentRenderer.tsx` -> hapus MessagesPanel + map entry
- `src/app/admin/communications/page.tsx` -> redirect kini ke notifications
- `src/app/admin/communications/messages/` -> **dihapus seluruhnya**
- `src/app/api/leads/` -> **dihapus seluruhnya** (route + test)
- `src/app/admin/lib/adminQueries.ts` -> hapus key/interface/placeholder/fetch/prefetch leads
- `src/middleware/__tests__/csrf.test.ts` -> hapus kasus `/api/leads`
- `AGENTS.md` -> tabel zona admin diselaraskan + catatan penghapusan
- `src/lib/constants.ts` -> APP_VERSION 1.3.88 → 1.3.89
- `CHANGELOG.md` -> entry [1.3.89]
- `docs/tracker/INDEX_TRACKER.md` -> entri log ini

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)

Pekerjaan selesai. Jangan buat ulang panel leads. Bila owner meminta inbox chat, buat fitur
baru (panel + endpoint tulis yang memakai `chatStore.addAdminReply` + auth admin + CSRF) dengan
log tracker sendiri.
