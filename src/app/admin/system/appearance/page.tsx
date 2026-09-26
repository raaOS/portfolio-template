'use client';

import { useState, lazy, Suspense } from 'react';
import { Monitor, Image as ImageIcon, Box } from 'lucide-react';
import { AdminAuthGuard } from '../../components/AdminAuthGuard';
import { AdminHeader } from '../../components/components/AdminHeader';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useAdminSystem } from '../../hooks/useAdminSystem';
import { useAdminContent } from '../../hooks/useAdminContent';
import WallpaperManager from '../components/WallpaperManager';
import DesktopProjectsForm from '../components/DesktopProjectsForm';
import AdminLoading from '@/components/admin/AdminLoading';

const SpatialModelManager = lazy(() => import('../components/SpatialModelManager'));

function AppearanceClientContent() {
  const { csrfToken } = useAdminAuth();
  const {
    systemData,
    loading,
    error,
    isPlaceholderData: systemIsPlaceholder,
    handleUpdateSystem,
  } = useAdminSystem(csrfToken);

  const { projects } = useAdminContent(csrfToken);

  const [activeSubTab, setActiveSubTab] = useState<'wallpaper' | 'desktop' | 'spatial'>('wallpaper');

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
        title="Tampilan & Desktop"
        titleIcon={<Monitor className="h-5 w-5" aria-hidden />}
        titleAccent="bg-cyan-50 text-cyan-700"
      />

      <div className="flex-1 space-y-6 p-6">
        {error && (
          <div className="mb-6 flex items-center justify-between rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
            <span>{error}</span>
          </div>
        )}

        {/* Sub-Tabs Selector */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveSubTab('wallpaper')}
            className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-semibold transition-all ${
              activeSubTab === 'wallpaper'
                ? 'border-cyan-600 text-cyan-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            <ImageIcon className="h-4 w-4" />
            Wallpaper & Tema
          </button>
          <button
            onClick={() => setActiveSubTab('desktop')}
            className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-semibold transition-all ${
              activeSubTab === 'desktop'
                ? 'border-cyan-600 text-cyan-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            <Monitor className="h-4 w-4" />
            Ikon Desktop
          </button>
          <button
            onClick={() => setActiveSubTab('spatial')}
            className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-semibold transition-all ${
              activeSubTab === 'spatial'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            <Box className="h-4 w-4" />
            Objek 3D Spatial
          </button>
        </div>

        {/* Tab Content */}
        <div className="min-h-[500px] w-full overflow-hidden rounded-lg border border-gray-200 bg-white p-6 shadow-sm lg:p-8">
          {activeSubTab === 'wallpaper' ? (
            <div className="space-y-8">
              <div className="mb-6 rounded-lg border border-cyan-200 bg-cyan-50 p-4">
                <h3 className="flex items-center gap-2 font-bold text-cyan-800">
                  <ImageIcon className="h-5 w-5" /> Konfigurasi Wallpaper & Tema
                </h3>
                <p className="mt-1 text-sm text-cyan-600">
                  Ganti latar belakang desktop dan atur transparansi window.
                </p>
              </div>
              <WallpaperManager
                data={systemData.wallpaperConfig}
                onUpdate={(data) => handleUpdateSystem({ wallpaperConfig: data })}
                isLoading={systemIsPlaceholder}
              />
            </div>
          ) : activeSubTab === 'desktop' ? (
            <div className="space-y-8">
              <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <h3 className="flex items-center gap-2 font-bold text-blue-800">
                  <Monitor className="h-5 w-5" /> Konfigurasi Ikon Desktop
                </h3>
                <p className="mt-1 text-sm text-blue-600">
                  Atur shortcut aplikasi dan file yang tampil di halaman utama.
                </p>
              </div>
              <DesktopProjectsForm
                projects={projects}
                data={systemData.desktopPreferences}
                onUpdate={(data) => handleUpdateSystem({ desktopPreferences: data })}
              />
            </div>
          ) : (
            <div className="space-y-8">
              <div className="mb-6 rounded-lg border border-purple-200 bg-purple-50 p-4">
                <h3 className="flex items-center gap-2 font-bold text-purple-800">
                  <Box className="h-5 w-5" /> Objek 3D Tengah — Spatial Gallery
                </h3>
                <p className="mt-1 text-sm text-purple-600">
                  Ganti model 3D di tengah ring template Spatial Gallery. Upload file .glb kustom atau gunakan preset bawaan.
                </p>
              </div>
              <Suspense fallback={<AdminLoading size="default" />}>
                <SpatialModelManager
                  data={systemData.spatialGalleryConfig}
                  onUpdate={(cfg) => handleUpdateSystem({ spatialGalleryConfig: cfg })}
                  csrfToken={csrfToken}
                  isLoading={systemIsPlaceholder}
                />
              </Suspense>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function AdminAppearancePage() {
  return (
    <AdminAuthGuard>
      <AppearanceClientContent />
    </AdminAuthGuard>
  );
}
