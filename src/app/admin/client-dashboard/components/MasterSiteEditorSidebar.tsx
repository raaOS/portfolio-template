'use client';

import { FormEvent, useState } from 'react';
import {
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  Save,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import type { AdminSiteSummary } from '@/app/admin/lib/adminQueries';
import type {
  ClientAccessDraft,
  SiteMasterDraft,
} from '../ClientDashboardPanel';

interface MasterSiteEditorSidebarProps {
  selectedSite: AdminSiteSummary | null;
  isCreatingSite: boolean;
  activeSiteDraft: SiteMasterDraft;
  activeClientAccessDraft: ClientAccessDraft;
  activePublicUrl: string;
  activePublicSlug: string;
  deleteConfirmSlug: string;
  canSaveSite: boolean;
  isSiteDraftValid: boolean;
  canSaveClientAccess: boolean;
  canDeleteSelectedSite: boolean;
  isBusy: boolean;
  siteSavePending: boolean;
  siteSaveError: Error | null;
  clientAccessPending: boolean;
  siteDeletePending: boolean;
  formatDate: (val?: string) => string;
  setSiteDraft: React.Dispatch<React.SetStateAction<SiteMasterDraft>>;
  setClientAccessDraft: React.Dispatch<React.SetStateAction<ClientAccessDraft>>;
  setClientAccessDraftSiteId: (id: string) => void;
  setDeleteConfirmSlug: (slug: string) => void;
  closeSiteCreator: () => void;
  copyPublicUrl: () => Promise<void>;
  submitSiteForm: (e: FormEvent<HTMLFormElement>) => void;
  saveClientAccess: () => void;
  confirmDeleteSite: () => Promise<void>;
}

export function MasterSiteEditorSidebar({
  selectedSite,
  isCreatingSite,
  activeSiteDraft,
  activeClientAccessDraft,
  activePublicUrl,
  activePublicSlug,
  deleteConfirmSlug,
  canSaveSite,
  isSiteDraftValid,
  canSaveClientAccess,
  canDeleteSelectedSite,
  siteSavePending,
  siteSaveError,
  clientAccessPending,
  siteDeletePending,
  formatDate,
  setSiteDraft,
  setClientAccessDraft,
  setClientAccessDraftSiteId,
  setDeleteConfirmSlug,
  closeSiteCreator,
  copyPublicUrl,
  submitSiteForm,
  saveClientAccess,
  confirmDeleteSite,
}: MasterSiteEditorSidebarProps) {
  const [activeTab, setActiveTab] = useState<'settings' | 'storage' | 'access'>('settings');

  if (!isCreatingSite && !selectedSite) return null;

  return (
    <aside className="flex flex-col min-w-0 w-full lg:w-[360px] lg:min-w-[360px] lg:max-w-[360px] border-t border-zinc-200 bg-white lg:border-l lg:border-t-0">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 min-w-0">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-zinc-900 truncate">
            {isCreatingSite ? 'Client/Site Baru' : selectedSite?.name || 'Pengaturan Site'}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 font-mono truncate">
            {isCreatingSite ? 'Form pembuatan tenant site baru' : selectedSite?.id || '-'}
          </p>
        </div>
        {isCreatingSite && (
          <button
            type="button"
            onClick={closeSiteCreator}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950 flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation Sub-Tabs when editing existing site */}
      {!isCreatingSite && selectedSite && (
        <div className="border-b border-zinc-200 bg-zinc-50 p-2">
          <div className="grid grid-cols-3 rounded-lg bg-zinc-200/70 p-1 text-center">
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`rounded-md py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'settings'
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              Pengaturan
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('storage')}
              className={`rounded-md py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'storage'
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              Storage
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('access')}
              className={`rounded-md py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'access'
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              Akses
            </button>
          </div>
        </div>
      )}

      {/* Main Tab Contents */}
      <form onSubmit={submitSiteForm} className="flex min-h-0 flex-1 flex-col justify-between">
        <div className="space-y-4 p-4 min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {/* TAB 1: General Settings or Creating New Site */}
          {(isCreatingSite || activeTab === 'settings') && (
            <>
              <label className="block">
                <span className="text-xs font-medium text-zinc-600">Nama site</span>
                <input
                  value={activeSiteDraft.name}
                  onChange={(event) =>
                    setSiteDraft((prev) => ({ ...prev, name: event.target.value }))
                  }
                  onMouseDown={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  className="mt-1 h-9 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-400"
                  placeholder="Studio Designer"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-zinc-600">Slug site (URL)</span>
                <input
                  value={activeSiteDraft.slug}
                  onChange={(event) =>
                    setSiteDraft((prev) => ({ ...prev, slug: event.target.value }))
                  }
                  onMouseDown={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  className="mt-1 h-9 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-400"
                  placeholder="studio-designer"
                />
              </label>

              {!isCreatingSite && selectedSite && (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <div className="text-[11px] font-semibold uppercase text-zinc-600">Public URL</div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium text-zinc-900 font-mono">
                      {activePublicUrl || `/${activePublicSlug}`}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={copyPublicUrl}
                        className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
                        title="Copy Public URL"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <a
                        href={activePublicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
                        title="Buka Public URL"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                  {activeSiteDraft.customDomain?.trim() && (
                    <div className="mt-2 border-t border-zinc-200 pt-2 text-[11px] text-zinc-500 space-y-1">
                      <div className="text-[11px] font-medium text-emerald-700">
                        Custom Domain:{' '}
                        <a
                          href={`https://${activeSiteDraft.customDomain.trim().replace(/^https?:\/\//, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono underline hover:text-emerald-900"
                        >
                          https://{activeSiteDraft.customDomain.trim().replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-zinc-600">Status</span>
                  <select
                    value={activeSiteDraft.status}
                    onChange={(event) =>
                      setSiteDraft((prev) => ({
                        ...prev,
                        status: event.target.value as SiteMasterDraft['status'],
                      }))
                    }
                    className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400"
                  >
                    <option value="active">active</option>
                    <option value="suspended">suspended</option>
                  </select>
                </label>
              </div>

              {/* Custom Domain Card */}
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-zinc-500">Custom Domain</span>
                  {selectedSite?.customDomain?.customDomain ? (
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      🌐 Active
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-zinc-400">Belum di-set</span>
                  )}
                </div>
                <input
                  value={activeSiteDraft.customDomain ?? ''}
                  onChange={(event) =>
                    setSiteDraft((prev) => ({
                      ...prev,
                      customDomain: event.target.value,
                    }))
                  }
                  onMouseDown={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs outline-none transition focus:border-zinc-400 font-mono"
                  placeholder="misal: makeitbetter.my.id"
                />

                {/* Info CNAME & Shortcut Buka Web */}
                <div className="pt-2 flex items-center justify-between text-[11px] text-zinc-500 border-t border-zinc-200/60 mt-1">
                  <div className="flex items-center gap-1 min-w-0 truncate">
                    <span className="text-zinc-400">CNAME:</span>
                    <code className="font-mono text-[10px] bg-white px-1.5 py-0.5 rounded border border-zinc-200 text-zinc-700 select-all">
                      cname.portfolio-os.dev
                    </code>
                  </div>
                  {activeSiteDraft.customDomain?.trim() && (
                    <a
                      href={`https://${activeSiteDraft.customDomain.trim().replace(/^https?:\/\//, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 shrink-0"
                    >
                      <span>Buka Web</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </>
          )}

          {/* TAB 2: Storage & Quota Add-ons */}
          {!isCreatingSite && selectedSite && activeTab === 'storage' && (
            <>
              {/* Quota override inputs */}
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <div className="mb-2 text-xs font-semibold uppercase text-zinc-500">
                  Custom Quota Add-ons
                </div>
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-xs font-medium text-zinc-600">Project limit override</span>
                    <input
                      value={activeSiteDraft.quotaOverride.projectLimit}
                      onChange={(event) =>
                        setSiteDraft((prev) => ({
                          ...prev,
                          quotaOverride: { ...prev.quotaOverride, projectLimit: event.target.value },
                        }))
                      }
                      className="mt-1 h-8.5 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400"
                      placeholder="Kosongkan untuk bawaan sistem"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-zinc-600">Storage (MB) override</span>
                    <input
                      value={activeSiteDraft.quotaOverride.storageMb}
                      onChange={(event) =>
                        setSiteDraft((prev) => ({
                          ...prev,
                          quotaOverride: { ...prev.quotaOverride, storageMb: event.target.value },
                        }))
                      }
                      className="mt-1 h-8.5 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400"
                      placeholder="Kosongkan untuk bawaan sistem"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-zinc-600">Media per project override</span>
                    <input
                      value={activeSiteDraft.quotaOverride.mediaPerProject}
                      onChange={(event) =>
                        setSiteDraft((prev) => ({
                          ...prev,
                          quotaOverride: { ...prev.quotaOverride, mediaPerProject: event.target.value },
                        }))
                      }
                      className="mt-1 h-8.5 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400"
                      placeholder="Kosongkan untuk bawaan sistem"
                    />
                  </label>
                </div>
              </div>
            </>
          )}

          {/* TAB 3: Access & Danger Zone */}
          {!isCreatingSite && selectedSite && activeTab === 'access' && (
            <>
              <div className="rounded-lg border border-zinc-200 bg-white p-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-zinc-500" />
                  <div>
                    <div className="text-xs font-semibold text-zinc-700">Akses client</div>
                    <div className="mt-0.5 text-[11px] text-zinc-500">
                      {selectedSite.clientAccess
                        ? `Login terakhir ${formatDate(selectedSite.clientAccess.lastLoginAt || undefined)}`
                        : 'Belum ada akun client'}
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-3">
                  <label className="block">
                    <span className="text-xs font-medium text-zinc-600">Email client</span>
                    <input
                      value={activeClientAccessDraft.email}
                      onChange={(event) => {
                        setClientAccessDraftSiteId(selectedSite.id);
                        setClientAccessDraft({
                          ...activeClientAccessDraft,
                          email: event.target.value,
                        });
                      }}
                      className="mt-1 h-9 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-400"
                      placeholder="client@example.com"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-zinc-600">
                      {selectedSite.clientAccess ? 'Reset password manual' : 'Password awal'}
                    </span>
                    <input
                      value={activeClientAccessDraft.password}
                      type="password"
                      autoComplete="new-password"
                      onChange={(event) => {
                        setClientAccessDraftSiteId(selectedSite.id);
                        setClientAccessDraft({
                          ...activeClientAccessDraft,
                          password: event.target.value,
                        });
                      }}
                      className="mt-1 h-9 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-400"
                      placeholder={
                        selectedSite.clientAccess ? 'Kosongkan jika tidak reset' : 'Minimal 8 karakter'
                      }
                    />
                  </label>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <select
                      value={activeClientAccessDraft.status}
                      onChange={(event) => {
                        setClientAccessDraftSiteId(selectedSite.id);
                        setClientAccessDraft({
                          ...activeClientAccessDraft,
                          status: event.target.value as ClientAccessDraft['status'],
                        });
                      }}
                      className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400"
                    >
                      <option value="active">active</option>
                      <option value="suspended">suspended</option>
                    </select>
                    <button
                      type="button"
                      disabled={!canSaveClientAccess}
                      onClick={saveClientAccess}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-zinc-950 px-3 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
                    >
                      {clientAccessPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Simpan Akses
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
                  <ShieldAlert className="h-4 w-4 text-red-600" />
                  <span>Area Hapus Permanen</span>
                </div>
                <p className="mt-1 text-[11px] text-red-600">
                  Menghapus permanen seluruh data D1 & media R2 site ini.
                </p>
                <input
                  value={deleteConfirmSlug}
                  onChange={(event) => setDeleteConfirmSlug(event.target.value)}
                  className="mt-2.5 h-8.5 w-full rounded-md border border-red-200 bg-white px-3 text-xs outline-none transition focus:border-red-400 font-mono"
                  placeholder={`Ketik ${selectedSite.slug}`}
                />
                <button
                  type="button"
                  disabled={!canDeleteSelectedSite}
                  onClick={() => void confirmDeleteSite()}
                  className="mt-2 inline-flex h-8.5 w-full items-center justify-center gap-2 rounded-md bg-red-600 px-3 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-200"
                >
                  {siteDeletePending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Hapus Site
                </button>
              </div>
            </>
          )}

          {siteSaveError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {siteSaveError.message || 'Gagal menyimpan site'}
            </div>
          )}
        </div>

        {/* Action button at bottom - permanent fixed footer to prevent layout shift */}
        <div className="border-t border-zinc-200 bg-white p-3">
          <button
            type="submit"
            disabled={!canSaveSite || !isSiteDraftValid}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {siteSavePending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isCreatingSite ? 'Buat Site Baru' : 'Simpan Perubahan Site'}
          </button>
        </div>
      </form>
    </aside>
  );
}

