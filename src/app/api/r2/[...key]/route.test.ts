import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { isConfiguredMock, getObjectMock, headObjectMock } = vi.hoisted(() => ({
  isConfiguredMock: vi.fn(),
  getObjectMock: vi.fn(),
  headObjectMock: vi.fn(),
}));

vi.mock('@/lib/r2Storage', () => ({
  getR2Object: getObjectMock,
  headR2Object: headObjectMock,
  isR2StorageConfigured: isConfiguredMock,
}));

import { GET, HEAD, OPTIONS } from './route';

const routeCtx = { params: Promise.resolve({ key: ['assets', 'projects', 'cover.png'] }) };

describe('/api/r2/[...key]', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('OPTIONS', () => {
    it('returns CORS headers', async () => {
      const response = await OPTIONS();
      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
    });
  });

  describe('GET', () => {
    it('returns 503 when R2 is not configured', async () => {
      isConfiguredMock.mockReturnValue(false);
      const request = new NextRequest('http://localhost/api/r2/assets/projects/cover.png');

      const response = await GET(request, routeCtx);
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body.error).toContain('R2');
    });

    it('returns 404 for keys outside allowed prefixes', async () => {
      isConfiguredMock.mockReturnValue(true);
      const request = new NextRequest('http://localhost/api/r2/malicious/path');
      const ctx = { params: Promise.resolve({ key: ['malicious', 'path'] }) };

      const response = await GET(request, ctx);
      const body = await response.text();

      expect(response.status).toBe(404);
      expect(body).toBe('Not Found');
    });

    it('never serves D1 backup files, even under the allowed sites/ prefix', async () => {
      isConfiguredMock.mockReturnValue(true);
      const request = new NextRequest(
        'http://localhost/api/r2/sites/default-site/backups/d1/2026-10-05T01-00-00-000Z.json'
      );
      const ctx = {
        params: Promise.resolve({
          key: ['sites', 'default-site', 'backups', 'd1', '2026-10-05T01-00-00-000Z.json'],
        }),
      };

      const response = await GET(request, ctx);

      expect(response.status).toBe(404);
      expect(getObjectMock).not.toHaveBeenCalled();
      expect(headObjectMock).not.toHaveBeenCalled();
    });

    it('returns 404 for keys with path traversal', async () => {
      isConfiguredMock.mockReturnValue(true);
      const request = new NextRequest('http://localhost/api/r2/assets/../etc/passwd');
      const ctx = { params: Promise.resolve({ key: ['assets', '..', 'etc', 'passwd'] }) };

      const response = await GET(request, ctx);
      expect(response.status).toBe(404);
    });

    it.each([
      ['ffmpeg-core.wasm', 'application/wasm'],
      ['ffmpeg-core.js', 'application/javascript; charset=utf-8'],
    ])('serves browser-only ffmpeg asset %s from the controlled prefix', async (fileName, contentType) => {
      isConfiguredMock.mockReturnValue(true);
      const mockBody = {
        transformToWebStream: () =>
          new ReadableStream({
            start(c) {
              c.close();
            },
          }),
      };
      getObjectMock.mockResolvedValue({
        ContentType: contentType,
        ContentLength: 32232419,
        CacheControl: 'public, max-age=31536000, immutable',
        Body: mockBody,
      });

      const request = new NextRequest(`http://localhost/api/r2/ffmpeg/${fileName}`);
      const ctx = { params: Promise.resolve({ key: ['ffmpeg', fileName] }) };

      const response = await GET(request, ctx);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe(contentType);
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
    });

    it('does not expose arbitrary objects under the ffmpeg prefix', async () => {
      isConfiguredMock.mockReturnValue(true);
      const request = new NextRequest('http://localhost/api/r2/ffmpeg/secret.txt');
      const ctx = { params: Promise.resolve({ key: ['ffmpeg', 'secret.txt'] }) };

      const response = await GET(request, ctx);

      expect(response.status).toBe(404);
      expect(getObjectMock).not.toHaveBeenCalled();
    });

    it('serves R2 objects with correct headers', async () => {
      isConfiguredMock.mockReturnValue(true);
      const mockBody = {
        transformToWebStream: () =>
          new ReadableStream({
            start(c) {
              c.close();
            },
          }),
      };
      getObjectMock.mockResolvedValue({
        ContentType: 'image/png',
        ContentLength: 1024,
        CacheControl: 'public, max-age=3600',
        ETag: '"abc123"',
        LastModified: new Date('2026-01-01'),
        Body: mockBody,
      });

      const request = new NextRequest('http://localhost/api/r2/assets/projects/cover.png');
      const response = await GET(request, routeCtx);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('image/png');
      expect(response.headers.get('accept-ranges')).toBe('bytes');
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
    });

    it('allows sites/ and platform/ prefixes', async () => {
      isConfiguredMock.mockReturnValue(true);
      const mockBody = {
        transformToWebStream: () =>
          new ReadableStream({
            start(c) {
              c.close();
            },
          }),
      };
      getObjectMock.mockResolvedValue({
        ContentType: 'image/webp',
        ContentLength: 500,
        Body: mockBody,
      });

      const siteReq = new NextRequest('http://localhost/api/r2/sites/default-site/assets/media/qris.webp');
      const siteCtx = { params: Promise.resolve({ key: ['sites', 'default-site', 'assets', 'media', 'qris.webp'] }) };
      const siteRes = await GET(siteReq, siteCtx);
      expect(siteRes.status).toBe(200);

      const platformReq = new NextRequest('http://localhost/api/r2/platform/payment/qris.webp');
      const platformCtx = { params: Promise.resolve({ key: ['platform', 'payment', 'qris.webp'] }) };
      const platformRes = await GET(platformReq, platformCtx);
      expect(platformRes.status).toBe(200);
    });

    it('returns 206 for range requests', async () => {
      isConfiguredMock.mockReturnValue(true);
      const mockBody = {
        transformToWebStream: () =>
          new ReadableStream({
            start(c) {
              c.close();
            },
          }),
      };
      getObjectMock.mockResolvedValue({
        ContentType: 'video/mp4',
        ContentLength: 1048576,
        CacheControl: 'public, max-age=31536000, immutable',
        ETag: '"xyz"',
        LastModified: new Date(),
        Body: mockBody,
        ContentRange: 'bytes 0-1023/1048576',
      });

      const request = new NextRequest('http://localhost/api/r2/assets/projects/video.mp4', {
        headers: { range: 'bytes=0-1023' },
      });
      const response = await GET(request, routeCtx);

      expect(response.status).toBe(206);
      expect(response.headers.get('content-range')).toBe('bytes 0-1023/1048576');
    });

    it('returns 404 when object is not found', async () => {
      isConfiguredMock.mockReturnValue(true);
      const notFoundError = { name: 'NoSuchKey', $metadata: { httpStatusCode: 404 } };
      getObjectMock.mockRejectedValue(notFoundError);

      const request = new NextRequest('http://localhost/api/r2/assets/projects/missing.png');
      const response = await GET(request, routeCtx);
      const body = await response.text();

      expect(response.status).toBe(404);
      expect(body).toBe('Not Found');
    });
  });

  describe('HEAD', () => {
    it('returns headers without body', async () => {
      isConfiguredMock.mockReturnValue(true);
      headObjectMock.mockResolvedValue({
        ContentType: 'image/png',
        ContentLength: 1024,
        CacheControl: 'public, max-age=3600',
        ETag: '"abc"',
        LastModified: new Date('2026-01-01'),
      });

      const request = new NextRequest('http://localhost/api/r2/assets/projects/cover.png');
      const response = await HEAD(request, routeCtx);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('image/png');
      expect(response.headers.get('content-length')).toBe('1024');
      expect(await response.text()).toBe('');
    });

    it('returns 404 when R2 object not found via HEAD', async () => {
      isConfiguredMock.mockReturnValue(true);
      headObjectMock.mockRejectedValue({ name: 'NotFound', $metadata: { httpStatusCode: 404 } });

      const request = new NextRequest('http://localhost/api/r2/assets/projects/missing.png');
      const response = await HEAD(request, routeCtx);

      expect(response.status).toBe(404);
    });
  });
});
