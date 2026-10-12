'use client';

import { PlayCircle } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useAdminSystem } from '@/app/admin/hooks/useAdminSystem';
import { useAdminContent } from '@/app/admin/hooks/useAdminContent';
import LoaderManagerForm from '@/app/admin/system/components/LoaderManagerForm';
import AdminLoading from '@/components/admin/AdminLoading';

export default function LoaderPanel() {
  const { csrfToken } = useAdminAuth();
  const { systemData, loading, error, isPlaceholderData, handleUpdateSystem } =
    useAdminSystem(csrfToken);
  const { projects } = useAdminContent(csrfToken);

  if (loading && !systemData) return <AdminLoading size="default" />;

  if (!systemData) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-red-600">Gagal memuat data sistem.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {error && (
        <div className="rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      <div className="mb-2 rounded-lg border border-violet-200 bg-violet-50 p-4">
        <h3 className="flex items-center gap-2 font-bold text-violet-800">
          <PlayCircle className="h-5 w-5" /> Animasi Loader Halaman Utama
        </h3>
        <p className="mt-1 text-sm text-violet-600">
          Atur animasi pembuka tumpukan gambar yang tampil sekali per kunjungan
          sebelum konten homepage muncul.
        </p>
      </div>

      <LoaderManagerForm
        data={systemData.loaderConfig}
        projects={projects}
        onUpdate={(cfg) => handleUpdateSystem({ loaderConfig: cfg })}
        isLoading={isPlaceholderData}
      />
    </div>
  );
}
