'use client';

import type { Project } from '@/types/projects';
import { useMemo, useEffect, useRef, memo, useDeferredValue, useState, useCallback } from 'react';
import { LazyMotion, domAnimation, m, AnimatePresence, type Transition } from 'motion/react';
import ProjectCardPinterest from '@/components/projects/ProjectCardPinterest';
import MasonryGrid from '@/components/layout/MasonryGrid';
import { useProjectFiltering } from './hooks/useProjectFiltering';
import { useInfiniteScroll } from './hooks/useInfiniteScroll';
import { useQuickLook } from '@/components/os/hooks/useQuickLook';
import QuickLookModal from '@/components/ui/QuickLookModal';
import { resolveCover } from '@/lib/images';
import { useDictionary } from '@/contexts/LanguageContext';

import dynamic from 'next/dynamic';
import { useWindowContext } from '@/contexts/WindowContext';
import Projects3DView from '@/components/canvas/Projects3DView';

const ProjectDetailWrapper = dynamic(
  () => import('@/components/os/ui/ProjectDetailWrapper'),
  { ssr: false }
);

type Props = {
  projects: Project[];
  tag: string;
  searchQuery: string;
  windowWidth?: number;
  isLoading?: boolean;
  view?: 'grid' | '3d';
  siteId?: string;
};

const MemoizedProjectCardPinterest = memo(ProjectCardPinterest);

function ViewLoadingIndicator() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-400"></div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl bg-gray-100 dark:bg-neutral-800">
      <div className="aspect-[4/5] bg-gray-200 dark:bg-neutral-700" />
      <div className="space-y-2 p-3">
        <div className="h-3 w-2/3 rounded bg-gray-200 dark:bg-neutral-700" />
        <div className="h-2.5 w-1/2 rounded bg-gray-200 dark:bg-neutral-700" />
      </div>
    </div>
  );
}

// Pre-computed skeleton array — avoids re-creating on every render
const SKELETON_ITEMS = Array.from({ length: 6 }, (_, i) => <SkeletonCard key={`skel-${i}`} />);

export default function IndexClientInner({
  projects,
  tag,
  searchQuery,
  windowWidth,
  isLoading: isParentLoading,
  view = 'grid',
  siteId = 'default-site',
}: Props) {
  const t = useDictionary();
  const { filteredProjects } = useProjectFiltering(projects, tag, searchQuery);
  const { visibleCount, isLoadingMore, hasMore, resetCount, initialCount } = useInfiniteScroll(
    filteredProjects.length
  );
  const activeView = useDeferredValue(view);
  const isViewTransitioning = activeView !== view;

  const { openWindow, closeWindow, windows } = useWindowContext();

  const handleOpenProject = useCallback(
    (project: Project) => {
      // Close other open project windows to prevent multiple windows overlapping
      windows.forEach((w) => {
        if (w.id.startsWith('project-') && w.id !== `project-${project.id}`) {
          closeWindow(w.id);
        }
      });

      const initialPos =
        typeof window !== 'undefined'
          ? {
              x: Math.max(20, Math.round((window.innerWidth - 900) / 2)),
              y: Math.max(40, Math.round((window.innerHeight - 620) / 2)),
            }
          : { x: 100, y: 100 };

      openWindow(`project-${project.id}`, {
        title: `Portfolio: ${project.title}`,
        content: (
          <ProjectDetailWrapper
            project={project}
            projects={projects}
            siteId={siteId}
          />
        ),
        initialPosition: initialPos,
        width: 900,
        height: 620,
        noPadding: true,
        zIndex: 500,
      });
    },
    [openWindow, closeWindow, windows, projects, siteId]
  );

  // Quick Look
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  const [quickLookProject, setQuickLookProject] = useState<Project | null>(null);

  useQuickLook(!!hoveredProjectId && !quickLookProject, () => {
    const proj = filteredProjects.find((p) => p.id === hoveredProjectId);
    if (proj) setQuickLookProject(proj);
  });

  // Reset scroll count when filter changes
  const prevFilterHash = useRef('');
  useEffect(() => {
    const hash = `${tag}-${searchQuery}-${filteredProjects.length}`;
    if (hash !== prevFilterHash.current) {
      resetCount();
      prevFilterHash.current = hash;
    }
  }, [tag, searchQuery, filteredProjects.length, resetCount]);

  // Build looping display list via modulo — 20 projects repeat seamlessly
  const displayedItems = useMemo(() => {
    const len = filteredProjects.length;
    if (len === 0) return [];
    const items: { project: Project; key: string }[] = new Array(visibleCount);
    for (let i = 0; i < visibleCount; i++) {
      const project = filteredProjects[i % len];
      // Key format: slug-loopN-posN (unique per rendered instance)
      items[i] = { project, key: `${project.slug}-L${(i / len) | 0}-${i % len}` };
    }
    return items;
  }, [filteredProjects, visibleCount]);

  const gridPriorityCount = Math.min(initialCount, displayedItems.length);
  const gridEagerCount = Math.min(Math.max(initialCount, 20), displayedItems.length);

  const gridView = useMemo(
    () => (
      <MasonryGrid width={windowWidth}>
        {displayedItems.map((item, index) => {
          const isPriority = index < gridPriorityCount;
          const isEager = index < gridEagerCount;
          const animationProps = isPriority
            ? undefined
            : {
                initial: { opacity: 0, y: 20 },
                whileInView: { opacity: 1, y: 0 },
                viewport: { once: true, margin: '-30px' },
                transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } as Transition,
              };
          return (
            <m.div
              key={item.key}
              {...animationProps}
              style={{
                contentVisibility: 'auto',
                containIntrinsicSize: '300px',
                contain: 'layout paint style',
                transform: 'translateZ(0)',
              }}
              onMouseEnter={() => setHoveredProjectId(item.project.id)}
              onMouseLeave={() => setHoveredProjectId(null)}
            >
              <MemoizedProjectCardPinterest
                project={item.project}
                priority={isPriority}
                eager={isEager}
                videoEnabled={true}
                highlightedTag={tag}
                transitionOrigin="grid"
                onClick={() => handleOpenProject(item.project)}
              />
            </m.div>
          );
        })}
      </MasonryGrid>
    ),
    [displayedItems, windowWidth, tag, gridPriorityCount, gridEagerCount, handleOpenProject]
  );

  const showLoading = isParentLoading || isViewTransitioning;

  return (
    <section className={`${activeView === '3d' ? '' : 'px-4 pb-8 pt-4'}`} data-projects-grid>
      <h1 className="sr-only">{t.projects.srTitle}</h1>
      {tag && (
        <div className="mb-6 text-center">
          <span className="inline-block rounded-full bg-black px-4 py-2 text-sm text-white">
            {t.projects.filteredByTag}: <strong>{tag}</strong>
          </span>
        </div>
      )}
      <LazyMotion features={domAnimation}>
        <div className={activeView === '3d' ? 'fixed inset-0 z-0 overflow-hidden' : 'min-h-screen'}>
          {showLoading ? (
            <ViewLoadingIndicator />
          ) : displayedItems.length > 0 ? (
            <>
              {activeView === '3d' ? (
                <Projects3DView
                  projects={filteredProjects}
                  onSelectProject={handleOpenProject}
                />
              ) : (
                gridView
              )}
              {activeView === 'grid' && (
                <>
                  {/* Sentinel spacer for scroll detection */}
                  {hasMore && (
                    <div className="pointer-events-none h-10 w-full" aria-hidden="true" />
                  )}

                  {/* Loading skeletons */}
                  <AnimatePresence>
                    {isLoadingMore && (
                      <m.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:mt-4 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6"
                      >
                        {SKELETON_ITEMS}
                      </m.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </>
          ) : (
            <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
              <p className="mb-2 text-lg text-gray-600">
                {searchQuery
                  ? `${t.projects.noProjectsForSearch} "${searchQuery}"`
                  : tag
                    ? `${t.projects.noProjectsWithTag} "${tag}"`
                    : t.projects.noProjectsAvailable}
              </p>
            </div>
          )}
        </div>
      </LazyMotion>

      {/* Quick Look Modal */}
      {quickLookProject &&
        (() => {
          const cover = resolveCover(quickLookProject);
          return (
            <QuickLookModal
              isOpen={!!quickLookProject}
              onClose={() => setQuickLookProject(null)}
              title={quickLookProject.title}
              type={cover.kind}
              url={cover.src}
              metadata={quickLookProject.tags?.join(', ')}
              onGoToDetail={() => {
                setQuickLookProject(null);
                handleOpenProject(quickLookProject);
              }}
            />
          );
        })()}
    </section>
  );
}
