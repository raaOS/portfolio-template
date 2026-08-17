'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Eye,
  FolderKanban,
  Loader2,
  MousePointerClick,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import type { SiteAnalyticsSummary } from '@/lib/services/analyticsService';

interface AnalyticsModulePanelProps {
  siteId: string;
}

export function AnalyticsModulePanel({ siteId }: AnalyticsModulePanelProps) {
  const [summary, setSummary] = useState<SiteAnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/client/analytics?siteId=${encodeURIComponent(siteId)}`);
      if (!res.ok) throw new Error('Gagal memuat data analitik');
      const json = await res.json();
      setSummary(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setIsLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    let isMounted = true;
    if (siteId) {
      fetch(`/api/client/analytics?siteId=${encodeURIComponent(siteId)}`)
        .then((res) => {
          if (!res.ok) throw new Error('Gagal memuat data analitik');
          return res.json();
        })
        .then((json) => {
          if (isMounted) {
            setSummary(json.data);
            setIsLoading(false);
          }
        })
        .catch((err) => {
          if (isMounted) {
            setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
            setIsLoading(false);
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [siteId]);

  return (
    <div className="space-y-5 p-4 text-zinc-900">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-3">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-indigo-600" />
            <span>Statistik Pengunjung & Interaksi Site</span>
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Analitik site-scoped internal tanpa tracking script pihak ketiga yang memperlambat site.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchAnalytics()}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-xs text-zinc-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-indigo-600" />
          Memuat data analitik...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-600">
          {error}
        </div>
      ) : summary ? (
        <>
          {/* Stat Cards Grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-zinc-500">
                <span className="text-xs font-medium">Total Pengunjung Site</span>
                <Eye className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-900">{summary.totalViews}</p>
              <p className="mt-1 text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Real-time active hits
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-zinc-500">
                <span className="text-xs font-medium">Project Dilihat</span>
                <FolderKanban className="h-4 w-4 text-purple-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-900">{summary.uniqueProjectsCount}</p>
              <p className="mt-1 text-[11px] text-zinc-500">Project unik yang pernah diklik</p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-zinc-500">
                <span className="text-xs font-medium">Interaksi Fitur OS</span>
                <MousePointerClick className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-900">
                {summary.popularApps.reduce((acc, a) => acc + a.clicks, 0)}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">Klik ikon & aplikasi OS</p>
            </div>
          </div>

          {/* Leaderboard & Distribution Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Top Projects Leaderboard */}
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                🏆 Project Paling Populer
              </h3>
              {summary.topProjects.length === 0 ? (
                <p className="text-xs text-zinc-500 italic">Belum ada interaksi project.</p>
              ) : (
                <div className="space-y-2">
                  {summary.topProjects.map((p, idx) => (
                    <div key={p.slug} className="flex items-center justify-between text-xs py-1.5 border-b border-zinc-100 last:border-0">
                      <span className="font-medium text-zinc-700">
                        {idx + 1}. {p.title}
                      </span>
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-bold text-indigo-600">
                        {p.views} views
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* OS App Popularity */}
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                📱 Aplikasi OS Terfavorit Pengunjung
              </h3>
              {summary.popularApps.length === 0 ? (
                <p className="text-xs text-zinc-500 italic">Belum ada data aplikasi.</p>
              ) : (
                <div className="space-y-2">
                  {summary.popularApps.map((a) => (
                    <div key={a.name} className="flex items-center justify-between text-xs py-1.5 border-b border-zinc-100 last:border-0">
                      <span className="font-medium text-zinc-700">{a.name}</span>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">
                        {a.clicks} klik
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
