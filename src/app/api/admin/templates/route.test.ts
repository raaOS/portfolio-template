import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';
import { PUT } from './[id]/route';
import * as auth from '@/lib/auth';
import * as cloudflareD1 from '@/lib/cloudflareD1';

describe('Admin Templates API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/admin/templates', () => {
    it('returns 401 if unauthorized', async () => {
      vi.spyOn(auth, 'validateAdminRequest').mockResolvedValue(false);
      const req = new NextRequest('http://localhost/api/admin/templates');
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it('returns templates list for valid admin', async () => {
      vi.spyOn(auth, 'validateAdminRequest').mockResolvedValue(true);
      const req = new NextRequest('http://localhost/api/admin/templates');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.templates)).toBe(true);
    });
  });

  describe('POST /api/admin/templates', () => {
    it('creates new template', async () => {
      vi.spyOn(auth, 'validateAdminRequest').mockResolvedValue(true);
      vi.spyOn(cloudflareD1, 'queryD1').mockResolvedValue([]);

      const req = new NextRequest('http://localhost/api/admin/templates', {
        method: 'POST',
        body: JSON.stringify({
          id: 'custom-tpl',
          name: 'Custom Template',
          tierRequired: 'pro',
          priceIdr: 100000,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  describe('PUT /api/admin/templates/[id]', () => {
    it('updates template details', async () => {
      vi.spyOn(auth, 'validateAdminRequest').mockResolvedValue(true);
      vi.spyOn(cloudflareD1, 'queryD1').mockResolvedValue([]);

      const req = new NextRequest('http://localhost/api/admin/templates/custom-tpl', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Name',
          isActive: false,
        }),
      });

      const res = await PUT(req, { params: Promise.resolve({ id: 'custom-tpl' }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });
});
