'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Clapperboard, Trash2, Upload } from 'lucide-react';
import { getWritableCsrfToken } from '@/lib/security/client-csrf';
import { useFFmpeg } from '@/app/admin/components/file-upload/hooks/useFFmpeg';

/**
 * Panel Video Hero (v1.3.49) — CRUD rekaman demo untuk lembaran koridor
 * hero halaman jualan storefront.
 *
 * Alur upload per slot: rekaman mentah (HP/laptop, format apa pun) →
 * dikompres OTOMATIS di browser (WASM FFmpeg, profil `standard`:
 * MP4 H.264 720p, audio dibuang, faststart) → diunggah ke R2 lewat
 * `/api/admin/upload?folder=hero-videos` → URL disimpan di D1 lewat
 * `/api/admin/hero-videos`. Slot kosong = hero memakai video default /
 * gambar screenshot.
 *
 * Owner-only: route API dibalas 404 di deployment klien (requireOwnerMode)
 * dan app ini tidak tampil di desktop admin klien (ownerOnly di registry).
 *
 * Serialize: WASM FFmpeg single-thread — satu encode pada satu waktu,
 * tombol lain dinonaktifkan saat ada yang sibuk.
 */

const SLOT_LABELS: Record<string, string> = {
  'os-desktop': 'OS Desktop',
  'infinite-canvas': 'Infinite Canvas',
  'spatial-gallery': 'Spatial Gallery',
};
const SLOTS = Object.keys(SLOT_LABELS);
/** Rekaman mentah > 500 MB tidak layak diproses di browser. */
const MAX_RAW_BYTES = 500 * 1024 * 1024;

type SlotState = {
  busy: boolean;
  progress: number;
  error: string;
};

const IDLE_SLOT: SlotState = { busy: false, progress: 0, error: '' };

export default function HeroVideosPanel() {
  const [videos, setVideos] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [slots, setSlots] = useState<Record<string, SlotState>>({});
  const [ffmpegStatus, setFfmpegStatus] = useState('');
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Satu encode pada satu waktu (WASM FFmpeg single-thread).
  const anyBusy = Object.values(slots).some((s) => s.busy);

  const { compressVideo } = useFFmpeg(
    useCallback((status: string) => setFfmpegStatus(status), [])
  );

  const setSlot = useCallback(
    (slot: string, patch: Partial<SlotState>) => {
      setSlots((prev) => ({
        ...prev,
        [slot]: { ...(prev[slot] || IDLE_SLOT), ...patch },
      }));
    },
    []
  );

  const fetchVideos = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const res = await fetch('/api/admin/hero-videos');
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.videos !== 'object' || !data.videos) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setVideos(data.videos as Record<string, string>);
    } catch (err) {
      console.error('[HeroVideosPanel] Gagal memuat video hero:', err);
      setLoadError('Gagal memuat video hero. Coba segarkan halaman.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load awal ditunda ke macrotask berikutnya (rule react-hooks/set-state-in-effect).
  useEffect(() => {
    const timer = setTimeout(() => void fetchVideos(), 0);
    return () => clearTimeout(timer);
  }, [fetchVideos]);

  const saveUrl = useCallback(
    async (slot: string, url: string) => {
      const res = await fetch('/api/admin/hero-videos', {
        method: 'PUT',
        headers: { 'x-csrf-token': getWritableCsrfToken(null) },
        credentials: 'include',
        body: JSON.stringify({ slug: slot, url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setVideos(data.videos as Record<string, string>);
    },
    []
  );

  const handleFile = useCallback(
    async (slot: string, file: File) => {
      if (!file.type.startsWith('video/')) {
        setSlot(slot, { error: 'File harus video (mp4/webm/mov).' });
        return;
      }
      if (file.size > MAX_RAW_BYTES) {
        setSlot(slot, {
          error: 'Rekaman mentah terlalu besar (>500 MB) — potong durasinya.',
        });
        return;
      }

      setSlot(slot, { busy: true, progress: 0, error: '' });
      setNotice('');
      try {
        // 1. Kompres di browser → MP4 H.264 720p, audio dibuang, faststart
        //    (mulai diputar sambil masih diunduh — buka browser cold pun
        //    video hero langsung hidup).
        const compressed = await compressVideo(file, (p) =>
          setSlot(slot, { progress: p })
        );
        const named = new File([await compressed.arrayBuffer()], `hero-${slot}.mp4`, {
          type: 'video/mp4',
        });

        // 2. Unggah ke R2 (folder hero-videos; route upload menghormati
        //    folder yang diawali `assets/`).
        setSlot(slot, { progress: 100 });
        const formData = new FormData();
        formData.append('file', named);
        const res = await fetch(
          `/api/admin/upload?folder=assets/hero-videos&filename=hero-${slot}`,
          {
            method: 'POST',
            headers: { 'x-csrf-token': getWritableCsrfToken(null) },
            credentials: 'include',
            body: formData,
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.url) {
          throw new Error(data.error || `Upload gagal (HTTP ${res.status})`);
        }

        // 3. Simpan URL ke D1 → hero ter-update dalam ±1 menit (ISR 60 dtk).
        //    Route upload mengembalikan URL relatif (/r2/…) sedangkan
        //    validasi service mewajibkan http(s) absolut → jadikan absolut.
        const absoluteUrl = new URL(String(data.url), window.location.origin).toString();
        await saveUrl(slot, absoluteUrl);
        setNotice(
          `Video ${SLOT_LABELS[slot]} tersimpan. Hero ter-update otomatis dalam ±1 menit.`
        );
      } catch (err) {
        console.error(`[HeroVideosPanel] Gagal upload ${slot}:`, err);
        setSlot(slot, {
          error:
            err instanceof Error ? err.message : 'Gagal memproses rekaman.',
        });
      } finally {
        setSlot(slot, { busy: false });
        setFfmpegStatus('');
      }
    },
    [compressVideo, saveUrl, setSlot]
  );

  const handleDelete = useCallback(
    async (slot: string) => {
      if (!window.confirm(`Hapus video hero ${SLOT_LABELS[slot]}?`)) return;
      setSlot(slot, { busy: true, error: '' });
      setNotice('');
      try {
        await saveUrl(slot, '');
        setNotice(`Video ${SLOT_LABELS[slot]} dihapus — hero memakai video default / gambar.`);
      } catch (err) {
        setSlot(slot, {
          error: err instanceof Error ? err.message : 'Gagal menghapus video.',
        });
      } finally {
        setSlot(slot, { busy: false });
      }
    },
    [saveUrl, setSlot]
  );

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 md:p-6">
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
        <p className="mb-1 font-medium text-neutral-800">
          Rekaman demo untuk lembaran hero halaman jualan
        </p>
        <p>
          Rekam layar demo (durasi pendek ±15–30 detik, tanpa suara) lalu
          upload di slot template yang sesuai. Rekaman dikompres otomatis di
          browser (MP4, 720p, audio dibuang) sebelum disimpan — file mentah
          besar pun aman. Slot kosong otomatis memakai video default / gambar
          screenshot.
        </p>
      </div>

      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {notice}
        </div>
      )}
      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-neutral-500">Memuat video hero…</p>
      ) : (
        SLOTS.map((slot) => {
          const state = slots[slot] || IDLE_SLOT;
          const url = videos[slot];
          return (
            <section
              key={slot}
              className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4 md:flex-row md:items-start"
            >
              <div className="flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <Clapperboard className="h-4 w-4 text-rose-500" aria-hidden />
                  <h3 className="text-sm font-semibold text-neutral-800">
                    {SLOT_LABELS[slot]}
                  </h3>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                    {url ? 'aktif' : 'default'}
                  </span>
                </div>

                {url ? (
                  <video
                    key={url}
                    src={url}
                    muted
                    loop
                    playsInline
                    controls
                    preload="metadata"
                    className="mb-2 w-full max-w-sm rounded-lg border border-neutral-200 bg-black"
                  />
                ) : (
                  <p className="mb-2 text-xs text-neutral-500">
                    Belum ada rekaman — hero memakai video default / gambar.
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={(el) => {
                      inputRefs.current[slot] = el;
                    }}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) void handleFile(slot, file);
                    }}
                  />
                  <button
                    type="button"
                    disabled={state.busy || anyBusy}
                    onClick={() => inputRefs.current[slot]?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden />
                    {url ? 'Ganti rekaman' : 'Upload rekaman'}
                  </button>
                  {url && (
                    <button
                      type="button"
                      disabled={state.busy || anyBusy}
                      onClick={() => void handleDelete(slot)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Hapus
                    </button>
                  )}
                </div>
              </div>

              <div className="w-full md:w-56">
                {state.busy && (
                  <div className="space-y-1">
                    <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
                      <div
                        className="h-full rounded-full bg-rose-500 transition-all"
                        style={{ width: `${Math.max(4, state.progress)}%` }}
                      />
                    </div>
                    <p className="text-xs text-neutral-500">
                      {ffmpegStatus || 'Memproses…'}
                    </p>
                  </div>
                )}
                {state.error && (
                  <p className="text-xs text-red-600">{state.error}</p>
                )}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
