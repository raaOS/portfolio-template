'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransitionRouter } from 'next-view-transitions';
import { Grid, Filter, Search as SearchIcon, X, Check, Box } from 'lucide-react';
import { saveProjectsViewMode } from '@/lib/projectsViewMode';
import { useDictionary } from '@/contexts/LanguageContext';
import { buildTenantProjectsHref } from '@/lib/routing/tenantRoutes';

import { Label } from '@/types/labels';

interface ProjectsFinderHeaderProps {
  itemCount: number;
  labels?: Label[];
}

export default function ProjectsFinderHeader({
  itemCount,
  labels = [],
}: ProjectsFinderHeaderProps) {
  const t = useDictionary();
  const router = useRouter();
  // Router khusus untuk transisi visual saat ganti mode grid ↔ 3D canvas
  const vtRouter = useTransitionRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  // FIX: Remove useTransition - not needed for simple router.push
  const [isNavigating, setIsNavigating] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const rawView = searchParams?.get('view');
  const currentView = rawView === '3d' ? '3d' : 'grid';
  const currentTag = searchParams?.get('tag') || '';
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Add "All" option to labels
  const allCategories = [{ name: t.projects.allWorks, slug: '' }, ...labels];

  useEffect(() => {
    const query = searchParams?.get('q') || '';
    const frame = requestAnimationFrame(() => {
      setSearchQuery(query);
      setIsMounted(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [searchParams]);

  // Persist mode terakhir agar tombol "Back to Projects" di halaman detail
  // bisa kembali ke mode yang sama (grid atau 3D canvas).
  useEffect(() => {
    saveProjectsViewMode(currentView);
  }, [currentView]);

  // Close filter when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounce search update to URL
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentQ = searchParams?.get('q') || '';
      // Skip push if nothing actually changed (prevents init re-render)
      if (searchQuery === currentQ) return;

      const params = new URLSearchParams(searchParams?.toString());
      if (searchQuery) {
        params.set('q', searchQuery);
      } else {
        params.delete('q');
      }
      // FIX: Direct router.push without startTransition
      setIsNavigating(true);
      router.push(buildTenantProjectsHref(pathname, params.toString()), { scroll: false });
      // Reset navigating state after a short delay
      setTimeout(() => setIsNavigating(false), 300);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, router, searchParams, pathname]);

  const handleViewChange = (view: 'grid' | '3d') => {
    if (view === currentView) return;
    const params = new URLSearchParams(searchParams?.toString());
    params.set('view', view);
    // Pakai vtRouter biar ganti mode grid <-> 3D canvas dapat slide animation
    setIsNavigating(true);
    vtRouter.push(buildTenantProjectsHref(pathname, params.toString()), { scroll: false });
    setTimeout(() => setIsNavigating(false), 300);
  };

  const handleTagChange = (tag: string) => {
    const params = new URLSearchParams(searchParams?.toString());
    if (tag) {
      params.set('tag', tag);
    } else {
      params.delete('tag');
    }
    setIsFilterOpen(false);
    // FIX: Direct router.push without startTransition
    setIsNavigating(true);
    router.push(buildTenantProjectsHref(pathname, params.toString()), { scroll: false });
    setTimeout(() => setIsNavigating(false), 300);
  };

  const handleClear = () => {
    setSearchQuery('');
  };

  return (
    <div className="relative z-50 mt-8 flex flex-col items-center justify-between gap-4 px-4 py-4 sm:flex-row sm:px-8">


      {/* Search Input Integrated into Header */}
      <div
        className={`relative order-3 mx-auto w-full max-w-md transition-opacity duration-200 sm:order-2 sm:mx-0 ${isNavigating ? 'opacity-70' : 'opacity-100'}`}
      >
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t.projects.searchPlaceholder}
          className="w-full rounded-md border border-gray-300 bg-gray-200/50 py-2 pl-10 pr-9 text-sm text-gray-900 transition-all duration-200 focus:border-blue-500/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-gray-100 dark:focus:bg-neutral-900"
        />
        {isMounted && searchQuery && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
            aria-label="Clear search"
          >
            <X className="h-4 w-4 text-red-500" />
          </button>
        )}
      </div>

      {/* View Mode & Filter Buttons */}
      <div className="order-2 flex w-full items-center justify-between gap-2 sm:order-3 sm:w-auto sm:justify-end">
        {!isMounted ? (
          <div className="flex items-center gap-1" aria-hidden="true">
            <div className="h-7 w-7 p-1.5" />
            <div className="h-7 w-7 p-1.5" />
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleViewChange('grid')}
              className={`p-1 transition-all duration-200 ${currentView === 'grid' ? 'scale-110 text-emerald-500 drop-shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
              title={t.projects.gridView}
              aria-label={t.projects.gridView}
              aria-pressed={currentView === 'grid'}
            >
              <Grid size={18} />
            </button>
            <button
              onClick={() => handleViewChange('3d')}
              className={`p-1 transition-all duration-200 ${currentView === '3d' ? 'scale-110 text-blue-500 drop-shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
              title={t.projects.view3d}
              aria-label={t.projects.view3d}
              aria-pressed={currentView === '3d'}
            >
              <Box size={18} />
            </button>
          </div>
        )}

        {/* Filter Dropdown */}
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`flex items-center gap-2 rounded-md border px-4 py-2 text-[10px] font-black uppercase leading-none tracking-widest shadow-sm transition-all ${currentTag ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-300 dark:hover:bg-neutral-800'}`}
            aria-expanded={isFilterOpen}
            aria-haspopup="listbox"
          >
            <Filter size={12} />{' '}
            {currentTag
              ? allCategories.find((c) => c.slug === currentTag)?.name
              : t.projects.filter}
          </button>

          {isFilterOpen && (
            <div
              className="animate-in fade-in zoom-in absolute right-0 z-[100] mt-2 w-48 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-xl duration-200 dark:border-neutral-800 dark:bg-neutral-900"
              role="listbox"
              aria-label="Filter categories"
            >
              {allCategories.map((cat) => (
                <button
                  key={cat.slug}
                  onClick={() => handleTagChange(cat.slug)}
                  className={`flex w-full items-center justify-between px-4 py-2 text-left text-xs transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20 ${currentTag === cat.slug ? 'font-bold text-blue-600' : 'text-gray-700 dark:text-gray-300'}`}
                  role="option"
                  aria-selected={currentTag === cat.slug}
                >
                  {cat.name}
                  {currentTag === cat.slug && <Check size={12} className="text-blue-600" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
