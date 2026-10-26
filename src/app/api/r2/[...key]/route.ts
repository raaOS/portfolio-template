import { NextRequest, NextResponse } from 'next/server';
import { getR2Object, headR2Object, isR2StorageConfigured } from '@/lib/r2Storage';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ key: string[] }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  return serveR2Object(request, context, false);
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  return serveR2Object(request, context, true);
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: buildCorsHeaders() });
}

async function serveR2Object(request: NextRequest, context: RouteContext, headOnly: boolean) {
  if (!isR2StorageConfigured()) {
    return NextResponse.json({ error: 'Cloudflare R2 is not configured' }, { status: 503 });
  }

  const { key: keyParts } = await context.params;
  const key = keyParts.map(decodeURIComponent).join('/');

  if (!isAllowedKey(key)) {
    return new NextResponse('Not Found', { status: 404, headers: buildCorsHeaders() });
  }

  try {
    const range = request.headers.get('range');
    if (headOnly) {
      const object = await headR2Object(key);
      const headers = buildObjectHeaders({
        key,
        contentType: object.ContentType,
        contentLength: object.ContentLength,
        cacheControl: object.CacheControl,
        etag: object.ETag,
        lastModified: object.LastModified,
      });

      return new NextResponse(null, { status: 200, headers });
    }

    const object = await getR2Object(key, range);

    const headers = buildObjectHeaders({
      key,
      contentType: object.ContentType,
      contentLength: object.ContentLength,
      cacheControl: object.CacheControl,
      etag: object.ETag,
      lastModified: object.LastModified,
      contentRange: 'ContentRange' in object ? object.ContentRange : undefined,
    });

    const status = range && headers.has('content-range') ? 206 : 200;
    const body = toWebStream(object.Body);

    return new NextResponse(body, { status, headers });
  } catch (error) {
    const statusCode = getErrorStatus(error);

    if (statusCode === 404) {
      return new NextResponse('Not Found', { status: 404, headers: buildCorsHeaders() });
    }

    // Prevent CDN from caching transient error responses
    console.error('[R2Proxy] Failed to serve object:', error);
    return new NextResponse('Storage error', {
      status: 502,
      headers: {
        ...buildCorsHeaders(),
        'cache-control': 'no-store',
        'cdn-cache-control': 'no-store',
      },
    });
  }
}

function buildObjectHeaders(input: {
  key: string;
  contentType?: string;
  contentLength?: number;
  cacheControl?: string;
  etag?: string;
  lastModified?: Date;
  contentRange?: string;
}) {
  const headers = new Headers(buildCorsHeaders());
  headers.set('accept-ranges', 'bytes');

  // Cache-Control untuk browser. Default 1 tahun immutable (R2 keys
  // are content-addressed lewat timestamp filename, jadi aman
  // immutable — overwrite tidak terjadi).
  const cacheValue = input.cacheControl || 'public, max-age=31536000, immutable';
  headers.set('cache-control', cacheValue);

  // CDN-Cache-Control: shared CDN hint for immutable media responses.
  // Keep long-lived cache headers here so repeated media views avoid
  // unnecessary origin/R2 transfer cost.
  headers.set('cdn-cache-control', cacheValue);

  headers.set('content-type', input.contentType || contentTypeForKey(input.key));

  // SVG bisa mengeksekusi script bila dibuka langsung sebagai dokumen
  // (stored XSS di origin yang sama). Ikon tetap tampil di dalam `<img>`,
  // tapi navigasi langsung dipaksa mengunduh dan script diblokir.
  if (headers.get('content-type') === 'image/svg+xml') {
    headers.set('content-disposition', 'attachment');
    headers.set('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'");
  }

  if (typeof input.contentLength === 'number') {
    headers.set('content-length', String(input.contentLength));
  }
  if (input.etag) headers.set('etag', input.etag);
  if (input.lastModified) headers.set('last-modified', input.lastModified.toUTCString());
  if (input.contentRange) headers.set('content-range', input.contentRange);

  return headers;
}

function buildCorsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, HEAD, OPTIONS',
    'access-control-allow-headers': 'range, if-none-match, if-modified-since',
    'access-control-expose-headers': 'accept-ranges, content-length, content-range, etag',
  };
}

function isAllowedKey(key: string) {
  if (!key || key.includes('..') || key.includes('\\')) return false;
  // Cadangan D1 berisi seluruh isi database (password hash, PII order,
  // settings) — tidak boleh pernah terbaca lewat proxy publik tanpa login.
  if (key.includes('/backups/') || key.startsWith('backups/')) return false;
  if (
    key === 'ffmpeg/ffmpeg-core.js' ||
    key === 'ffmpeg/ffmpeg-core.wasm'
  ) {
    return true;
  }
  return (
    key.startsWith('assets/') ||
    key.startsWith('temp/') ||
    key.startsWith('sites/') ||
    key.startsWith('platform/')
  );
}

function toWebStream(body: unknown): ReadableStream | null {
  if (!body) return null;

  if (typeof (body as { transformToWebStream?: unknown }).transformToWebStream === 'function') {
    return (body as { transformToWebStream: () => ReadableStream }).transformToWebStream();
  }

  return body as ReadableStream;
}

function getErrorStatus(error: unknown) {
  const candidate = error as { $metadata?: { httpStatusCode?: number }; name?: string };
  if (candidate.$metadata?.httpStatusCode) return candidate.$metadata.httpStatusCode;
  if (candidate.name === 'NoSuchKey' || candidate.name === 'NotFound') return 404;
  return 500;
}

function contentTypeForKey(key: string) {
  const ext = key.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    pdf: 'application/pdf',
    txt: 'text/plain; charset=utf-8',
    js: 'application/javascript; charset=utf-8',
    wasm: 'application/wasm',
  };

  return types[ext || ''] || 'application/octet-stream';
}
