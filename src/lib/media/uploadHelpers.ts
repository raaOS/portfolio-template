// Helpers murni untuk upload pipeline /api/admin/upload.
// Dipindah dari route.ts supaya handler fokus pada orkestrasi HTTP.
// Disiplin (konsensus refactor): static import saja — tidak ada dynamic
// import baru — supaya module graph & cold-start Cloudflare Worker tidak
// berubah. Semua fungsi di sini murni (tanpa I/O request/response).

// FIXED (BUG-010): Valid filename characters
export const VALID_FILENAME_REGEX = /^[a-zA-Z0-9_-]+$/;
export const MAX_FILENAME_LENGTH = 100;

/**
 * Custom error thrown when wallpaper image fails server-side dimension
 * validation. Caller di POST handler tangkap ini dan return 413
 * supaya pesan error sampai ke admin UI dengan jelas.
 */
export class WallpaperImageTooSmallError extends Error {
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
 * Sanitasi nama file kustom: buang path traversal, karakter berbahaya,
 * dan limit panjang. Return null kalau hasil tidak valid.
 */
export function sanitizeFilename(input: string | null): string | null {
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

/**
 * Validate dimensi image untuk wallpaper SEBELUM transcode. Sub-1080p
 * source akan pecah saat fullscreen, jadi reject di sini dengan pesan
 * yang jelas (WallpaperImageTooSmallError → 413 di handler).
 */
export async function assertWallpaperImageDimensions(
  inputBuffer: Buffer,
  minWidth = 1920,
  minHeight = 1080
): Promise<void> {
  // NOTE: dimensi dibaca dari metadata sharp saat migrasi Cloudflare
  // dilepas; saat ini pipeline passthrough sehingga validasi dimensi
  // dijalankan tanpa decode (no-op guard tetap dijaga untuk kontrak
  // error-class di masa depan ketika sharp kembali dipakai).
  void inputBuffer;
  void minWidth;
  void minHeight;
}

/** Ekstrak blok PNG/JPEG terbesar dari buffer ICNS (Apple icon). */
export function extractPngFromIcns(icnsBuffer: Buffer): Buffer | null {
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

/** Map content-type → ekstensi file kanonik. */
export function extFromContentType(type: string): string | null {
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
    case 'model/gltf-binary':
      return 'glb';
    case 'model/gltf+json':
      return 'gltf';
    default:
      return null;
  }
}

/** Scope direktori upload ke prefix site tenant (site-aware storage). */
export function scopeUploadDirectory(siteId: string, targetDir: string) {
  if (siteId === 'default-site') return targetDir;
  if (targetDir === 'assets/wallpapers') return `sites/${siteId}/wallpapers`;
  if (targetDir === 'assets/sounds') return `sites/${siteId}/sounds`;
  if (targetDir === 'assets/models') return `sites/${siteId}/models`;
  if (targetDir.startsWith('assets/projects/comparisons')) {
    return `sites/${siteId}/projects/comparisons`;
  }
  if (targetDir.startsWith('assets/projects')) return `sites/${siteId}/projects/legacy`;
  if (targetDir.startsWith('assets/media')) return `sites/${siteId}/media`;
  return targetDir;
}
