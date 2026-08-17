'use client';

import React from 'react';
import { CloudUpload, CheckCircle2, XCircle, Loader2, X as XIcon } from 'lucide-react';
import PopoutShell from './PopoutShell';
import type { BackgroundUploadTask } from '@/contexts/BackgroundUploadContext';

interface UploadsPopoutProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  tasks: BackgroundUploadTask[];
  totalProgress: number;
  onRemoveTask: (id: string) => void;
}

const UPLOAD_STATUS_LABEL: Record<BackgroundUploadTask['status'], string> = {
  starting: 'Starting',
  compressing: 'Compressing',
  uploading: 'Uploading',
  processing: 'Processing',
  finalizing: 'Finalizing',
  complete: 'Complete',
  error: 'Error',
};

function isActiveStatus(status: BackgroundUploadTask['status']): boolean {
  return status !== 'complete' && status !== 'error';
}

export function UploadsPopout({
  isOpen,
  onClose,
  anchorRef,
  tasks,
  totalProgress,
  onRemoveTask,
}: UploadsPopoutProps) {
  const totalCount = tasks.length;
  const completedCount = tasks.filter((t) => t.status === 'complete').length;
  const erroredCount = tasks.filter((t) => t.status === 'error').length;
  const activeCount = tasks.filter((t) => isActiveStatus(t.status)).length;
  const avgProgress = Math.round(totalProgress);

  return (
    <PopoutShell isOpen={isOpen} onClose={onClose} anchorRef={anchorRef} width={340}>
      <div className="border-b border-black/5 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
            <CloudUpload className="h-5 w-5 text-blue-500" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-zinc-800">Background Uploads</div>
            <div className="text-xs text-zinc-500">
              {totalCount === 0
                ? 'Tidak ada upload aktif'
                : `${completedCount}/${totalCount} selesai · ${avgProgress}% rata-rata`}
            </div>
          </div>
        </div>
        {activeCount > 0 && (
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/5">
            <div
              className="h-full bg-blue-500 transition-[width] duration-200 ease-out"
              style={{ width: `${avgProgress}%` }}
            />
          </div>
        )}
      </div>

      <div className="max-h-[360px] space-y-2 overflow-y-auto p-3">
        {tasks.length === 0 ? (
          <div className="px-2 py-6 text-center text-xs text-zinc-400">
            Drop file wallpaper di Admin → Appearance untuk mulai upload.
          </div>
        ) : (
          tasks.map((task) => <UploadTaskRow key={task.id} task={task} onRemove={onRemoveTask} />)
        )}
      </div>

      {erroredCount > 0 && (
        <div className="border-t border-rose-100 bg-rose-50/50 px-4 py-2 text-[11px] text-rose-700">
          {erroredCount} upload gagal — check error message per-file di atas.
        </div>
      )}

      <div className="border-t border-black/5 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
        Portfolio Admin · Wallpaper Pipeline
      </div>
    </PopoutShell>
  );
}

interface UploadTaskRowProps {
  task: BackgroundUploadTask;
  onRemove: (id: string) => void;
}

function UploadTaskRow({ task, onRemove }: UploadTaskRowProps) {
  const pct = Math.round(task.progress);
  const isActive = isActiveStatus(task.status);
  const isError = task.status === 'error';
  const isDone = task.status === 'complete';

  const StatusIcon = isError ? XCircle : isDone ? CheckCircle2 : Loader2;
  const statusIconClass = isError
    ? 'text-rose-500'
    : isDone
      ? 'text-emerald-500'
      : 'text-blue-500 animate-spin';

  return (
    <div
      className={`group rounded-lg border p-2.5 transition-colors ${
        isError
          ? 'border-rose-200 bg-rose-50/40'
          : isDone
            ? 'border-emerald-200 bg-emerald-50/30'
            : 'border-zinc-200 bg-white/60'
      }`}
    >
      <div className="flex items-start gap-2">
        <StatusIcon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${statusIconClass}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-xs font-medium text-zinc-800" title={task.filename}>
              {task.filename}
            </div>
            {!isActive && (
              <button
                type="button"
                onClick={() => onRemove(task.id)}
                className="flex-shrink-0 rounded p-0.5 text-zinc-400 opacity-0 transition-opacity hover:bg-black/5 hover:text-zinc-700 group-hover:opacity-100"
                title="Dismiss"
                aria-label={`Dismiss ${task.filename}`}
              >
                <XIcon className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-500">
            <span>{UPLOAD_STATUS_LABEL[task.status]}</span>
            {isActive && <span className="font-mono">{pct}%</span>}
            {task.profile && <span className="rounded bg-black/5 px-1 py-px">{task.profile}</span>}
          </div>
          {isActive && (
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-black/5">
              <div
                className="h-full bg-blue-500 transition-[width] duration-200 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
          {task.statusDetail && isActive && (
            <div className="mt-1 truncate text-[10px] text-zinc-400" title={task.statusDetail}>
              {task.statusDetail}
            </div>
          )}
          {isError && task.error && (
            <div className="mt-1 break-words text-[10px] text-rose-600">{task.error}</div>
          )}
        </div>
      </div>
    </div>
  );
}
