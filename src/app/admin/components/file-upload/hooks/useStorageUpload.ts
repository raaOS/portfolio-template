'use client';

import { useCallback } from 'react';

interface UseStorageUploadOptions {
  folder?: string;
  customFilename?: string;
  csrfToken?: string;
}

interface UploadResult {
  url: string;
  previewUrl?: string;
  posterUrl?: string;
  videoStats?: {
    originalSize: number;
    optimizedSize: number;
    previewSize: number;
    posterSize: number;
  } | null;
  imageStats?: {
    originalSize: number;
    optimizedSize: number;
    width?: number;
    height?: number;
  } | null;
  audioStats?: {
    originalSize: number;
    optimizedSize: number;
  } | null;
  storageProvider?: 'r2';
  success: boolean;
  error?: string;
}

interface UploadOptions {
  skipMainVideoOptimization?: boolean;
  onUploadProgress?: (progress: number) => void;
}
interface UploadResponse {
  url?: string;
  previewUrl?: string;
  posterUrl?: string;
  videoStats?: UploadResult['videoStats'];
  imageStats?: UploadResult['imageStats'];
  audioStats?: UploadResult['audioStats'];
  storageProvider?: UploadResult['storageProvider'];
  success?: boolean;
  error?: string;
}

function postFormDataWithProgress(
  url: string,
  formData: FormData,
  headers: Record<string, string>,
  onUploadProgress?: (progress: number) => void
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open('POST', url);
    xhr.withCredentials = true;

    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      const percent = Math.min(100, Math.max(0, Math.round((event.loaded / event.total) * 100)));
      onUploadProgress?.(percent);
    };

    xhr.upload.onload = () => {
      onUploadProgress?.(100);
    };

    xhr.onload = () => {
      let data: UploadResponse = {};
      if (xhr.responseText) {
        try {
          data = JSON.parse(xhr.responseText) as UploadResponse;
        } catch {
          reject(new Error('Invalid response from server'));
          return;
        }
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        if (data.success === false) {
          reject(new Error(data.error || 'Upload failed'));
          return;
        }
        resolve(data);
        return;
      }

      reject(new Error(data.error || xhr.statusText || `Upload failed with status ${xhr.status}`));
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new Error('Upload cancelled'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));

    xhr.send(formData);
  });
}

export function useStorageUpload(options: UseStorageUploadOptions = {}) {
  const { folder, customFilename, csrfToken } = options;

  const upload = useCallback(
    async (file: File, uploadOptions: UploadOptions = {}): Promise<UploadResult> => {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const params = new URLSearchParams();
        if (folder) params.append('folder', folder);
        if (customFilename) params.append('filename', customFilename);
        if (uploadOptions.skipMainVideoOptimization) {
          params.append('skipMainVideoOptimization', '1');
        }

        const query = params.toString();
        const data = await postFormDataWithProgress(
          `/api/admin/upload${query ? `?${query}` : ''}`,
          formData,
          csrfToken ? { 'x-csrf-token': csrfToken } : {},
          uploadOptions.onUploadProgress
        );

        if (!data.url) {
          throw new Error(data.error || 'Upload response did not include a URL');
        }

        return {
          url: data.url,
          previewUrl: data.previewUrl,
          posterUrl: data.posterUrl,
          videoStats: data.videoStats,
          imageStats: data.imageStats,
          audioStats: data.audioStats,
          storageProvider: data.storageProvider,
          success: true,
        };
      } catch (error) {
        console.error('[useStorageUpload] Error:', error);
        return {
          url: '',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [folder, customFilename, csrfToken]
  );

  /**
   * Direct-to-R2 upload for large videos (mainly wallpapers).
   *
   * Flow:
   *  1. POST /api/upload/presign  -> { uploadUrl, publicUrl, ... }
   *     Server signs a PUT URL bound to a server-chosen R2 key.
   *  2. PUT  uploadUrl            -> Cloudflare Worker R2 binding
   *     Browser sends raw bytes without FormData, bypassing the application
   *     FormData parser and avoiding "Failed to parse body as FormData"
   *     on bigger payloads.
   *  3. POST /api/upload          -> small JPG poster as FormData
   *     The poster is captured in-browser via canvas, so it's tiny
   *     and always fits within the function body limit.
   *
   * The returned shape matches `upload()` so callers can swap between
   * the two modes without restructuring their code.
   */
  const uploadVideoDirectToR2 = useCallback(
    async (
      file: File,
      videoOptions: UploadOptions & { posterBlob?: Blob | null } = {}
    ): Promise<UploadResult> => {
      try {
        if (!file.type.startsWith('video/')) {
          throw new Error('uploadVideoDirectToR2 hanya untuk video');
        }

        // 1) Ask the server for a signed URL.
        const presignRes = await fetch('/api/admin/upload/presign', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
          },
          body: JSON.stringify({
            folder: folder || 'wallpapers',
            filename: file.name,
            contentType: file.type,
            size: file.size,
          }),
        });
        if (!presignRes.ok) {
          const err = await presignRes.json().catch(() => ({}) as { error?: string });
          throw new Error(err.error || `Failed to issue presigned URL (${presignRes.status})`);
        }
        const presigned = (await presignRes.json()) as {
          uploadUrl: string;
          publicUrl: string;
          key: string;
          contentType: string;
          cacheControl: string;
        };

        // 2) PUT the file straight to R2 with progress reporting.
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', presigned.uploadUrl);
          xhr.setRequestHeader('Content-Type', presigned.contentType);
          xhr.setRequestHeader('Cache-Control', presigned.cacheControl);
          if (csrfToken) {
            xhr.setRequestHeader('x-csrf-token', csrfToken);
          }

          xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable || event.total <= 0) return;
            const percent = Math.min(
              100,
              Math.max(0, Math.round((event.loaded / event.total) * 100))
            );
            // Reserve last 5% for poster upload.
            videoOptions.onUploadProgress?.(Math.min(95, Math.round(percent * 0.95)));
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
              return;
            }
            reject(
              new Error(`R2 upload failed (${xhr.status}): ${xhr.responseText.slice(0, 200)}`)
            );
          };
          xhr.onerror = () => reject(new Error('Network error during R2 upload'));
          xhr.onabort = () => reject(new Error('R2 upload cancelled'));
          xhr.ontimeout = () => reject(new Error('R2 upload timed out'));
          xhr.send(file);
        });

        // 3) Optional poster upload via the regular /api/upload route.
        //    The poster is a small JPG (<300 KB even at 1080p) so it
        //    never trips the body limit.
        let posterUrl: string | undefined;
        if (videoOptions.posterBlob) {
          try {
            const baseName =
              presigned.key
                .split('/')
                .pop()
                ?.replace(/\.(mp4|webm|mov)$/i, '') || 'poster';
            const posterFile = new File([videoOptions.posterBlob], `${baseName}.jpg`, {
              type: 'image/jpeg',
            });
            const posterForm = new FormData();
            posterForm.append('file', posterFile);

            const posterParams = new URLSearchParams();
            posterParams.append('folder', folder || 'wallpapers');
            posterParams.append('filename', baseName);
            // Skip server-side transcode JPG → WebP supaya side-car
            // poster tetap konsisten dengan konvensi `<base>.jpg`
            // yang dipakai `lib/mediaPreview.ts` untuk derive poster
            // URL. JPG q82 dari canvas sudah cukup kecil.
            posterParams.append('skipImageOptimization', '1');

            const posterData = await postFormDataWithProgress(
              `/api/admin/upload?${posterParams.toString()}`,
              posterForm,
              csrfToken ? { 'x-csrf-token': csrfToken } : {}
            );
            posterUrl = posterData.url;
          } catch (posterErr) {
            // Poster is optional; never fail the whole upload because
            // of it. The admin grid falls back to the first frame.
            console.warn('[useStorageUpload] poster upload failed:', posterErr);
          }
        }

        videoOptions.onUploadProgress?.(100);

        return {
          url: presigned.publicUrl,
          posterUrl,
          videoStats: {
            originalSize: file.size,
            optimizedSize: file.size,
            previewSize: 0,
            posterSize: videoOptions.posterBlob?.size ?? 0,
          },
          storageProvider: 'r2',
          success: true,
        };
      } catch (error) {
        console.error('[useStorageUpload] Direct R2 error:', error);
        return {
          url: '',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [folder, csrfToken]
  );

  return { upload, uploadVideoDirectToR2 };
}
