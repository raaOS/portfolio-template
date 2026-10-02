'use client';

import { Building2, HardDrive } from 'lucide-react';
import type { AdminSiteSummary } from '@/app/admin/lib/adminQueries';

interface MasterSiteTableProps {
  sites: AdminSiteSummary[];
  effectiveSiteId: string;
  onSelectSite: (site: AdminSiteSummary) => void;
}

export function MasterSiteTable({
  sites,
  effectiveSiteId,
  onSelectSite,
}: MasterSiteTableProps) {
  const totalStorageMb = sites.reduce(
    (acc, site) => acc + (site.usage?.storage?.mb || 0),
    0
  );

  return (
    <aside className="min-h-0 min-w-0 w-full lg:w-[250px] lg:min-w-[250px] lg:max-w-[250px] border-b border-zinc-200 bg-white lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <div className="text-xs font-semibold uppercase text-zinc-500">Client/Sites ({sites.length})</div>
        {sites.length > 0 && (
          <div
            className="flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600"
            title="Total R2 Storage terpakai di seluruh site (Cloudflare Free Tier: 10 GB)"
          >
            <HardDrive className="h-3 w-3 text-zinc-400" />
            <span>
              {totalStorageMb >= 1024
                ? `${(totalStorageMb / 1024).toFixed(2)} GB`
                : `${totalStorageMb.toFixed(1)} MB`}
            </span>
          </div>
        )}
      </div>
      <div className="max-h-[220px] space-y-2 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden p-3 lg:max-h-none">
        {sites.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 px-3 py-8 text-center">
            <Building2 className="mx-auto mb-2 h-5 w-5 text-zinc-400" />
            <p className="text-sm font-medium text-zinc-700">Client/site belum tersedia</p>
            <p className="mt-1 text-xs text-zinc-500">
              Buat client pertama dari tombol di header.
            </p>
          </div>
        ) : (
          sites.map((site) => {
            const selected = site.id === effectiveSiteId;
            const projectPercent = Math.min(
              100,
              (site.usage.projects / site.quota.projectLimit) * 100
            );
            const storageMb = site.usage?.storage?.mb || 0;
            const storageLimitMb = site.quota?.storageMb || 500;
            const storagePercent = Math.min(
              100,
              Math.round((storageMb / storageLimitMb) * 100)
            );

            const storageBarColor = selected
              ? 'bg-white'
              : storagePercent >= 90
              ? 'bg-red-500'
              : storagePercent >= 75
              ? 'bg-amber-500'
              : 'bg-indigo-500';

            return (
              <button
                key={site.id}
                type="button"
                onClick={() => onSelectSite(site)}
                className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                  selected
                    ? 'border-zinc-950 bg-zinc-950 text-white'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{site.name}</div>
                    <div
                      className={`mt-0.5 truncate text-xs ${
                        selected ? 'text-zinc-300' : 'text-zinc-500'
                      }`}
                    >
                      {site.customDomain?.customDomain ? (
                        <span className={`font-mono text-[11px] font-medium ${selected ? 'text-emerald-300' : 'text-emerald-700'}`}>
                          🌐 {site.customDomain.customDomain}
                        </span>
                      ) : (
                        <span>/{site.slug}</span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                      selected ? 'bg-white/15 text-white' : 'bg-zinc-100 text-zinc-700'
                    }`}
                  >
                    {site.status}
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {/* Projects usage */}
                  <div>
                    <div
                      className={`flex items-center justify-between text-[10px] ${
                        selected ? 'text-zinc-300' : 'text-zinc-500'
                      }`}
                    >
                      <span>Projects</span>
                      <span className="font-mono">{site.usage.projects}/{site.quota.projectLimit}</span>
                    </div>
                    <div
                      className={`mt-1 h-1 overflow-hidden rounded-full ${
                        selected ? 'bg-white/20' : 'bg-zinc-100'
                      }`}
                    >
                      <div
                        className={`h-full rounded-full ${
                          selected ? 'bg-white' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${projectPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Storage usage */}
                  <div>
                    <div
                      className={`flex items-center justify-between text-[10px] ${
                        selected ? 'text-zinc-300' : 'text-zinc-500'
                      }`}
                    >
                      <span>Storage R2</span>
                      <span className="font-mono">
                        {storageMb < 1 ? `${storageMb} MB` : `${Math.round(storageMb)} MB`}/{storageLimitMb} MB
                      </span>
                    </div>
                    <div
                      className={`mt-1 h-1 overflow-hidden rounded-full ${
                        selected ? 'bg-white/20' : 'bg-zinc-100'
                      }`}
                    >
                      <div
                        className={`h-full rounded-full ${storageBarColor}`}
                        style={{ width: `${storagePercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}

