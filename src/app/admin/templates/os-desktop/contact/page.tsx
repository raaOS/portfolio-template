'use client';

import { useState } from 'react';
import { Mail, Save, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminAuthGuard } from '@/app/admin/components/AdminAuthGuard';
import { AdminHeader } from '@/app/admin/components/components/AdminHeader';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useToast } from '@/contexts/ToastContext';
import { getWritableCsrfToken } from '@/lib/security/client-csrf';

interface ContactData {
  email: string;
  phone: string;
  location: string;
  socialLinks: Record<string, string>;
}

async function fetchContact(): Promise<ContactData> {
  const res = await fetch('/api/templates/os-desktop/contact');
  if (!res.ok) throw new Error('Gagal memuat data');
  return res.json();
}

function ContactForm() {
  const { csrfToken } = useAdminAuth();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['os-desktop-contact'],
    queryFn: fetchContact,
  });

  const updateField = (field: keyof ContactData, value: string) => {
    if (!data) return;
    queryClient.setQueryData(['os-desktop-contact'], { ...data, [field]: value });
  };

  const handleSave = async () => {
    if (!data || !csrfToken) return;
    setSaving(true);
    try {
      const token = getWritableCsrfToken(csrfToken);
      const res = await fetch('/api/templates/os-desktop/contact', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
        body: JSON.stringify(data),
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
  if (!data) return <div className="py-20 text-center text-red-600">Gagal memuat data</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Info Kontak</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input type="email" value={data.email} onChange={(e) => updateField('email', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Telepon</label>
            <input type="text" value={data.phone} onChange={(e) => updateField('phone', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
        </div>
        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">Lokasi</label>
          <input type="text" value={data.location} onChange={(e) => updateField('location', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Simpan
        </button>
      </div>
    </div>
  );
}

export default function OSDesktopContactPage() {
  return (
    <AdminAuthGuard>
      <AdminHeader
        title="Kontak"
        titleIcon={<Mail className="h-5 w-5" aria-hidden />}
        titleAccent="bg-cyan-50 text-cyan-700"
      />
      <div className="flex-1 space-y-6 p-6">
        <ContactForm />
      </div>
    </AdminAuthGuard>
  );
}
