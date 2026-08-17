'use client';

import { useState, useSyncExternalStore } from 'react';
import { Project, CreateProjectData, UpdateProjectData } from '@/types/projects';
import { Loader2, X } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import dynamic from 'next/dynamic';

// Import design system components
import { useAdminAuth } from '@/hooks/useAdminAuth';
import ProjectCardSkeleton from '@/components/admin/ProjectCardSkeleton';

// New Modular Hooks & Components
import { useAdminProjects } from '../hooks/useAdminProjects';
import { useDataStatus } from '../hooks/useDataStatus';
import { ProjectToolbar } from './components/ProjectToolbar';
import { ProjectCard } from './components/ProjectCard';
import { Pagination } from './components/Pagination';
import { useConfirm } from '@/components/admin/ConfirmDialog';

// Lazy load heavy modals
const ProjectForm = dynamic(() => import('@/components/admin/project-form/ProjectForm'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <Loader2 className="animate-spin text-white" />
    </div>
  ),
});
const DataConnectionModal = dynamic(() => import('@/app/admin/components/DataConnectionModal'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <Loader2 className="animate-spin text-white" />
    </div>
  ),
});

const SecuritySettingsModal = dynamic(() => import('../components/SecuritySettingsModal'), {
  ssr: false,
});

const subscribeHydration = () => () => undefined;
const getHydratedSnapshot = () => true;
const getServerSnapshot = () => false;

function SortableProjectItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    position: 'relative' as const,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="h-full">
      {children}
    </div>
  );
}

export default function AdminProjectsClient() {
  useAdminAuth();
  const { confirm } = useConfirm();

  // Custom Hooks
  const {
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
  } = useAdminProjects();

  const { connectionStatus } = useDataStatus();

  // Local UI State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const isDndReady = useSyncExternalStore(
    subscribeHydration,
    getHydratedSnapshot,
    getServerSnapshot
  );
  const ITEMS_PER_PAGE = 18;

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Derived Paginated Data
  const totalPages = Math.ceil(orderedProjects.length / ITEMS_PER_PAGE);
  // FIX: Hindari setState di dalam useEffect (cascading render). Gunakan
  // derived displayPage; pagination controls selalu bekerja dari posisi valid.
  const displayPage = totalPages > 0 ? Math.min(currentPage, totalPages) : 1;
  const paginatedProjects = orderedProjects.slice(
    (displayPage - 1) * ITEMS_PER_PAGE,
    displayPage * ITEMS_PER_PAGE
  );

  const handleToggleProjectStatus = (project: Project) => {
    const nextStatus = project.status === 'published' ? 'draft' : 'published';
    updateMutation.mutate({ ...project, status: nextStatus, id: project.id });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    // Drop di luar area target (`over` null atau item tak dikenal) = batalkan,
    // bukan memindah item ke paling bawah list tanpa sadar.
    if (!over?.id) return;
    if (active.id !== over.id) {
      const oldIndex = orderedProjects.findIndex((i) => i.id === active.id);
      const newIndex = orderedProjects.findIndex((i) => i.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      const newItems = [...orderedProjects];
      const [movedItem] = newItems.splice(oldIndex, 1);
      newItems.splice(newIndex, 0, movedItem);
      handleReorder(newItems);
    }
  };

  const renderProjectCard = (project: Project, index: number) => (
    <ProjectCard
      project={project}
      priority={index < 6}
      eager={index < 12}
      selectedProjectIds={selectedProjectIds}
      toggleProjectSelection={toggleProjectSelection}
      handleToggleProjectStatus={handleToggleProjectStatus}
      setEditingProject={setEditingProject}
      handleDeleteProject={async (id) => {
        const ok = await confirm({
          title: 'Hapus proyek ini?',
          message: 'Proyek akan dihapus permanen, termasuk semua relasi-nya.',
          confirmText: 'Hapus',
          cancelText: 'Batal',
          tone: 'danger',
        });
        if (ok) deleteMutation.mutate(id);
      }}
      commentCount={commentCounts[project.slug] || 0}
    />
  );

  return (
    <div className="space-y-8 p-6 md:p-8">
      <ProjectToolbar
        connectionStatus={connectionStatus}
        selectedProjectIds={selectedProjectIds}
        isBulkUpdating={isBulkUpdating}
        allProjectsLength={orderedProjects.length}
        handleBulkUpdate={handleBulkUpdate}
        selectAllProjects={() => selectAllProjects(orderedProjects.map((p) => p.id))}
        setShowSecurityModal={setShowSecurityModal}
        setShowSettings={setShowSettings}
        setShowCreateForm={setShowCreateForm}
      />

      <>
        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <X className="h-5 w-5 text-red-500" />
            <p className="text-sm text-red-700">Failed to load projects</p>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
            {[...Array(6)].map((_, i) => (
              <ProjectCardSkeleton key={i} />
            ))}
          </div>
        ) : orderedProjects.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-20 text-center">
            <p className="mb-2 text-lg text-gray-500">Project tidak ditemukan</p>
            <p className="text-sm text-gray-400">Buat project pertama Anda untuk memulai</p>
          </div>
        ) : (
          <>
            {isDndReady ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={paginatedProjects.map((p) => p.id)}
                  strategy={rectSortingStrategy}
                >
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
                    {paginatedProjects.map((project, index) => (
                      <SortableProjectItem key={project.id} id={project.id}>
                        {renderProjectCard(project, index)}
                      </SortableProjectItem>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
                {paginatedProjects.map((project, index) => (
                  <div key={project.id} className="h-full">
                    {renderProjectCard(project, index)}
                  </div>
                ))}
              </div>
            )}

            <Pagination
              currentPage={displayPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </>

      {/* Modals */}
      {(showCreateForm || editingProject) && (
        <ProjectForm
          project={editingProject || undefined}
          allProjects={orderedProjects}
          labels={labels}
          title={editingProject ? 'Edit Proyek' : 'Buat Proyek Baru'}
          onCancel={() => {
            setShowCreateForm(false);
            setEditingProject(null);
          }}
          onSubmit={async (data) => {
            if (editingProject) {
              await updateMutation.mutateAsync(data as UpdateProjectData);
            } else {
              await createMutation.mutateAsync(data as CreateProjectData);
            }
          }}
        />
      )}

      {showSettings && <DataConnectionModal onCancel={() => setShowSettings(false)} />}

      {showSecurityModal && <SecuritySettingsModal onClose={() => setShowSecurityModal(false)} />}
    </div>
  );
}
