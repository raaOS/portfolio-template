'use client';

import { useState, useEffect, useRef, useCallback, useSyncExternalStore, memo } from 'react';
import { motion } from 'motion/react';
import type { Project } from '@/types/projects';
import MasonryGrid from '@/components/layout/MasonryGrid';
import ProjectCardPinterest from '@/components/projects/ProjectCardPinterest';

const INITIAL_COUNT = 5;
const BATCH_SIZE = 24;

// Static animation config — never recreated
const ANIMATION_CONFIG = {
  initial: { y: 30 },
  whileInView: { y: 0 },
  viewport: { once: true, margin: '100px' },
  transition: { duration: 0.4, ease: 'easeOut' as const },
};

interface UseInfiniteProjectsReturn {
  displayedProjects: Project[];
  isLoading: boolean;
  observerTarget: React.RefObject<HTMLDivElement>;
}

/**
 * Infinite scroll hook for project detail related projects.
 * Uses IntersectionObserver (stable — not recreated on state change).
 */
export function useInfiniteProjects(projects: Project[]): UseInfiniteProjectsReturn {
  const subscribe = useCallback(() => () => {}, []);
  const hasMounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

  const [displayedProjects, setDisplayedProjects] = useState<Project[]>(() =>
    projects.slice(0, INITIAL_COUNT)
  );
  const [isLoading, setIsLoading] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null!);

  // Refs for stable observer callback
  const loadingRef = useRef(false);
  const countRef = useRef(INITIAL_COUNT);

  const loadMore = useCallback(() => {
    if (loadingRef.current || projects.length === 0) return;

    loadingRef.current = true;
    setIsLoading(true);

    const current = countRef.current;
    const nextBatch: Project[] = new Array(BATCH_SIZE);
    for (let i = 0; i < BATCH_SIZE; i++) {
      nextBatch[i] = projects[(current + i) % projects.length];
    }

    setDisplayedProjects((prev) => {
      const next = [...prev, ...nextBatch];
      countRef.current = next.length;
      return next;
    });

    // Short delay for skeleton flash
    setTimeout(() => {
      loadingRef.current = false;
      setIsLoading(false);
    }, 50);
  }, [projects]);

  // Stable observer — mounted once, never recreated
  useEffect(() => {
    if (!hasMounted) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '800px 0px', threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMounted, loadMore]);

  return { displayedProjects, isLoading, observerTarget };
}

// Shared card item component — used by both ProjectRelated and ProjectRelatedColumn
const RelatedCardItem = memo(function RelatedCardItem({
  project,
  index,
}: {
  project: Project;
  index: number;
}) {
  const isPriority = index < 4;
  const isEager = index < 12;

  if (isPriority) {
    return (
      <div>
        <ProjectCardPinterest
          project={project}
          priority={true}
          eager={true}
          transitionOrigin="slug-related"
        />
      </div>
    );
  }

  return (
    <motion.div {...ANIMATION_CONFIG}>
      <ProjectCardPinterest
        project={project}
        priority={false}
        eager={isEager}
        transitionOrigin="slug-related"
      />
    </motion.div>
  );
});

interface ProjectRelatedProps {
  projects: Project[];
}

export function ProjectRelated({ projects }: ProjectRelatedProps) {
  const { displayedProjects, isLoading, observerTarget } = useInfiniteProjects(projects);

  return (
    <>
      <MasonryGrid columns="sidebar">
        {displayedProjects.map((p: Project, index: number) => (
          <RelatedCardItem key={`related-${p.slug}-${index}`} project={p} index={index} />
        ))}
      </MasonryGrid>

      <div ref={observerTarget} className="pointer-events-none h-10 w-full" aria-hidden="true" />
      {isLoading && (
        <div className="py-6 text-center opacity-50 sm:py-8">
          <div className="inline-block h-5 w-5 animate-spin rounded-full border-b-2 border-gray-400 sm:h-6 sm:w-6"></div>
          <p className="mt-2 text-xs text-gray-500">Memuat lebih banyak project...</p>
        </div>
      )}
    </>
  );
}

interface ProjectRelatedColumnProps {
  projects: Project[];
  column: 'A' | 'B';
}

export function ProjectRelatedColumn({ projects, column }: ProjectRelatedColumnProps) {
  return (
    <div className={column === 'B' ? 'lg:w-1/2' : ''}>
      <MasonryGrid columns="sidebar">
        {projects.map((p: Project, index: number) => (
          <RelatedCardItem key={`col-${column}-${p.slug}-${index}`} project={p} index={index} />
        ))}
      </MasonryGrid>
    </div>
  );
}
