import { NextRequest, NextResponse } from 'next/server';
import { queryD1 } from '@/lib/cloudflareD1';
import { verifyOrderAccessToken } from '@/lib/services/orderService';
import { checkAdminAuth } from '@/lib/auth';
import { enforceRequestRateLimit } from '@/lib/security/request';
import { getR2Object, isR2StorageConfigured } from '@/lib/r2Storage';

/**
 * GET /api/billing/orders/[orderId]/proof
 *
 * Menampilkan bukti bayar milik satu order SETELAH otorisasi.
 *
 * Kenapa route ini ada: file bukti disimpan di R2 dengan key `orders/{orderId}/`,
 * sedangkan route publik `/r2/[...key]` sengaja MENOLAK prefix `orders/` agar PII
 * bukti transfer tidak bisa diakses sembarang orang. Konsekuensinya URL asli
 * (`/r2/orders/...`) selalu 404 dan panel admin tidak pernah bisa menampilkan
 * gambar hasil upload file.
 *
 * Route ini menjadi satu-satunya jendela aksesnya:
 *   - admin  -> sesi JWT (`admin_token`)
 *   - pembeli -> access token order (?token=...)
 *
 * URL eksternal (pembeli menempel link manual) dialihkan, bukan di-proxy.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function contentTypeForKey(key: string) {
  const ext = key.split('.').pop()?.toLowerCase() ?? '';
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

function isNotFoundError(error: unknown) {
  const candidate = error as { name?: string; Code?: string; code?: string };
  return (
    candidate?.name === 'NoSuchKey' ||
    candidate?.name === 'NotFound' ||
    candidate?.Code === 'NoSuchKey' ||
    candidate?.code === 'NotFound'
  );
}

/**
 * Ekstrak key R2 milik order ini dari URL bukti, atau null bila bukan objek R2
 * internal. Key yang dihasilkan selalu berawalan `orders/{orderId}/` sehingga
 * tidak mungkin membaca objek milik order lain.
 */
function internalProofKey(url: string, orderId: string): string | null {
  let path = url;

  if (/^https?:\/\//i.test(url)) {
    try {
      path = new URL(url).pathname;
    } catch {
      return null;
    }
  }

  if (!path.startsWith('/')) return null;

  const marker = `orders/${orderId}/`;
  const index = path.indexOf(marker);
  if (index < 0) return null;

  let key: string;
  try {
    key = decodeURIComponent(path.slice(index));
  } catch {
    return null;
  }

  if (key.includes('..') || key.includes('\\')) return null;
  return key;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    const rateLimit = await enforceRequestRateLimit(request, 'billing_proof_get', 60, 60_000, 120_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Terlalu banyak permintaan. Silakan coba lagi beberapa saat.', retryAfter: rateLimit.retryAfter },
        { status: 429 }
      );
    }

    const token = request.nextUrl.searchParams.get('token');
    const isAdmin = checkAdminAuth(request);

    if (!isAdmin && !(token && (await verifyOrderAccessToken(orderId, token)))) {
      return NextResponse.json({ error: 'Token akses tidak valid' }, { status: 401 });
    }

    const rows = await queryD1('SELECT payment_proof_url FROM orders WHERE id = ?', [orderId]);
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });
    }

    const rawUrl = rows[0].payment_proof_url;
    const proofUrl = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    if (!proofUrl) {
      return NextResponse.json({ error: 'Order ini belum memiliki bukti pembayaran' }, { status: 404 });
    }

    const key = internalProofKey(proofUrl, orderId);

    if (key) {
      if (!isR2StorageConfigured()) {
        return NextResponse.json({ error: 'Cloudflare R2 is not configured' }, { status: 503 });
      }

      const object = await getR2Object(key);

      const headers = new Headers({
        'content-type': object.ContentType || contentTypeForKey(key),
        // Sengaja `private`: objek ini hanya boleh disimpan oleh browser
        // yang sudah mengotorisasi diri, bukan oleh shared cache/CDN.
        'cache-control': 'private, max-age=3600',
        'x-content-type-options': 'nosniff',
        'content-disposition': 'inline',
      });
      if (typeof object.ContentLength === 'number') {
        headers.set('content-length', String(object.ContentLength));
      }
      if (object.ETag) headers.set('etag', object.ETag);

      return new NextResponse(object.Body, { status: 200, headers });
    }

    // Bukan objek R2 internal: URL relatif di situs sendiri atau link eksternal
    // yang ditempel pembeli. Alihkan saja — jangan ikut di-proxy.
    const isRelative = proofUrl.startsWith('/');
    if (!isRelative && !/^https?:\/\//i.test(proofUrl)) {
      return NextResponse.json({ error: 'URL bukti tidak valid' }, { status: 400 });
    }

    return NextResponse.redirect(new URL(proofUrl, request.url), 302);
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'File bukti tidak ditemukan di penyimpanan' }, { status: 404 });
    }
    console.error('[order-proof] Error:', error);
    return NextResponse.json({ error: 'Gagal menampilkan bukti pembayaran' }, { status: 500 });
  }
}
