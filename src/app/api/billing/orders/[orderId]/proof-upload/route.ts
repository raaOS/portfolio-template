import { NextRequest, NextResponse } from 'next/server';
import { verifyOrderAccessToken, uploadPaymentProof } from '@/lib/services/orderService';
import { checkAdminAuth } from '@/lib/auth';
import { enforceRequestRateLimit } from '@/lib/security/request';
import { uploadToR2 } from '@/lib/r2Storage';
import crypto from 'crypto';

/**
 * POST /api/billing/orders/[orderId]/proof-upload
 *
 * Upload bukti bayar sebagai file (multipart/form-data) dari halaman order
 * pembeli. Menggantikan kebutuhan "paste URL" yang menyulitkan pembeli
 * non-teknis (sumber human error utama). File disimpan di R2 di bawah prefix
 * `orders/{orderId}/`, lalu order dipindahkan ke `waiting_verification`
 * melalui service yang sama dengan jalur URL (termasuk guard late-payment).
 */

export const maxDuration = 30;

const ALLOWED_IMAGE_TYPES = new Map<string, string>([
  ['image/jpeg', 'jpeg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);
const MAX_PROOF_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    const rateLimit = await enforceRequestRateLimit(request, 'billing_proof_file', 5, 60_000, 300_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Terlalu banyak permintaan. Silakan coba lagi beberapa saat.', retryAfter: rateLimit.retryAfter },
        { status: 429 }
      );
    }

    const isAdmin = checkAdminAuth(request);

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Payload multipart tidak valid' }, { status: 400 });
    }

    const token = (formData.get('token') as string | null) || '';
    if (!isAdmin && !(token && (await verifyOrderAccessToken(orderId, token)))) {
      return NextResponse.json({ error: 'Token akses tidak valid' }, { status: 401 });
    }

    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File bukti wajib dilampirkan' }, { status: 400 });
    }

    const extension = ALLOWED_IMAGE_TYPES.get(file.type);
    if (!extension) {
      return NextResponse.json(
        { error: 'Format bukti harus berupa gambar (JPG, PNG, atau WebP)' },
        { status: 400 }
      );
    }

    if (file.size > MAX_PROOF_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Ukuran bukti maksimal 5 MB' }, { status: 413 });
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    const key = `orders/${orderId}/proof-${Date.now()}-${randomSuffix}.${extension}`;

    let uploaded: { key: string; url: string } | null = null;
    try {
      uploaded = await uploadToR2({
        key,
        body: buffer,
        contentType: file.type,
        cacheControl: 'public, max-age=31536000, immutable',
      });
    } catch (err) {
      console.error('[proof-upload] uploadToR2 failed:', err);
      return NextResponse.json({ error: 'Gagal menyimpan bukti. Silakan coba lagi.' }, { status: 500 });
    }
    if (!uploaded?.url) {
      return NextResponse.json(
        { error: 'Penyimpanan media belum dikonfigurasi. Silakan upload via URL atau hubungi admin.' },
        { status: 503 }
      );
    }

    const result = await uploadPaymentProof(orderId, uploaded.url, {
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
      TELEGRAM_ADMIN_CHAT_ID: process.env.TELEGRAM_ADMIN_CHAT_ID,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Gagal memproses bukti bayar' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Bukti pembayaran berhasil diunggah dan sedang dalam verifikasi admin.',
      proofUrl: uploaded.url,
    });
  } catch (error: unknown) {
    console.error('[proof-upload] Error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengunggah bukti bayar' }, { status: 500 });
  }
}