import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';
import * as clientAuth from '@/lib/clientAuth';
import * as cloudflareD1 from '@/lib/cloudflareD1';

describe('API /api/client/template', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/client/template', () => {
    it('returns 401 if unauthenticated', async () => {
      vi.spyOn(clientAuth, 'getClientSessionFromRequest').mockResolvedValue(null);
      const req = new NextRequest('http://localhost/api/client/template');
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it('returns list of templates with entitlement status and active state', async () => {
      vi.spyOn(clientAuth, 'getClientSessionFromRequest').mockResolvedValue({
        accessId: 'acc-1',
        siteId: 'site-123',
        siteSlug: 'demo',
        siteName: 'Demo Site',
        siteStatus: 'active',
        plan: 'pro',
        email: 'client@example.com',
      });

      vi.spyOn(cloudflareD1, 'queryD1').mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT active_template_key')) {
          return [{ active_template_key: 'landing-bento' }];
        }
        return [];
      });

      const req = new NextRequest('http://localhost/api/client/template');
      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.activeKey).toBe('landing-bento');
      expect(Array.isArray(json.templates)).toBe(true);
      expect(json.templates.length).toBeGreaterThan(0);

      const bento = json.templates.find((t: { id: string }) => t.id === 'landing-bento');
      expect(bento?.isActive).toBe(true);
      expect(bento?.isEntitled).toBe(true);
    });
  });

  describe('POST /api/client/template', () => {
    it('returns 401 if unauthenticated', async () => {
      vi.spyOn(clientAuth, 'getClientSessionFromRequest').mockResolvedValue(null);
      const req = new NextRequest('http://localhost/api/client/template', {
        method: 'POST',
        body: JSON.stringify({ templateId: 'landing-bento' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('returns 403 when trying to activate unentitled template', async () => {
      vi.spyOn(clientAuth, 'getClientSessionFromRequest').mockResolvedValue({
        accessId: 'acc-1',
        siteId: 'site-123',
        siteSlug: 'demo',
        siteName: 'Demo Site',
        siteStatus: 'active',
        plan: 'lite',
        email: 'client@example.com',
      });

      vi.spyOn(cloudflareD1, 'isD1Configured').mockReturnValue(false);

      const req = new NextRequest('http://localhost/api/client/template', {
        method: 'POST',
        body: JSON.stringify({ templateId: 'unknown-premium-template' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it('updates active_template_key when entitled', async () => {
      vi.spyOn(clientAuth, 'getClientSessionFromRequest').mockResolvedValue({
        accessId: 'acc-1',
        siteId: 'site-123',
        siteSlug: 'demo',
        siteName: 'Demo Site',
        siteStatus: 'active',
        plan: 'pro',
        email: 'client@example.com',
      });

      vi.spyOn(cloudflareD1, 'queryD1').mockResolvedValue([]);

      const req = new NextRequest('http://localhost/api/client/template', {
        method: 'POST',
        body: JSON.stringify({ templateId: 'landing-bento' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.activeTemplateKey).toBe('landing-bento');
    });
  });
});
