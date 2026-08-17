// ═══════════════════════════════════════════════════════════════════
// SECTION MAP (upload/route.ts — 796 lines)
// L1-11:    Imports, runtime config (nodejs, maxDuration: 60)
// L12-109:  Constants: size limits, allowed types, validation helpers
// L110-147: assertWallpaperImageDimensions — dimension validation
// L148-268: optimizeImageBuffer — sharp image processing (webp/avif/jpg)
// L269-757: POST handler — multipart parse, type detection, FFmpeg video
//           compression, sharp image resize, R2 upload, D1 metadata write
// L758-796: DELETE handler — R2 object deletion + D1 cleanup
// ═══════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import {
  assertKnownSite,
  resolveRequestSiteId,
  SiteContextError,
} from '@/lib/admin/siteRequestContext';
import {
  buildR2PublicUrl,
  deleteFromR2,
  getMissingR2EnvKeys,
  headR2Object,
  isR2StorageConfigured,
  uploadToR2,
} from '@/lib/r2Storage';

// IMPORTANT: Keep this route timeout conservative. Large media should use
// direct-to-R2 upload instead of passing through the application runtime.
// Note: untuk wallpaper video besar, BackgroundUploadContext sudah pakai
// path direct-to-R2 (presign + PUT) yang bypass route ini sepenuhnya, jadi
// 60 detik di sini cukup untuk image/audio + poster JPG.
export const maxDuration = 60;

// FIXED (BUG-010): Valid filename characters
const VALID_FILENAME_REGEX = /^[a-zA-Z0-9_-]+$/;
const MAX_FILENAME_LENGTH = 100;

// Image compression contract:
//   - JPEG, PNG, WebP  -> resize + transcode to WebP q82 (one pipeline, one upload).
//   - GIF              -> passthrough (sharp would drop animation frames).
//   - SVG              -> passthrough (vector, already tiny).
//   - HEIC/HEIF/AVIF   -> resize + transcode to WebP q82 if sharp supports it.
// The original user-selected file is never written to R2 for compressible
// images; only the optimized buffer reaches storage.
const IMAGE_TRANSCODE_TYPES = new Set<string>();
// Wallpaper-specific tuning. Konteks: wallpaper di-render fullscreen via
// `object-cover` + scale 1.08 (breathing). Untuk portfolio scale (250
// visitor/bulan), 4K output (1-2 MB per image) overkill — sebagian besar
// visitor di 1080p/1440p, dan 4K monitor < 5% market share. 2560px cap
// (1440p/QHD-ready) + q80 menghasilkan 200-500 KB per image → 4-5× lebih
// hemat bandwidth, dengan slight upscale (+50%) di 4K monitor yang
// hampir tidak terlihat untuk static image wallpaper.

function sanitizeFilename(input: string | null): string | null {
  if (!input) return null;

  // Remove any path traversal attempts
  const sanitized = input
    .replace(/[/\\]/g, '') // Remove path separators
    .replace(/\.{2,}/g, '') // Remove sequences of dots
    .replace(/[<>"|?*]/g, ''); // Remove other dangerous chars

  // Validate result
  if (!VALID_FILENAME_REGEX.test(sanitized)) {
    return null;
  }

  // Limit length
  return sanitized.substring(0, MAX_FILENAME_LENGTH);
}

interface OptimizedImageResult {
  buffer: Buffer;
  contentType: string;
  extension: string;
  originalSize: number;
  optimizedSize: number;
  width?: number;
  height?: number;
}

/**
 * Custom error thrown when wallpaper image fails server-side dimension
 * validation. Caller di POST handler tangkap ini dan return 413
 * supaya pesan error sampai ke admin UI dengan jelas.
 */
class WallpaperImageTooSmallError extends Error {
  constructor(
    public readonly width: number,
    public readonly height: number,
    public readonly minWidth: number,
    public readonly minHeight: number
  ) {
    super(
      `Wallpaper image ${width}x${height} di bawah minimum ${minWidth}x${minHeight}. ` +
        `Upload versi resolusi lebih tinggi.`
    );
    this.name = 'WallpaperImageTooSmallError';
  }
}

/**
 * Validate dimensi image untuk wallpaper SEBELUM transcode. Sharp
 * `withoutEnlargement: true` artinya sub-1080p source tetap kecil di
 * output → wallpaper akan pecah saat fullscreen. Reject di sini dengan
 * pesan yang jelas.
 *
 * Dipanggil hanya untuk wallpaper folder + format yang sharp bisa decode.
 * Format animated/SVG tidak melewati pipeline transcode jadi tidak
 * butuh validation ini.
 */
async function assertWallpaperImageDimensions(
  inputBuffer: Buffer,
  minWidth = 1920,
  minHeight = 1080
): Promise<void> {
  const metadata = { orientation: 1, width: 0, height: 0 };

  // EXIF rotation: kalau image punya orientation 5/6/7/8, sharp swap
  // width/height saat .rotate() tapi metadata report dimensi pre-rotation.
  // Hitung effective dimensions (post-rotate) supaya validation cocok
  // dengan yang akan ditampilkan visitor.
  const orientation = metadata.orientation ?? 1;
  const isRotated = orientation >= 5 && orientation <= 8;
  const effectiveWidth = isRotated ? (metadata.height ?? 0) : (metadata.width ?? 0);
  const effectiveHeight = isRotated ? (metadata.width ?? 0) : (metadata.height ?? 0);

  if (!effectiveWidth || !effectiveHeight) {
    // Sharp tidak bisa baca dimensi → biarkan optimizeImageBuffer
    // yang gagal nanti dengan pesan generic. Tidak throw di sini
    // supaya tidak block format yang sharp metadata mungkin tidak
    // dukung tapi pipeline-nya bisa.
    return;
  }

  if (effectiveWidth < minWidth || effectiveHeight < minHeight) {
    throw new WallpaperImageTooSmallError(effectiveWidth, effectiveHeight, minWidth, minHeight);
  }
}

/**
 * Compresses an image buffer to WebP using sharp.
 *
 * Returns the compressed buffer when smaller than the original; otherwise
 * falls back to the original to avoid pathological cases (e.g. already
 * tiny PNG icons that bloat under WebP). Animated GIFs and SVG are skipped
 * by the caller because they need other handling.
 */
async function optimizeImageBuffer(
  inputBuffer: Buffer,
  inputType: string,
  _options: { isWallpaper?: boolean } = {}
): Promise<OptimizedImageResult> {
  return {
    buffer: inputBuffer,
    contentType: inputType,
    extension: extFromContentType(inputType) || 'bin',
    originalSize: inputBuffer.length,
    optimizedSize: inputBuffer.length,
  };
}

function extFromContentType(type: string): string | null {
  switch (type) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/svg+xml':
      return 'svg';
    case 'image/heic':
      return 'heic';
    case 'image/heif':
      return 'heif';
    case 'image/avif':
      return 'avif';
    case 'video/mp4':
      return 'mp4';
    case 'video/webm':
      return 'webm';
    default:
      return null;
  }
}

function scopeUploadDirectory(siteId: string, targetDir: string) {
  if (siteId === 'default-site') return targetDir;
  if (targetDir === 'assets/wallpapers') return `sites/${siteId}/wallpapers`;
  if (targetDir === 'assets/sounds') return `sites/${siteId}/sounds`;
  if (targetDir.startsWith('assets/projects/comparisons')) {
    return `sites/${siteId}/projects/comparisons`;
  }
  if (targetDir.startsWith('assets/projects')) return `sites/${siteId}/projects/legacy`;
  if (targetDir.startsWith('assets/media')) return `sites/${siteId}/media`;
  return targetDir;
}

function extractPngFromIcns(icnsBuffer: Buffer): Buffer | null {
  if (icnsBuffer.length < 8) return null;
  const magic = icnsBuffer.toString('ascii', 0, 4);
  if (magic !== 'icns') return null;

  let offset = 8;
  let largestBuffer: Buffer | null = null;
  let largestSize = 0;

  const isPng = (buf: Buffer) => {
    return (
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a
    );
  };

  const isJpeg = (buf: Buffer) => {
    return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  };

  while (offset + 8 <= icnsBuffer.length) {
    const size = icnsBuffer.readUInt32BE(offset + 4);

    if (size < 8 || offset + size > icnsBuffer.length) {
      break;
    }

    const blockData = icnsBuffer.subarray(offset + 8, offset + size);
    if (isPng(blockData) || isJpeg(blockData)) {
      if (blockData.length > largestSize) {
        largestSize = blockData.length;
        largestBuffer = Buffer.from(blockData);
      }
    }

    offset += size;
  }

  return largestBuffer;
}

export async function POST(req: NextRequest) {
  try {
    if (!(await validateAdminRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Basic Validation
    const validTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/svg+xml',
      'image/heic',
      'image/heif',
      'image/avif',
      'image/x-icns',
      'image/icns',
      'video/mp4',
      'video/webm',
      // Audio formats (used by SoundEffectsManager). Compressed server-side
      // to MP3 128k mono via `optimizeAudioForPortfolio`. WAV uploads can
      // shrink dramatically; already-encoded MP3 falls back to original
      // when re-encoding would not help.
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/wave',
      'audio/x-wav',
      'audio/ogg',
      'audio/webm',
      'audio/aac',
      'audio/mp4',
      'audio/x-m4a',
      'audio/flac',
    ];

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const isIcnsFile = fileExtension === 'icns';
    const isAcceptedMime =
      validTypes.includes(file.type) ||
      (isIcnsFile &&
        (file.type === 'image/x-icns' ||
          file.type === 'image/icns' ||
          file.type === 'application/octet-stream' ||
          file.type === ''));

    if (!isAcceptedMime) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    // Server-side size ceilings. Keeping this hard cap server-side
    // (in addition to client validation) prevents bypasses via direct
    // /api/upload POST or DevTools tampering. Limits are picked to
    // match the dominant use case of each media type:
    //   - Image  : 30 MB. Sharp decode RGBA buffer is ~width*height*4
    //              bytes; 30 MB JPEG ≈ 30-40 megapixel ≈ 120-160 MB
    //              raw — fits in typical 1024 MB function memory with
    //              headroom for re-encode pipelines.
    //   - Video  : 60 MB. Match `MAX_WALLPAPER_FILE_SIZE` di
    //              WallpaperManager. /api/upload/presign juga punya
    //              200 MB ceiling sendiri tapi itu untuk direct-to-R2
    //              path; FormData-based upload di sini harus stricter.
    //   - Audio  : 25 MB. SoundEffect biasanya pendek (<30 detik).
    const originalBuffer = Buffer.from(await file.arrayBuffer());
    let buffer: Buffer<ArrayBufferLike> = originalBuffer;
    let contentType = file.type;

    if (isIcnsFile) {
      const extracted = extractPngFromIcns(originalBuffer);
      if (!extracted) {
        return NextResponse.json(
          { error: 'Gagal mengekstrak gambar dari file ICNS. Pastikan file ICNS valid.' },
          { status: 400 }
        );
      }
      buffer = extracted;
      if (
        extracted.length >= 3 &&
        extracted[0] === 0xff &&
        extracted[1] === 0xd8 &&
        extracted[2] === 0xff
      ) {
        contentType = 'image/jpeg';
      } else {
        contentType = 'image/png';
      }
    }

    const isVideoUpload = contentType.startsWith('video/');
    const isImageUpload = contentType.startsWith('image/');
    const isAudioUpload = contentType.startsWith('audio/');

    const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
    const MAX_VIDEO_BYTES_FORMDATA = 60 * 1024 * 1024;
    const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

    const currentSize = buffer.length;

    if (isImageUpload && currentSize > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        {
          error: `Image ${(currentSize / 1024 / 1024).toFixed(1)} MB melewati batas ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
        },
        { status: 413 }
      );
    }
    if (isVideoUpload && currentSize > MAX_VIDEO_BYTES_FORMDATA) {
      return NextResponse.json(
        {
          error: `Video ${(currentSize / 1024 / 1024).toFixed(1)} MB melewati batas ${MAX_VIDEO_BYTES_FORMDATA / 1024 / 1024} MB untuk upload langsung. Pakai direct-to-R2 path untuk file besar.`,
        },
        { status: 413 }
      );
    }
    if (isAudioUpload && currentSize > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        {
          error: `Audio ${(currentSize / 1024 / 1024).toFixed(1)} MB melewati batas ${MAX_AUDIO_BYTES / 1024 / 1024} MB.`,
        },
        { status: 413 }
      );
    }

    if (!isR2StorageConfigured()) {
      return NextResponse.json(
        {
          error: `Cloudflare R2 env is incomplete. Missing: ${getMissingR2EnvKeys().join(', ')}`,
        },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const siteId = await resolveRequestSiteId(req);
    await assertKnownSite(siteId);
    const rawCustomFilename = searchParams.get('filename');
    const folderParam = searchParams.get('folder');
    const skipMainVideoOptimization = searchParams.get('skipMainVideoOptimization') === '1';
    // Client (poster side-car capture di flow direct-to-R2) sudah
    // generate JPG q82 dari canvas; tidak perlu re-encode ke WebP
    // di server karena:
    //   1. WebP transcode merusak side-car convention `<base>.jpg`
    //      yang dipakai `lib/mediaPreview.ts` untuk derive poster URL.
    //   2. JPG q82 dari canvas sudah ~80-200 KB di 1080p — sweet spot.
    //      Re-encode ke WebP hanya hemat ~10-20%, tidak worth break
    //      kontrak.
    // Flag ini opt-in supaya tidak break flow image upload reguler
    // (yang masih benefit dari WebP transcode).
    const skipImageOptimization = searchParams.get('skipImageOptimization') === '1';
    const requestedProfile = searchParams.get('profile');
    const isWallpaperFolder = folderParam === 'wallpapers';

    // Wallpaper-specific format restrictions.
    //
    // GIF tidak boleh untuk wallpaper desktop:
    //   - Animated GIF di-loop terus → distracting saat user kerja
    //     (window/dock di atas wallpaper). UX sangat buruk dan tidak
    //     bisa di-pause user.
    //   - File size GIF jauh lebih besar dari WebP/MP4 untuk content
    //     animasi serupa → ngikis bandwidth tanpa benefit.
    //   - Kalau admin mau wallpaper bergerak, jalur yang tepat adalah
    //     video (mp4/webm) yang sudah punya pipeline compress + poster.
    //
    // SVG juga di-reject di sini supaya konsisten — wallpaper desktop
    // bukan use case untuk vector logo/icon.
    if (isWallpaperFolder && (file.type === 'image/gif' || file.type === 'image/svg+xml')) {
      return NextResponse.json(
        {
          error:
            `Format ${file.type} tidak didukung untuk wallpaper desktop. ` +
            `Pakai JPG/PNG/WebP/AVIF/HEIC/HEIF untuk static image, ` +
            `atau MP4/WebM untuk animated wallpaper.`,
        },
        { status: 415 }
      );
    }

    // FIXED (BUG-010): Sanitize custom filename
    const customFilename = sanitizeFilename(rawCustomFilename);
    if (rawCustomFilename && !customFilename) {
      return NextResponse.json(
        {
          error: 'Invalid filename. Use only alphanumeric characters, hyphens, and underscores.',
        },
        { status: 400 }
      );
    }

    // ---------- IMAGE: server-side compression ----------
    // We compress before deciding the final extension so .jpg uploads can
    // ship as .webp (= the actual on-disk content) without the client
    // having to know.
    let imageStats: {
      originalSize: number;
      optimizedSize: number;
      width?: number;
      height?: number;
    } | null = null;
    let audioStats: { originalSize: number; optimizedSize: number } | null = null;
    let optimizedExtensionOverride: string | null = null;

    if (isImageUpload && IMAGE_TRANSCODE_TYPES.has(contentType) && !skipImageOptimization) {
      // Wallpaper: enforce min 1920x1080 sebelum transcode. Sharp
      // resize `withoutEnlargement: true` tidak akan upscale sub-1080p
      // source, jadi output akan pecah di fullscreen. Reject di sini
      // dengan WallpaperImageTooSmallError yang ditangkap outer catch
      // sebagai 413.
      if (isWallpaperFolder) {
        await assertWallpaperImageDimensions(buffer, 1920, 1080);
      }

      const optimized = await optimizeImageBuffer(buffer, contentType, {
        isWallpaper: isWallpaperFolder,
      });
      buffer = optimized.buffer;
      contentType = optimized.contentType;
      optimizedExtensionOverride = optimized.extension;
      imageStats = {
        originalSize: optimized.originalSize,
        optimizedSize: optimized.optimizedSize,
        width: optimized.width,
        height: optimized.height,
      };
    } else if (isAudioUpload) {
      // Cloudflare Workers cannot run FFmpeg. Preserve original audio bytes;
      // client/tooling-side optimization can be added later if needed.
      audioStats = {
        originalSize: originalBuffer.length,
        optimizedSize: originalBuffer.length,
      };
    }

    // Determine Name & Folder
    const sourceExt = isIcnsFile
      ? contentType === 'image/jpeg'
        ? 'jpg'
        : 'png'
      : file.name.split('.').pop() || '';
    const ext = optimizedExtensionOverride || sourceExt || (isVideoUpload ? 'mp4' : 'bin');
    let finalFilename: string;
    let targetDir: string;

    if (customFilename) {
      finalFilename = `${customFilename}.${ext}`;
      // Pre-existing default for the project form: when a custom filename
      // is provided without an explicit folder, place it under
      // `assets/projects`. New folders (sounds, wallpapers, …) honor the
      // user-supplied folder so a custom filename + dedicated bucket can
      // coexist (e.g. SoundEffectsManager pins `customFilename=startup`
      // and expects it to land in `assets/sounds`).
      if (folderParam === 'sounds') {
        targetDir = 'assets/sounds';
      } else if (folderParam === 'wallpapers') {
        targetDir = 'assets/wallpapers';
      } else if (folderParam && folderParam.startsWith('assets/')) {
        targetDir = folderParam;
      } else {
        targetDir = 'assets/projects';
      }
    } else if (folderParam === 'comparisons') {
      const rawSlug = searchParams.get('slug');
      const cleanSlug = rawSlug ? sanitizeFilename(rawSlug) : null;
      const cleanName = cleanSlug ? `${cleanSlug}-before` : file.name.split('.')[0];
      finalFilename = `${cleanName}.${ext}`;
      targetDir = 'assets/projects/comparisons';
    } else {
      // Strip the source extension first so we can append the canonical
      // one consistently (matters for images that get transcoded to a
      // different format than the user uploaded).
      const baseName = file.name
        .replace(/\.[^.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-');
      finalFilename = `${Date.now()}-${baseName}.${ext}`;

      // Respect the folder param if provided and safe
      if (
        folderParam &&
        (folderParam.startsWith('assets/') ||
          folderParam === 'temp' ||
          folderParam === 'wallpapers' ||
          folderParam === 'sounds')
      ) {
        if (folderParam === 'wallpapers') targetDir = 'assets/wallpapers';
        else if (folderParam === 'sounds') targetDir = 'assets/sounds';
        else targetDir = folderParam;
      } else {
        targetDir = 'assets/media';
      }
    }

    targetDir = scopeUploadDirectory(siteId, targetDir);
    const storagePath = `${targetDir}/${finalFilename}`;
    let previewPath: string | null = null;
    let posterPath: string | null = null;
    let previewBuffer: Buffer | null = null;
    let posterBuffer: Buffer | null = null;
    let videoStats: {
      originalSize: number;
      optimizedSize: number;
      previewSize: number;
      posterSize: number;
    } | null = null;

    if (isVideoUpload) {
      const optimizeVideoForPortfolio = async (_input: Buffer, _options: unknown) => ({
        buffer: originalBuffer,
        previewBuffer: null,
        posterBuffer: null,
        originalSize: originalBuffer.length,
        optimizedSize: originalBuffer.length,
        previewSize: 0,
        posterSize: 0,
      });

      // Determine the encode profile.
      //   1. Explicit `?profile=` from the client wins (so callers can
      //      offer "Standard / High / Ultra" UI).
      //   2. Otherwise default to `high` for wallpapers, `standard` for
      //      everything else.
      //
      // Note: untuk wallpaper, default flow di admin sekarang adalah
      // direct-to-R2 (presign + PUT) yang sudah meng-compress di
      // browser via WASM ffmpeg ke profile `high` (1440p). Path ini
      // hanya kena kalau ada caller yang sengaja POST FormData ke
      // /api/upload?folder=wallpapers (mis. tooling lama atau script).
      // Jangan andalkan path ini sebagai jalur utama kompresi
      // wallpaper karena 60-detik maxDuration Hobby tier akan
      // bottleneck untuk video besar.
      const ALLOWED_PROFILES = new Set(['standard', 'high', 'ultra'] as const);
      type Profile = 'standard' | 'high' | 'ultra';
      const profile: Profile =
        requestedProfile && ALLOWED_PROFILES.has(requestedProfile as Profile)
          ? (requestedProfile as Profile)
          : isWallpaperFolder
            ? 'high'
            : 'standard';

      const optimized = await optimizeVideoForPortfolio(originalBuffer, {
        // Wallpapers prioritize a small, predictable on-disk size, so
        // never pass the original through even if the encoder happens
        // to produce a slightly larger MP4. For other folders keep the
        // existing behavior to preserve quality on already-optimized
        // source MP4s.
        allowOriginalPassthrough: isWallpaperFolder ? false : file.type === 'video/mp4',
        profile,
        // Wallpaper TIDAK butuh preview clip 6s — wallpaper diputar
        // full di desktop background. Preview cuma dipakai untuk
        // hover preview di explorer/admin, yang tidak relevan untuk
        // wallpaper. Skip preview encode → cuma main + poster yang
        // di-generate. Wall-clock turun ~30-40%.
        skipPreview: isWallpaperFolder,
      });
      buffer = skipMainVideoOptimization ? originalBuffer : optimized.buffer;
      contentType = file.type || 'application/octet-stream';
      previewBuffer = optimized.previewBuffer;
      posterBuffer = optimized.posterBuffer;
      videoStats = {
        originalSize: optimized.originalSize,
        optimizedSize: buffer.length,
        previewSize: optimized.previewSize,
        posterSize: optimized.posterSize,
      };

      const basePath = storagePath.replace(/\.(mp4|webm|mov)$/i, '');
      // Preview path hanya di-set kalau preview buffer ada (wallpaper
      // skip preview, jadi previewPath null → tidak ada upload preview).
      previewPath = previewBuffer ? `${basePath}-preview.mp4` : null;
      posterPath = posterBuffer ? `${basePath}.jpg` : null;
    }

    const cacheControl = 'public, max-age=31536000, immutable';
    const [r2Main] = await Promise.all([
      uploadToR2({
        key: storagePath,
        body: buffer,
        contentType,
        cacheControl,
      }),
      ...(previewPath && previewBuffer
        ? [
            uploadToR2({
              key: previewPath,
              body: previewBuffer,
              contentType: 'video/mp4',
              cacheControl,
            }),
          ]
        : []),
      ...(posterPath && posterBuffer
        ? [
            uploadToR2({
              key: posterPath,
              body: posterBuffer,
              contentType: 'image/jpeg',
              cacheControl,
            }),
          ]
        : []),
    ]);

    // Best-effort cleanup of legacy .webp poster at the same base.
    //
    // The old transcode pipeline wrote posters as `<base>.webp`. The
    // current pipeline writes `<base>.jpg`. When an admin re-uploads
    // a video to a deterministic key (e.g. via `customFilename`), the
    // new write does not overwrite the legacy `.webp` because it has
    // a different extension — it lingers in R2 as an orphan that
    // audit scripts will flag.
    //
    // Why this is safe to do here:
    //   1. We're inside the video upload branch, so we just wrote a
    //      new `<base>.mp4` to the same key.
    //   2. A `<base>.webp` at that same key can only have come from
    //      a previous upload to that same key (no other code path
    //      writes that pattern).
    //   3. We never touch other extensions or other keys.
    //
    // Why we tolerate 404:
    //   New uploads (most cases) won't have a `.webp` at the new
    //   timestamped key. HEAD returning NotFound is the expected,
    //   silent fast-path.
    //
    // Why this is best-effort, not awaited as a hard dependency:
    //   The video upload itself already succeeded. If R2 is degraded
    //   right now and HEAD/DELETE fails for transient reasons, we
    //   don't want to fail the user's upload. The leftover orphan can
    //   be picked up by `audit-orphan-projects.ts` later.
    if (isVideoUpload && posterPath) {
      const legacyWebpKey = posterPath.replace(/\.jpg$/i, '.webp');
      // Skip if posterPath wasn't actually .jpg (defensive — current
      // code always writes .jpg, but the regex above is non-throwing
      // and could fall through on future change).
      if (legacyWebpKey !== posterPath) {
        try {
          await headR2Object(legacyWebpKey);
          // HEAD succeeded → file exists → delete.
          await deleteFromR2(legacyWebpKey);
        } catch (e: unknown) {
          const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
          const code = err?.$metadata?.httpStatusCode;
          if (code !== 404 && err?.name !== 'NotFound' && err?.name !== 'NoSuchKey') {
            // Real error (network, permission). Log and move on.
            console.warn(
              '[Upload] Legacy .webp poster cleanup failed (non-fatal):',
              legacyWebpKey,
              e
            );
          }
        }
      }
    }

    return NextResponse.json({
      url: r2Main.url,
      previewUrl: previewPath ? buildR2PublicUrl(previewPath) : undefined,
      posterUrl: posterPath ? buildR2PublicUrl(posterPath) : undefined,
      storagePath,
      previewPath: previewPath || undefined,
      posterPath: posterPath || undefined,
      finalFilename,
      contentType,
      videoStats,
      imageStats,
      audioStats,
      storageProvider: 'r2',
      success: true,
    });
  } catch (e) {
    if (e instanceof SiteContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('Upload Error:', e);

    // Wallpaper image dimension validation: surface ke client sebagai
    // 413 Payload Too Large dengan pesan asli supaya admin UI bisa
    // tampilkan ke admin "image kurang dari 1920x1080, upload yang
    // lebih besar". 500 generic akan hilangkan info diagnostik ini.
    if (e instanceof WallpaperImageTooSmallError) {
      return NextResponse.json({ error: e.message }, { status: 413 });
    }

    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!(await validateAdminRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const storagePath = searchParams.get('path');

    if (!storagePath) {
      return NextResponse.json({ error: 'Missing storage path' }, { status: 400 });
    }

    // Only allow deleting from certain paths for security
    if (
      !storagePath.startsWith('assets/') &&
      !storagePath.startsWith('temp/') &&
      !/^sites\/[a-zA-Z0-9_-]+\//.test(storagePath)
    ) {
      return NextResponse.json({ error: 'Forbidden path' }, { status: 403 });
    }

    if (!isR2StorageConfigured()) {
      return NextResponse.json(
        {
          error: `Cloudflare R2 env is incomplete. Missing: ${getMissingR2EnvKeys().join(', ')}`,
        },
        { status: 500 }
      );
    }

    await deleteFromR2(storagePath);

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof SiteContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('Delete Error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Delete failed' },
      { status: 500 }
    );
  }
}
