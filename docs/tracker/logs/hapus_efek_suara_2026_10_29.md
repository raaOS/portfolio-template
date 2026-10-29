# Hapus Seluruh Efek Suara OS (v1.3.75, 2026-10-29)

- **Status:** Completed
- **Permintaan owner:** hapus dan bersihkan seluruh efek suara di project — file, kode, dan CRUD panel admin. **Musik tidak boleh disentuh.**

## Ringkasan

Seluruh mesin efek suara OS dihapus. Pemutar musik (`MusicPlayerContext`, kartu musik di Control Center, upload audio) tetap utuh dan tidak diubah. Slider volume sistem tetap berfungsi karena musik membaca `useOSMedia().volume`; yang dihapus hanya penerusan volume ke `SoundManager`.

## File dihapus

| File | Keterangan |
|---|---|
| `src/components/os/utils/SoundManager.ts` | Singleton pemutar SFX |
| `src/components/os/hooks/useSystemSound.ts` | Oscillator WebAudio untuk bunyi klik dock (`playPop`) |
| `src/components/layout/SoundConfigLoader.tsx` | Loader konfigurasi suara dari D1 |
| `src/app/admin/system/components/SoundEffectsManager.tsx` | CRUD efek suara panel admin |
| `src/app/admin/system/sounds/page.tsx` | Route admin `/admin/system/sounds` |
| `src/app/admin/desktop/panels/SoundsPanel.tsx` | Panel desktop admin "Efek Suara" |
| `scripts/cloudflare/check-sound-config.ts` | Script inspeksi `soundConfig` |
| `scripts/cloudflare/restore-sound-config.ts` | Script restore `soundConfig` |
| `scripts/cloudflare/test-update-sound.ts` | Script uji update `soundConfig` |
| `scripts/media/generate-sounds.js` | Generator file WAV efek suara |
| `public/sounds/` | 19 file SFX (mp3/wav) |

## File diubah (pemanggilan/plumbing dihapus)

- `src/components/os/windows/Window.tsx` — bunyi saat window dibuka.
- `src/components/os/windows/components/WindowTitleBar.tsx` — bunyi tombol close.
- `src/components/os/hooks/useWindowKeyboard.ts` — bunyi Escape/close.
- `src/components/os/ui/elements/DesktopIcon.tsx` — bunyi klik & drag ikon desktop.
- `src/components/os/core/DockItem.tsx` — `playPop()` oscillator.
- `src/components/os/core/DesktopEnvironment.tsx` — load config, preload startup, 3 blok suppression.
- `src/components/os/hooks/useBootSequence.ts` — unlock/clearCache saat power on.
- `src/components/os/ui/StartScreen.tsx` — opsi `playSound` dan pemutaran startup.
- `src/components/os/ui/ControlCenter.tsx` — `soundManager.setVolume`; slider volume tetap ada.
- `src/hooks/useChatSync.ts` — notifikasi pesan masuk, pesan terkirim, balasan demo.
- `src/components/os/windows/hooks/useChatSequencer.ts` — notifikasi chat simulasi.
- `src/components/chat/_components/FullPageChatFooter.tsx` — bunyi mengetik.
- `src/app/(site)/layout.tsx`, `src/app/page.tsx` — pelepasan `SoundConfigLoader`.
- `src/app/admin/desktop/WindowContentRenderer.tsx`, `registry.ts` — app/panel "Efek Suara" dihapus dari zona Tampilan.
- `src/types/about.ts`, `src/lib/about.ts`, `src/lib/services/aboutService.ts`, `src/lib/validations/adminCrud.ts`, `src/data/about.json` — tipe, loader, merge, validasi, dan seed `soundConfig` dihapus.
- `src/lib/constants.ts` — helper `getAssetPath` (hanya dipakai SFX) dihapus.
- `src/lib/media/uploadHelpers.ts`, `src/app/api/admin/upload/route.ts` — cabang folder `assets/sounds` dihapus; dukungan MIME audio **tetap** untuk musik.
- `src/components/os/hooks/window-manager/useWindowActions.ts`, `src/components/os/core/Dock.tsx` — komentar usang diperbarui.
- `src/components/os/ui/__tests__/StartScreen.test.tsx`, `src/hooks/__tests__/useChatSync.test.tsx` — mock `SoundManager` dihapus.
- `tests/e2e/os-core.spec.ts` — test "startup click unlocks OS audio" dihapus.
- `AGENTS.md` — entri protected core P5 (`SoundManager`) dihapus, tabel dinomori ulang P1–P7, daftar app zona Tampilan diperbarui.
- `panduan/PANDUAN_UNTUK_KAMU_OWNER.md`, `scripts/README.md` — deskripsi efek suara/generator dihapus.

## Verifikasi

- `npx tsc --noEmit` → **0 error**.
- `npx eslint` pada seluruh file yang diubah → **0 error / 0 warning**.
- `npx vitest run` → **150 file / 1266 test PASS**.
- Pencarian ulang `SoundManager|useSystemSound|soundConfig|SoundConfig|SoundsPanel|SoundEffects|soundManager|/sounds|assets/sounds|Efek Suara|generate-sounds` di luar log historis → **0 hit**.
- `public/sounds/` dan `src/app/admin/system/sounds/` sudah tidak ada.
- Sisa kata "sound" di `src/` hanya teks bahasa Inggris yang tidak terkait (prompt terjemahan & deskripsi karya seni).

## Catatan

- Baris D1 lama yang masih menyimpan `soundConfig` di `content/about` tidak dimigrasi; tidak ada kode yang membacanya lagi dan kunci itu akan hilang saat admin menyimpan data About berikutnya.
- `CHANGELOG.md` historis yang menyebut efek suara sengaja **tidak** diubah (catatan rilis lama).
- Musik: `MusicPlayerContext`, `MusicPlayerControlCard`, dan jalur upload audio tidak disentuh.
