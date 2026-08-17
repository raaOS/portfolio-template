'use client';

import { ChangeEvent, FormEvent } from 'react';
import {
  CheckCircle2,
  FilePlus2,
  ImagePlus,
  Loader2,
  Pencil,
  Save,
  Search,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import type { Project } from '@/types/projects';
import type { ClientSiteSummary, ProjectDraft } from '../ClientSelfServiceDashboard';

interface ProjectsModulePanelProps {
  site: ClientSiteSummary;
  projects: Project[];
  filteredProjects: Project[];
  draft: ProjectDraft;
  search: string;
  isEditorOpen: boolean;
  isBusy: boolean;
  isSiteActive: boolean;
  isProjectLimitReached: boolean;
  projectCreateBlocker: string;
  hasPublishedProjects: boolean;
  storagePercent: number;
  maxGalleryItems: number;
  remainingGallerySlots: number;
  isDraftValid: boolean;
  PROJECT_IMAGE_ACCEPT: string;
  PROJECT_VIDEO_ACCEPT: string;
  formatStorageMb: (val: number) => string;
  isVideoUrl: (url: string) => boolean;
  setSearch: (val: string) => void;
  setDraft: React.Dispatch<React.SetStateAction<ProjectDraft>>;
  startCreate: () => void;
  startEdit: (project: Project) => void;
  closeEditor: () => void;
  removeGalleryItem: (index: number) => void;
  handleCoverChange: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleGalleryImagesChange: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleGalleryVideoChange: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  submitProject: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  deleteProject: (project: Project) => Promise<void>;
}

export function ProjectsModulePanel({
  site,
  projects,
  filteredProjects,
  draft,
  search,
  isEditorOpen,
  isBusy,
  isSiteActive,
  isProjectLimitReached,
  projectCreateBlocker,
  hasPublishedProjects,
  storagePercent,
  maxGalleryItems,
  remainingGallerySlots,
  isDraftValid,
  PROJECT_IMAGE_ACCEPT,
  PROJECT_VIDEO_ACCEPT,
  formatStorageMb,
  isVideoUrl,
  setSearch,
  setDraft,
  startCreate,
  startEdit,
  closeEditor,
  removeGalleryItem,
  handleCoverChange,
  handleGalleryImagesChange,
  handleGalleryVideoChange,
  submitProject,
  deleteProject,
}: ProjectsModulePanelProps) {
  return (
    <div className="p-0">
      {/* Quota summary cards */}
      <div className="grid gap-3 border-b border-zinc-200 bg-zinc-50/80 p-4 md:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="text-xs font-medium text-zinc-500">Quota project</div>
          <div className="mt-3 text-2xl font-semibold">
            {site.usage.projects}/{site.quota.projectLimit}
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{
                width: `${
                  site.quota.projectLimit > 0
                    ? Math.min(100, (site.usage.projects / site.quota.projectLimit) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="text-xs font-medium text-zinc-500">Quota storage</div>
          <div className="mt-3 text-xl font-semibold">
            {site.usage.storage.available
              ? `${formatStorageMb(site.usage.storage.mb)} / ${formatStorageMb(
                  site.quota.storageMb
                )}`
              : formatStorageMb(site.quota.storageMb)}
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-sky-500"
              style={{ width: `${storagePercent}%` }}
            />
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Status site
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-2xl font-semibold uppercase">{site.status}</div>
              <div className="mt-1 text-xs text-zinc-500">{site.plan.toUpperCase()}</div>
            </div>
            <span
              className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                hasPublishedProjects
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-zinc-100 text-zinc-600'
              }`}
            >
              {hasPublishedProjects ? 'Preview siap' : 'Belum publish'}
            </span>
          </div>
        </div>
      </div>

      {/* Project list + editor side-by-side */}
      <div className={`${isEditorOpen ? 'grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px]' : 'p-4'}`}>
        {/* Project table */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
            <div>
              <h2 className="text-sm font-semibold">Projects</h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                {filteredProjects.length} item / {site?.quota.mediaPerProject ?? 0} media per project
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-9 w-56 rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-zinc-400"
                  placeholder="Cari project"
                />
              </div>
              <button
                type="button"
                onClick={startCreate}
                disabled={!site || !isSiteActive || isProjectLimitReached || isBusy}
                title={projectCreateBlocker || undefined}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-950 px-3 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                <FilePlus2 className="h-4 w-4" />
                {isProjectLimitReached ? 'Quota Penuh' : 'Project Baru'}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-zinc-200">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="bg-zinc-50 text-left text-xs font-semibold uppercase text-zinc-500">
                  <th className="border-b border-zinc-200 px-4 py-3">Project</th>
                  <th className="border-b border-zinc-200 px-4 py-3">Status</th>
                  <th className="border-b border-zinc-200 px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-14 text-center">
                      <FilePlus2 className="mx-auto mb-3 h-6 w-6 text-zinc-300" />
                      <p className="text-sm font-medium text-zinc-700">
                        {search.trim()
                          ? 'Tidak ada project sesuai pencarian'
                          : 'Belum ada project'}
                      </p>
                      <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-zinc-500">
                        {search.trim()
                          ? 'Coba kata kunci lain atau kosongkan pencarian.'
                          : projectCreateBlocker ||
                            'Buat project pertama, upload cover, lalu publish agar tampil di public site.'}
                      </p>
                      {!search.trim() && (
                        <button
                          type="button"
                          onClick={startCreate}
                          disabled={!site || !isSiteActive || isProjectLimitReached || isBusy}
                          title={projectCreateBlocker || undefined}
                          className="mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-zinc-950 px-3 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
                        >
                          <FilePlus2 className="h-4 w-4" />
                          Buat Project Pertama
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((project) => (
                    <tr key={project.id} className="hover:bg-zinc-50">
                      <td className="border-b border-zinc-100 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 overflow-hidden rounded-md bg-zinc-100 ring-1 ring-zinc-200">
                            {isVideoUrl(project.cover) ? (
                              <video
                                src={project.cover}
                                muted
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div
                                className="h-full w-full bg-cover bg-center"
                                style={{
                                  backgroundImage: project.cover
                                    ? `url("${project.cover.replaceAll('"', '\\"')}")`
                                    : undefined,
                                }}
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium">{project.title}</div>
                            <div className="truncate text-xs text-zinc-500">{project.client}</div>
                          </div>
                        </div>
                      </td>
                      <td className="border-b border-zinc-100 px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            project.status === 'published'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-zinc-100 text-zinc-700'
                          }`}
                        >
                          {project.status}
                        </span>
                      </td>
                      <td className="border-b border-zinc-100 px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => startEdit(project)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
                            title="Edit project"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void deleteProject(project)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Hapus project"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Project Editor Sidebar */}
        {isEditorOpen && (
          <aside className="rounded-xl border border-zinc-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">
                  {draft.id ? 'Edit Project' : 'Project Baru'}
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">{draft.id || site?.id || '-'}</p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={submitProject}>
              <div className="space-y-4 p-4">
                <label className="block">
                  <span className="text-xs font-medium text-zinc-600">Title</span>
                  <input
                    value={draft.title}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, title: event.target.value }))
                    }
                    className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-400"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-medium text-zinc-600">Client</span>
                    <input
                      value={draft.client}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, client: event.target.value }))
                      }
                      className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-400"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-zinc-600">Year</span>
                    <input
                      value={draft.year}
                      inputMode="numeric"
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, year: event.target.value }))
                      }
                      className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-400"
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-600">Cover</span>
                    <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50">
                      <ImagePlus className="h-4 w-4" />
                      Upload
                      <input
                        type="file"
                        accept={PROJECT_IMAGE_ACCEPT}
                        disabled={isBusy}
                        onChange={handleCoverChange}
                        className="sr-only"
                      />
                    </label>
                  </div>
                  <div className="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 text-xs text-zinc-400">
                    {draft.cover ? (
                      isVideoUrl(draft.cover) ? (
                        <video
                          src={draft.cover}
                          muted
                          controls
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="h-full w-full bg-cover bg-center"
                          style={{
                            backgroundImage: `url("${draft.cover.replaceAll('"', '\\"')}")`,
                          }}
                        />
                      )
                    ) : (
                      'No cover'
                    )}
                  </div>
                  <input
                    value={draft.cover}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, cover: event.target.value }))
                    }
                    className="h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-400"
                    placeholder="Cover URL"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-zinc-600">
                      Gallery {draft.gallery.length}/{maxGalleryItems}
                    </span>
                    <div className="flex gap-2">
                      <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50">
                        <ImagePlus className="h-4 w-4" />
                        Image
                        <input
                          type="file"
                          multiple
                          accept={PROJECT_IMAGE_ACCEPT}
                          disabled={isBusy || remainingGallerySlots <= 0}
                          onChange={handleGalleryImagesChange}
                          className="sr-only"
                        />
                      </label>
                      <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50">
                        <Video className="h-4 w-4" />
                        Video
                        <input
                          type="file"
                          accept={PROJECT_VIDEO_ACCEPT}
                          disabled={isBusy || remainingGallerySlots <= 0}
                          onChange={handleGalleryVideoChange}
                          className="sr-only"
                        />
                      </label>
                    </div>
                  </div>
                  {draft.gallery.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {draft.gallery.map((url, index) => (
                        <div
                          key={index}
                          className="group relative aspect-square overflow-hidden rounded-md border border-zinc-200 bg-zinc-100"
                        >
                          {isVideoUrl(url) ? (
                            <video src={url} muted className="h-full w-full object-cover" />
                          ) : (
                            <div
                              className="h-full w-full bg-cover bg-center"
                              style={{ backgroundImage: `url("${url.replaceAll('"', '\\"')}")` }}
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => removeGalleryItem(index)}
                            className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded bg-white/90 text-zinc-600 opacity-0 shadow-sm transition hover:text-red-600 group-hover:opacity-100"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-20 items-center justify-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 text-xs text-zinc-400">
                      No gallery media
                    </div>
                  )}
                </div>

                <label className="block">
                  <span className="text-xs font-medium text-zinc-600">Tags</span>
                  <input
                    value={draft.tags}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, tags: event.target.value }))
                    }
                    className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-400"
                    placeholder="ui, brand, web"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-zinc-600">Status</span>
                  <select
                    value={draft.status}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        status: event.target.value as ProjectDraft['status'],
                      }))
                    }
                    className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400"
                  >
                    <option value="draft">draft</option>
                    <option value="published">published</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-zinc-600">Description</span>
                  <textarea
                    value={draft.description}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, description: event.target.value }))
                    }
                    className="mt-1 min-h-28 w-full resize-none rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none transition focus:border-zinc-400"
                  />
                </label>
              </div>
              <div className="border-t border-zinc-200 p-4">
                <button
                  type="submit"
                  disabled={isBusy || !isSiteActive || !isDraftValid}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
                >
                  {isBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Simpan
                </button>
              </div>
            </form>
          </aside>
        )}
      </div>
    </div>
  );
}
