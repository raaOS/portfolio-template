import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getProjectBySlugAsyncMock, allProjectsAsyncMock } = vi.hoisted(() => ({
  getProjectBySlugAsyncMock: vi.fn(),
  allProjectsAsyncMock: vi.fn(),
}));

vi.mock('@/lib/projects', () => ({
  getProjectBySlugAsync: getProjectBySlugAsyncMock,
  allProjectsAsync: allProjectsAsyncMock,
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
}));

import { generateMetadata, revalidate } from './page';

describe('projects/[slug]/page', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('uses a slug-specific lookup for metadata and leaves list fetching unused', async () => {
    getProjectBySlugAsyncMock.mockResolvedValue({
      title: 'Case Study',
      description: 'Project description',
      cover: '/cover.jpg',
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'case-study' }),
    });

    expect(revalidate).toBe(60);
    expect(getProjectBySlugAsyncMock).toHaveBeenCalledWith('case-study');
    expect(allProjectsAsyncMock).not.toHaveBeenCalled();
    expect(metadata.title).toBe('Case Study | Portfolio OS - Creative Portfolio');
  });
});
