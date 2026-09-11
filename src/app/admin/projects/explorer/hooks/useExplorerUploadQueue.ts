// ═══════════════════════════════════════════════════════════════════
// useExplorerUploadQueue — antrean upload & kompresi FFmpeg untuk
// Admin Explorer (diekstrak dari AdminExplorerClient.tsx, Phase 2).
//
// Kepemilikan (sesuai konsensus refactor):
// - compressChainRef: serialisasi WASM FFmpeg single-thread — dua
//   kompresi paralel akan me-reset WASM heap. Wajib tetap satu
//   promise chain di hook ini, jangan dipecah.
// - currentParentIdRef: mirror state folder aktif supaya closure
//   async (XHR progress, register) selalu baca folder terbaru.
// - fileInputRef: input hidden dikelola hook, komponen hanya render.
// - Rollback: upload sukses tapi register gagal → aset R2 dihapus
//   via DELETE /api/admin/upload (cleanupUploadedAssets).
// ═══════════════════════════════════════════════════════════════════
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { getWritableCsrfToken } from '@/lib/security/client-csrf';
import { useFFmpeg } from '@/app/admin/components/file-upload/hooks';
import { AnyExplorerNode } from '@/types/explorer';

export type UploadResult = {
  url: string;
  previewUrl?: string;
  posterUrl?: string;
  storagePath?: string;
  previewPath?: string;
  posterPath?: string;
  finalFilename?: string;
  contentType?: string;
  videoStats?: { optimizedSize: number };
  imageStats?: { optimizedSize: number };
  audioStats?: { optimizedSize: number };
};

export type ActiveUpload = {
  id: string;
  name: string;
  progress: number;
  status: 'compressing' | 'uploading' | 'registering' | 'success' | 'error';
  error?: string;
};

export function getFileKind(mimeType: string): 'image' | 'video' | 'audio' | 'pdf' | 'text' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';
  return 'text';
}

interface UseExplorerUploadQueueParams {
  /** Folder explorer yang sedang dibuka (state komponen). */
  currentParentId: string | null;
  /** Refresh daftar node setelah seluruh antrean selesai. */
  fetchNodes: (parentId: string | null) => Promise<void> | void;
  /** Setter optimistic insert file yang baru terdaftar ke folder aktif. */
  setNodes: React.Dispatch<React.SetStateAction<AnyExplorerNode[]>>;
}

export function useExplorerUploadQueue({
  currentParentId,
  fetchNodes,
  setNodes,
}: UseExplorerUploadQueueParams) {
  const [isUploading, setIsUploading] = useState(false);
  const [activeUploads, setActiveUploads] = useState<Record<string, ActiveUpload>>({});
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { csrfToken } = useAdminAuth();
  const { showError, showSuccess } = useToast();
  const ignoreCompressionStatus = useCallback(() => undefined, []);
  const { compressVideo } = useFFmpeg(ignoreCompressionStatus);

  const compressChainRef = React.useRef<Promise<void>>(Promise.resolve());
  const currentParentIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    currentParentIdRef.current = currentParentId;
  }, [currentParentId]);

  const cleanupUploadedAssets = useCallback(
    async (uploadResult: UploadResult) => {
      const paths = [uploadResult.storagePath, uploadResult.previewPath, uploadResult.posterPath].filter(
        (path): path is string => Boolean(path)
      );
      await Promise.all(
        paths.map((path) =>
          fetch(`/api/admin/upload?path=${encodeURIComponent(path)}`, {
            method: 'DELETE',
            headers: {
              'x-csrf-token': getWritableCsrfToken(csrfToken),
            },
          }).catch((error) => {
            console.warn('[AdminExplorer] Failed to rollback uploaded asset:', path, error);
          })
        )
      );
    },
    [csrfToken]
  );

  const handleUploadFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const filesArray = Array.from(files);
      // Reset input immediately so same file can be chosen again
      if (fileInputRef.current) fileInputRef.current.value = '';

      setIsUploading(true);

      const uploadPromises = filesArray.map(async (file) => {
        const uploadId = Math.random().toString(36).substring(7);

        // Add to active uploads state for Optimistic UI
        setActiveUploads((prev) => ({
          ...prev,
          [uploadId]: {
            id: uploadId,
            name: file.name,
            progress: 0,
            status: 'uploading',
          },
        }));

        const updateUpload = (updates: Partial<ActiveUpload>) => {
          setActiveUploads((prev) => ({
            ...prev,
            [uploadId]: { ...prev[uploadId], ...updates },
          }));
        };

        try {
          let fileToUpload = file;
          let videoWasClientProcessed = false;

          if (file.type.startsWith('video/')) {
            updateUpload({ status: 'compressing', progress: 0 });
            await new Promise<void>((resolve, reject) => {
              compressChainRef.current = compressChainRef.current
                .then(async () => {
                  try {
                    const originalSize = file.size;
                    fileToUpload = await compressVideo(file, (progress) =>
                      updateUpload({ progress })
                    );
                    videoWasClientProcessed = true;
                    showSuccess(
                      `Video optimized: ${(originalSize / 1024 / 1024).toFixed(2)}MB -> ${(fileToUpload.size / 1024 / 1024).toFixed(2)}MB`
                    );
                  } catch (error) {
                    console.warn(
                      '[AdminExplorer] Video compression failed, server will try fallback:',
                      error
                    );
                  }
                })
                .then(resolve)
                .catch(reject);
            });
          }

          // 1. Upload to Storage using XMLHttpRequest to track progress
          const formData = new FormData();
          formData.append('file', fileToUpload);

          const uploadPromise = new Promise<UploadResult>((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const percent = Math.round((event.loaded / event.total) * 100);
                updateUpload({ progress: percent });
              }
            };

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                try {
                  const response = JSON.parse(xhr.responseText);
                  if (response.success) resolve(response);
                  else reject(new Error(response.error || 'Upload failed'));
                } catch {
                  reject(new Error('Invalid response from server'));
                }
              } else {
                reject(new Error(`Server error: ${xhr.status}`));
              }
            };

            xhr.onerror = () => reject(new Error('Network error during upload'));

            const params = new URLSearchParams({
              folder: `assets/explorer/${currentParentIdRef.current || 'root'}`,
            });
            if (videoWasClientProcessed) {
              params.set('skipMainVideoOptimization', '1');
            }
            xhr.open('POST', `/api/admin/upload?${params.toString()}`);
            xhr.setRequestHeader('x-csrf-token', getWritableCsrfToken(csrfToken));
            xhr.send(formData);
          });

          const uploadResult = await uploadPromise;

          // 2. Register in Explorer DB
          updateUpload({ status: 'registering', progress: 100 });

          const registeredName = uploadResult.finalFilename || fileToUpload.name;
          const actualExtension = registeredName.split('.').pop()?.toLowerCase() || '';
          const storedSize =
            uploadResult.videoStats?.optimizedSize ??
            uploadResult.imageStats?.optimizedSize ??
            uploadResult.audioStats?.optimizedSize ??
            fileToUpload.size;

          const explorerRes = await fetch('/api/explorer', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-csrf-token': getWritableCsrfToken(csrfToken),
            },
            body: JSON.stringify({
              type: 'file',
              parentId: currentParentIdRef.current || null,
              name: file.name,
              url: uploadResult.url,
              previewUrl: uploadResult.previewUrl,
              thumbnailUrl: uploadResult.posterUrl,
              storageKey: uploadResult.storagePath,
              previewKey: uploadResult.previewPath,
              thumbnailKey: uploadResult.posterPath,
              mimeType: uploadResult.contentType || fileToUpload.type,
              originalName: file.name,
              fileType: getFileKind(fileToUpload.type),
              size: storedSize,
              metadata: {
                extension: actualExtension,
                actualExtension,
                ownedBy: 'explorer',
              },
            }),
          });

          const explorerPayload = await explorerRes.json().catch(() => null);

          if (explorerRes.ok && explorerPayload?.success && explorerPayload.data) {
            const createdFile = explorerPayload.data as AnyExplorerNode;
            if (
              createdFile.type === 'file' &&
              createdFile.parentId === (currentParentIdRef.current || null)
            ) {
              setNodes((prev) =>
                prev.some((node) => node.id === createdFile.id) ? prev : [...prev, createdFile]
              );
            }
            updateUpload({ status: 'success' });
            // Cleanup success item after 3 seconds
            setTimeout(() => {
              setActiveUploads((prev) => {
                const next = { ...prev };
                delete next[uploadId];
                return next;
              });
            }, 3000);
          } else {
            await cleanupUploadedAssets(uploadResult);
            throw new Error(explorerPayload?.error || 'Gagal mendaftarkan file');
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          console.error(`[Upload Error ${uploadId}]:`, err);
          updateUpload({ status: 'error', error: message, progress: 0 });
          showError(`Gagal upload "${file.name}": ${message}`);

          // Keep error for 5 seconds to let user see it
          setTimeout(() => {
            setActiveUploads((prev) => {
              const next = { ...prev };
              delete next[uploadId];
              return next;
            });
          }, 5000);
        }
      });

      await Promise.allSettled(uploadPromises);

      await fetchNodes(currentParentIdRef.current);
      setIsUploading(false);
    },
    [cleanupUploadedAssets, compressVideo, csrfToken, fetchNodes, setNodes, showError, showSuccess]
  );

  return {
    fileInputRef,
    isUploading,
    activeUploads,
    handleUploadFile,
    handleFileChange,
  };
}
