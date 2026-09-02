import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  validateAdminRequestMock,
  getProjectByIdSqlMock,
  updateProjectSqlMock,
  deleteProjectSqlMock,
  enforceProjectUpdateQuotaMock,
  resolveProjectSiteIdMock,
  refMock,
  onceMock,
  valMock,
  setMock,
  removeMock,
  revalidatePathMock,
  generateGenZCommentsMock,
  validateSiteMutationRequestMock,
} = vi.hoisted(() => ({
  validateAdminRequestMock: vi.fn(),
  getProjectByIdSqlMock: vi.fn(),
  updateProjectSqlMock: vi.fn(),
  deleteProjectSqlMock: vi.fn(),
  enforceProjectUpdateQuotaMock: vi.fn(),
  resolveProjectSiteIdMock: vi.fn(),
  refMock: vi.fn(),
  onceMock: vi.fn(),
  valMock: vi.fn(),
  setMock: vi.fn(),
  removeMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  generateGenZCommentsMock: vi.fn(),
  validateSiteMutationRequestMock: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  validateAdminRequest: validateAdminRequestMock,
}));

vi.mock('@/lib/admin/siteMutationAuth', () => ({
  validateSiteMutationRequest: validateSiteMutationRequestMock,
}));

vi.mock('@/lib/services/project/projectSqlService', () => ({
  projectSqlService: {
    getProjectByIdSql: getProjectByIdSqlMock,
    updateProjectSql: updateProjectSqlMock,
    deleteProjectSql: deleteProjectSqlMock,
  },
}));

vi.mock('@/lib/admin/projectSiteContext', () => {
  class ProjectQuotaError extends Error {
    constructor(
      message: string,
      public readonly errorCode: string,
      public readonly details?: Record<string, unknown>
    ) {
      super(message);
    }
  }

  return {
    enforceProjectUpdateQuota: enforceProjectUpdateQuotaMock,
    resolveProjectSiteId: resolveProjectSiteIdMock,
    ProjectQuotaError,
  };
});

vi.mock('@/lib/database', () => ({
  db: {
    ref: refMock,
  },
}));

vi.mock('@/lib/magic', () => ({
  generateGenZComments: generateGenZCommentsMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

import { NextRequest } from 'next/server';
import { GET, PUT, DELETE } from './route';

const mockProject = {
  id: 'proj-1',
  slug: 'test-project',
  title: 'Test Project',
  client: 'Test Client',
  year: 2025,
  tags: ['web'],
  description: 'A test project',
  cover: '/r2/assets/test/cover.jpg',
  coverWidth: 800,
  coverHeight: 600,
  likes: 0,
  shares: 0,
  status: 'published' as const,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function buildPut(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/projects/proj-1', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function buildDelete(): NextRequest {
  return new NextRequest('http://localhost/api/projects/proj-1', {
    method: 'DELETE',
  });
}

describe('GET /api/projects/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resolveProjectSiteIdMock.mockReturnValue('default-site');
    getProjectByIdSqlMock.mockResolvedValue(mockProject);
  });

  it('returns a single project from SQL', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/projects/proj-1'),
      params('proj-1')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.project.id).toBe('proj-1');
    expect(getProjectByIdSqlMock).toHaveBeenCalledWith('default-site', 'proj-1');
  });

  it('returns 404 when project not found', async () => {
    getProjectByIdSqlMock.mockResolvedValue(null);

    const response = await GET(
      new NextRequest('http://localhost/api/projects/proj-1'),
      params('proj-1')
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Project not found');
  });

  it('returns 500 on unexpected error', async () => {
    getProjectByIdSqlMock.mockRejectedValue(new Error('DB error'));

    const response = await GET(
      new NextRequest('http://localhost/api/projects/proj-1'),
      params('proj-1')
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to load project');
  });
});

describe('PUT /api/projects/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    validateSiteMutationRequestMock.mockResolvedValue({ role: 'admin' });
    resolveProjectSiteIdMock.mockReturnValue('default-site');
    enforceProjectUpdateQuotaMock.mockResolvedValue(undefined);
    getProjectByIdSqlMock.mockResolvedValue(mockProject);
    updateProjectSqlMock.mockResolvedValue(mockProject);
    valMock.mockReturnValue([]);
    onceMock.mockResolvedValue({ val: valMock });
    refMock.mockReturnValue({ once: onceMock, set: setMock, remove: removeMock });
    setMock.mockResolvedValue(undefined);
    removeMock.mockResolvedValue(undefined);
  });

  it('rejects unauthenticated updates', async () => {
    validateSiteMutationRequestMock.mockResolvedValue(null);
    const response = await PUT(
      buildPut({ id: 'proj-1', title: 'Test' }) as never,
      params('proj-1')
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized or invalid CSRF token');
  });

  it('rejects invalid payload with validation details', async () => {
    const response = await PUT(buildPut({ id: '', title: '' }) as never, params(''));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Validation Failed');
    expect(body.details).toBeDefined();
  });

  it('updates a project and revalidates paths', async () => {
    updateProjectSqlMock.mockResolvedValue({ ...mockProject, title: 'Updated Project' });

    const response = await PUT(
      buildPut({ id: 'proj-1', title: 'Updated Project' }) as never,
      params('proj-1')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.project.title).toBe('Updated Project');
    expect(enforceProjectUpdateQuotaMock).toHaveBeenCalled();
    expect(updateProjectSqlMock).toHaveBeenCalledWith(
      'default-site',
      'proj-1',
      expect.objectContaining({ title: 'Updated Project' })
    );
    expect(revalidatePathMock).toHaveBeenCalledWith('/', 'layout');
    expect(revalidatePathMock).toHaveBeenCalledWith('/projects');
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin');
  });

  it('returns 404 when project not found for update', async () => {
    updateProjectSqlMock.mockResolvedValue(null);
    const response = await PUT(
      buildPut({ id: 'proj-1', title: 'Test' }) as never,
      params('proj-1')
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Project not found or update failed');
  });

  it('appends comments when initialCommentCount > 0', async () => {
    generateGenZCommentsMock.mockReturnValue([
      { id: 1, text: 'Love it!', isMe: false, time: '12:00' },
    ]);
    updateProjectSqlMock.mockResolvedValue(mockProject);
    valMock.mockReturnValue([{ id: 0, text: 'Existing', isMe: false, time: '11:00' }]);

    await PUT(
      buildPut({ id: 'proj-1', title: 'Test', initialCommentCount: 1 }) as never,
      params('proj-1')
    );

    expect(generateGenZCommentsMock).toHaveBeenCalledWith('test-project', 1);
    expect(setMock).toHaveBeenCalled();
  });

  it('persists submitted generated comments to the updated project slug', async () => {
    const submittedComments = [
      { id: 'generated-1', text: 'Keren banget!', name: 'AI', likes: 2, replies: [] },
    ];
    updateProjectSqlMock.mockResolvedValue({ ...mockProject, slug: 'test-project' });

    const response = await PUT(
      buildPut({ id: 'proj-1', title: 'Test', comments: submittedComments }) as never,
      params('proj-1')
    );

    expect(response.status).toBe(200);
    expect(refMock).toHaveBeenCalledWith('comments/default-site/test-project');
    expect(setMock).toHaveBeenCalledWith(submittedComments);
    expect(generateGenZCommentsMock).not.toHaveBeenCalled();
  });

  it('moves comments when project slug changes', async () => {
    const previousComments = [{ id: 'old-1', text: 'Old', name: 'User', likes: 0, replies: [] }];
    const generatedComments = [
      { id: 'new-1', text: 'Generated', name: 'AI', likes: 0, replies: [] },
    ];

    const oldCommentsRef = {
      once: vi.fn().mockResolvedValue({ val: () => previousComments }),
      remove: removeMock,
    };
    const newCommentsRef = {
      once: vi.fn().mockResolvedValue({ val: () => generatedComments }),
      set: setMock,
    };

    refMock.mockImplementation((path: string) => {
      if (path === 'comments/default-site/test-project') return oldCommentsRef;
      if (path === 'comments/default-site/new-slug') return newCommentsRef;
      return { once: onceMock, set: setMock, remove: removeMock };
    });
    updateProjectSqlMock.mockResolvedValue({ ...mockProject, slug: 'new-slug' });

    const response = await PUT(
      buildPut({ id: 'proj-1', slug: 'new-slug', title: 'Test' }) as never,
      params('proj-1')
    );

    expect(response.status).toBe(200);
    expect(setMock).toHaveBeenCalledWith([...generatedComments, ...previousComments]);
    expect(removeMock).toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith('/projects/test-project');
    expect(revalidatePathMock).toHaveBeenCalledWith('/projects/new-slug');
  });

  it('handles unexpected error in update', async () => {
    updateProjectSqlMock.mockRejectedValue(new Error('Crash'));
    const response = await PUT(
      buildPut({ id: 'proj-1', title: 'Test' }) as never,
      params('proj-1')
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Crash');
  });
});

describe('DELETE /api/projects/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    validateSiteMutationRequestMock.mockResolvedValue({ role: 'admin' });
    resolveProjectSiteIdMock.mockReturnValue('default-site');
    deleteProjectSqlMock.mockResolvedValue(true);
  });

  it('rejects unauthenticated deletes', async () => {
    validateSiteMutationRequestMock.mockResolvedValue(null);
    const response = await DELETE(buildDelete() as never, params('proj-1'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized or invalid CSRF token');
  });

  it('deletes a project and revalidates', async () => {
    const response = await DELETE(buildDelete() as never, params('proj-1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Project deleted successfully');
    expect(deleteProjectSqlMock).toHaveBeenCalledWith('default-site', 'proj-1');
    expect(revalidatePathMock).toHaveBeenCalled();
  });

  it('returns 404 when project not found for delete', async () => {
    deleteProjectSqlMock.mockResolvedValue(false);
    const response = await DELETE(buildDelete() as never, params('proj-1'));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Project not found or delete failed');
  });

  it('handles unexpected delete error', async () => {
    deleteProjectSqlMock.mockRejectedValue(new Error('Crash'));
    const response = await DELETE(buildDelete() as never, params('proj-1'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Crash');
  });
});
