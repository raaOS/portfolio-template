import jsQR from 'jsqr';
import { normalizeQRISPayload, validateStaticMerchantQRIS } from './qris';

export interface QRISDecodeResult {
  success: boolean;
  payload?: string;
  error?: string;
}

/**
 * Reads a File / Blob / Image URL in browser, draws it on canvas,
 * and extracts the raw EMVCo QRIS static payload string automatically.
 */
export async function decodeQRISFromImageFile(file: File): Promise<QRISDecodeResult> {
  if (typeof window === 'undefined') {
    return { success: false, error: 'Decoder hanya dapat dijalankan di browser' };
  }

  return new Promise<QRISDecodeResult>((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        const tryDecode = (w: number, h: number, smoothing: boolean): string | null => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) return null;
          canvas.width = w;
          canvas.height = h;
          ctx.imageSmoothingEnabled = smoothing;
          ctx.drawImage(img, 0, 0, w, h);
          const imageData = ctx.getImageData(0, 0, w, h);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });
          return code?.data ? normalizeQRISPayload(code.data) : null;
        };

        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;

        let rawPayload: string | null = null;

        // 1. Try full resolution with crisp module rendering (smoothing = false)
        rawPayload = tryDecode(origW, origH, false);

        // 2. Try full resolution with standard rendering
        if (!rawPayload) {
          rawPayload = tryDecode(origW, origH, true);
        }

        // 3. Fallback: try scaled resolution (max 1200px)
        if (!rawPayload) {
          const maxDim = 1200;
          if (origW > maxDim || origH > maxDim) {
            const scale = maxDim / Math.max(origW, origH);
            const scaledW = Math.round(origW * scale);
            const scaledH = Math.round(origH * scale);
            rawPayload = tryDecode(scaledW, scaledH, false) || tryDecode(scaledW, scaledH, true);
          }
        }

        if (!rawPayload) {
          return resolve({
            success: false,
            error: 'Gambar QRIS tidak dapat dibaca atau QR Code tidak terdeteksi',
          });
        }

        const normalized = normalizeQRISPayload(rawPayload);
        const validation = validateStaticMerchantQRIS(normalized);

        if (!validation.valid) {
          return resolve({
            success: false,
            error: `QR Code terdeteksi tapi bukan QRIS merchant statis valid: ${validation.errors.join(', ')}`,
          });
        }

        resolve({ success: true, payload: normalized });
      } catch (err) {
        resolve({
          success: false,
          error: err instanceof Error ? err.message : 'Gagal memproses gambar QRIS',
        });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ success: false, error: 'Gagal memuat file gambar' });
    };

    img.src = objectUrl;
  });
}
