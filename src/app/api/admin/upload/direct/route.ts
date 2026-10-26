import { NextRequest, NextResponse } from 'next/server';
import { uploadToR2, verifyR2UploadToken } from '@/lib/r2Storage';
import { checkDataRateLimit } from '@/lib/dataRateLimit';
import { getClientIP } from '@/lib/security/request';

export const dynamic = 'force-dynamic';

// SECURITY: Rate limit per IP untuk route publik ini. Tanpa ini, attacker
// bisa spam PUT dengan token kadaluarsa/invalid untuk membakar CPU Worker.
const MAX_UPLOAD_ATTEMPTS_PER_WINDOW = 30;
const UPLOAD_RATE_LIMIT_WINDOW = 5 * 60 * 1000;
const UPLOAD_BLOCK_DURATION = 5 * 60 * 1000;

type FixedLengthStreamConstructor = new (expectedLength: number | bigint) => {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
};

function getFixedLengthStreamConstructor() {
  return (globalThis as unknown as { FixedLengthStream?: FixedLengthStreamConstructor })
    .FixedLengthStream;
}

async function readBodyWithLimit(body: ReadableStream<Uint8Array>, maxSize: number) {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let bytesReceived = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    bytesReceived += value.byteLength;
    if (bytesReceived > maxSize) {
      throw new Error('UPLOAD_SIZE_EXCEEDED');
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(bytesReceived);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return merged.buffer;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'access-control-allow-methods': 'PUT, OPTIONS',
      'access-control-allow-headers': 'content-type, cache-control, x-csrf-token',
    },
  });
}

export async function PUT(req: NextRequest) {
  try {
    // SECURITY: Rate-limit sebelum verifikasi token agar token-guessing
    // dan spam request tidak membakar resource Worker.
    const rateLimitIp = getClientIP(req);
    const rateLimit = await checkDataRateLimit(
      `r2direct_${rateLimitIp}`,
      MAX_UPLOAD_ATTEMPTS_PER_WINDOW,
      UPLOAD_RATE_LIMIT_WINDOW,
      UPLOAD_BLOCK_DURATION
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many upload attempts. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) },
        }
      );
    }

    const token = req.nextUrl.searchParams.get('token') || '';
    const payload = await verifyR2UploadToken(token);

    // SECURITY: Site binding — token yang diterbitkan untuk site X hanya
    // boleh menulis ke prefix `sites/X/`. Token default-site (tanpa siteId)
    // tetap hanya boleh menulis ke `assets/wallpapers/`. Token yang bocor
    // tidak bisa dipakai lintas site.
    if (payload.siteId) {
      const expectedPrefix = `sites/${payload.siteId}/`;
      if (!payload.key.startsWith(expectedPrefix)) {
        return NextResponse.json({ error: 'Upload token site mismatch' }, { status: 403 });
      }
    } else if (payload.key.startsWith('sites/')) {
      // Token legacy tanpa siteId tidak boleh menulis ke prefix site.
      return NextResponse.json({ error: 'Upload token site mismatch' }, { status: 403 });
    }

    const isAllowedKey =
      payload.key.startsWith('assets/wallpapers/') ||
      /^sites\/[a-zA-Z0-9_-]+\/wallpapers\//.test(payload.key) ||
      /^sites\/[a-zA-Z0-9_-]+\/projects\/(videos|video-posters|video-previews)\//.test(
        payload.key
      );

    if (!isAllowedKey) {
      return NextResponse.json({ error: 'Upload target is not allowed' }, { status: 400 });
    }

    const contentType = req.headers.get('content-type') || '';
    if (contentType !== payload.contentType) {
      return NextResponse.json({ error: 'Content-Type does not match upload token' }, { status: 400 });
    }

    const contentLengthHeader = req.headers.get('content-length');
    const contentLength = Number(contentLengthHeader || 0);
    if (contentLengthHeader && (!Number.isFinite(contentLength) || contentLength < 0)) {
      return NextResponse.json({ error: 'Invalid Content-Length header' }, { status: 400 });
    }
    if (contentLengthHeader && contentLength > payload.maxSize) {
      return NextResponse.json({ error: 'Upload is larger than allowed size' }, { status: 413 });
    }

    if (!req.body) {
      return NextResponse.json({ error: 'Missing upload body' }, { status: 400 });
    }

    // SECURITY FIX: Streaming body size guard — counts actual bytes consumed.
    // Content-Length can be omitted (chunked encoding) or spoofed by the client.
    // R2 rejects transformed request streams because they lose known length.
    // Cloudflare R2 accepts the readable half of FixedLengthStream.
    const FixedLengthStream = getFixedLengthStreamConstructor();
    let uploadBody: ReadableStream<Uint8Array> | ArrayBuffer;
    // Ukuran yang BENAR-BENAR diunggah. Tanpa Content-Length (chunked), nilai
    // 0 dulu dipakai untuk cek kuota → kuota bisa dilewati sepenuhnya
    // (audit 2026-10-24). Jalur ArrayBuffer menghitung byte sungguhan.
    let uploadSize: number;
    if (contentLengthHeader && FixedLengthStream) {
      const fixedLengthStream = new FixedLengthStream(contentLength);
      req.body.pipeTo(fixedLengthStream.writable).catch(() => {});
      uploadBody = fixedLengthStream.readable;
      uploadSize = contentLength;
    } else {
      const buffered = await readBodyWithLimit(req.body, payload.maxSize);
      uploadBody = buffered;
      uploadSize = buffered.byteLength;
    }

    try {
      // SECURITY FIX: Re-check storage quota dengan content-length AKTUAL
      // (bukan ukuran yang dideklarasikan client saat presign). Cek + upload
      // dibungkus satu lock per-site untuk menutup TOCTOU.
      const siteMatch = payload.key.match(/^sites\/([a-zA-Z0-9_-]+)\//);
      if (siteMatch) {
        const { getAdminSiteContext } = await import('@/lib/admin/projectSiteContext');
        const { withSiteQuotaLock, enforceSiteStorageQuotaUnlocked } = await import(
          '@/lib/product/siteStorageUsage'
        );
        const site = await getAdminSiteContext(siteMatch[1]);
        if (site.status !== 'active') {
          return NextResponse.json({ error: 'Site is not active' }, { status: 403 });
        }

        const result = await withSiteQuotaLock(siteMatch[1], async () => {
          await enforceSiteStorageQuotaUnlocked(siteMatch[1], uploadSize, site.quota);
          return uploadToR2({
            key: payload.key,
            body: uploadBody,
            contentType: payload.contentType,
            cacheControl: payload.cacheControl,
          });
        });
        return NextResponse.json({ success: true, key: result.key, publicUrl: result.url });
      }

      const result = await uploadToR2({
        key: payload.key,
        body: uploadBody,
        contentType: payload.contentType,
        cacheControl: payload.cacheControl,
      });
      return NextResponse.json({ success: true, key: result.key, publicUrl: result.url });
    } catch (uploadError) {
      if (uploadError instanceof Error && uploadError.message === 'UPLOAD_SIZE_EXCEEDED') {
        return NextResponse.json({ error: 'Upload body exceeds allowed size' }, { status: 413 });
      }
      throw uploadError;
    }
  } catch (error) {
    console.error('[R2DirectUpload] Upload failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
