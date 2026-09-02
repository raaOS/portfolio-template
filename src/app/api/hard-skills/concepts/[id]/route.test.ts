import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { validateAdminRequestMock, validateSiteMutationRequestMock, conceptServiceMock } = vi.hoisted(() => ({
  validateAdminRequestMock: vi.fn(),
  validateSiteMutationRequestMock: vi.fn(),
  conceptServiceMock: {
    updateConcept: vi.fn(),
    deleteConcept: vi.fn(),
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

import { PUT, DELETE } from './route';

function buildCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('/api/hard-skills/concepts/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('PUT', () => {
    it('blocks unauthenticated requests', async () => {
      validateSiteMutationRequestMock.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/hard-skills/concepts/abc', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Updated' }),
      });

      const response = await PUT(request, buildCtx('abc'));
      await response.json();

      expect(response.status).toBe(401);
    });

    it('updates a concept successfully', async () => {
      validateSiteMutationRequestMock.mockResolvedValue({ role: 'admin' });
      conceptServiceMock.updateConcept.mockResolvedValue({
        id: 'abc',
        title: 'Updated Concept',
        description: 'Desc',
      });

      const request = new NextRequest('http://localhost/api/hard-skills/concepts/abc', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Updated Concept' }),
      });

      const response = await PUT(request, buildCtx('abc'));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.concept.title).toBe('Updated Concept');
    });

    it('returns 404 when concept is not found', async () => {
      validateSiteMutationRequestMock.mockResolvedValue({ role: 'admin' });
      conceptServiceMock.updateConcept.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/hard-skills/concepts/missing', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Missing' }),
      });

      const response = await PUT(request, buildCtx('missing'));
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toContain('not found');
    });

    it('returns 500 on service failure', async () => {
      validateSiteMutationRequestMock.mockResolvedValue({ role: 'admin' });
      conceptServiceMock.updateConcept.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/hard-skills/concepts/abc', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'X' }),
      });

      const response = await PUT(request, buildCtx('abc'));
      await response.json();

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE', () => {
    it('blocks unauthenticated requests', async () => {
      validateSiteMutationRequestMock.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/hard-skills/concepts/abc', {
        method: 'DELETE',
      });

      const response = await DELETE(request, buildCtx('abc'));
      await response.json();

      expect(response.status).toBe(401);
    });

    it('deletes a concept successfully', async () => {
      validateSiteMutationRequestMock.mockResolvedValue({ role: 'admin' });
      conceptServiceMock.deleteConcept.mockResolvedValue(true);

      const request = new NextRequest('http://localhost/api/hard-skills/concepts/abc', {
        method: 'DELETE',
      });

      const response = await DELETE(request, buildCtx('abc'));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it('returns 404 when concept not found', async () => {
      validateSiteMutationRequestMock.mockResolvedValue({ role: 'admin' });
      conceptServiceMock.deleteConcept.mockResolvedValue(false);

      const request = new NextRequest('http://localhost/api/hard-skills/concepts/missing', {
        method: 'DELETE',
      });

      const response = await DELETE(request, buildCtx('missing'));
      await response.json();

      expect(response.status).toBe(404);
    });

    it('returns 500 on service failure', async () => {
      validateSiteMutationRequestMock.mockResolvedValue({ role: 'admin' });
      conceptServiceMock.deleteConcept.mockRejectedValue(new Error('Internal error'));

      const request = new NextRequest('http://localhost/api/hard-skills/concepts/abc', {
        method: 'DELETE',
      });

      const response = await DELETE(request, buildCtx('abc'));
      await response.json();

      expect(response.status).toBe(500);
    });
  });
});
