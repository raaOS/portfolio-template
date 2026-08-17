'use client';

import React from 'react';
import { Database, Cloud, Activity, Shield } from 'lucide-react';
import { useStorageStats } from '../../hooks/useStorageStats';
import PopoutShell from './PopoutShell';
import { StorageBreakdownSection } from './StorageBreakdown';

interface DatabasePopoutProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  status: 'connected' | 'checking' | 'error' | 'disconnected';
  latencyMs?: number | null;
  apiLatencyMs?: number | null;
  backend?: string | null;
  lastCheckedAt?: number | null;
  errorMessage?: string | null;
}

const STATUS_LABEL: Record<DatabasePopoutProps['status'], string> = {
  connected: 'Terhubung',
  checking: 'Memeriksa…',
  error: 'Bermasalah',
  disconnected: 'Terputus',
};

const STATUS_DOT: Record<DatabasePopoutProps['status'], string> = {
  connected: 'bg-emerald-400',
  checking: 'bg-amber-400',
  error: 'bg-rose-500',
  disconnected: 'bg-slate-500',
};

const DB_REASON: Record<DatabasePopoutProps['status'], string> = {
  connected: 'Hijau karena /api/health berhasil membaca Cloudflare D1.',
  checking: 'Kuning karena admin sedang memeriksa /api/health.',
  error: 'Merah karena browser tidak bisa membaca /api/health.',
  disconnected: 'Merah karena /api/health bisa dijangkau, tapi read D1 gagal.',
};

function formatMs(value?: number | null) {
  return typeof value === 'number' ? `${value} ms` : '-';
}

function formatTime(value?: number | null) {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusLegend() {
  return (
    <div className="grid grid-cols-3 gap-1 px-2 pt-1 text-[10px] text-zinc-500">
      <span>
        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />
        Online
      </span>
      <span>
        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" />
        Checking
      </span>
      <span>
        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-500" />
        Offline
      </span>
    </div>
  );
}

export function DatabasePopout({
  isOpen,
  onClose,
  anchorRef,
  status,
  latencyMs,
  apiLatencyMs,
  backend,
  lastCheckedAt,
  errorMessage,
}: DatabasePopoutProps) {
  const { state: storageState, refresh: refreshStorage } = useStorageStats({
    enabled: isOpen,
  });

  return (
    <PopoutShell isOpen={isOpen} onClose={onClose} anchorRef={anchorRef} width={340}>
      <div className="border-b border-black/5 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-black/5">
            <Database className="h-5 w-5 text-sky-500" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-zinc-800">Cloudflare D1</div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
              {STATUS_LABEL[status]}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2 p-3 text-xs text-zinc-500">
        <div className="flex items-center justify-between rounded-lg px-2 py-2 transition-colors hover:bg-black/5">
          <span className="flex items-center gap-2">
            <Cloud className="h-3.5 w-3.5 text-zinc-400" />
            Backend
          </span>
          <span className="font-medium text-zinc-700">{backend || '-'}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg px-2 py-2 transition-colors hover:bg-black/5">
          <span className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-zinc-400" />
            D1 latency
          </span>
          <span className="font-medium text-zinc-700">{formatMs(latencyMs)}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg px-2 py-2 transition-colors hover:bg-black/5">
          <span className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-zinc-400" />
            API latency
          </span>
          <span className="font-medium text-zinc-700">{formatMs(apiLatencyMs)}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg px-2 py-2 transition-colors hover:bg-black/5">
          <span className="flex items-center gap-2">
            <Database className="h-3.5 w-3.5 text-zinc-400" />
            Last check
          </span>
          <span className="font-medium text-zinc-700">{formatTime(lastCheckedAt)}</span>
        </div>
        <div className="rounded-lg bg-black/5 px-2 py-2 text-[11px] text-zinc-600">
          {DB_REASON[status]}
        </div>
        {errorMessage ? (
          <div className="rounded-lg bg-rose-50 px-2 py-2 text-[11px] text-rose-700">
            {errorMessage}
          </div>
        ) : null}
        <StorageBreakdownSection state={storageState} onRefresh={() => void refreshStorage(true)} />
        <StatusLegend />
      </div>

      <div className="border-t border-black/5 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
        Portfolio Admin · Data Plane
      </div>
    </PopoutShell>
  );
}
