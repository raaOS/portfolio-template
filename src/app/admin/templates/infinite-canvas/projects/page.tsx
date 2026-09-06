'use client';

import { useState } from 'react';
import { FolderOpen, Plus, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminAuthGuard } from '@/app/admin/components/AdminAuthGuard';
import { AdminHeader } from '@/app/admin/components/components/AdminHeader';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useToast } from '@/contexts/ToastContext';
import { getWritableCsrfToken } from '@/lib/security/client-csrf';

interface Project {
  id: string;
  title: string;
  slug: string;
  description: string;
  cover_url: string;
  status: string;
  year: string;
  featured: boolean;
}

async function fetchProjects(): Promise<{ projects: Project[] }> {
  const res = await fetch('/api/templates/infinite-canvas/projects');
  if (!res.ok) throw new Error('Gagal memuat project');
  return res.json();
}

function ProjectsList() {
  const { csrfToken } = useAdminAuth();
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const [deleting, setDeleting] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['infinite-canvas-projects'],
    queryFn: fetchProjects,
  });

  const projects = data?.projects || [];

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus project ini?')) return;
    if (!csrfToken) return;
    setDeleting(id);
    try {
      const token = getWritableCsrfToken(csrfToken);
      const res = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
        headers: { 'x-csrf-token': token },
      });
      if (!res.ok) throw new Error('Gagal menghapus');
      queryClient.invalidateQueries({ queryKey: ['infinite-canvas-projects'] });
    } catch {
      showError('Gagal menghapus project');
    } finally {
      setDeleting(null);
    }
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">{projects.length} project</p>
        <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Tambah Project
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Judul</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tahun</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {projects.map((project) => (
              <tr key={project.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{project.title}</div>
                  <div className="text-xs text-gray-500">{project.slug}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                    project.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {project.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{project.year || '-'}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <a href={`/projects/${project.slug}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <button onClick={() => handleDelete(project.id)} disabled={deleting === project.id}
                      className="text-red-600 hover:text-red-800 disabled:opacity-50">
                      {deleting === project.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">Belum ada project</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function InfiniteCanvasProjectsPage() {
  return (
    <AdminAuthGuard>
      <AdminHeader
        title="Projects"
        titleIcon={<FolderOpen className="h-5 w-5" aria-hidden />}
        titleAccent="bg-emerald-50 text-emerald-700"
      />
      <div className="flex-1 space-y-6 p-6">
        <ProjectsList />
      </div>
    </AdminAuthGuard>
  );
}
