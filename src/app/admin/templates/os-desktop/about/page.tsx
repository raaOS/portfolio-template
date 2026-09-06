'use client';

import { useState } from 'react';
import { User, Save, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminAuthGuard } from '@/app/admin/components/AdminAuthGuard';
import { AdminHeader } from '@/app/admin/components/components/AdminHeader';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useToast } from '@/contexts/ToastContext';
import { getWritableCsrfToken } from '@/lib/security/client-csrf';

interface AboutData {
  hero: { name: string; title: string; headline: string; description: string };
  professional: { bio: string };
}

async function fetchAbout(): Promise<AboutData> {
  const res = await fetch('/api/templates/os-desktop/about');
  if (!res.ok) throw new Error('Gagal memuat data');
  return res.json();
}

function AboutForm() {
  const { csrfToken } = useAdminAuth();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [saving, setSaving] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['os-desktop-about'],
    queryFn: fetchAbout,
  });

  const handleSave = async () => {
    if (!data || !csrfToken) return;
    setSaving(true);
    try {
      const token = getWritableCsrfToken(csrfToken);
      const res = await fetch('/api/templates/os-desktop/about', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Gagal menyimpan');
      queryClient.invalidateQueries({ queryKey: ['os-desktop-about'] });
      showSuccess('Berhasil disimpan!');
    } catch {
      showError('Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  if (error || !data) return <div className="py-20 text-center text-red-600">Gagal memuat data</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Hero Section</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Nama</label>
            <input
              type="text"
              value={data.hero.name}
              onChange={(e) => queryClient.setQueryData(['os-desktop-about'], { ...data, hero: { ...data.hero, name: e.target.value } })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Title / Jabatan</label>
            <input
              type="text"
              value={data.hero.title}
              onChange={(e) => queryClient.setQueryData(['os-desktop-about'], { ...data, hero: { ...data.hero, title: e.target.value } })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">Headline</label>
          <textarea
            value={data.hero.headline}
            onChange={(e) => queryClient.setQueryData(['os-desktop-about'], { ...data, hero: { ...data.hero, headline: e.target.value } })}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">Deskripsi</label>
          <textarea
            value={data.hero.description}
            onChange={(e) => queryClient.setQueryData(['os-desktop-about'], { ...data, hero: { ...data.hero, description: e.target.value } })}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Professional Bio</h3>
        <textarea
          value={data.professional.bio}
          onChange={(e) => queryClient.setQueryData(['os-desktop-about'], { ...data, professional: { ...data.professional, bio: e.target.value } })}
          rows={5}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Simpan
        </button>
      </div>
    </div>
  );
}

export default function OSDesktopAboutPage() {
  return (
    <AdminAuthGuard>
      <AdminHeader
        title="Profil & About"
        titleIcon={<User className="h-5 w-5" aria-hidden />}
        titleAccent="bg-blue-50 text-blue-700"
      />
      <div className="flex-1 space-y-6 p-6">
        <AboutForm />
      </div>
    </AdminAuthGuard>
  );
}
