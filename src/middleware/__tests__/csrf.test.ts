import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/security/token', () => ({
  validateCSRFToken: vi.fn(),
}));

import { validateCSRFToken } from '@/lib/security/token';
import { checkCSRF } from '../csrf';

const CSRF_VALID = 'a'.repeat(64);

function buildRequest(
  pathname: string,
  method: string,
  options: { cookieToken?: string; headerToken?: string } = {}
): NextRequest {
  const url = new URL(`http://localhost${pathname}`);
  const headers: Record<string, string> = {};
  if (options.headerToken) headers['x-csrf-token'] = options.headerToken;
  const req = new NextRequest(url, {
    method,
    headers: new Headers(headers),
  });
  if (options.cookieToken) {
    req.cookies.set('csrf_token', options.cookieToken);
  }
  return req;
}

describe('checkCSRF middleware', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (validateCSRFToken as ReturnType<typeof vi.fn>).mockReturnValue(true);
  });

  it('skips non-API routes regardless of method', () => {
    const result = checkCSRF(buildRequest('/admin/dashboard', 'POST'));
    expect(result.isValid).toBe(true);
  });

  it('skips safe methods on API routes', () => {
    const result = checkCSRF(buildRequest('/api/projects', 'GET'));
    expect(result.isValid).toBe(true);
    expect(validateCSRFToken).not.toHaveBeenCalled();
  });

  describe('visitor-reachable endpoints (must bypass CSRF)', () => {
    it.each([
      '/api/metrics',
      '/api/comments',
      '/api/analytics',
      '/api/chat/send',
      '/api/translate',
      '/api/admin/login',
      '/api/admin/logout',
    ])('allows %s POST without csrf_token cookie (visitor fresh)', (pathname) => {
      const result = checkCSRF(buildRequest(pathname, 'POST'));
      expect(result.isValid).toBe(true);
      expect(validateCSRFToken).not.toHaveBeenCalled();
    });
  });

  describe('admin-only endpoints (must enforce CSRF)', () => {
    it.each([
      '/api/projects',
      '/api/about',
      '/api/sticky-notes',
      '/api/hard-skills',
      '/api/gallery/featured',
      '/api/settings',
      '/api/leads',
    ])('rejects %s PUT without csrf_token cookie', (pathname) => {
      const result = checkCSRF(buildRequest(pathname, 'PUT'));
      expect(result.isValid).toBe(false);
      expect(result.response?.status).toBe(403);
    });

    it('rejects when header token missing but cookie present', () => {
      const result = checkCSRF(buildRequest('/api/projects', 'POST', { cookieToken: CSRF_VALID }));
      expect(result.isValid).toBe(false);
      expect(result.response?.status).toBe(403);
    });

    it('rejects when tokens do not match (validateCSRFToken returns false)', () => {
      (validateCSRFToken as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const result = checkCSRF(
        buildRequest('/api/projects', 'POST', {
          cookieToken: CSRF_VALID,
          headerToken: CSRF_VALID,
        })
      );

      expect(result.isValid).toBe(false);
      expect(result.response?.status).toBe(403);
    });

    it('accepts when both tokens present and validated', () => {
      (validateCSRFToken as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const result = checkCSRF(
        buildRequest('/api/projects', 'POST', {
          cookieToken: CSRF_VALID,
          headerToken: CSRF_VALID,
        })
      );

      expect(result.isValid).toBe(true);
      expect(validateCSRFToken).toHaveBeenCalledWith(CSRF_VALID, CSRF_VALID);
    });
  });

  describe('all mutation methods protected', () => {
    it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
      'enforces CSRF on %s for admin endpoint',
      (method) => {
        const result = checkCSRF(buildRequest('/api/projects/123', method));
        expect(result.isValid).toBe(false);
        expect(result.response?.status).toBe(403);
      }
    );
  });
});
