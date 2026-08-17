'use client';

import { FormEvent } from 'react';
import { Loader2, Monitor, Save } from 'lucide-react';
import type { ClientSystemDraft } from '../ClientSelfServiceDashboard';
import { CustomDomainSection } from './CustomDomainSection';

interface SystemModulePanelProps {
  siteId?: string;
  csrfToken?: string;
  showToast?: (message: string, type?: 'success' | 'error') => void;
  systemDraft: ClientSystemDraft;
  isBusy: boolean;
  isSiteActive: boolean;
  canEditSystem?: boolean;
  isSystemLoaded: boolean;
  setSystemDraft: React.Dispatch<React.SetStateAction<ClientSystemDraft>>;
  submitSystem: (e: FormEvent<HTMLFormElement>) => Promise<void>;
}

export function SystemModulePanel({
  siteId,
  csrfToken,
  showToast = () => {},
  systemDraft,
  isBusy,
  isSiteActive,
  canEditSystem: _canEditSystem,
  isSystemLoaded,
  setSystemDraft,
  submitSystem,
}: SystemModulePanelProps) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-cyan-600" />
            <h2 className="text-sm font-semibold">Sistem & Tampilan</h2>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            Atur wallpaper desktop, sticky note, dan label Dock.
          </p>
        </div>
      </div>

      <form onSubmit={submitSystem}>

          <div className="grid gap-4 p-4 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-zinc-600">Wallpaper aktif</span>
              <select
                value={systemDraft.activeWallpaperId}
                onChange={(event) =>
                  setSystemDraft((prev) => ({
                    ...prev,
                    activeWallpaperId: event.target.value,
                  }))
                }
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400"
              >
                <option value="">Default</option>
                {systemDraft.wallpapers.map((wallpaper) => (
                  <option key={wallpaper.id} value={wallpaper.id}>
                    {wallpaper.name}
                  </option>
                ))}
              </select>
              {systemDraft.wallpapers.length === 0 && (
                <p className="mt-1 text-xs text-zinc-500">
                  Koleksi wallpaper masih kosong. Upload wallpaper tetap lewat Master.
                </p>
              )}
            </label>
            <label className="block">
              <span className="text-xs font-medium text-zinc-600">
                Blur wallpaper: {systemDraft.wallpaperBlur}px
              </span>
              <input
                type="range"
                min={0}
                max={20}
                value={systemDraft.wallpaperBlur}
                onChange={(event) =>
                  setSystemDraft((prev) => ({
                    ...prev,
                    wallpaperBlur: Number(event.target.value),
                  }))
                }
                className="mt-3 w-full accent-zinc-950"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-xs font-medium text-zinc-600">Sticky note text</span>
              <textarea
                value={systemDraft.stickyNote.text}
                onChange={(event) =>
                  setSystemDraft((prev) => ({
                    ...prev,
                    stickyNote: { ...prev.stickyNote, text: event.target.value },
                  }))
                }
                className="mt-1 min-h-28 w-full resize-y rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none transition focus:border-zinc-400"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-zinc-600">Sticky note color</span>
              <input
                type="color"
                value={systemDraft.stickyNote.color}
                onChange={(event) =>
                  setSystemDraft((prev) => ({
                    ...prev,
                    stickyNote: { ...prev.stickyNote, color: event.target.value },
                  }))
                }
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white p-1"
              />
            </label>
            <div className="md:col-span-2">
              <div className="mb-2 text-xs font-semibold uppercase text-zinc-500">Label Dock</div>
              <div className="grid gap-3 md:grid-cols-2">
                {([
                  ['projects', 'Projects'],
                  ['contact', 'Contact'],
                  ['whatsapp', 'WhatsApp'],
                  ['notes', 'Notes'],
                  ['about', 'About'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="block">
                    <span className="text-xs font-medium text-zinc-600">{label}</span>
                    <input
                      value={systemDraft.dockLabels[key]}
                      onChange={(event) =>
                        setSystemDraft((prev) => ({
                          ...prev,
                          dockLabels: {
                            ...prev.dockLabels,
                            [key]: event.target.value,
                          },
                        }))
                      }
                      className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-400"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-zinc-200 p-4">
            <button
              type="submit"
              disabled={isBusy || !isSiteActive || !isSystemLoaded}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Simpan Tampilan
            </button>
          </div>
        </form>

      {siteId && (

        <div className="p-4 border-t border-zinc-200">
          <CustomDomainSection siteId={siteId} csrfToken={csrfToken} showToast={showToast} />
        </div>
      )}
    </div>
  );
}
