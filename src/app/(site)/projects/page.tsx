import type { Metadata } from 'next';
import { Suspense } from 'react';
import IndexClientWithAutoUpdate from '@/components/home/IndexClientWithAutoUpdate';
import { allProjectsAsync } from '@/lib/projects';
import { allLabelsAsync } from '@/lib/labels';
import SystemNavFrame from '@/components/layout/SystemNavFrame';
import QueryProvider from '@/components/layout/QueryProvider';
import ProjectsFinderHeader from './_components/ProjectsFinderHeader';
import { baseSEO } from '@/lib/seo';

// Public catalog can be cached by Cloudflare. Search/tag/view state is handled in
// client components wrapped with Suspense, so the shell can stay ISR-backed.
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Projects | Portfolio OS',
  description: 'Daftar lengkap project desain dan pengembangan dari portfolio demo.',
  alternates: {
    canonical: `${baseSEO.siteUrl}/projects`,
  },
};

export default async function ProjectsPage() {
  const projects = await allProjectsAsync();
  const labels = await allLabelsAsync();

  // allProjectsAsync() already filters drafts

  return (
    <SystemNavFrame>
      <main id="main-content" role="main" className="flex-1 bg-white">
        {/* Integrated Finder Header - Wrapped in Suspense for useSearchParams */}
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
            <IndexClientWithAutoUpdate initialProjects={projects} />
          </QueryProvider>
        </Suspense>
      </main>
    </SystemNavFrame>
  );
}
