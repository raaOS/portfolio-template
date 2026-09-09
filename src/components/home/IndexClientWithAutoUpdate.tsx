'use client';

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Project } from '@/types/projects';
import { useSearchParams } from 'next/navigation';
import { useLastUpdated } from '@/contexts/LastUpdatedContext';
import { POLLING } from '@/lib/constants';
import IndexClientInner from './IndexClientInner';
import { useDictionary } from '@/contexts/LanguageContext';

type Props = {
  initialProjects?: Project[];
  siteId?: string;
  windowWidth?: number;
};

interface ProjectsResponse {
  projects: Project[];
  lastUpdated: string;
}

export default function IndexClientWithAutoUpdate({
  initialProjects: serverProjects = [],
  siteId,
  windowWidth,
}: Props) {
  const t = useDictionary();
  // Safe context access
  const context = useLastUpdated();
  const contextLastUpdated = context?.lastUpdated;
  // Use useMemo to avoid recreating function on every render
  const setLastUpdated = useMemo(
    () => context?.setLastUpdated || (() => {}),
    [context?.setLastUpdated]
  );
  const searchParams = useSearchParams();
  const tag = searchParams?.get('tag') || '';
  const searchQuery = searchParams?.get('q') || '';
  const rawView = searchParams?.get('view');
  const view = rawView === '3d' ? '3d' : 'grid';

  // BUG FIX #4: Sync ref with context value on mount to prevent unnecessary updates
  const prevLastUpdated = useRef<string>(
    contextLastUpdated ? contextLastUpdated.toISOString() : ''
  );

  // BUG FIX #2: useCallback untuk mencegah stale closure dan restart interval
  // BUG FIX #8: Di client component, pakai relative path supaya browser
  // otomatis pakai origin saat ini. Sebelumnya pakai NEXT_PUBLIC_SITE_URL
  // yang kalau di-set ke URL produksi, fetch dari localhost akan gagal
  // karena cross-origin (CORS) atau production deployment down → menampilkan
  // "TypeError: Failed to fetch" di dev.
  const fetchProjects = useCallback(async (): Promise<ProjectsResponse> => {
    const params = new URLSearchParams({ status: 'published' });
    if (siteId) {
      params.set('siteId', siteId);
    }

    const response = await fetch(`/api/projects?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch projects');
    }
    const json = await response.json();
    // API wraps response in { success, data: { projects, lastUpdated } }
    // Extract the inner data object
    return json.data ?? json;
  }, [siteId]);

  // BUG FIX #5: Valid timestamp untuk initialData
  const initialData =
    serverProjects.length > 0
      ? {
          projects: serverProjects,
          lastUpdated: new Date().toISOString(), // Gunakan timestamp sekarang, bukan string kosong
        }
      : undefined;

  const { data, isError, error, isLoading } = useQuery({
    queryKey: ['projects', 'published', siteId ?? 'default-site'],
    queryFn: fetchProjects,
    refetchInterval: POLLING.UPDATE_INTERVAL,
    structuralSharing: true,
    staleTime: 2000,
    initialData,
  });

  const projects = data?.projects ?? serverProjects;
  const lastUpdatedStr = data?.lastUpdated;

  // BUG FIX #4 & #5: Sync lastUpdated context dengan guard yang lebih baik
  useEffect(() => {
    if (lastUpdatedStr) {
      // Parse dan validasi date
      const newDate = new Date(lastUpdatedStr);
      if (isNaN(newDate.getTime())) {
        console.warn('[IndexClientWithAutoUpdate] Invalid date received:', lastUpdatedStr);
        return;
      }

      // Hanya update kalau benar-benar berbeda dari ref
      if (lastUpdatedStr !== prevLastUpdated.current) {
        prevLastUpdated.current = lastUpdatedStr;
        setLastUpdated(newDate);
      }
    }
  }, [lastUpdatedStr, setLastUpdated]);

  // BUG FIX #5: Log error untuk debugging
  useEffect(() => {
    if (isError && error) {
      console.error('[IndexClientWithAutoUpdate] Failed to fetch projects:', error);
    }
  }, [isError, error]);

  return (
    <div>
      {/* BUG FIX #5: Error state indicator */}
      {isError && (
        <div className="border border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-red-700">
          {t.projects.loadLatestError}
        </div>
      )}

      <IndexClientInner
        projects={projects}
        tag={tag}
        searchQuery={searchQuery}
        windowWidth={windowWidth}
        isLoading={isLoading}
        siteId={siteId}
        view={view}
      />
    </div>
  );
}
