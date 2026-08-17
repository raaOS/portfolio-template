'use client';

import { ChangeEvent, FormEvent } from 'react';
import {
  ImagePlus,
  Loader2,
  Save,
  Video,
  X,
} from 'lucide-react';
import type { AdminSiteSummary } from '@/app/admin/lib/adminQueries';
import type { ProjectDraft } from '../ClientDashboardPanel';

interface MasterProjectEditorSidebarProps {
  selectedSite: AdminSiteSummary | null;
  draft: ProjectDraft;
  isBusy: boolean;
  isSiteActive: boolean;
  isDraftValid: boolean;
  canUploadCover: boolean;
  canUploadGallery: boolean;
  maxGalleryItems: number;
  remainingGallerySlots: number;
  savePending: boolean;
  PROJECT_COVER_ACCEPT: string;
  PROJECT_GALLERY_ACCEPT: string;
  PROJECT_GALLERY_VIDEO_ACCEPT: string;
  isVideoUrl: (url: string) => boolean;
  setDraft: React.Dispatch<React.SetStateAction<ProjectDraft>>;
  closeEditor: () => void;
  removeGalleryImage: (index: number) => void;
  handleCoverFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handleGalleryFilesChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handleGalleryVideoChange: (e: ChangeEvent<HTMLInputElement>) => void;
  submitForm: (e: FormEvent<HTMLFormElement>) => void;
}

export function MasterProjectEditorSidebar({
  selectedSite,
  draft,
  isBusy,
  isSiteActive,
  isDraftValid,
  canUploadCover,
  canUploadGallery,
  maxGalleryItems,
  remainingGallerySlots,
  savePending,
  PROJECT_COVER_ACCEPT,
  PROJECT_GALLERY_ACCEPT,
  PROJECT_GALLERY_VIDEO_ACCEPT,
  isVideoUrl,
  setDraft,
  closeEditor,
  removeGalleryImage,
  handleCoverFileChange,
  handleGalleryFilesChange,
  handleGalleryVideoChange,
  submitForm,
}: MasterProjectEditorSidebarProps) {
  return (
    <aside className="rounded-xl border border-zinc-200 bg-white shadow-lg">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">
            {draft.id ? 'Edit Project' : 'Project Baru'}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">{draft.id || selectedSite?.id || '-'}</p>
        </div>
        <button
          type="button"
          onClick={closeEditor}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={submitForm}>
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
                  accept={PROJECT_COVER_ACCEPT}
                  disabled={!canUploadCover || isBusy}
                  onChange={handleCoverFileChange}
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
                    accept={PROJECT_GALLERY_ACCEPT}
                    disabled={!canUploadGallery || isBusy}
                    onChange={handleGalleryFilesChange}
                    className="sr-only"
                  />
                </label>
                <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50">
                  <Video className="h-4 w-4" />
                  Video
                  <input
                    type="file"
                    accept={PROJECT_GALLERY_VIDEO_ACCEPT}
                    disabled={!canUploadGallery || isBusy}
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
                      onClick={() => removeGalleryImage(index)}
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
            disabled={!selectedSite || !isSiteActive || !isDraftValid || savePending}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {savePending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Simpan
          </button>
        </div>
      </form>
    </aside>
  );
}
