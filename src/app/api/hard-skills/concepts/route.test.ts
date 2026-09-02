import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { validateAdminRequestMock, validateSiteMutationRequestMock, conceptServiceMock } = vi.hoisted(() => ({
  validateAdminRequestMock: vi.fn(),
  validateSiteMutationRequestMock: vi.fn(),
  conceptServiceMock: {
    getConcepts: vi.fn(),
    createConcept: vi.fn(),
  },
}));

vi.mock('@/lib/auth', () => ({
  validateAdminRequest: validateAdminRequestMock,
}));

vi.mock('@/lib/admin/siteMutationAuth', () => ({
  validateSiteMutationRequest: validateSiteMutationRequestMock,
}));

vi.mock('@/lib/services/hardSkillConceptService', () => ({
  hardSkillConceptService: conceptServiceMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { GET, POST } from './route';

describe('/api/hard-skills/concepts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('GET', () => {
    it('returns sorted concepts', async () => {
      const concepts = [
        { id: '1', title: 'Z Concept', order: 3, description: 'z' },
        { id: '2', title: 'A Concept', order: 1, description: 'a' },
        { id: '3', title: 'B Concept', order: 2, description: 'b' },
      ];
      conceptServiceMock.getConcepts.mockResolvedValue({
        concepts,
        lastUpdated: '2026-01-01',
      });

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.concepts).toHaveLength(3);
      expect(body.concepts[0].order).toBe(1);
      expect(body.concepts[0].title).toBe('A Concept');
      expect(body.lastUpdated).toBe('2026-01-01');
    });

    it('returns 500 on service failure', async () => {
      conceptServiceMock.getConcepts.mockRejectedValue(new Error('DB down'));

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toContain('Failed to load');
    });
  });

  describe('POST', () => {
    it('blocks unauthenticated requests', async () => {
      validateSiteMutationRequestMock.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/hard-skills/concepts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Test', description: 'Desc' }),
      });

      const response = await POST(request);
      await response.json();

      expect(response.status).toBe(401);
    });

    it('returns 400 when title or description is missing', async () => {
      validateSiteMutationRequestMock.mockResolvedValue({ role: 'admin' });

      const request = new NextRequest('http://localhost/api/hard-skills/concepts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'No Desc' }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('required');
    });

    it('creates a concept with defaults', async () => {
      validateSiteMutationRequestMock.mockResolvedValue({ role: 'admin' });
      conceptServiceMock.createConcept.mockResolvedValue({
        id: 'new-concept',
        title: 'New Concept',
        description: 'A new concept',
        order: 0,
        isActive: true,
      });

      const request = new NextRequest('http://localhost/api/hard-skills/concepts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'New Concept', description: 'A new concept' }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.concept.title).toBe('New Concept');
      expect(body.concept.isActive).toBe(true);
    });

    it('creates a concept with explicit isActive=false', async () => {
      validateSiteMutationRequestMock.mockResolvedValue({ role: 'admin' });
      conceptServiceMock.createConcept.mockResolvedValue({
        id: 'inactive',
        title: 'Hidden',
        description: 'Not visible',
        order: 5,
        isActive: false,
      });

      const request = new NextRequest('http://localhost/api/hard-skills/concepts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Hidden',
          description: 'Not visible',
          order: 5,
          isActive: false,
        }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.concept.isActive).toBe(false);
      expect(body.concept.order).toBe(5);
    });
  });
});
