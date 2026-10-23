# Log: Mode demo chat — balasan simulasi (v1.3.70)

Tanggal: 2026-10-24 · Keputusan owner (jawaban atas 3 opsi): **"Mode demo: balasan simulasi"**

## Masalah

Demo desktop (situs milik owner) tidak akan diisi nomor WA pribadi → tanpa itu jendela Contact
kembali jalur legacy "pesan disimpan D1 tak dibaca siapa pun" (buruk untuk demo fitur & untuk D1).

## Solusi yang dibangun

`useChatSync(greeting, whatsappNumber, demoReply?)` — param ketiga keberadaannya = mode demo:

- Sumber flag: `FullPageChat` membaca `process.env.NEXT_PUBLIC_OWNER_MODE === 'true'`
  (di-iniline saat build; `deployClient()` memaksa 'false' dua lapis → klien tak pernah demo).
- Syarat mode: demoReply ada **DAN** nomor WA tidak valid. Jika someday owner mengisi nomor →
  jembatan WhatsApp real menang (urutkan kalkulasi: `isDemoChat = !!demoReply && !isWhatsAppBridge`).
- Eksekusi kirim di mode demo: balon pengunjung (centang biru) → 600 ms → indikator mengetik →
  1400 ms → 2 balon admin: `chat.demoNotice` + `chat.demoReply` (kamus id/en baru).
  Nol `fetch`, nol `window.open`, nol tulis D1. Timer dibersihkan saat unmount (`demoTimersRef`).
- Polling `sync` juga dimatikan di mode demo (SWR key null).

## File diubah

- `src/hooks/useChatSync.ts` — param `demoReply`, `isDemoChat`, cabang simulasi, cleanup timer
- `src/components/chat/FullPageChat.tsx` — `isDemoSite` (`NEXT_PUBLIC_OWNER_MODE`) → `demoReply`
- `src/dictionaries/id.ts` + `en.ts` — `chat.demoNotice`, `chat.demoReply`
- `src/hooks/__tests__/useChatSync.test.tsx` — suite mode demo (fake timers)
- `src/lib/constants.ts` — `APP_VERSION = '1.3.70'`
- `CHANGELOG.md` — entri `[1.3.70]`

## Gerbang

- typegen → tsc: 0 · lint: 0 · vitest: **144 file / 1197 test PASS** (+1 test demo)
- Deploy: Version `99c911bf-f771-431c-8b03-c5891996fd6e`; `/api/health` prod = `version: 1.3.70,
  db connected, stale false, p95 156 ms`
- E2E nyata di prod (`/preview/os-desktop?app=contact`, 2026-10-24): kirim "Tes mode demo dari agent"
  → balon pengunjung ✓ → 2 balon admin (notice + reply) muncul ±2 detik ✓
  (screenshot `AppData\Local\Temp\opencode\demo_e2e_after.png`); `agent-browser tab list` hanya 1 tab —
  **nol popup wa.me** ✓; D1 setelah test: app_kv kunci chat/visitor = 0, `submissions` = 0,
  `audit_logs` 2 jam terakhir = 0 → **demo benar-benar tidak menulis apa pun** ✓

## Tweak pasca-rilis (2026-10-24, ijin owner)

Hint kolom WhatsApp di `/admin/communications/contacts` diperbarui: sebelumnya hanya menyebut
"tombol Mulai Obrolan WhatsApp", kini menjelaskan fungsinya dengan benar — nomor itu dipakai
fitur chat (pesan pengunjung diteruskan ke WA admin), format 6281234567890. Satu baris teks,
logika tak tersentuh (tsc 0, lint 0, 144 file/1197 test PASS).
