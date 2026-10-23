'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ContactData, ContactInfo, UpdateContactData } from '@/types/contact';
import { AdminHeader } from '../../components/components/AdminHeader';
import { useToast } from '@/contexts/ToastContext';
import { PhoneCall, Type, Share2, Info, Mail } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import {
  ADMIN_DATA_GC_TIME,
  ADMIN_DATA_STALE_TIME,
  ADMIN_PLACEHOLDER_DATA,
  ADMIN_QUERY_KEYS,
  fetchAdminContact,
} from '../../lib/adminQueries';

export default function AdminContactClient() {
  const queryClient = useQueryClient();
  const [, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'info' | 'socials' | 'labels'>(
    'content'
  );
  const { showSuccess, showError } = useToast();
  const { csrfToken } = useAdminAuth();

  const contactQuery = useQuery({
    queryKey: ADMIN_QUERY_KEYS.contact,
    queryFn: fetchAdminContact,
    staleTime: ADMIN_DATA_STALE_TIME,
    gcTime: ADMIN_DATA_GC_TIME,
    placeholderData: ADMIN_PLACEHOLDER_DATA.contact,
  });

  const contactData = contactQuery.data ?? null;
  const loading = contactQuery.isLoading;

  const handleUpdateContact = async (updateData: UpdateContactData) => {
    try {
      const response = await fetch('/api/contact', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken || '',
        },
        credentials: 'include',
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        const result = await response.json();
        if (result?.data) {
          queryClient.setQueryData(ADMIN_QUERY_KEYS.contact, result.data as ContactData);
        } else {
          await queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.contact });
        }
        setError(null);
        showSuccess('Contact updated successfully.');
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(
          `Failed to update contact: ${errorData.error || response.statusText} (${response.status})`
        );
        showError(
          `Failed to update contact: ${errorData.error || response.statusText} (${response.status})`
        );
      }
    } catch (err) {
      setError(`Failed to update contact: ${err instanceof Error ? err.message : 'Network error'}`);
      showError(
        `Failed to update contact: ${err instanceof Error ? err.message : 'Network error'}`
      );
    }
  };

  if (loading) {
    return (
      <>
        <AdminHeader
          title="Contact Page"
          titleIcon={<PhoneCall className="h-5 w-5" aria-hidden />}
          titleAccent="bg-amber-50 text-amber-700"
        />
        <div className="flex-1 space-y-6 p-6">
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-amber-600"></div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AdminHeader
        title="Contact Page"
        titleIcon={<PhoneCall className="h-5 w-5" aria-hidden />}
        titleAccent="bg-amber-50 text-amber-700"
      />
      <div className="flex-1 space-y-6 p-6">
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {/* Modern Tabs */}
          <div className="border-b border-gray-200 bg-gray-50/50">
            <nav className="flex space-x-1 px-4 py-2">
              {[
                { id: 'content', name: 'Page Content', icon: Type },
                { id: 'info', name: 'Contact Info', icon: Mail },
                { id: 'socials', name: 'Social Media', icon: Share2 },
                { id: 'labels', name: 'Settings', icon: Info },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() =>
                      setActiveTab(tab.id as 'content' | 'info' | 'socials' | 'labels')
                    }
                    className={`flex items-center rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-amber-100 text-amber-800 shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100'
                    } `}
                  >
                    <Icon
                      className={`mr-2 h-4 w-4 ${activeTab === tab.id ? 'text-amber-600' : 'text-gray-400'}`}
                    />
                    {tab.name}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'content' && contactData && (
              <div className="max-w-2xl">
                <h3 className="mb-6 text-lg font-medium text-gray-900">Edit Page Text</h3>
                <ContactContentForm
                  data={contactData.content || { headline: '', subtext: '' }}
                  onUpdate={(data) => handleUpdateContact({ content: data })}
                />
              </div>
            )}

            {activeTab === 'info' && contactData && (
              <div className="max-w-2xl">
                <h3 className="mb-2 text-lg font-medium text-gray-900">Kontak Publik</h3>
                <p className="mb-6 text-sm text-gray-500">
                  Kontak yang tampil ke pengunjung (window Contact, tombol chat WhatsApp,
                  link email). Di situs klien, isinya kontak milik klien tersebut.
                </p>
                <ContactInfoForm
                  info={contactData.info}
                  onUpdate={(info) => handleUpdateContact({ info })}
                />
              </div>
            )}

            {activeTab === 'labels' && contactData && (
              <div className="max-w-2xl">
                <h3 className="mb-6 text-lg font-medium text-gray-900">UI Labels & Settings</h3>
                <ContactLabelsForm
                  labels={contactData.labels || {}}
                  onUpdate={(labels) => handleUpdateContact({ labels })}
                />
              </div>
            )}

            {activeTab === 'socials' && contactData && (
              <div className="max-w-2xl">
                <h3 className="mb-6 text-lg font-medium text-gray-900">Manage Social Links</h3>
                <SocialMediaForm
                  data={contactData.info.socialMedia}
                  onUpdate={(socialData) =>
                    handleUpdateContact({ info: { ...contactData.info, socialMedia: socialData } })
                  }
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// --- Subcomponents ---

interface ContactLabelsFormProps {
  labels: Record<string, string>;
  onUpdate: (l: Record<string, string>) => void;
}

function ContactLabelsForm({ labels, onUpdate }: ContactLabelsFormProps) {
  const [form, setForm] = useState(labels || {});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-700">Chat Button Text</label>
        <input
          type="text"
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500"
          placeholder="Chat Langsung"
          value={form.chatButtonText || ''}
          onChange={(e) => setForm({ ...form, chatButtonText: e.target.value })}
        />
      </div>

      <div className="pt-4">
        <button
          type="submit"
          className="rounded-lg bg-gray-900 px-6 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-black"
        >
          Save Settings
        </button>
      </div>
    </form>
  );
}

interface ContactContentFormProps {
  data: { headline: string; subtext: string };
  onUpdate: (d: { headline: string; subtext: string }) => void;
}

function ContactContentForm({ data, onUpdate }: ContactContentFormProps) {
  const [form, setForm] = useState(data);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-700">
          Headline (Judul Utama)
        </label>
        <p className="mb-6 text-sm text-gray-500">
          Kelola link media sosial dan kontak yang muncul di folder &quot;Contact&quot; pada About
          OS.
        </p>
        <textarea
          required
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 font-mono text-sm transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500"
          placeholder="Let's Create..."
          value={form.headline}
          onChange={(e) => setForm({ ...form, headline: e.target.value })}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-700">
          Subtext (Deskripsi)
        </label>
        <textarea
          required
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500"
          placeholder="We build digital experiences..."
          value={form.subtext}
          onChange={(e) => setForm({ ...form, subtext: e.target.value })}
        />
      </div>

      <div className="pt-4">
        <button
          type="submit"
          className="rounded-lg bg-gray-900 px-6 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-black"
        >
          Save Content
        </button>
      </div>
    </form>
  );
}

interface ContactInfoFormProps {
  info: ContactInfo;
  onUpdate: (info: ContactInfo) => void;
}

function ContactInfoForm({ info, onUpdate }: ContactInfoFormProps) {
  const [email, setEmail] = useState(info.email || '');
  const [phone, setPhone] = useState(info.phone || '');
  const [whatsapp, setWhatsapp] = useState(info.socialMedia?.whatsapp || '');
  const [address, setAddress] = useState(info.address || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate({
      ...info,
      email,
      phone,
      address,
      socialMedia: { ...info.socialMedia, whatsapp },
    });
  };

  const fields = [
    {
      key: 'email',
      label: 'Email',
      type: 'email',
      placeholder: 'nama@email.com',
      value: email,
      onChange: setEmail,
    },
    {
      key: 'phone',
      label: 'Telepon',
      type: 'tel',
      placeholder: '+62 812-3456-7890',
      value: phone,
      onChange: setPhone,
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      type: 'tel',
      placeholder: '6281234567890',
      value: whatsapp,
      onChange: setWhatsapp,
      hint: 'Dipakai fitur chat — pesan pengunjung diteruskan ke WhatsApp-mu. Format: 6281234567890 (tanpa +).',
    },
    {
      key: 'address',
      label: 'Alamat',
      type: 'text',
      placeholder: 'Jakarta, Indonesia',
      value: address,
      onChange: setAddress,
    },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {fields.map((f) => (
        <div key={f.key}>
          <label className="mb-1 block text-sm font-medium text-gray-700">{f.label}</label>
          <input
            type={f.type}
            autoComplete="off"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500"
            placeholder={f.placeholder}
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
          />
          {'hint' in f && f.hint && (
            <p className="mt-1 text-xs text-gray-500">{f.hint}</p>
          )}
        </div>
      ))}

      <div className="pt-4">
        <button
          type="submit"
          className="rounded-lg bg-gray-900 px-6 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-black"
        >
          Save Contact Info
        </button>
      </div>
    </form>
  );
}

interface SocialMediaFormProps {
  data: Record<string, string>;
  onUpdate: (d: Record<string, string>) => void;
}

function SocialMediaForm({ data, onUpdate }: SocialMediaFormProps) {
  const [form, setForm] = useState(data || {});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(form);
  };

  const platforms = [
    { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/username' },
    { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/username' },
    { key: 'twitter', label: 'Twitter / X', placeholder: 'https://x.com/username' },
    { key: 'behance', label: 'Behance', placeholder: 'https://behance.net/username' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {platforms.map((p) => (
        <div key={p.key}>
          <label className="mb-1 block text-sm font-medium capitalize text-gray-700">
            {p.label}
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500"
            placeholder={p.placeholder}
            value={form[p.key] || ''}
            onChange={(e) => setForm({ ...form, [p.key]: e.target.value })}
          />
        </div>
      ))}

      <div className="pt-4">
        <button
          type="submit"
          className="rounded-lg bg-gray-900 px-6 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-black"
        >
          Update Social Links
        </button>
      </div>
    </form>
  );
}
