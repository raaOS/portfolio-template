import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  validateAdminRequestMock,
  getProjectsSqlMock,
  createProjectSqlMock,
  enforceProjectCreateQuotaMock,
  resolveProjectSiteIdMock,
  refMock,
  setMock,
  revalidatePathMock,
  generateGenZCommentsMock,
  validateSiteMutationRequestMock,
} = vi.hoisted(() => ({
  validateAdminRequestMock: vi.fn(),
  getProjectsSqlMock: vi.fn(),
  createProjectSqlMock: vi.fn(),
  enforceProjectCreateQuotaMock: vi.fn(),
  resolveProjectSiteIdMock: vi.fn(),
  refMock: vi.fn(),
  setMock: vi.fn(),
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
    getProjectsSql: getProjectsSqlMock,
    createProjectSql: createProjectSqlMock,
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
    enforceProjectCreateQuota: enforceProjectCreateQuotaMock,
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

import { GET, POST } from './route';

const validProjectPayload = {
  title: 'Test Project',
  client: 'Test Client',
  year: 2025,
  tags: ['web', 'design'],
  description: 'A test project description',
  cover: '/r2/assets/projects/test/cover.jpg',
  likes: 0,
  shares: 0,
  status: 'published' as const,
};

const mockProject = {
  id: 'proj-1',
  slug: 'test-project',
  title: 'Test Project',
  client: 'Test Client',
  year: 2025,
  tags: ['web', 'design'],
  description: 'A test project description',
  cover: '/r2/assets/projects/test/cover.jpg',
  coverWidth: 800,
  coverHeight: 600,
  likes: 0,
  shares: 0,
  status: 'published' as const,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

function buildGet(url: string): Request {
  return new Request(`http://localhost/api/projects${url}`, { method: 'GET' });
}

function buildPost(body: unknown): Request {
  return new Request('http://localhost/api/projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/projects', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resolveProjectSiteIdMock.mockReturnValue('default-site');
    getProjectsSqlMock.mockResolvedValue({
      projects: [mockProject],
      lastUpdated: '2025-01-01T00:00:00Z',
    });
  });

  it('returns project list with resolved URLs', async () => {
    const response = await GET(buildGet('?status=published') as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.projects).toHaveLength(1);
    expect(body.data.lastUpdated).toBe('2025-01-01T00:00:00Z');
  });

  it('passes status filter to service', async () => {
    await GET(buildGet('?status=draft') as never);
    expect(getProjectsSqlMock).toHaveBeenCalledWith('default-site', 'published');
  });

  it('uses SQL service even when legacy fresh flag is present', async () => {
    await GET(buildGet('?fresh=true') as never);
    expect(getProjectsSqlMock).toHaveBeenCalledWith('default-site', 'published');
  });

  it('returns server error on service failure', async () => {
    getProjectsSqlMock.mockRejectedValue(new Error('DB down'));
    const response = await GET(buildGet('') as never);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Failed to load projects');
  });
});

describe('POST /api/projects', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    validateSiteMutationRequestMock.mockResolvedValue({ role: 'admin' });
    createProjectSqlMock.mockResolvedValue(mockProject);
    enforceProjectCreateQuotaMock.mockResolvedValue(undefined);
    resolveProjectSiteIdMock.mockReturnValue('default-site');
    refMock.mockReturnValue({ set: setMock });
    setMock.mockResolvedValue(undefined);
    generateGenZCommentsMock.mockReturnValue([]);
  });

  it('rejects unauthenticated requests', async () => {
    validateSiteMutationRequestMock.mockResolvedValue(null);
    const response = await POST(buildPost(validProjectPayload) as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Invalid or missing CSRF token');
  });

  it('rejects invalid payloads', async () => {
    const response = await POST(buildPost({}) as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Validation failed');
    expect(createProjectSqlMock).not.toHaveBeenCalled();
  });

  it('creates a project and triggers revalidation', async () => {
    const response = await POST(buildPost(validProjectPayload) as never);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('proj-1');
    expect(enforceProjectCreateQuotaMock).toHaveBeenCalled();
    expect(createProjectSqlMock).toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith('/', 'layout');
    expect(revalidatePathMock).toHaveBeenCalledWith('/projects');
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin');
  });

  it('does not generate comments when initialCommentCount is 0', async () => {
    await POST(buildPost(validProjectPayload) as never);
    expect(generateGenZCommentsMock).not.toHaveBeenCalled();
  });

  it('generates comments when initialCommentCount > 0', async () => {
    generateGenZCommentsMock.mockReturnValue([
      { id: 1, text: 'Nice!', isMe: false, time: '12:00' },
    ]);

    await POST(buildPost({ ...validProjectPayload, initialCommentCount: 2 }) as never);

    expect(generateGenZCommentsMock).toHaveBeenCalledWith('test-project', 2);
    expect(refMock).toHaveBeenCalledWith('comments/default-site/test-project');
  });

  it('handles service ZodError as validation error', async () => {
    const { ZodError } = await import('zod');
    createProjectSqlMock.mockRejectedValue(new ZodError([]));
    const response = await POST(buildPost(validProjectPayload) as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('returns server error on unexpected failure', async () => {
    createProjectSqlMock.mockRejectedValue(new Error('Unexpected'));
    const response = await POST(buildPost(validProjectPayload) as never);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Failed to create project');
  });

  it('converts year correctly when passed as number', async () => {
    await POST(buildPost({ ...validProjectPayload, year: 2025 }) as never);

    const callArg = createProjectSqlMock.mock.calls[0][1];
    expect(callArg.year).toBe(2025);
  });

  it('returns quota errors from the site quota guard', async () => {
    const { ProjectQuotaError } = await import('@/lib/admin/projectSiteContext');
    enforceProjectCreateQuotaMock.mockRejectedValue(
      new ProjectQuotaError('Project quota exceeded. Limit: 5', 'PROJECT_LIMIT_EXCEEDED', {
        limit: 5,
      })
    );

    const response = await POST(buildPost(validProjectPayload) as never);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('PROJECT_LIMIT_EXCEEDED');
    expect(createProjectSqlMock).not.toHaveBeenCalled();
  });
});
