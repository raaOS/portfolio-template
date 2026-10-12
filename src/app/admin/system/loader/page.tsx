'use client';

import { MonitorPlay } from 'lucide-react';
import { AdminAuthGuard } from '../../components/AdminAuthGuard';
import { AdminHeader } from '../../components/components/AdminHeader';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useAdminSystem } from '../../hooks/useAdminSystem';
import { useAdminContent } from '../../hooks/useAdminContent';
import LoaderManagerForm from '../components/LoaderManagerForm';
import AdminLoading from '@/components/admin/AdminLoading';

function LoaderClientContent() {
  const { csrfToken } = useAdminAuth();
  const {
    systemData,
    loading,
    error,
    isPlaceholderData: systemIsPlaceholder,
    handleUpdateSystem,
  } = useAdminSystem(csrfToken);

  const { projects } = useAdminContent(csrfToken);

  if (loading && !systemData) {
    return (
      <div className="flex-1 space-y-6 p-6">
        <AdminLoading size="default" />
      </div>
    );
  }

  if (!systemData) {
    return (
      <div className="flex-1 space-y-6 p-6">
        <div className="flex items-center justify-center py-8">
          <p className="text-red-600">Gagal memuat data sistem.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <AdminHeader
        title="Loader Animasi"
        titleIcon={<MonitorPlay className="h-5 w-5" aria-hidden />}
        titleAccent="bg-violet-50 text-violet-700"
      />

      <div className="flex-1 space-y-6 p-6">
        {error && (
          <div className="mb-6 flex items-center justify-between rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
            <span>{error}</span>
          </div>
        )}

        <div className="min-h-[500px] w-full overflow-hidden rounded-lg border border-gray-200 bg-white p-6 shadow-sm lg:p-8">
          <LoaderManagerForm
            data={systemData.loaderConfig}
            projects={projects}
            onUpdate={(cfg) => handleUpdateSystem({ loaderConfig: cfg })}
            isLoading={systemIsPlaceholder}
          />
        </div>
      </div>
    </>
  );
}

export default function AdminLoaderPage() {
  return (
    <AdminAuthGuard>
      <LoaderClientContent />
    </AdminAuthGuard>
  );
}
