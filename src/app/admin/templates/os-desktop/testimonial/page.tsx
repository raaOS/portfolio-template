'use client';

import { useState } from 'react';
import { MessageSquare, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminAuthGuard } from '@/app/admin/components/AdminAuthGuard';
import { AdminHeader } from '@/app/admin/components/components/AdminHeader';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useToast } from '@/contexts/ToastContext';
import { getWritableCsrfToken } from '@/lib/security/client-csrf';

interface Testimonial {
  id: string;
  name: string;
  company: string;
  content: string;
  rating: number;
}

async function fetchTestimonials(): Promise<Testimonial[]> {
  const res = await fetch('/api/templates/os-desktop/testimonial');
  if (!res.ok) throw new Error('Gagal memuat data');
  return res.json();
}

function TestimonialForm() {
  const { csrfToken } = useAdminAuth();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: testimonials = [], isLoading } = useQuery({
    queryKey: ['os-desktop-testimonials'],
    queryFn: fetchTestimonials,
  });

  const updateField = (id: string, field: keyof Testimonial, value: string | number) => {
    queryClient.setQueryData(['os-desktop-testimonials'], testimonials.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const addTestimonial = () => {
    queryClient.setQueryData(['os-desktop-testimonials'], [
      ...testimonials,
      { id: `test-${Date.now()}`, name: '', company: '', content: '', rating: 5 },
    ]);
  };

  const handleSave = async (testimonial: Testimonial) => {
    if (!csrfToken) return;
    setSavingId(testimonial.id);
    try {
      const token = getWritableCsrfToken(csrfToken);
      const res = await fetch('/api/templates/os-desktop/testimonial', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
        body: JSON.stringify(testimonial),
      });
      if (!res.ok) throw new Error('Gagal menyimpan');
      showSuccess('Berhasil disimpan!');
    } catch {
      showError('Gagal menyimpan testimoni');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus testimoni ini?')) return;
    if (!csrfToken) return;
    try {
      const token = getWritableCsrfToken(csrfToken);
      const res = await fetch('/api/templates/os-desktop/testimonial', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Gagal menghapus');
      queryClient.setQueryData(['os-desktop-testimonials'], testimonials.filter((t) => t.id !== id));
    } catch {
      showError('Gagal menghapus testimoni');
    }
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-4">
      {testimonials.map((test) => (
        <div key={test.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-medium text-gray-900">Testimoni</h4>
            <div className="flex items-center gap-2">
              <button onClick={() => handleSave(test)} disabled={savingId === test.id} className="text-blue-600 hover:text-blue-800">
                {savingId === test.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </button>
              <button onClick={() => handleDelete(test.id)} className="text-red-600 hover:text-red-800">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input placeholder="Nama klien" value={test.name} onChange={(e) => updateField(test.id, 'name', e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            <input placeholder="Perusahaan" value={test.company} onChange={(e) => updateField(test.id, 'company', e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
          <textarea placeholder="Isi testimoni" value={test.content} onChange={(e) => updateField(test.id, 'content', e.target.value)}
            rows={3} className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          <div className="mt-2">
            <label className="mr-2 text-sm text-gray-600">Rating:</label>
            <select value={test.rating} onChange={(e) => updateField(test.id, 'rating', parseInt(e.target.value))}
              className="rounded border border-gray-300 px-2 py-1 text-sm">
              {[1, 2, 3, 4, 5].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
      ))}

      <button onClick={addTestimonial} className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
        <Plus className="h-4 w-4" /> Tambah Testimoni
      </button>
    </div>
  );
}

export default function OSDesktopTestimonialPage() {
  return (
    <AdminAuthGuard>
      <AdminHeader
        title="Testimoni"
        titleIcon={<MessageSquare className="h-5 w-5" aria-hidden />}
        titleAccent="bg-pink-50 text-pink-700"
      />
      <div className="flex-1 space-y-6 p-6">
        <TestimonialForm />
      </div>
    </AdminAuthGuard>
  );
}
