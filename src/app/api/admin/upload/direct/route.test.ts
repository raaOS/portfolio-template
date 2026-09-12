import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  uploadToR2Mock,
  verifyR2UploadTokenMock,
  getAdminSiteContextMock,
  enforceSiteStorageQuotaUnlockedMock,
  checkDataRateLimitMock,
} = vi.hoisted(() => ({
  uploadToR2Mock: vi.fn(),
  verifyR2UploadTokenMock: vi.fn(),
  getAdminSiteContextMock: vi.fn(),
  enforceSiteStorageQuotaUnlockedMock: vi.fn(),
  checkDataRateLimitMock: vi.fn(),
}));

vi.mock('@/lib/r2Storage', () => ({
  uploadToR2: uploadToR2Mock,
  verifyR2UploadToken: verifyR2UploadTokenMock,
}));

vi.mock('@/lib/dataRateLimit', () => ({
  checkDataRateLimit: checkDataRateLimitMock,
}));

vi.mock('@/lib/admin/projectSiteContext', () => ({
  getAdminSiteContext: getAdminSiteContextMock,
}));

vi.mock('@/lib/product/siteStorageUsage', () => ({
  enforceSiteStorageQuotaUnlocked: enforceSiteStorageQuotaUnlockedMock,
  withSiteQuotaLock: (_siteId: string, fn: () => Promise<unknown>) => fn(),
}));

import { PUT } from './route';

function buildRequest({
  body = 'video-bytes',
  contentLength,
  contentType = 'video/mp4',
}: {
  body?: BodyInit;
  contentLength?: string;
  contentType?: string;
} = {}) {
  const headers = new Headers({ 'content-type': contentType });
  if (contentLength !== undefined) headers.set('content-length', contentLength);

  return new NextRequest('http://localhost/api/admin/upload/direct?token=signed', {
    method: 'PUT',
    headers,
    body,
  });
}

describe('PUT /api/admin/upload/direct', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
    verifyR2UploadTokenMock.mockResolvedValue({
      key: 'sites/site-1/projects/videos/demo.mp4',
      contentType: 'video/mp4',
      cacheControl: 'public, max-age=31536000, immutable',
      maxSize: 1024,
      siteId: 'site-1',
    });
    checkDataRateLimitMock.mockResolvedValue({ allowed: true });
    uploadToR2Mock.mockResolvedValue({
      key: 'sites/site-1/projects/videos/demo.mp4',
      url: 'https://cdn.example.com/sites/site-1/projects/videos/demo.mp4',
    });
    getAdminSiteContextMock.mockResolvedValue({
      siteId: 'site-1',
      status: 'active',
      quota: { storageMb: 100 },
    });
    enforceSiteStorageQuotaUnlockedMock.mockResolvedValue({});
  });

  it('uses FixedLengthStream for known-length request bodies', async () => {
    const fixedStreams: Array<{
      expectedLength: number | bigint;
      readable: ReadableStream<Uint8Array>;
      writable: WritableStream<Uint8Array>;
    }> = [];
    vi.stubGlobal(
      'FixedLengthStream',
      class {
        public readonly expectedLength: number | bigint;
        public readonly readable: ReadableStream<Uint8Array>;
        public readonly writable: WritableStream<Uint8Array>;

        constructor(expectedLength: number | bigint) {
          this.expectedLength = expectedLength;
          const stream = new TransformStream<Uint8Array, Uint8Array>();
          this.readable = stream.readable;
          this.writable = stream.writable;
          fixedStreams.push(this);
        }
      }
    );

    const response = await PUT(buildRequest({ body: 'hello', contentLength: '5' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(fixedStreams[0]?.expectedLength).toBe(5);
    expect(uploadToR2Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'sites/site-1/projects/videos/demo.mp4',
        body: fixedStreams[0]?.readable,
        contentType: 'video/mp4',
      })
    );
  });

  it('rejects content-length values above the signed max size', async () => {
    const response = await PUT(buildRequest({ contentLength: '1025' }));
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.error).toBe('Upload is larger than allowed size');
    expect(uploadToR2Mock).not.toHaveBeenCalled();
  });

  it('buffers no-content-length uploads with the signed size limit', async () => {
    const response = await PUT(buildRequest({ body: 'hello' }));

    expect(response.status).toBe(200);
    expect(uploadToR2Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.any(ArrayBuffer),
      })
    );
  });

  it('rejects site-scoped uploads that exceed the actual storage quota', async () => {
    enforceSiteStorageQuotaUnlockedMock.mockRejectedValue(
      new Error('Storage quota exceeded. Limit: 100 MB')
    );

    const response = await PUT(buildRequest({ body: 'hello', contentLength: '5' }));

    expect(response.status).toBe(500);
    expect(uploadToR2Mock).not.toHaveBeenCalled();
    expect(enforceSiteStorageQuotaUnlockedMock).toHaveBeenCalledWith('site-1', 5, {
      storageMb: 100,
    });
  });

  it('rejects token whose key prefix does not match the bound siteId', async () => {
    // Token diterbitkan untuk site-1, tapi key menunjuk site lain.
    verifyR2UploadTokenMock.mockResolvedValue({
      key: 'sites/site-2/projects/videos/evil.mp4',
      contentType: 'video/mp4',
      cacheControl: 'public, max-age=31536000, immutable',
      maxSize: 1024,
      siteId: 'site-1',
    });

    const response = await PUT(buildRequest({ body: 'hello' }));

    expect(response.status).toBe(403);
    expect(await body_error(response)).toBe('Upload token site mismatch');
    expect(uploadToR2Mock).not.toHaveBeenCalled();
  });

  it('rejects legacy token without siteId targeting a site-scoped key', async () => {
    verifyR2UploadTokenMock.mockResolvedValue({
      key: 'sites/site-1/projects/videos/legacy.mp4',
      contentType: 'video/mp4',
      cacheControl: 'public, max-age=31536000, immutable',
      maxSize: 1024,
    });

    const response = await PUT(buildRequest({ body: 'hello' }));

    expect(response.status).toBe(403);
    expect(await body_error(response)).toBe('Upload token site mismatch');
    expect(uploadToR2Mock).not.toHaveBeenCalled();
  });

  it('allows legacy token without siteId for default-site assets folder', async () => {
    verifyR2UploadTokenMock.mockResolvedValue({
      key: 'assets/wallpapers/demo.mp4',
      contentType: 'video/mp4',
      cacheControl: 'public, max-age=31536000, immutable',
      maxSize: 1024,
    });

    const response = await PUT(buildRequest({ body: 'hello' }));

    expect(response.status).toBe(200);
    expect(uploadToR2Mock).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'assets/wallpapers/demo.mp4' })
    );
  });

  it('blocks requests when the IP rate limit is exhausted', async () => {
    checkDataRateLimitMock.mockResolvedValue({ allowed: false, retryAfter: 120 });

    const response = await PUT(buildRequest({ body: 'hello' }));

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('120');
    expect(verifyR2UploadTokenMock).not.toHaveBeenCalled();
    expect(uploadToR2Mock).not.toHaveBeenCalled();
  });
});

async function body_error(response: Response) {
  const body = (await response.json()) as { error?: string };
  return body.error;
}
