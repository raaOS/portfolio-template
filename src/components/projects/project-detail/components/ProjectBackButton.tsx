'use client';

import { useSyncExternalStore } from 'react';
import { Link } from 'next-view-transitions';
import { ArrowLeft } from 'lucide-react';
import {
  buildProjectsHref,
  getProjectsViewModeServerSnapshot,
  readProjectsViewMode,
  subscribeProjectsViewMode,
} from '@/lib/projectsViewMode';
import { markBack } from '@/lib/navigationDirection';
import { cancelProjectCoverTransition } from '@/lib/projectCoverTransition';

interface ProjectBackButtonProps {
  label?: string;
  className?: string;
}

export function ProjectBackButton({
  label = 'Back to Projects',
  className,
}: ProjectBackButtonProps) {
  // SSR-safe read dari sessionStorage via useSyncExternalStore.
  // Server snapshot selalu 'grid' (default) agar tidak hydration mismatch.
  // Client snapshot baca sessionStorage, re-read otomatis bila mode berubah.
  const mode = useSyncExternalStore(
    subscribeProjectsViewMode,
    readProjectsViewMode,
    getProjectsViewModeServerSnapshot
  );

  const handleClickCapture = () => {
    if (mode === 'grid') {
      cancelProjectCoverTransition();
    }
    markBack();
  };

  return (
    <Link
      href={buildProjectsHref(mode)}
      scroll={false}
      // Tandai navigasi ini sebagai "back" agar slide dari arah kiri.
      // Pakai onClickCapture agar set attribute SEBELUM next-view-transitions
      // trigger document.startViewTransition (React capture phase jalan duluan).
      onClickCapture={handleClickCapture}
      className={
        className ||
        'mb-4 inline-flex touch-manipulation items-center gap-2 text-gray-600 transition-colors duration-200 hover:text-black dark:text-gray-400 dark:hover:text-white sm:mb-6'
      }
    >
      <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
      <span className="text-sm sm:text-base">{label}</span>
    </Link>
  );
}
