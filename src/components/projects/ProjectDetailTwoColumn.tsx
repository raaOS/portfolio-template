'use client';

import { useMemo, useCallback, useState, useSyncExternalStore } from 'react';
import type { Project, GalleryItem } from '@/types/projects';
import { motion, AnimatePresence } from 'motion/react';
import { Info, BookOpen, Image, MessageSquare } from 'lucide-react';
import LightboxGallery from '@/components/ui/LightboxGallery';
import { useLanguage } from '@/contexts/LanguageContext';
import { localizeProject, localizeText } from '@/lib/i18n/contentLocalization';
import { useProjectDetail } from './project-detail/hooks';
import {
  ProjectBackButton,
  ProjectCover,
  ProjectHeader,
  ProjectInteractionBar,
  ProjectRelatedColumn,
  ProjectComments,
  useInfiniteProjects,
} from './project-detail/components';
import ProjectDetailTabsPane, {
  type ProjectWindowTab,
  type ProjectWindowTabId,
} from './project-detail/components/ProjectDetailTabsPane';

interface ProjectDetailTwoColumnProps {
  project: Project;
  cover: GalleryItem;
  gallery: GalleryItem[];
  ratio: number;
  otherProjects: Project[];
  siteId?: string;
  isWindowMode?: boolean;
}

export default function ProjectDetailTwoColumn({
  project,
  cover,
  gallery,
  ratio,
  otherProjects,
  siteId = 'default-site',
  isWindowMode = false,
}: ProjectDetailTwoColumnProps) {
  const { locale } = useLanguage();
  const localizedProject = useMemo(() => localizeProject(project, locale), [locale, project]);

  // SSR-safe mount detection without triggering set-state-in-effect lint
  const subscribe = useCallback(() => () => {}, []);
  const hasMounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

  const {
    comments,
    setComments,
    isProjectLiked,
    metrics,
    isLikePending,
    translations,
    translateLoading,
    activeGalleryGroup,
    setActiveGalleryGroup,
    activeNarrativeTab,
    setActiveNarrativeTab,
    handleProjectLike,
    handleProjectShare,
    translateAll,
  } = useProjectDetail({ project, siteId });
  const displayProject = translations ? project : localizedProject;
  const isEnglish = locale === 'en' || !!translations;

  const [activeWindowTab, setActiveWindowTab] = useState<ProjectWindowTabId>('overview');
  const [isLeftColumnHovered, setIsLeftColumnHovered] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);

  const commentsSectionId = useMemo(() => `comments-section-${project.id}`, [project.id]);

  const handleScrollToComments = useCallback(() => {
    if (isWindowMode) {
      setIsCommentsOpen((prev) => !prev);
      return;
    }

    // Toggle overlay in page mode too to match window comments experience
    setIsCommentsOpen((prev) => !prev);
  }, [isWindowMode]);

  // Memoize container class to prevent recreation
  const containerClassName = useMemo(() => {
    return isWindowMode
      ? 'h-full overflow-y-auto p-3 sm:p-4 lg:p-6'
      : 'min-h-screen pt-10 sm:pt-12 px-3 sm:px-4 lg:px-6 pb-8';
  }, [isWindowMode]);

  // Infinity Scroll Logic
  const { displayedProjects, isLoading, observerTarget } = useInfiniteProjects(otherProjects);

  // Memoize column projects to prevent array recreation
  const columnAProjects = useMemo(() => {
    if (isWindowMode) return [];
    return displayedProjects.filter((_, idx) => idx % 2 !== 0);
  }, [displayedProjects, isWindowMode]);

  const columnBProjects = useMemo(() => {
    if (isWindowMode) return [];
    return displayedProjects.filter((_, idx) => idx % 2 === 0);
  }, [displayedProjects, isWindowMode]);

  const projectBadges = (
    <div className="mt-4 flex flex-wrap gap-1.5 sm:gap-2">
      {project.client && (
        <span className="inline-flex h-5 items-center rounded-full bg-gray-100 px-3 text-xs leading-none text-gray-600 transition-colors duration-300 dark:bg-gray-800 dark:text-gray-400">
          {project.client}
        </span>
      )}
      {project.year && (
        <span className="inline-flex h-5 items-center rounded-full bg-gray-100 px-3 text-xs leading-none text-gray-600 transition-colors duration-300 dark:bg-gray-800 dark:text-gray-400">
          {project.year}
        </span>
      )}
    </div>
  );

  // Unified tabs definition
  const hasGroupedGallery = project.galleryGroups && project.galleryGroups.length > 0;
  const totalGalleryCount =
    gallery.length + (project.galleryGroups?.reduce((acc, g) => acc + g.items.length, 0) || 0);

  const windowTabs = useMemo<ProjectWindowTab[]>(() => {
    return [
      {
        id: 'overview' as const,
        label: isEnglish ? 'Overview' : 'Ringkasan',
        icon: Info,
        show: true,
      },
      {
        id: 'story' as const,
        label: isEnglish ? 'Story' : 'Proses',
        icon: BookOpen,
        show: !!displayProject.narrative,
      },
      {
        id: 'gallery' as const,
        label: isEnglish ? 'Gallery' : 'Galeri',
        icon: Image,
        show: gallery.length > 0 || hasGroupedGallery,
        count: totalGalleryCount,
      },
    ]
      .filter((tab) => tab.show)
      .map(({ show: _show, ...tab }) => tab);
  }, [displayProject.narrative, gallery.length, hasGroupedGallery, isEnglish, totalGalleryCount]);

  // Window split layout helper
  const renderSplitContent = () => {
    return (
      <div className="flex h-full w-full select-text flex-col overflow-hidden bg-white transition-colors duration-300 dark:bg-black md:flex-row">
        {/* Left Column: Media & Core Interaction */}
        <div
          onMouseEnter={() => setIsLeftColumnHovered(true)}
          onMouseLeave={() => {
            setIsLeftColumnHovered(false);
            setIsCommentsOpen(false);
          }}
          className="relative flex h-full w-full items-center justify-center overflow-hidden border-b border-black/10 bg-gray-50/50 dark:border-white/10 dark:bg-gray-900/10 md:w-[42%] md:border-b-0 md:border-r"
          data-no-window-drag
        >
          <div
            className="relative w-full transition-[padding] duration-300 ease-out"
            style={{ padding: isLeftColumnHovered || !isWindowMode ? '0 24px' : '0' }}
          >
            <ProjectCover
              project={displayProject}
              cover={cover}
              ratio={ratio}
              isWindowMode={true}
              enableViewTransition={!isWindowMode}
            />

            <motion.div
              className="absolute inset-y-0 right-1 z-20 flex items-center"
              initial={{ x: 50, opacity: 0 }}
              animate={{
                x: isLeftColumnHovered || !isWindowMode ? 0 : 50,
                opacity: isLeftColumnHovered || !isWindowMode ? 1 : 0,
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <ProjectInteractionBar
                isProjectLiked={isProjectLiked}
                metrics={metrics}
                comments={comments}
                translations={translations}
                translateLoading={translateLoading}
                likePending={isLikePending}
                onLike={handleProjectLike}
                onShare={handleProjectShare}
                onTranslate={translateAll}
                onScrollToComments={handleScrollToComments}
                orientation="vertical"
                projectSlug={project.slug}
              />
            </motion.div>
          </div>

          <AnimatePresence>
            {isCommentsOpen && (
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                className="absolute inset-0 z-30 flex flex-col bg-white/95 backdrop-blur-xl dark:bg-black/95"
              >
                <div className="flex flex-shrink-0 items-center justify-between border-b border-black/5 px-4 py-3 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={14} className="text-indigo-500" />
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                      {isEnglish ? 'Reviews' : 'Ulasan'}
                    </span>
                    {comments.length > 0 && (
                      <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                        {comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0)}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setIsCommentsOpen(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <ProjectComments
                    slug={project.slug}
                    siteId={siteId}
                    comments={comments}
                    setComments={setComments}
                    allowComments={project.allowComments}
                    sectionId={commentsSectionId}
                    withDivider={false}
                    isVisible={true}
                    animated={false}
                    className="w-full"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Tabbed Content (Header, Tabs Navigation, Tab Panels) */}
        <div
          className="flex h-full flex-1 flex-col overflow-hidden bg-white dark:bg-black"
          data-no-window-drag
        >
          <div className="flex-shrink-0 border-b border-black/5 p-5 dark:border-white/5 sm:p-6">
            <ProjectHeader
              project={displayProject}
              translations={translations}
              isWindowMode={true}
            />
          </div>

          <ProjectDetailTabsPane
            project={displayProject}
            gallery={gallery}
            translations={translations}
            isEnglish={isEnglish}
            isWindowMode={true}
            tabs={windowTabs}
            activeTab={activeWindowTab}
            onTabChange={setActiveWindowTab}
            projectBadges={projectBadges}
            activeNarrativeTab={activeNarrativeTab}
            onNarrativeTabChange={setActiveNarrativeTab}
            onGalleryGroupClick={setActiveGalleryGroup}
          />
        </div>
      </div>
    );
  };

  if (isWindowMode) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="h-full w-full"
      >
        {renderSplitContent()}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`${containerClassName} bg-white transition-colors duration-300 dark:bg-black`}
    >
      {/* Back Button */}
      {!isWindowMode && <ProjectBackButton />}

      <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row">
        {/* Left Column */}
        <div className="space-y-3 sm:space-y-4 lg:w-1/2">
          {/* Card Box (Box Besar) */}
          <div className="relative overflow-hidden rounded-lg border border-black/10 bg-white shadow-none transition-all duration-300 dark:border-white/10 dark:bg-black sm:rounded-xl">
            <div className="flex h-full flex-col lg:flex-row">
              {/* Cover & Interaction Section (Aligned to match simulator window layout) */}
              <div
                onMouseEnter={() => setIsLeftColumnHovered(true)}
                onMouseLeave={() => {
                  setIsLeftColumnHovered(false);
                  setIsCommentsOpen(false);
                }}
                className="relative flex w-full items-center justify-center overflow-hidden border-b border-gray-100 bg-gray-50 dark:border-white/10 dark:bg-gray-900/20 lg:w-[45%] lg:border-b-0 lg:border-r"
              >
                {/* Cover + Icons wrapper — icons positioned relative to the media */}
                <div
                  className="relative w-full transition-[padding] duration-300 ease-out"
                  style={{ padding: isLeftColumnHovered || !isWindowMode ? '0 24px' : '0' }}
                >
                  <ProjectCover
                    project={displayProject}
                    cover={cover}
                    ratio={ratio}
                    isWindowMode={true}
                    enableViewTransition={!isWindowMode}
                  />

                  {/* Vertical Interaction Bar — centered vertically relative to image */}
                  <motion.div
                    className="absolute inset-y-0 right-1 z-20 flex items-center"
                    initial={{ x: 50, opacity: 0 }}
                    animate={{
                      x: isLeftColumnHovered || !isWindowMode ? 0 : 50,
                      opacity: isLeftColumnHovered || !isWindowMode ? 1 : 0,
                    }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  >
                    <ProjectInteractionBar
                      isProjectLiked={isProjectLiked}
                      metrics={metrics}
                      comments={comments}
                      translations={translations}
                      translateLoading={translateLoading}
                      likePending={isLikePending}
                      onLike={handleProjectLike}
                      onShare={handleProjectShare}
                      onTranslate={translateAll}
                      onScrollToComments={handleScrollToComments}
                      orientation="vertical"
                      projectSlug={project.slug}
                    />
                  </motion.div>
                </div>

                {/* Comments Overlay — slides up from bottom on comment icon click */}
                <AnimatePresence>
                  {isCommentsOpen && (
                    <motion.div
                      initial={{ y: '100%' }}
                      animate={{ y: 0 }}
                      exit={{ y: '100%' }}
                      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                      className="absolute inset-0 z-30 flex flex-col bg-white/95 backdrop-blur-xl dark:bg-black/95"
                    >
                      {/* Header */}
                      <div className="flex flex-shrink-0 items-center justify-between border-b border-black/5 px-4 py-3 dark:border-white/10">
                        <div className="flex items-center gap-2">
                          <MessageSquare size={14} className="text-indigo-500" />
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                            {isEnglish ? 'Reviews' : 'Ulasan'}
                          </span>
                          {comments.length > 0 && (
                            <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                              {comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0)}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => setIsCommentsOpen(false)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                          </svg>
                        </button>
                      </div>
                      {/* Scrollable comments content */}
                      <div className="flex-1 overflow-y-auto p-4">
                        <ProjectComments
                          slug={project.slug}
                          siteId={siteId}
                          comments={comments}
                          setComments={setComments}
                          allowComments={project.allowComments}
                          sectionId={commentsSectionId}
                          withDivider={false}
                          isVisible={true}
                          animated={false}
                          className="w-full"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Details Section (Uses tabbed layout inside the card box, adapting to height without nested scrollbar) */}
              <div className="flex w-full flex-col bg-white dark:bg-black lg:w-[55%]">
                {/* Header (Title, etc.) */}
                <div className="border-b border-black/5 p-5 dark:border-white/5 sm:p-6">
                  <ProjectHeader
                    project={displayProject}
                    translations={translations}
                    isWindowMode={false}
                  />
                </div>

                <ProjectDetailTabsPane
                  project={displayProject}
                  gallery={gallery}
                  translations={translations}
                  isEnglish={isEnglish}
                  isWindowMode={false}
                  tabs={windowTabs}
                  activeTab={activeWindowTab}
                  onTabChange={setActiveWindowTab}
                  projectBadges={projectBadges}
                  activeNarrativeTab={activeNarrativeTab}
                  onNarrativeTabChange={setActiveNarrativeTab}
                  onGalleryGroupClick={setActiveGalleryGroup}
                />
              </div>
            </div>
          </div>

          {/* Related Projects - Column A */}
          {!isWindowMode && hasMounted && columnAProjects.length > 0 && (
            <ProjectRelatedColumn projects={columnAProjects} column="A" />
          )}
        </div>

        {/* Right Column - Related Projects */}
        {!isWindowMode && hasMounted && columnBProjects.length > 0 && (
          <ProjectRelatedColumn projects={columnBProjects} column="B" />
        )}
      </div>

      {/* Infinity Scroll Target & Loading UI */}
      <div className="mt-10 pb-20">
        <div ref={observerTarget} className="pointer-events-none h-20 w-full" aria-hidden="true" />

        {isLoading && (
          <div className="text-center opacity-50">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-b-2 border-amber-500"></div>
            <p className="mt-3 whitespace-nowrap text-xs font-medium text-gray-500">
              {localizeText('Memuat karya...', locale)}
            </p>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {activeGalleryGroup && (
        <LightboxGallery
          items={activeGalleryGroup.items}
          groupName={activeGalleryGroup.name}
          onClose={() => setActiveGalleryGroup(null)}
        />
      )}
    </motion.div>
  );
}

// Re-export hooks and components for external use
export { useProjectDetail } from './project-detail/hooks';
export * from './project-detail/components';
