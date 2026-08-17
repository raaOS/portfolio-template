import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import IndexClientWithAutoUpdate from '@/components/home/IndexClientWithAutoUpdate';
import { allProjectsAsync } from '@/lib/projects';
import { allLabelsAsync } from '@/lib/labels';
import SystemNavFrame from '@/components/layout/SystemNavFrame';
import QueryProvider from '@/components/layout/QueryProvider';
import ProjectsFinderHeader from '@/app/(site)/projects/_components/ProjectsFinderHeader';
import { getSiteBySlug } from '@/lib/adapters/siteDataAdapter';

export const revalidate = 60;

interface TenantProjectsPageProps {
  params: Promise<{ siteSlug: string }>;
}

export async function generateMetadata({ params }: TenantProjectsPageProps): Promise<Metadata> {
  const { siteSlug } = await params;
  const site = await getSiteBySlug(siteSlug);

  if (!site || site.status !== 'active') {
    return { title: 'Site Not Found' };
  }

  return {
    title: `Projects | ${site.name}`,
    description: `Daftar project dari ${site.name}.`,
  };
}

export default async function TenantProjectsPage({ params }: TenantProjectsPageProps) {
  const { siteSlug } = await params;
  const site = await getSiteBySlug(siteSlug);

  if (!site || site.status !== 'active') {
    notFound();
  }

  const [projects, labels] = await Promise.all([allProjectsAsync(site.id), allLabelsAsync(site.id)]);

  return (
    <SystemNavFrame>
      <main id="main-content" role="main" className="flex-1 bg-white">
        <Suspense
          fallback={
            <div className="mt-8 h-16 animate-pulse rounded bg-gray-50 px-4 py-4 sm:px-8" />
          }
        >
          <ProjectsFinderHeader itemCount={projects.length} labels={labels} />
        </Suspense>

        <Suspense
          fallback={
            <section className="px-4 py-24 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
              <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Memuat koleksi project...
              </p>
            </section>
          }
        >
          <QueryProvider>
            <IndexClientWithAutoUpdate initialProjects={projects} siteId={site.id} />
          </QueryProvider>
        </Suspense>
      </main>
    </SystemNavFrame>
  );
}
