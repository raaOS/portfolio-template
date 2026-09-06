'use client';

import { useState } from 'react';
import { Code2, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminAuthGuard } from '@/app/admin/components/AdminAuthGuard';
import { AdminHeader } from '@/app/admin/components/components/AdminHeader';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useToast } from '@/contexts/ToastContext';
import { getWritableCsrfToken } from '@/lib/security/client-csrf';

interface Skill {
  id: string;
  name: string;
  level: number;
  icon: string;
  description: string;
}

async function fetchSkills(): Promise<Skill[]> {
  const res = await fetch('/api/templates/os-desktop/skills');
  if (!res.ok) throw new Error('Gagal memuat data');
  return res.json();
}

function SkillsForm() {
  const { csrfToken } = useAdminAuth();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [saving, setSaving] = useState(false);

  const { data: skills = [], isLoading } = useQuery({
    queryKey: ['os-desktop-skills'],
    queryFn: fetchSkills,
  });

  const updateField = (id: string, field: keyof Skill, value: string | number) => {
    queryClient.setQueryData(['os-desktop-skills'], skills.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const addSkill = () => {
    queryClient.setQueryData(['os-desktop-skills'], [...skills, { id: `skill-${Date.now()}`, name: '', level: 50, icon: '', description: '' }]);
  };

  const removeSkill = (id: string) => {
    queryClient.setQueryData(['os-desktop-skills'], skills.filter((s) => s.id !== id));
  };

  const handleSave = async () => {
    if (!csrfToken) return;
    setSaving(true);
    try {
      const token = getWritableCsrfToken(csrfToken);
      const res = await fetch('/api/templates/os-desktop/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
        body: JSON.stringify(skills),
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
      {skills.map((skill) => (
        <div key={skill.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-medium text-gray-900">Skill</h4>
            <button onClick={() => removeSkill(skill.id)} className="text-red-600 hover:text-red-800">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input placeholder="Nama skill" value={skill.name} onChange={(e) => updateField(skill.id, 'name', e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            <input type="number" min={0} max={100} placeholder="Level (0-100)" value={skill.level}
              onChange={(e) => updateField(skill.id, 'level', parseInt(e.target.value) || 0)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            <input placeholder="Icon (lucide name)" value={skill.icon} onChange={(e) => updateField(skill.id, 'icon', e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button onClick={addSkill} className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <Plus className="h-4 w-4" /> Tambah Skill
        </button>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Simpan
        </button>
      </div>
    </div>
  );
}

export default function OSDesktopSkillsPage() {
  return (
    <AdminAuthGuard>
      <AdminHeader
        title="Hard Skills"
        titleIcon={<Code2 className="h-5 w-5" aria-hidden />}
        titleAccent="bg-amber-50 text-amber-700"
      />
      <div className="flex-1 space-y-6 p-6">
        <SkillsForm />
      </div>
    </AdminAuthGuard>
  );
}
