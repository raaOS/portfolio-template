// ═══════════════════════════════════════════════════════════════════
// SECTION MAP (BackgroundUploadContext.tsx — 700 lines)
// L1-104:   Imports, types (BackgroundUploadTask, WallpaperUploadProfile),
//           context interface, useBackgroundUpload hook
// L105-146: BackgroundUploadProvider — state, FFmpeg refs, compression chains
// L147-350: removeTask, enqueueVideoCompression — queue management
// L351-550: FFmpeg compression pipeline — progress tracking, chain serialization
// L551-700: Context value, menubar progress integration, provider JSX
// ═══════════════════════════════════════════════════════════════════
'use client';

/**
 * Background Upload Context — State upload wallpaper video ke Cloudflare R2.
 *
 * Mengelola antrean kompresi WASM FFmpeg di client-side, progress tracking,
 * dan direct upload ke R2 via presigned URL. Digunakan oleh admin panel
 * untuk upload wallpaper video besar (bypass batas body runtime aplikasi).
 *
 * @module BackgroundUploadContext
 */
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { useStorageUpload } from '@/app/admin/components/file-upload/hooks/useStorageUpload';
import {
  useFFmpeg,
  type VideoCompressionProfile,
} from '@/app/admin/components/file-upload/hooks/useFFmpeg';
import { useToast } from '@/contexts/ToastContext';
import { mutate } from 'swr';
import { useQueryClient } from '@tanstack/react-query';
import { ADMIN_QUERY_KEYS } from '@/app/admin/lib/adminQueries';
import { getWritableCsrfToken } from '@/lib/security/client-csrf';
import { UploadedAsset } from '@/app/admin/components/file-upload/types';
import { AboutData } from '@/types/about';
import { readVideoDimensions } from '@/lib/videoMeta';

/**
 * Profil yang relevan untuk wallpaper. `standard` (720p) tidak diekspos
 * di sini karena wallpaper tampil fullscreen — pakai 720p akan terlihat
 * pecah di panel 1080p+.
 */
export type WallpaperUploadProfile = Extract<VideoCompressionProfile, 'high' | 'ultra'>;

export interface BackgroundUploadTask {
  id: string;
  filename: string;
  progress: number;
  status:
    | 'starting'
    | 'compressing'
    | 'uploading'
    | 'processing'
    | 'finalizing'
    | 'complete'
    | 'error';
  /**
   * Sub-status detail untuk fase compress (misal "Loading core",
   * "Compressing 35% - ~12s remaining"). Diisi dari `useFFmpeg.onStatusUpdate`.
   * Membantu admin tahu encode benar-benar jalan & estimasi waktu sisa.
   */
  statusDetail?: string;
  error?: string;
  type: 'wallpaper';
  profile?: WallpaperUploadProfile;
}

interface BackgroundUploadContextType {
  tasks: BackgroundUploadTask[];
  enqueueWallpaperUpload: (file: File, options?: { profile?: WallpaperUploadProfile }) => void;
  removeTask: (id: string) => void;
  hasActiveUploads: boolean;
  totalProgress: number;
}

const BackgroundUploadContext = createContext<BackgroundUploadContextType | undefined>(undefined);

import { useCsrfToken } from '@/hooks/useCsrfToken';

// ── Compression heuristics ──────────────────────────────────────────────
//
// Wallpaper di-compress di browser (WASM ffmpeg) supaya server tidak
// pernah harus terima video besar dan supaya output yang sampai ke
// monitor admin/visitor sudah dinormalisasi ke target resolusi.
//
// Skip-on-good-source heuristic per profile (file source sudah bagus →
// pass-through, hindari re-encode yang malah merusak quality):
//   * 'high'  (1440p): file ≤ 25 MB & lebar ≤ 2560 px → biarkan apa adanya
//   * 'ultra' (2160p): file ≤ 50 MB & lebar ≤ 3840 px → biarkan apa adanya
//
// Ceiling 60 MB. File di atas itu di-tolak (lihat WallpaperManager
// validation) — admin diminta export ulang dulu. Live wallpaper 4K dari
// internet tipikal 30-50 MB, jadi 60 MB cukup longgar untuk pass-through
// ultra; di sisi lain mencegah upload 200 MB raw export yang bikin
// visitor sengsara.
const MAX_CLIENT_COMPRESS_SIZE = 60 * 1024 * 1024; // 60 MB

const SKIP_COMPRESS_BY_PROFILE: Record<
  WallpaperUploadProfile,
  { sizeBytes: number; widthPx: number }
> = {
  high: { sizeBytes: 25 * 1024 * 1024, widthPx: 2560 },
  ultra: { sizeBytes: 50 * 1024 * 1024, widthPx: 3840 },
};

const DEFAULT_WALLPAPER_PROFILE: WallpaperUploadProfile = 'high';

export function BackgroundUploadProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<BackgroundUploadTask[]>([]);
  const csrfToken = useCsrfToken();
  const queryClient = useQueryClient();
  const { uploadVideoDirectToR2 } = useStorageUpload({
    folder: 'wallpapers',
    csrfToken: csrfToken || '',
  });

  // Track which task is currently being encoded so we can route the
  // hook's `onStatusUpdate` callback to the right entry. WASM ffmpeg
  // is single-threaded (we serialize via `compressChainRef`), jadi
  // selalu max 1 task encoding di waktu bersamaan.
  const encodingTaskIdRef = useRef<string | null>(null);

  const updateTaskRef = useRef<
    ((id: string, updates: Partial<BackgroundUploadTask>) => void) | null
  >(null);

  // Forward useFFmpeg status string ke task statusDetail. Callback
  // identity stable supaya tidak menyebabkan re-load WASM core
  // tiap render — useFFmpeg loadCore depends on this callback.
  const handleEncodeStatus = useCallback((statusDetail: string) => {
    const taskId = encodingTaskIdRef.current;
    if (!taskId) return;
    updateTaskRef.current?.(taskId, { statusDetail });
  }, []);
  const { compressVideo } = useFFmpeg(handleEncodeStatus);
  const { showSuccess, showError, showWarning } = useToast();

  // Serialize the read-modify-write of `wallpaperConfig` so that two
  // concurrent uploads don't clobber each other's collection update.
  // Without this, upload B reads the same `current` snapshot as upload A
  // and writes back a collection missing A's entry (last-write-wins).
  const finalizeChainRef = useRef<Promise<unknown>>(Promise.resolve());

  // WASM ffmpeg single-threaded — dua encode paralel akan saling rebut
  // FFmpeg instance dan menghasilkan file korup. Serialkan encode di
  // sini supaya beberapa drag/drop sekaligus tetap aman; upload network
  // tetap paralel (dipisah per-task).
  const compressChainRef = useRef<Promise<unknown>>(Promise.resolve());

  const removeTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<BackgroundUploadTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  }, []);

  // Keep ref pointing at latest updateTask so the encode-status
  // callback (handleEncodeStatus) can dispatch into it without
  // capturing a stale closure. Pakai useEffect (bukan assignment
  // langsung di render) supaya tidak melanggar `react-hooks/refs`
  // rule. updateTask identity stable via useCallback([], jadi
  // effect cuma jalan sekali setelah mount.
  useEffect(() => {
    updateTaskRef.current = updateTask;
  }, [updateTask]);

  const hasActiveUploads = tasks.some((t) => t.status !== 'complete' && t.status !== 'error');
  const activeTasks = tasks.filter((t) => t.status !== 'complete' && t.status !== 'error');
  const totalProgress =
    activeTasks.length > 0
      ? activeTasks.reduce((sum, t) => sum + t.progress, 0) / activeTasks.length
      : 0;

  // ── Session keep-alive heartbeat ────────────────────────────────
  // JWT TTL admin = 2 jam (lihat lib/auth.ts). Compress wallpaper 4K
  // bisa makan 5-15 menit, plus admin sering multitask di tab lain
  // selama proses jalan. Tanpa heartbeat, sliding refresh di proxy
  // tidak akan trigger (tab idle = no requests = no refresh) dan
  // session expired di tengah upload → redirect ke login → context
  // reload → progress hilang.
  //
  // Solusi: ping `/api/admin/verify` setiap 5 menit selama ada task
  // aktif. Endpoint ini ringan (cuma cek token), dan setiap call
  // melewati proxy yang akan refresh token kalau sisa < 30 menit.
  useEffect(() => {
    if (!hasActiveUploads) return;

    const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

    const ping = () => {
      fetch('/api/admin/verify', {
        credentials: 'include',
        cache: 'no-store',
        // Best-effort — kalau gagal (network blip, server error),
        // upload tetap lanjut. Heartbeat bukan critical path.
      }).catch((err) => {
        console.warn('[BackgroundUpload] session heartbeat failed:', err);
      });
    };

    // Ping sekali langsung supaya kalau token sudah hampir habis di
    // saat upload dimulai, refresh kicks-in segera (tidak nunggu 5
    // menit pertama).
    ping();
    const intervalId = setInterval(ping, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [hasActiveUploads]);

  // ── Unload guard ────────────────────────────────────────────────
  // Browser dialog "Leave site?" saat user mau close tab / navigate
  // away saat upload masih jalan. Tidak bisa cegah sepenuhnya (browser
  // modern hanya tampilkan generic message), tapi cukup untuk warning
  // ke admin sebelum kehilangan progress.
  useEffect(() => {
    if (!hasActiveUploads) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore custom message dan tampilkan generic prompt
      // mereka sendiri. Tapi `returnValue` HARUS truthy non-empty string;
      // empty string bisa diperlakukan sebagai "no value" → dialog tidak
      // muncul di sebagian browser. Pesan ini tidak akan kelihatan ke
      // user, hanya untuk trigger dialog.
      e.returnValue = 'Upload sedang berjalan';
      return 'Upload sedang berjalan';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasActiveUploads]);

  const enqueueWallpaperUpload = useCallback(
    async (file: File, options?: { profile?: WallpaperUploadProfile }) => {
      const profile = options?.profile ?? DEFAULT_WALLPAPER_PROFILE;
      const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      setTasks((prev) => [
        ...prev,
        {
          id: taskId,
          filename: file.name,
          progress: 0,
          status: 'starting',
          type: 'wallpaper',
          profile,
        },
      ]);

      try {
        const isVideo = file.type.startsWith('video/');
        const isImage = file.type.startsWith('image/');

        if (!isVideo && !isImage) {
          throw new Error(
            `File type ${file.type || 'unknown'} tidak didukung. ` +
              `Pakai video (mp4/webm) atau image (jpg/png/webp/avif/heic/heif).`
          );
        }

        // ── IMAGE PATH ────────────────────────────────────────────
        // Image jauh lebih simpel dari video:
        //   - Tidak perlu WASM ffmpeg compress (server `/api/upload`
        //     sudah punya sharp pipeline yang resize ke max 3840px +
        //     transcode ke WebP q82). Output 1080p tipikal 200-400 KB.
        //   - Tidak perlu poster side-car (image-nya sendiri jadi
        //     "poster"-nya).
        //   - Tidak perlu direct-to-R2 presign (image <30 MB fit di
        //     batas body runtime aplikasi, lewat /api/upload langsung).
        //   - Tidak perlu serialize encode chain (sharp di server
        //     paralel-friendly).
        //
        // Hemat bandwidth visitor: WebP q82 ~30-50% lebih kecil dari
        // JPEG q85, dengan quality visually identical.
        if (isImage) {
          updateTask(taskId, { status: 'uploading', progress: 5 });

          // Upload via FormData. Tidak pakai `skipImageOptimization`
          // → server transcode ke WebP + resize ke 4K-ready dimension.
          const formData = new FormData();
          formData.append('file', file);

          const token = getWritableCsrfToken(csrfToken);
          const uploadRes = await fetch('/api/admin/upload?folder=wallpapers', {
            method: 'POST',
            credentials: 'include',
            headers: { 'x-csrf-token': token },
            body: formData,
          });

          if (!uploadRes.ok) {
            const errBody = await uploadRes.json().catch(() => ({}) as { error?: string });
            throw new Error(errBody.error || `Image upload gagal (${uploadRes.status})`);
          }

          const uploadBody = (await uploadRes.json()) as {
            url?: string;
            error?: string;
          };
          if (!uploadBody.url) {
            throw new Error('Image upload returned tidak ada URL');
          }

          updateTask(taskId, { status: 'finalizing', progress: 90 });

          // Finalize: append ke wallpaperConfig.collection lewat
          // endpoint atomic yang sama dengan video flow. Tanpa
          // posterUrl karena image-nya sendiri yang ditampilkan
          // langsung di DesktopBackground (`isVideoSource()` return
          // false → image render path).
          const previousChain = finalizeChainRef.current;
          const finalizePromise = previousChain
            .catch((prevErr) => {
              if (prevErr) {
                console.warn(
                  '[BackgroundUpload] previous finalize in chain failed, continuing:',
                  prevErr
                );
              }
              return undefined;
            })
            .then(async () => {
              const newWallpaper = {
                id: `w-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                url: uploadBody.url!,
                name: 'Custom Wallpaper',
                // posterUrl SENGAJA tidak diisi — image bukan video,
                // tidak butuh poster sidecar.
              };

              const updateRes = await fetch('/api/about/wallpaper-collection', {
                method: 'POST',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                  'x-csrf-token': token,
                },
                body: JSON.stringify({
                  action: 'add',
                  wallpaper: newWallpaper,
                  makeActive: true,
                }),
              });

              if (!updateRes.ok) {
                const errBody = await updateRes
                  .json()
                  .catch(() => ({}) as { error?: string; details?: string });
                throw new Error(
                  errBody.error ||
                    errBody.details ||
                    `Failed to save wallpaper config (${updateRes.status})`
                );
              }

              const updateBody = (await updateRes.json().catch(() => null)) as {
                success?: boolean;
                data?: AboutData;
              } | null;

              if (updateBody?.data) {
                queryClient.setQueryData(ADMIN_QUERY_KEYS.about, updateBody.data);
                await mutate('/api/about', updateBody.data, {
                  revalidate: false,
                });
              } else {
                await queryClient.invalidateQueries({
                  queryKey: ADMIN_QUERY_KEYS.about,
                });
                await mutate('/api/about');
              }
            });

          finalizeChainRef.current = finalizePromise.catch((err) => {
            console.warn('[BackgroundUpload] finalize chain link rejected:', err);
            return undefined;
          });
          await finalizePromise;

          updateTask(taskId, { status: 'complete', progress: 100 });
          showSuccess(`Wallpaper image "${file.name}" berhasil diupload!`);
          setTimeout(() => removeTask(taskId), 3000);
          return;
        }

        // ── VIDEO PATH (existing flow) ────────────────────────────

        // ── 1. Decide whether to client-compress ─────────────────────
        // Baca dimensi sekali dari File (gratis, byte-range metadata).
        // WallpaperManager sudah memanggil `validateWallpaperFiles` yang
        // membaca dimensi serupa untuk validasi 1920×1080; pemanggilan
        // di sini terjadi setelah validasi sukses, jadi paling buruk
        // dua kali decode metadata — tetap murah (<100 ms).
        let dimensions: { width: number; height: number } | null = null;
        try {
          const dim = await readVideoDimensions(file);
          dimensions = { width: dim.width, height: dim.height };
        } catch {
          // Dimensi tidak terbaca — tetap lanjut, server akan handle.
          dimensions = null;
        }

        const skipBudget = SKIP_COMPRESS_BY_PROFILE[profile];
        const isOversized = file.size > MAX_CLIENT_COMPRESS_SIZE;

        if (isOversized) {
          // Tolak upload — tidak fallback as-is. Live wallpaper 60+ MB
          // bikin visitor sengsara di mobile network dan deteriorate
          // Lighthouse LCP score. Lebih bersih kasih admin pesan tegas
          // untuk export ulang dulu daripada mengizinkan asset jelek
          // masuk koleksi.
          throw new Error(
            `Wallpaper ${(file.size / 1024 / 1024).toFixed(1)} MB melewati batas ` +
              `${MAX_CLIENT_COMPRESS_SIZE / 1024 / 1024} MB. Export ulang ke ` +
              `${profile === 'ultra' ? '2160p (~30-50 MB)' : '1440p (~10-20 MB)'} dulu, ` +
              `lalu upload lagi.`
          );
        }

        const isAlreadySmall =
          file.size <= skipBudget.sizeBytes &&
          (dimensions ? dimensions.width <= skipBudget.widthPx : true);
        const shouldCompress = !isAlreadySmall;

        let fileToUpload: File = file;

        if (shouldCompress) {
          updateTask(taskId, { status: 'compressing', progress: 1 });

          // Serialize multiple concurrent ffmpeg invocations through a
          // single WASM instance. Awaiting the previous chain entry
          // means the second drag/drop waits for the first to finish
          // encoding, then runs.
          const previousCompress = compressChainRef.current;
          const compressPromise = previousCompress
            .catch((prevErr) => {
              // Previous task in the chain failed — that failure was
              // already surfaced by ITS own catch handler (toast +
              // task status). We only swallow here so this task's
              // encode can still start; logging keeps the trail.
              if (prevErr) {
                console.warn(
                  '[BackgroundUpload] previous compress in chain failed, continuing:',
                  prevErr
                );
              }
              return undefined;
            })
            .then(async () => {
              const originalSize = file.size;
              // Mark this task as the one currently encoding so the
              // shared `useFFmpeg.onStatusUpdate` callback knows
              // which task to dispatch its status string to.
              encodingTaskIdRef.current = taskId;
              try {
                const compressed = await compressVideo(
                  file,
                  (encodePercent) => {
                    // 1 → 70 reserved for client encode; 70 → 95 for
                    // network upload, 95 → 100 for finalize.
                    const mapped = 1 + (encodePercent / 100) * 69;
                    updateTask(taskId, { progress: Math.min(70, mapped) });
                  },
                  { profile }
                );
                const newSize = compressed.size;
                const profileLabel = profile === 'ultra' ? 'Ultra (2160p)' : 'High (1440p)';
                showSuccess(
                  `Wallpaper compressed [${profileLabel}]: ${(originalSize / 1024 / 1024).toFixed(1)} MB → ${(
                    newSize /
                    1024 /
                    1024
                  ).toFixed(1)} MB`
                );
                return compressed;
              } finally {
                // Clear marker no matter what — next task akan set
                // ulang. Tanpa clear ini, status callback akan
                // route ke task yang sudah selesai.
                if (encodingTaskIdRef.current === taskId) {
                  encodingTaskIdRef.current = null;
                }
              }
            });
          // Chain marker also catches its own error so the next
          // upload doesn't accidentally inherit a rejected promise.
          // Logging is handled by the inner catch above.
          compressChainRef.current = compressPromise.catch((err) => {
            console.warn('[BackgroundUpload] compress chain link rejected:', err);
            return undefined;
          });

          try {
            fileToUpload = await compressPromise;
          } catch (compressErr) {
            // WASM ffmpeg load gagal atau OOM — fallback upload
            // original. Server tidak akan re-encode (direct PUT),
            // tapi minimal video tetap masuk dan bisa direplace
            // setelah admin tahu engine-nya offline.
            console.warn(
              '[BackgroundUpload] client compression failed, uploading original:',
              compressErr
            );
            showWarning(
              'Compression engine offline. Uploading wallpaper as-is — kualitas tergantung file asli.'
            );
            fileToUpload = file;
          }
          // Clear status detail before transitioning to upload phase
          // supaya tooltip tidak nyangkut menampilkan "Compressing 100%".
          updateTask(taskId, { statusDetail: undefined });
        }

        updateTask(taskId, { status: 'uploading', progress: shouldCompress ? 70 : 5 });

        // Capture poster frame locally if possible.
        // Pakai `fileToUpload` (bukan `file`) supaya poster konsisten
        // dengan video yang benar-benar masuk R2 (penting kalau client
        // compress mengubah aspect/crop di masa depan; saat ini
        // compressVideo tidak crop tanpa trimOptions, tapi poster yang
        // selaras tetap lebih aman).
        let posterBlob: Blob | null = null;
        try {
          const { captureVideoPoster } = await import('@/lib/videoPoster');
          const captured = await captureVideoPoster(fileToUpload);
          posterBlob = captured.blob;
        } catch (e) {
          console.warn('Poster capture failed (will skip):', e);
        }

        const networkStart = shouldCompress ? 70 : 5;
        const networkSpan = shouldCompress ? 25 : 90;
        const result = await uploadVideoDirectToR2(fileToUpload, {
          posterBlob,
          onUploadProgress: (networkProgress) => {
            updateTask(taskId, {
              progress: networkStart + (networkProgress / 100) * networkSpan,
            });
          },
        });

        if (!result.success) {
          throw new Error(result.error || 'Direct R2 upload failed');
        }

        updateTask(taskId, { status: 'finalizing', progress: 95 });

        const newAsset: UploadedAsset = {
          url: result.url,
          previewUrl: result.previewUrl,
          posterUrl: result.posterUrl,
        };

        // Serialize finalize across concurrent uploads in this tab.
        // Each upload waits for the previous one's collection write to
        // commit before proceeding. The atomic endpoint
        // (`/api/about/wallpaper-collection`) handles the actual
        // read-modify-write on the server, so this in-tab mutex is
        // mostly belt-and-suspenders for back-to-back drag/drops where
        // the order of inserts matters to the user (the visible order
        // in WallpaperManager grid).
        //
        // Caveat: this mutex does NOT protect across tabs or admins.
        // The server endpoint reduces the cross-client racing window
        // to milliseconds, but does not eliminate it. See route
        // documentation at
        // src/app/api/about/wallpaper-collection/route.ts for details.
        const previousChain = finalizeChainRef.current;
        const finalizePromise = previousChain
          .catch((prevErr) => {
            // Previous finalize failed — that task already surfaced
            // its own error. Swallow so this task can proceed; log
            // for diagnostics.
            if (prevErr) {
              console.warn(
                '[BackgroundUpload] previous finalize in chain failed, continuing:',
                prevErr
              );
            }
            return undefined;
          })
          .then(async () => {
            const token = getWritableCsrfToken(csrfToken);

            const newWallpaper = {
              id: `w-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              url: newAsset.url,
              posterUrl: newAsset.posterUrl,
              name: 'Custom Wallpaper',
            };

            // Atomic add via dedicated endpoint. Server reads the
            // freshest collection, appends, and writes back in one
            // function invocation — no client-side read-modify-write
            // window where two tabs could overlap.
            const updateRes = await fetch('/api/about/wallpaper-collection', {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': token,
              },
              body: JSON.stringify({
                action: 'add',
                wallpaper: newWallpaper,
                makeActive: true,
              }),
            });

            if (!updateRes.ok) {
              const errBody = await updateRes
                .json()
                .catch(() => ({}) as { error?: string; details?: string });
              throw new Error(
                errBody.error ||
                  errBody.details ||
                  `Failed to save wallpaper config (${updateRes.status})`
              );
            }

            const updateBody = (await updateRes.json().catch(() => null)) as {
              success?: boolean;
              data?: AboutData;
            } | null;

            // Push the fresh snapshot into the React Query cache so the
            // open WallpaperManager / appearance panel re-renders with
            // the newly added wallpaper without an extra round-trip.
            if (updateBody?.data) {
              queryClient.setQueryData(ADMIN_QUERY_KEYS.about, updateBody.data);
              // Pre-populate SWR cache dengan snapshot yang sama.
              // Pakai `revalidate: false` supaya tidak trigger fetch
              // berikutnya yang bisa balik dengan cached response
              // dari server-side cache (race window kecil tapi nyata
              // saat upload back-to-back). Tanpa flag ini, SWR
              // default-nya revalidate setelah set.
              await mutate('/api/about', updateBody.data, { revalidate: false });
            } else {
              await queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.about });
              await mutate('/api/about');
            }
          });

        // Store a rejection-tolerant marker so the next upload's
        // chain doesn't inherit a rejected promise. Original
        // `finalizePromise` is awaited below to surface error.
        finalizeChainRef.current = finalizePromise.catch((err) => {
          console.warn('[BackgroundUpload] finalize chain link rejected:', err);
          return undefined;
        });
        await finalizePromise;

        updateTask(taskId, { status: 'complete', progress: 100 });
        showSuccess(`Wallpaper video "${file.name}" has been uploaded and applied!`);

        // Clean up task after 3 seconds
        setTimeout(() => removeTask(taskId), 3000);
      } catch (error) {
        console.error('[BackgroundUpload]', error);
        updateTask(taskId, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Upload failed',
        });
        showError(`Failed to upload ${file.name}`);
        // Clean up task after 5 seconds
        setTimeout(() => removeTask(taskId), 5000);
      }
    },
    [
      uploadVideoDirectToR2,
      updateTask,
      showSuccess,
      showError,
      showWarning,
      removeTask,
      csrfToken,
      queryClient,
      compressVideo,
    ]
  );

  return (
    <BackgroundUploadContext.Provider
      value={{
        tasks,
        enqueueWallpaperUpload,
        removeTask,
        hasActiveUploads,
        totalProgress,
      }}
    >
      {children}
    </BackgroundUploadContext.Provider>
  );
}

export function useBackgroundUpload() {
  const context = useContext(BackgroundUploadContext);
  if (context === undefined) {
    throw new Error('useBackgroundUpload must be used within a BackgroundUploadProvider');
  }
  return context;
}
