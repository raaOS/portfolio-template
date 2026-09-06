'use client';

import { useState } from 'react';
import { Briefcase, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminAuthGuard } from '@/app/admin/components/AdminAuthGuard';
import { AdminHeader } from '@/app/admin/components/components/AdminHeader';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useToast } from '@/contexts/ToastContext';
import { getWritableCsrfToken } from '@/lib/security/client-csrf';

interface WorkExperience {
  id: string;
  company: string;
  position: string;
  period: string;
  description: string;
}

interface ExperienceData {
  workExperience: WorkExperience[];
}

async function fetchExperience(): Promise<ExperienceData> {
  const res = await fetch('/api/templates/os-desktop/experience');
  if (!res.ok) throw new Error('Gagal memuat data');
  const json = await res.json();
  return { workExperience: json.workExperience || [] };
}

function ExperienceForm() {
  const { csrfToken } = useAdminAuth();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['os-desktop-experience'],
    queryFn: fetchExperience,
  });

  const workExperience = data?.workExperience || [];

  const updateField = (id: string, field: keyof WorkExperience, value: string) => {
    const updated = workExperience.map((e) => (e.id === id ? { ...e, [field]: value } : e));
    queryClient.setQueryData(['os-desktop-experience'], { workExperience: updated });
  };

  const addExperience = () => {
    const updated = [...workExperience, { id: `exp-${Date.now()}`, company: '', position: '', period: '', description: '' }];
    queryClient.setQueryData(['os-desktop-experience'], { workExperience: updated });
  };

  const removeExperience = (id: string) => {
    queryClient.setQueryData(['os-desktop-experience'], { workExperience: workExperience.filter((e) => e.id !== id) });
  };

  const handleSave = async () => {
    if (!csrfToken) return;
    setSaving(true);
    try {
      const token = getWritableCsrfToken(csrfToken);
      const res = await fetch('/api/templates/os-desktop/experience', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
        body: JSON.stringify({ workExperience }),
      });
      if (!res.ok) throw new Error('Gagal menyimpan');
      showSuccess('Berhasil disimpan!');
    } catch {
      showError('Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-4">
      {workExperience.map((exp) => (
        <div key={exp.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-medium text-gray-900">Pengalaman</h4>
            <button onClick={() => removeExperience(exp.id)} className="text-red-600 hover:text-red-800">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input placeholder="Perusahaan" value={exp.company} onChange={(e) => updateField(exp.id, 'company', e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            <input placeholder="Posisi" value={exp.position} onChange={(e) => updateField(exp.id, 'position', e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            <input placeholder="Periode (misal: 2020 - 2023)" value={exp.period} onChange={(e) => updateField(exp.id, 'period', e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
          <textarea placeholder="Deskripsi pekerjaan" value={exp.description} onChange={(e) => updateField(exp.id, 'description', e.target.value)}
            rows={2} className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button onClick={addExperience} className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <Plus className="h-4 w-4" /> Tambah Pengalaman
        </button>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Simpan
        </button>
      </div>
    </div>
  );
}

export default function OSDesktopExperiencePage() {
  return (
    <AdminAuthGuard>
      <AdminHeader
        title="Pengalaman Kerja"
        titleIcon={<Briefcase className="h-5 w-5" aria-hidden />}
        titleAccent="bg-purple-50 text-purple-700"
      />
      <div className="flex-1 space-y-6 p-6">
        <ExperienceForm />
      </div>
    </AdminAuthGuard>
  );
}
