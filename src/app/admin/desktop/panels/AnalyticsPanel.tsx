'use client';

import { useQuery } from '@tanstack/react-query';
import AdminLoading from '@/components/admin/AdminLoading';
import {
  ADMIN_DATA_GC_TIME,
  ADMIN_DATA_STALE_TIME,
  ADMIN_QUERY_KEYS,
  fetchAdminAnalytics,
} from '@/app/admin/lib/adminQueries';

function formatLastActive(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function ListSection({
  title,
  items,
}: {
  title: string;
  items: Array<{ key: string; label: string; count: number }>;
}) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-4 text-sm">
            <span className="truncate text-gray-700">{item.label}</span>
            <span className="shrink-0 tabular-nums text-gray-500">{item.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Ringkasan analitik pengunjung, dibaca dari tabel D1 `site_analytics`
 * lewat GET /api/analytics. Sengaja hanya menampilkan bagian yang punya
 * data — kolom yang belum pernah diisi (mis. aplikasi populer) tidak
 * dirender sebagai angka nol yang membingungkan.
 */
export default function AnalyticsPanel() {
  const { data: summary, isLoading, error } = useQuery({
    queryKey: ADMIN_QUERY_KEYS.analytics,
    queryFn: fetchAdminAnalytics,
    staleTime: ADMIN_DATA_STALE_TIME,
    gcTime: ADMIN_DATA_GC_TIME,
    refetchOnMount: 'always',
  });

  if (isLoading) return <AdminLoading size="default" />;

  if (error) {
    return (
      <div className="rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
        Gagal memuat analitik: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  if (!summary) return null;

  const isEmpty = summary.totalViews === 0 && summary.otherEvents.length === 0;

  if (isEmpty) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
        <p className="text-sm font-medium text-gray-700">Belum ada data kunjungan.</p>
        <p className="mt-1 text-sm text-gray-500">
          Angka mulai terkumpul sejak pengunjung membuka halaman.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total kunjungan" value={summary.totalViews} />
        <StatCard label="Halaman tercatat" value={summary.topPages.length} />
        <StatCard label="Terakhir aktif" value={formatLastActive(summary.lastActive)} />
      </div>

      <ListSection
        title="Halaman populer"
        items={summary.topPages.map((page) => ({
          key: page.path,
          label: page.path,
          count: page.views,
        }))}
      />

      <ListSection
        title="Proyek terpopuler"
        items={summary.topProjects.map((project) => ({
          key: project.slug,
          label: project.title,
          count: project.views,
        }))}
      />

      <ListSection
        title="Aplikasi paling sering dibuka"
        items={summary.popularApps.map((app) => ({
          key: app.name,
          label: app.name,
          count: app.clicks,
        }))}
      />

      <ListSection
        title="Event lain"
        items={summary.otherEvents.map((event) => ({
          key: event.event,
          label: event.event,
          count: event.count,
        }))}
      />
    </div>
  );
}
