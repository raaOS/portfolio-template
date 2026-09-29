import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSiteBySlug } from '@/lib/adapters/siteDataAdapter';
import { allProjectsAsync, getProjectBySlugAsync } from '@/lib/projects';
import ProjectDetailTwoColumn from '@/components/projects/ProjectDetailTwoColumn';
import { resolveCover, resolveGallery } from '@/lib/images';
import { generateProjectMetadata, generateStructuredData } from '@/lib/seo';

export const revalidate = 60;

interface TenantProjectPageProps {
  params: Promise<{ siteSlug: string; slug: string }>;
}

export async function generateMetadata({ params }: TenantProjectPageProps): Promise<Metadata> {
  const { siteSlug, slug } = await params;
  const site = await getSiteBySlug(siteSlug);
  if (!site || site.status !== 'active') {
    return { title: 'Site Not Found' };
  }

  const project = await getProjectBySlugAsync(slug, site.id);
  if (!project) {
    return { title: 'Project Not Found' };
  }

  return generateProjectMetadata(project);
}

export default async function TenantProjectPage({ params }: TenantProjectPageProps) {
  const { siteSlug, slug } = await params;
  const site = await getSiteBySlug(siteSlug);

  if (!site || site.status !== 'active') {
    notFound();
  }

  const projects = await allProjectsAsync(site.id);
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
          // SECURITY FIX (audit 2026-09-29): escape `<` agar judul/deskripsi
          // project yang mengandung `</script>` tidak menutup tag & mengeksekusi
          // skrip (stored XSS via konten project).
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
        siteId={site.id}
        isWindowMode={false}
      />
    </main>
  );
}
