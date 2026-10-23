'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Project, CreateProjectData, UpdateProjectData } from '@/types/projects';
import { useToast } from '@/contexts/ToastContext';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useRealtimeSync } from '@/lib/services/realtimeSync';
import { getWritableCsrfToken } from '@/lib/security/client-csrf';
import { Label } from '@/types/labels';
import {
  ADMIN_DATA_GC_TIME,
  ADMIN_DATA_STALE_TIME,
  ADMIN_PLACEHOLDER_DATA,
  ADMIN_QUERY_KEYS,
  fetchAdminCommentCounts,
  fetchAdminLabels,
  fetchAdminProjects,
  fetchAdminProjectsFresh,
} from '../lib/adminQueries';

export function useAdminProjects() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const { csrfToken } = useAdminAuth();

  // Optimistic ordering override. Hanya berisi nilai saat user aktif drag-
  // and-drop / reorder. Otherwise null → ambil dari query data langsung.
  // Pattern ini menggantikan "mirror state" lama yang setState saat render
  // (atau setState dalam effect) → keduanya picu cascade re-render saat
  // navigasi antar menu CRUD.
  const [pendingOrder, setPendingOrder] = useState<Project[] | null>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const {
    data: projectsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ADMIN_QUERY_KEYS.projects,
    queryFn: fetchAdminProjects,
    staleTime: ADMIN_DATA_STALE_TIME,
    gcTime: ADMIN_DATA_GC_TIME,
    placeholderData: ADMIN_PLACEHOLDER_DATA.projects,
  });

  // 1.5 Fetch Labels
  const { data: labels } = useQuery({
    queryKey: ADMIN_QUERY_KEYS.labels,
    queryFn: fetchAdminLabels,
    staleTime: ADMIN_DATA_STALE_TIME,
    gcTime: ADMIN_DATA_GC_TIME,
    placeholderData: ADMIN_PLACEHOLDER_DATA.labels,
    initialData: [] as Label[],
  });

  const projects = (projectsData?.data?.projects || []) as Project[];
  const orderedProjects = pendingOrder ?? projects;

  // 2. Fetch Comment Counts
  const { data: commentCounts } = useQuery({
    queryKey: ADMIN_QUERY_KEYS.commentCounts,
    queryFn: fetchAdminCommentCounts,
    staleTime: ADMIN_DATA_STALE_TIME,
    gcTime: ADMIN_DATA_GC_TIME,
    initialData: {},
  });

  const refreshProjects = useCallback(
    async (fresh = false) => {
      const data = fresh
        ? await fetchAdminProjectsFresh()
        : await queryClient.fetchQuery({
            queryKey: ADMIN_QUERY_KEYS.projects,
            queryFn: fetchAdminProjects,
            staleTime: ADMIN_DATA_STALE_TIME,
            gcTime: ADMIN_DATA_GC_TIME,
          });

      queryClient.setQueryData(ADMIN_QUERY_KEYS.projects, data);
      // Selesai sync dengan server, lepas optimistic order override
      // (kalau ada) supaya next render kembali pakai data dari query.
      setPendingOrder(null);
      return data;
    },
    [queryClient]
  );

  const refreshCommentCounts = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.commentCounts });
  }, [queryClient]);

  // 3. Mutations
  const createMutation = useMutation({
    mutationFn: async (data: CreateProjectData | UpdateProjectData) => {
      const token = getWritableCsrfToken(csrfToken);
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': token,
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`${errorData.error || response.statusText} (${response.status})`);
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'], refetchType: 'none' });
      await refreshProjects(true);
      await refreshCommentCounts();
      showSuccess('Project berhasil dibuat');
    },
    onError: (err: Error) => showError(err.message || 'Failed to create project'),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateProjectData) => {
      const token = getWritableCsrfToken(csrfToken);
      const response = await fetch(`/api/projects/${data.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': token,
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`${errorData.error || response.statusText} (${response.status})`);
      }
      const responseData = await response.json();
      // Surface warning kalau komentar gagal persist (tidak menggagalkan mutation).
      if (responseData?.commentsWarning) {
        console.warn(responseData.commentsWarning);
        // Tidak throw: project sudah tersimpan, kita tidak mau re-run mutation.
        // User dapat warning lewat query invalidation (UI akan refetch comments).
      }
      return responseData;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'], refetchType: 'none' });
      await refreshProjects(true);
      await refreshCommentCounts();
      showSuccess('Project berhasil diperbarui');
    },
    onError: (err: Error) => showError(err.message || 'Failed to update project'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = getWritableCsrfToken(csrfToken);
      const response = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
        headers: {
          'x-csrf-token': token,
        },
        credentials: 'include',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`${errorData.error || response.statusText} (${response.status})`);
      }
      return id;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'], refetchType: 'none' });
      await refreshProjects(true);
      await refreshCommentCounts();
      showSuccess('Project dihapus');
    },
    onError: (err: Error) => showError(err.message || 'Failed to delete project'),
  });

  const handleReorder = useCallback(
    async (newItems: Project[]) => {
      // Optimistic UI: tampilkan urutan baru langsung sambil request bulk
      // reorder ke server berjalan.
      setPendingOrder(newItems);
      try {
        const token = getWritableCsrfToken(csrfToken);
        const res = await fetch('/api/projects/bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': token,
          },
          credentials: 'include',
          body: JSON.stringify({ action: 'reorder', ids: newItems.map((p) => p.id) }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to reorder');
        }
      } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : 'Unknown error';
        showError(`Gagal memperbarui urutan: ${errorMsg}`);
        // Rollback optimistic order ke data dari server.
        setPendingOrder(null);
        queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.projects });
      }
    },
    [csrfToken, queryClient, showError]
  );

  const handleBulkUpdate = async (action: 'publish' | 'draft' | 'delete') => {
    if (selectedProjectIds.size === 0) return;
    // Hapus massal bersifat destruktif → wajib konfirmasi dulu.
    // Publish/draft tidak perlu karena masih bisa dibalik.
    if (action === 'delete') {
      const confirmed = window.confirm(
        `Hapus ${selectedProjectIds.size} project terpilih?\n\nTindakan ini tidak bisa dibatalkan.`
      );
      if (!confirmed) return;
    }
    setIsBulkUpdating(true);
    try {
      const token = getWritableCsrfToken(csrfToken);
      const res = await fetch('/api/projects/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': token,
        },
        credentials: 'include',
        body: JSON.stringify({
          action,
          ids: Array.from(selectedProjectIds),
        }),
      });

      if (!res.ok) throw new Error('Bulk update failed');

      setSelectedProjectIds(new Set());
      showSuccess(`Bulk ${action} complete`);
      await queryClient.invalidateQueries({ queryKey: ['projects'], refetchType: 'none' });
      await refreshProjects(true);
      await refreshCommentCounts();
    } catch {
      showError(`Bulk ${action} failed`);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const toggleProjectSelection = (id: string) => {
    const newSelected = new Set(selectedProjectIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedProjectIds(newSelected);
  };

  const selectAllProjects = (allIds: string[]) => {
    if (selectedProjectIds.size === allIds.length) {
      setSelectedProjectIds(new Set());
    } else {
      setSelectedProjectIds(new Set(allIds));
    }
  };

  useRealtimeSync({
    onUpdate: () => {
      console.log('[AdminProjects] Real-time update detected, refreshing...');
      void refreshProjects(true);
      void refreshCommentCounts();
    },
    onUnavailable: () => {
      console.log('[AdminProjects] Real-time sync unavailable, using manual refresh');
    },
    enabled: typeof window !== 'undefined',
  });

  return {
    projects,
    orderedProjects,
    isLoading,
    error,
    commentCounts,
    createMutation,
    updateMutation,
    deleteMutation,
    handleReorder,
    handleBulkUpdate,
    isBulkUpdating,
    selectedProjectIds,
    toggleProjectSelection,
    selectAllProjects,
    labels,
    csrfToken,
    refreshProjects,
  };
}
