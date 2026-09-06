'use client';

import { LayoutGrid, User, Briefcase, Code2, MessageSquare, Mail, FolderOpen } from 'lucide-react';
import { AdminAuthGuard } from '@/app/admin/components/AdminAuthGuard';
import { AdminHeader } from '@/app/admin/components/components/AdminHeader';

const entities = [
  { id: 'about', label: 'Profil & About', icon: User, href: '/admin/templates/os-desktop/about', color: 'bg-blue-50 text-blue-700' },
  { id: 'projects', label: 'Projects', icon: FolderOpen, href: '/admin/templates/os-desktop/projects', color: 'bg-emerald-50 text-emerald-700' },
  { id: 'experience', label: 'Pengalaman Kerja', icon: Briefcase, href: '/admin/templates/os-desktop/experience', color: 'bg-purple-50 text-purple-700' },
  { id: 'skills', label: 'Hard Skills', icon: Code2, href: '/admin/templates/os-desktop/skills', color: 'bg-amber-50 text-amber-700' },
  { id: 'testimonial', label: 'Testimoni', icon: MessageSquare, href: '/admin/templates/os-desktop/testimonial', color: 'bg-pink-50 text-pink-700' },
  { id: 'contact', label: 'Kontak', icon: Mail, href: '/admin/templates/os-desktop/contact', color: 'bg-cyan-50 text-cyan-700' },
];

function DashboardContent() {
  return (
    <>
      <AdminHeader
        title="OS Desktop — CRUD"
        titleIcon={<LayoutGrid className="h-5 w-5" aria-hidden />}
        titleAccent="bg-blue-50 text-blue-700"
      />

      <div className="flex-1 space-y-6 p-6">
        <p className="text-sm text-gray-600">
          Kelola konten untuk template <strong>OS Desktop</strong>. Pilih modul yang ingin diedit.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entities.map((entity) => {
            const Icon = entity.icon;
            return (
              <a
                key={entity.id}
                href={entity.href}
                className="group flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${entity.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">{entity.label}</h3>
                  <p className="text-xs text-gray-500">Kelola {entity.label.toLowerCase()}</p>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </>
  );
}

export default function OSDesktopAdminPage() {
  return (
    <AdminAuthGuard>
      <DashboardContent />
    </AdminAuthGuard>
  );
}
