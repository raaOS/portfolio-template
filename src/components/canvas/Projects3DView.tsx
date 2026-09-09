'use client';

import { memo } from 'react';
import type { Project } from '@/types/projects';
import { SectionErrorBoundary } from '@/components/error/ErrorBoundary';
import InfiniteCanvasView from './InfiniteCanvasView';

type Props = {
  projects: Project[];
  onSelectProject?: (project: Project) => void;
};

function Projects3DViewComponent({ projects, onSelectProject }: Props) {
  return (
    <SectionErrorBoundary
      sectionName="Projects 3D View"
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-6 text-center">
          <div className="max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Mode 3D gagal dimuat</h2>
            <p className="mt-2 text-sm text-neutral-500">
              Kembali ke grid view atau refresh halaman untuk mencoba lagi.
            </p>
          </div>
        </div>
      }
    >
      <InfiniteCanvasView projects={projects} onSelectProject={onSelectProject} />
    </SectionErrorBoundary>
  );
}

const Projects3DView = memo(Projects3DViewComponent);

export default Projects3DView;
