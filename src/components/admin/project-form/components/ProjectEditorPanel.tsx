import type { RefObject } from 'react';
import { useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, BookOpen, ChevronDown, ChevronUp, Info, Sparkles } from 'lucide-react';
import type { Project } from '@/types/projects';
import type { Label } from '@/types/labels';
import type { ProjectFormData } from '@/hooks/useProjectForm';
import type { Comment } from '@/lib/magic';
import ProjectAIHelper, { type AIResponse } from '../ProjectAIHelper';
import ProjectBasicInfo from '../ProjectBasicInfo';
import ProjectGalleryManager from '../ProjectGalleryManager';
import ProjectNarrative from '../ProjectNarrative';
import { PROJECT_FORM_TABS } from '../projectFormConstants';
import { hasProjectFormTabErrors } from '../projectFormUtils';
import type {
  ProjectCreationMode,
  ProjectFormTabId,
  ProjectFormUpdateField,
} from '../types';

interface ProjectEditorPanelProps {
  project?: Project;
  allProjects: Project[];
  labels: Label[];
  formData: ProjectFormData;
  errors: Record<string, string>;
  pendingCoverFile: File | null;
  activeProjectSlug: string;
  filledContentFieldCount: number;
  totalCommentCount: number;
  activeTab: ProjectFormTabId;
  setActiveTab: (tab: ProjectFormTabId) => void;
  creationMode: ProjectCreationMode;
  setCreationMode: (mode: ProjectCreationMode) => void;
  hasGeneratedContent: boolean;
  setHasGeneratedContent: (hasGenerated: boolean) => void;
  isAIHelperExpanded: boolean;
  setIsAIHelperExpanded: (isExpanded: boolean) => void;
  showViralStats: boolean;
  setShowViralStats: (show: boolean) => void;
  descriptionRef: RefObject<HTMLTextAreaElement | null>;
  updateField: ProjectFormUpdateField;
  setFieldError: (field: string, msg: string | null) => void;
  onContentGenerated: (data: AIResponse, options?: { revealEditor?: boolean }) => void;
  onViralGenerated: (
    likes: number,
    shares: number,
    commentsCount: number,
    generatedComments?: Comment[],
    options?: { revealEditor?: boolean }
  ) => void;
  addGalleryItem: (url: string) => boolean;
  removeGalleryItem: (index: number) => void;
  toggleGalleryItem: (index: number) => void;
  addGalleryGroup: (name: string) => void;
  removeGalleryGroup: (groupId: string) => void;
  addGalleryItemToGroup: (groupId: string, url: string) => boolean;
  removeGalleryItemFromGroup: (groupId: string, itemIndex: number) => void;
  toggleGalleryItemInGroup: (groupId: string, itemIndex: number) => void;
  updateGroupName: (groupId: string, name: string) => void;
  onNewUpload: (url: string) => void;
}

export default function ProjectEditorPanel({
  project,
  allProjects,
  labels,
  formData,
  errors,
  pendingCoverFile,
  activeProjectSlug,
  filledContentFieldCount,
  totalCommentCount,
  activeTab,
  setActiveTab,
  creationMode,
  setCreationMode,
  hasGeneratedContent,
  setHasGeneratedContent,
  isAIHelperExpanded,
  setIsAIHelperExpanded,
  showViralStats,
  setShowViralStats,
  descriptionRef,
  updateField,
  setFieldError,
  onContentGenerated,
  onViralGenerated,
  addGalleryItem,
  removeGalleryItem,
  toggleGalleryItem,
  addGalleryGroup,
  removeGalleryGroup,
  addGalleryItemToGroup,
  removeGalleryItemFromGroup,
  toggleGalleryItemInGroup,
  updateGroupName,
  onNewUpload,
}: ProjectEditorPanelProps) {
  const galleryItemCount = useMemo(() => {
    const singleItems = formData.galleryItems.filter((item) => item.isActive !== false).length;
    const groupedItems = formData.galleryGroups.reduce(
      (total, group) => total + group.items.filter((item) => item.isActive !== false).length,
      0
    );

    return singleItems + groupedItems;
  }, [formData.galleryGroups, formData.galleryItems]);

  const activeTabIndex = Math.max(
    0,
    PROJECT_FORM_TABS.findIndex((tab) => tab.id === activeTab)
  );

  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col space-y-6 sm:max-w-[520px] lg:col-span-6">
      {creationMode === 'undecided' ? (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          className="flex flex-col space-y-5 rounded-2xl border border-slate-200/80 bg-white/50 p-6 shadow-lg backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/50"
        >
          <div className="space-y-2 text-center">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Pilih Metode Pengisian Proyek
            </h3>
            <p className="mx-auto max-w-sm text-[11px] leading-relaxed text-slate-400">
              Pilih apakah Anda ingin mengisi data detail proyek secara manual atau secara otomatis
              menggunakan AI asisten.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <button
              type="button"
              onClick={() => {
                setCreationMode('manual');
                setHasGeneratedContent(true);
              }}
              className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-left transition-all hover:border-indigo-500 hover:bg-indigo-50/5 dark:border-slate-800 dark:bg-slate-900/10 dark:hover:border-indigo-500/50"
            >
              <div className="rounded-lg bg-slate-200/60 p-2.5 text-slate-600 transition-colors group-hover:bg-indigo-100 group-hover:text-indigo-600 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-indigo-950/40">
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="flex-1 space-y-1">
                <h4 className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 dark:text-slate-200 dark:group-hover:text-indigo-400">
                  Isi Manual
                </h4>
                <p className="text-[10px] leading-relaxed text-slate-400">
                  Tulis deskripsi, cerita proses narasi, dan pilih galeri media secara manual dari
                  awal.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setCreationMode('auto');
              }}
              className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-left transition-all hover:border-indigo-500 hover:bg-indigo-50/5 dark:border-slate-800 dark:bg-slate-900/10 dark:hover:border-indigo-500/50"
            >
              <div className="rounded-lg bg-slate-200/60 p-2.5 text-slate-600 transition-colors group-hover:bg-indigo-100 group-hover:text-indigo-600 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-indigo-950/40">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="flex-1 space-y-1">
                <h4 className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 dark:text-slate-200 dark:group-hover:text-indigo-400">
                  Buat Otomatis (AI)
                </h4>
                <p className="text-[10px] leading-relaxed text-slate-400">
                  Gunakan kecerdasan buatan untuk menghasilkan draf detail proyek &
                  statistik viral berdasarkan cover media.
                </p>
              </div>
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full space-y-6"
        >
          <div className="mb-4 flex">
            <button
              type="button"
              onClick={() => {
                setCreationMode('undecided');
                setHasGeneratedContent(false);
              }}
              className="group flex items-center gap-1.5 rounded-full bg-slate-100/50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 transition-all hover:bg-slate-200 hover:text-slate-800 dark:bg-slate-900/50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              Pilih Metode Lain
            </button>
          </div>

          {creationMode === 'auto' && !hasGeneratedContent && (
            <div className="space-y-4">
              <div className="rounded-xl border border-indigo-100/30 bg-indigo-50/5 p-4 text-slate-600 dark:border-indigo-900/20 dark:bg-indigo-950/5">
                <h4 className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-400">
                  <Info className="h-4 w-4 text-indigo-500" />
                  Panduan Asisten AI
                </h4>
                <p className="mt-1 text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
                  Unggah file cover proyek terlebih dahulu di kolom sebelah kiri. Asisten AI
                  akan membaca media tersebut dan memformulasikan draf detail proyek secara otomatis.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <ProjectAIHelper
                  cover={formData.cover}
                  pendingFile={pendingCoverFile}
                  slug={activeProjectSlug}
                  projectId={project?.id}
                  mode="content"
                  existingContentFieldCount={filledContentFieldCount}
                  onGenerate={(data) => onContentGenerated(data, { revealEditor: true })}
                  onGenerateViral={() => {}}
                  onCoverMissing={() =>
                    setFieldError(
                      'cover',
                      'Wajib unggah Cover Media sebelum menggunakan AI Assistant!'
                    )
                  }
                />
                <ProjectAIHelper
                  cover={formData.cover}
                  pendingFile={pendingCoverFile}
                  slug={activeProjectSlug}
                  projectId={project?.id}
                  mode="viral"
                  existingCommentCount={totalCommentCount}
                  projectTitle={formData.title}
                  projectDescription={formData.description}
                  onGenerate={() => {}}
                  onGenerateViral={(likes, shares, commentsCount, generatedComments) =>
                    onViralGenerated(likes, shares, commentsCount, generatedComments, {
                      revealEditor: true,
                    })
                  }
                />
              </div>
            </div>
          )}

          {(creationMode === 'manual' || hasGeneratedContent) && (
            <div className="space-y-6">
              {creationMode === 'auto' && (
                <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-indigo-50/5 shadow-sm transition-all dark:border-indigo-950/40">
                  <button
                    type="button"
                    onClick={() => setIsAIHelperExpanded(!isAIHelperExpanded)}
                    className="flex w-full items-center justify-between bg-indigo-50/20 px-4 py-3 text-left text-xs font-bold text-indigo-600 hover:bg-indigo-50/40 dark:bg-indigo-950/10 dark:text-indigo-400"
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 animate-pulse text-indigo-500" />
                      <span className="font-mono text-[10px] uppercase tracking-wider">
                        AI Assistant
                      </span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[9px] text-slate-400 dark:text-slate-500">
                        {isAIHelperExpanded ? 'Sembunyikan' : 'Tampilkan Opsi'}
                      </span>
                      {isAIHelperExpanded ? (
                        <ChevronUp className="h-4 w-4 text-indigo-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-indigo-400" />
                      )}
                    </div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isAIHelperExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-4 border-t border-indigo-50/60 bg-white p-4 dark:border-indigo-950/40 dark:bg-slate-950"
                      >
                        <div className="grid grid-cols-1 gap-4">
                          <ProjectAIHelper
                            cover={formData.cover}
                            pendingFile={pendingCoverFile}
                            slug={activeProjectSlug}
                            projectId={project?.id}
                            mode="content"
                            existingContentFieldCount={filledContentFieldCount}
                            onGenerate={(data) => onContentGenerated(data)}
                            onGenerateViral={() => {}}
                            onCoverMissing={() =>
                              setFieldError(
                                'cover',
                                'Wajib unggah Cover Media sebelum menggunakan AI Assistant!'
                              )
                            }
                          />
                          <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
                            <ProjectAIHelper
                              cover={formData.cover}
                              pendingFile={pendingCoverFile}
                              slug={activeProjectSlug}
                              projectId={project?.id}
                              mode="viral"
                              existingCommentCount={totalCommentCount}
                              projectTitle={formData.title}
                              projectDescription={formData.description}
                              onGenerate={() => {}}
                              onGenerateViral={(likes, shares, commentsCount, generatedComments) =>
                                onViralGenerated(likes, shares, commentsCount, generatedComments)
                              }
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <div className="space-y-1">
                <input
                  type="text"
                  value={formData.title}
                  onChange={(event) => updateField('title', event.target.value)}
                  className="dark:placeholder-slate-650 w-full border-none bg-transparent p-0 text-2xl font-extrabold tracking-tight text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-0 dark:text-slate-100"
                  placeholder="Judul Proyek..."
                />
                {errors.title && (
                  <p className="mt-1 text-[10px] font-medium text-red-500">{errors.title}</p>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-hidden rounded-[22px] border-2 border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                <div className="relative rounded-t-[20px] bg-slate-50/90 px-4 pt-2 dark:bg-slate-900/40">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-0.5 bg-slate-200 dark:bg-slate-800"
                  />
                  <div
                    data-tab-nav
                    className="relative z-10 mx-auto grid h-11 w-[min(100%,560px)] min-w-0 grid-cols-3 items-end"
                  >
                    <motion.div
                      aria-hidden="true"
                      className="pointer-events-none absolute bottom-0 left-0 z-[1] h-11 w-1/3"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      animate={{
                        x: `${activeTabIndex * 100}%`,
                      }}
                    >
                      <svg
                        className="h-full w-full"
                        viewBox="0 0 180 44"
                        preserveAspectRatio="none"
                        overflow="visible"
                      >
                        <path
                          className="fill-white dark:fill-slate-950"
                          d="M0 47H180V43C166 43 160 39 160 27V18C160 8 152 3 140 3H40C28 3 20 8 20 18V27C20 39 14 43 0 43V47Z"
                        />
                        <path
                          className="fill-none stroke-slate-200 dark:stroke-slate-800"
                          d="M0 43C14 43 20 39 20 27V18C20 8 28 3 40 3H140C152 3 160 8 160 18V27C160 39 166 43 180 43"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    </motion.div>
                    {PROJECT_FORM_TABS.map((tab) => {
                      const isActive = activeTab === tab.id;
                      const hasError = hasProjectFormTabErrors(errors, tab.id);
                      const Icon = tab.Icon;
                      const showGalleryCount = tab.id === 'galeri' && galleryItemCount > 0;

                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveTab(tab.id)}
                          onMouseDown={(event) => event.preventDefault()}
                          className={`relative flex h-11 min-w-0 flex-1 cursor-pointer appearance-none items-center justify-center gap-2 border-0 bg-transparent px-3 text-xs font-extrabold tracking-normal transition-colors duration-200 ${
                            isActive
                              ? 'z-20 text-slate-900 dark:text-slate-100'
                              : 'z-10 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                          }`}
                          aria-pressed={isActive}
                        >
                          <Icon
                            className={`relative z-10 h-4 w-4 flex-shrink-0 ${
                              isActive ? 'text-indigo-500' : 'text-slate-400'
                            }`}
                            strokeWidth={2.25}
                          />
                          <span className="relative z-10 truncate">{tab.label}</span>
                          {showGalleryCount && (
                            <span
                              className={`relative z-10 flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-black leading-none ${
                                isActive
                                  ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-200 dark:text-indigo-700'
                                  : 'bg-white/80 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {galleryItemCount}
                            </span>
                          )}
                          {hasError && (
                            <span className="absolute right-2 top-2 flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto bg-white px-5 py-5 dark:bg-slate-950">
                  {activeTab === 'ringkasan' && (
                    <div className="space-y-6">
                      <div className="space-y-1">
                        <label className="block font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Deskripsi Singkat
                        </label>
                        <textarea
                          ref={descriptionRef}
                          value={formData.description || ''}
                          onChange={(event) => updateField('description', event.target.value)}
                          className="dark:placeholder-slate-650 min-h-[95px] w-full resize-none overflow-hidden rounded-md border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-800 placeholder-slate-400 transition-all hover:border-slate-300 focus:border-slate-800 focus:outline-none focus:ring-0 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-700 dark:focus:border-slate-300"
                          placeholder="Deskripsi ringkas proyek..."
                        />
                        {errors.description && (
                          <p className="text-[10px] font-medium text-red-500">
                            {errors.description}
                          </p>
                        )}
                      </div>

                      <ProjectBasicInfo
                        formData={formData}
                        errors={errors}
                        updateField={updateField}
                        allProjects={allProjects}
                        labels={labels}
                        mode="metadata"
                      />

                      <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Statistik & Viralitas
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowViralStats(!showViralStats)}
                            className="hover:text-slate-855 dark:text-slate-450 text-[10px] font-semibold text-slate-500 transition-colors dark:hover:text-slate-200"
                          >
                            {showViralStats ? 'Sembunyikan Opsi' : 'Tampilkan Opsi'}
                          </button>
                        </div>

                        {showViralStats && (
                          <div className="mt-4">
                            <ProjectBasicInfo
                              formData={formData}
                              errors={errors}
                              updateField={updateField}
                              allProjects={allProjects}
                              labels={labels}
                              mode="telemetry"
                              showViralStats={showViralStats}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'proses' && (
                    <div className="w-full">
                      <ProjectNarrative
                        formData={formData}
                        updateField={updateField}
                        errors={errors}
                      />
                    </div>
                  )}

                  {activeTab === 'galeri' && (
                    <div className="space-y-3">
                      <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Gallery Items
                      </h3>
                      <ProjectGalleryManager
                        formData={formData}
                        addGalleryItem={addGalleryItem}
                        removeGalleryItem={removeGalleryItem}
                        toggleGalleryItem={toggleGalleryItem}
                        addGalleryGroup={addGalleryGroup}
                        removeGalleryGroup={removeGalleryGroup}
                        addGalleryItemToGroup={addGalleryItemToGroup}
                        removeGalleryItemFromGroup={removeGalleryItemFromGroup}
                        toggleGalleryItemInGroup={toggleGalleryItemInGroup}
                        updateGroupName={updateGroupName}
                        onNewUpload={onNewUpload}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
