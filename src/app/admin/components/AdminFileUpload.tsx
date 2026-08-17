'use client';

import { useState, useRef, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '@/contexts/ToastContext';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useFileValidation, useFFmpeg, useStorageUpload } from './file-upload/hooks';
import { UploadProgress, UploadDropzone } from './file-upload/components';
import type { AdminFileUploadProps, UploadedAsset } from './file-upload/types';

// Import wrappers for lazy loading
import ImageCropper from '@/components/admin/ImageCropper';
import VideoTrimmer from '@/components/admin/VideoTrimmer';

export default function AdminFileUpload({
  onUpload,
  onUploadResult,
  accept = 'image/*,video/*',
  multiple = true,
  maxFiles = 10,
  maxSize = 10,
  className = '',
  disabled = false,
  enableCrop = false,
  enableVideoTrim = false,
  autoUpload = true,
  onFileSelect,
  folder,
  customFilename,
  onUploadStart,
  onUploadEnd,
  onUploadProgress,
  customValidator,
  variant = 'default',
}: AdminFileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showSuccess: showSuccessToast, showError, showWarning } = useToast();
  const { csrfToken: _csrfToken } = useAdminAuth();

  // Cropping & Trimming State
  const [activeCrop, setActiveCrop] = useState<{ src: string; file: File } | null>(null);
  const [activeTrim, setActiveTrim] = useState<{ file: File } | null>(null);

  // Hooks
  const { validateFiles } = useFileValidation({ accept, maxSize });
  const { compressVideo } = useFFmpeg(setStatus);
  const { upload, uploadVideoDirectToR2 } = useStorageUpload({
    folder,
    customFilename,
    csrfToken: _csrfToken || '',
  });

  const executeUpload = useCallback(
    async (
      files: File[],
      trimOptions?: {
        start: number;
        end: number;
        crop?: { x: number; y: number; width: number; height: number } | null;
      }
    ) => {
      const fileProgress = new Array(files.length).fill(0);
      const reportProgress = (value: number) => {
        const next = Math.min(100, Math.max(0, Math.round(value)));
        setProgress(next);
        onUploadProgress?.(next);
      };
      const reportFileProgress = (index: number, value: number) => {
        fileProgress[index] = Math.min(100, Math.max(0, Math.round(value)));
        const total = fileProgress.reduce((sum, item) => sum + item, 0);
        reportProgress(total / files.length);
      };

      setStatus('starting');
      reportProgress(0);
      onUploadStart?.();

      try {
        const uploadPromises = files.map(async (file, index) => {
          let fileToUpload = file;
          let videoWasClientProcessed = false;

          const isVideo = file.type.startsWith('video/');
          const isWallpaperVideo = isVideo && folder === 'wallpapers';

          // ---------- WALLPAPER VIDEO: direct-to-R2 path ----------
          // Wallpaper videos go straight to Cloudflare R2 via a
          // presigned PUT URL, bypassing the application function body
          // limit that was failing the upload with
          // "Failed to parse body as FormData". The poster is captured
          // in-browser (canvas) so the server never has to decode the
          // mp4 just to make a thumbnail.
          if (isWallpaperVideo && !trimOptions) {
            setStatus('Capturing poster frame...');
            reportFileProgress(index, 2);
            let posterBlob: Blob | null = null;
            try {
              const { captureVideoPoster } = await import('@/lib/videoPoster');
              const captured = await captureVideoPoster(file);
              posterBlob = captured.blob;
            } catch (e) {
              console.warn('Poster capture failed (will skip):', e);
            }

            setStatus('Uploading Video...');
            reportFileProgress(index, 5);
            const result = await uploadVideoDirectToR2(file, {
              posterBlob,
              onUploadProgress: (networkProgress) => {
                // 5 → 95 reserved for actual upload bytes
                reportFileProgress(index, 5 + (networkProgress / 100) * 90);
              },
            });
            if (!result.success) {
              throw new Error(result.error || 'Direct R2 upload failed');
            }
            setStatus('Finalizing...');
            reportFileProgress(index, 100);
            return {
              url: result.url,
              previewUrl: result.previewUrl,
              posterUrl: result.posterUrl,
            } as UploadedAsset;
          }

          // VIDEO COMPRESSION / TRIM (non-wallpaper or trim flow)
          if (isVideo) {
            // Skip client-side compression untuk:
            //  1. Video dengan trim/crop options (perlu ffmpeg client)
            //  2. Video < 50MB tanpa trim — server ffmpeg native 5-10×
            //     lebih cepat dari WASM browser. Untuk file moderate
            //     net wall-clock LEBIH cepat upload original lalu
            //     compress di server, daripada compress dulu di client
            //     (CPU-bound) baru upload.
            //  3. File > 50MB tetap pakai client compression supaya
            //     network upload-nya tidak besar (hemat bandwidth user).
            const SKIP_CLIENT_THRESHOLD = 50 * 1024 * 1024; // 50MB
            const hasTrim = !!trimOptions;
            const shouldClientCompress = hasTrim || file.size > SKIP_CLIENT_THRESHOLD;

            if (shouldClientCompress) {
              try {
                const originalSize = file.size;
                // Wallpapers fill the whole screen, so they need a
                // visibly higher target than e.g. project thumbnails.
                // Bump the encoder to the `high` profile (1440p,
                // CRF 20) for that folder and keep the existing
                // `standard` (720p, CRF 24) for the rest.
                // 1440p match dengan server `optimizeVideoForPortfolio.high`
                // dan dengan path direct-to-R2 di BackgroundUploadContext —
                // konsisten lewat semua jalur upload wallpaper.
                const profile = folder === 'wallpapers' ? 'high' : 'standard';
                fileToUpload = await compressVideo(
                  file,
                  (p) => reportFileProgress(index, Math.min(70, p * 0.7)),
                  { trimOptions, profile }
                );
                reportFileProgress(index, 72);
                videoWasClientProcessed = true;
                const newSize = fileToUpload.size;
                showSuccessToast(
                  `Video Processed! ${(originalSize / 1024 / 1024).toFixed(2)}MB -> ${(newSize / 1024 / 1024).toFixed(2)}MB`
                );
              } catch (e) {
                console.error('Client compression failed, falling back to original', e);
                showWarning('Compression engine offline. Uploading original file...');
              }
            }
            // Else: lewati client compression. Server ffmpeg native
            // akan handle. Status default akan diset ke
            // "Processing Video on Server..." setelah upload selesai.
          }

          // DEFERRED UPLOAD MODE
          if (autoUpload === false && onFileSelect) {
            onFileSelect(fileToUpload);
            const blobUrl = URL.createObjectURL(fileToUpload);
            reportFileProgress(index, 100);
            return { url: blobUrl } as UploadedAsset;
          }

          // IMMEDIATE UPLOAD MODE
          const isUploadingVideo = fileToUpload.type.startsWith('video/');
          // Progress allocation tergantung apakah client sudah compress.
          // - Client-compressed: 0-72 untuk encode (sudah dilaporkan), 72-90 upload network, 95-100 finalize
          // - Server-compressed: 0-90 upload network, 90-100 server processing
          const uploadStart = videoWasClientProcessed ? 72 : 0;
          const uploadSpan = videoWasClientProcessed ? 18 : 90;

          setStatus(isUploadingVideo ? 'Uploading Video...' : 'Uploading to Storage...');
          reportFileProgress(index, uploadStart);
          const { url, success, error, videoStats, imageStats, audioStats, previewUrl, posterUrl } =
            await upload(fileToUpload, {
              skipMainVideoOptimization: videoWasClientProcessed,
              onUploadProgress: (networkProgress) => {
                reportFileProgress(index, uploadStart + (networkProgress / 100) * uploadSpan);
                if (networkProgress >= 100) {
                  setStatus(
                    isUploadingVideo ? 'Processing Video on Server...' : 'Processing Upload...'
                  );
                }
              },
            });
          if (!success) {
            throw new Error(error || 'Upload failed');
          }
          setStatus('Finalizing...');
          reportFileProgress(index, 95);

          if (videoStats) {
            showSuccessToast(
              `Storage video ready: ${formatBytes(videoStats.optimizedSize)} + preview ${formatBytes(videoStats.previewSize)}`
            );
          }

          if (imageStats && imageStats.optimizedSize < imageStats.originalSize) {
            const ratio = Math.max(
              0,
              Math.round((1 - imageStats.optimizedSize / imageStats.originalSize) * 100)
            );
            showSuccessToast(
              `Image compressed: ${formatBytes(imageStats.originalSize)} -> ${formatBytes(imageStats.optimizedSize)} (-${ratio}%)`
            );
          }

          if (audioStats && audioStats.optimizedSize < audioStats.originalSize) {
            const ratio = Math.max(
              0,
              Math.round((1 - audioStats.optimizedSize / audioStats.originalSize) * 100)
            );
            showSuccessToast(
              `Audio compressed: ${formatBytes(audioStats.originalSize)} -> ${formatBytes(audioStats.optimizedSize)} (-${ratio}%)`
            );
          }

          reportFileProgress(index, 100);

          return { url, previewUrl, posterUrl } as UploadedAsset;
        });

        const results = await Promise.all(uploadPromises);
        const urlResults = results.map((r) => r.url);
        onUpload(urlResults);
        if (onUploadResult) {
          onUploadResult(results);
        }

        if (autoUpload !== false) {
          showSuccessToast('All files processed successfully.');
        }

        setStatus('Upload Complete!');
        reportProgress(100);

        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (err: unknown) {
        console.error(err);
        showError(`Process failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setStatus('');
        setProgress(0);
        onUploadEnd?.();
      }
    },
    [
      compressVideo,
      upload,
      uploadVideoDirectToR2,
      onUpload,
      onUploadResult,
      onUploadStart,
      onUploadEnd,
      onUploadProgress,
      showSuccessToast,
      showError,
      showWarning,
      autoUpload,
      onFileSelect,
      folder,
    ]
  );

  const handleFiles = useCallback(
    async (files: FileList) => {
      if (disabled) return;
      const fileArray = Array.from(files);

      if (fileArray.length > maxFiles) {
        showError(`Too many files. Maximum ${maxFiles} files allowed`);
        return;
      }

      const validationErrors = validateFiles(fileArray);
      if (validationErrors.length > 0) {
        showError(`Invalid files: ${validationErrors.join(', ')}`);
        return;
      }

      // Domain-specific validator (mis. resolusi minimum untuk wallpaper).
      // Dipanggil setelah validasi dasar lolos supaya tidak perlu read
      // metadata video kalau file size-nya sudah lebih dari batas.
      if (customValidator) {
        try {
          const customError = await customValidator(fileArray);
          if (customError) {
            showError(customError);
            return;
          }
        } catch (err) {
          console.error('customValidator threw', err);
          showError(err instanceof Error ? err.message : 'Validasi file gagal');
          return;
        }
      }

      // Handle crop for single image
      if (enableCrop && fileArray.length === 1 && fileArray[0].type.startsWith('image/')) {
        const file = fileArray[0];
        const reader = new FileReader();
        reader.onload = () => {
          setActiveCrop({ src: reader.result as string, file });
        };
        reader.readAsDataURL(file);
        return;
      }

      // Handle trim for single video
      if (enableVideoTrim && fileArray.length === 1 && fileArray[0].type.startsWith('video/')) {
        setActiveTrim({ file: fileArray[0] });
        return;
      }

      executeUpload(fileArray);
    },
    [
      disabled,
      maxFiles,
      validateFiles,
      executeUpload,
      enableCrop,
      enableVideoTrim,
      showError,
      customValidator,
    ]
  );

  // Crop handlers
  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!activeCrop) return;
    const croppedFile = new File([croppedBlob], activeCrop.file.name, {
      type: activeCrop.file.type,
      lastModified: Date.now(),
    });
    setActiveCrop(null);
    executeUpload([croppedFile]);
  };

  const handleCropCancel = () => setActiveCrop(null);

  // Trim handlers
  const handleTrimConfirm = (
    start: number,
    end: number,
    crop?: { x: number; y: number; width: number; height: number } | null
  ) => {
    if (!activeTrim) return;
    const file = activeTrim.file;
    setActiveTrim(null);
    executeUpload([file], { start, end, crop });
  };

  const handleTrimCancel = () => setActiveTrim(null);

  // Drag & drop handlers
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setIsDragOver(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (!disabled && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [disabled, handleFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
    },
    [handleFiles]
  );

  const handleClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  return (
    <>
      {/* Modals */}
      {activeCrop && (
        <UploadModalPortal>
          <ImageCropperWrapper
            src={activeCrop.src}
            onConfirm={handleCropComplete}
            onCancel={handleCropCancel}
          />
        </UploadModalPortal>
      )}

      {activeTrim && (
        <UploadModalPortal>
          <VideoTrimmerWrapper
            file={activeTrim.file}
            onConfirm={handleTrimConfirm}
            onCancel={handleTrimCancel}
          />
        </UploadModalPortal>
      )}

      {/* Upload Area */}
      <div
        className={
          variant === 'button' ? `w-auto flex-shrink-0 ${className}` : `w-full ${className}`
        }
      >
        {status ? (
          <UploadProgress status={status} progress={progress} />
        ) : variant === 'compact' ? (
          <div
            className={`relative flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-3 text-center transition-colors ${
              isDragOver
                ? 'border-blue-400 bg-blue-50'
                : 'hover:border-slate-350 border-slate-200 dark:border-slate-800 dark:hover:border-slate-700'
            } ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-slate-50 dark:hover:bg-slate-900/50'} `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
            role="button"
            tabIndex={disabled ? -1 : 0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
              }
            }}
            aria-label="Upload File"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              multiple={multiple}
              onChange={handleFileInput}
              className="hidden"
              disabled={disabled}
            />
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider">
                {isDragOver ? 'Drop file' : 'Upload File'}
              </span>
            </div>
          </div>
        ) : variant === 'button' ? (
          <button
            type="button"
            className={`text-slate-550 dark:hover:bg-slate-850 hover:border-slate-350 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-700 ${
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
            }`}
            onClick={handleClick}
            tabIndex={disabled ? -1 : 0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
              }
            }}
            aria-label="Upload File"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              multiple={multiple}
              onChange={handleFileInput}
              className="hidden"
              disabled={disabled}
            />
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </button>
        ) : (
          <UploadDropzone
            isDragOver={isDragOver}
            disabled={disabled}
            accept={accept}
            multiple={multiple}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
            onFileInput={handleFileInput}
            fileInputRef={fileInputRef}
          />
        )}
      </div>
    </>
  );
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function UploadModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null;

  return createPortal(<div className="fixed inset-0 z-[100000]">{children}</div>, document.body);
}

// Wrappers for Lazy Loading
function ImageCropperWrapper({
  src,
  onConfirm,
  onCancel,
}: {
  src: string;
  onConfirm: (b: Blob) => void;
  onCancel: () => void;
}) {
  return <ImageCropper imageSrc={src} onCropComplete={onConfirm} onCancel={onCancel} />;
}

function VideoTrimmerWrapper({
  file,
  onConfirm,
  onCancel,
}: {
  file: File;
  onConfirm: (
    s: number,
    e: number,
    c?: { x: number; y: number; width: number; height: number } | null
  ) => void;
  onCancel: () => void;
}) {
  return <VideoTrimmer file={file} onConfirm={onConfirm} onCancel={onCancel} />;
}

// Re-export hooks and components
export * from './file-upload/hooks';
export * from './file-upload/components';
