# 08. Agent Guardrails

**DOKUMEN INI ADALAH RULE KERAS (HARD RULES) UNTUK SEMUA AI AGENT.**

1. **NO FIREBASE:** Dilarang mengimpor, menambah dependensi, atau menaruh env `FIREBASE_*` dalam bentuk apapun. Gunakan D1 dan R2.
2. **NO UI REWRITE:** Dilarang merombak ulang (*rewrite*) arsitektur visual Desktop OS, Window, atau Dock.
3. **PRESERVE FIELDS:** Dilarang menghapus *field* data project lama (seperti `galleryItems`, `narrative`, `order`, dsb) yang masih dibutuhkan untuk merender UI OS.
4. **NO DIRECT DB FROM CLIENT:** Public Template Next.js (client components) dilarang menghubungi D1/R2 secret secara langsung. Semua komunikasi data menggunakan API Endpoint.
5. **ISOLASI CONTEXT:** Bekerjalah pada satu *context* dalam satu waktu (misal: Kerjakan Backend API saja, lalu berhenti. Jangan melompat langsung mengedit Frontend Logic di prompt yang sama).
6. **MANDATORY TRACKER:** Selalu baca dan *update* `docs/tracker/INDEX_TRACKER.md` di awal dan akhir sesi.
