import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { allProjectsAsync, getProjectBySlugAsync } from '@/lib/projects';
import ProjectDetailTwoColumn from '@/components/projects/ProjectDetailTwoColumn';
import { resolveCover, resolveGallery } from '@/lib/images';
import { generateProjectMetadata, generateStructuredData } from '@/lib/seo';

export const revalidate = 60;

interface ProjectPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProjectBySlugAsync(slug);

  if (!project) {
    return {
      title: 'Project Not Found',
    };
  }

  return generateProjectMetadata(project);
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const projects = await allProjectsAsync();
  const project = projects.find((p) => p.slug === slug && p.status !== 'draft');

  if (!project) {
    notFound();
  }

  const otherProjects = projects.filter((p) => p.id !== project.id);
  const cover = resolveCover(project);
  const gallery = resolveGallery(project);

  const ratio =
    project.coverWidth && project.coverHeight ? project.coverWidth / project.coverHeight : 16 / 9;

  return (
    <main className="min-h-screen bg-white dark:bg-gray-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          // SECURITY FIX (audit 2026-09-29): escape `<` cegah stored XSS
          // via judul/deskripsi project di dalam blok JSON-LD.
          __html: JSON.stringify(
            generateStructuredData('project', {
              title: project.title,
              description: project.description || '',
              cover: cover,
              tags: project.tags,
              client: project.client || undefined,
              year: project.year,
              slug: project.slug,
            })
          ).replace(/</g, '\\u003c'),
        }}
      />
      <ProjectDetailTwoColumn
        project={project}
        cover={cover}
        gallery={gallery}
        ratio={ratio}
        otherProjects={otherProjects}
        isWindowMode={false}
      />
    </main>
  );
}
