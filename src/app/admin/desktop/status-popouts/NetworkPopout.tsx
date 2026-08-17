'use client';

import React from 'react';
import { Globe, Wifi, Activity, Shield } from 'lucide-react';
import PopoutShell from './PopoutShell';

interface NetworkPopoutProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  browserOnline: boolean;
  serverStatus: 'online' | 'checking' | 'degraded' | 'offline';
  latencyMs?: number | null;
  lastCheckedAt?: number | null;
  errorMessage?: string | null;
}

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

function getNetworkView(browserOnline: boolean, serverStatus: NetworkPopoutProps['serverStatus']) {
  if (!browserOnline) {
    return {
      label: 'Browser offline',
      dot: 'bg-rose-500',
      icon: 'text-rose-500',
      reason: 'Merah karena browser melaporkan navigator.onLine=false.',
    };
  }

  if (serverStatus === 'online') {
    return {
      label: 'Online',
      dot: 'bg-emerald-400',
      icon: 'text-emerald-500',
      reason: 'Hijau karena browser online dan /api/health berhasil dijangkau.',
    };
  }

  if (serverStatus === 'checking') {
    return {
      label: 'Memeriksa API',
      dot: 'bg-amber-400',
      icon: 'text-amber-500',
      reason: 'Kuning karena admin sedang ping /api/health.',
    };
  }

  if (serverStatus === 'degraded') {
    return {
      label: 'API degraded',
      dot: 'bg-amber-400',
      icon: 'text-amber-500',
      reason: 'Kuning karena API bisa dijangkau, tapi health check melaporkan degraded.',
    };
  }

  return {
    label: 'API offline',
    dot: 'bg-rose-500',
    icon: 'text-rose-500',
    reason: 'Merah karena browser online, tapi request /api/health gagal.',
  };
}

export function NetworkPopout({
  isOpen,
  onClose,
  anchorRef,
  browserOnline,
  serverStatus,
  latencyMs,
  lastCheckedAt,
  errorMessage,
}: NetworkPopoutProps) {
  const view = getNetworkView(browserOnline, serverStatus);

  return (
    <PopoutShell isOpen={isOpen} onClose={onClose} anchorRef={anchorRef} width={280}>
      <div className="border-b border-black/5 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-black/5">
            <Wifi className={`h-5 w-5 ${view.icon}`} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-zinc-800">Network</div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className={`h-2 w-2 rounded-full ${view.dot}`} />
              {view.label}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2 p-3 text-xs text-zinc-500">
        <div className="flex items-center justify-between rounded-lg px-2 py-2 transition-colors hover:bg-black/5">
          <span className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-zinc-400" />
            Browser
          </span>
          <span className="font-medium text-zinc-700">{browserOnline ? 'online' : 'offline'}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg px-2 py-2 transition-colors hover:bg-black/5">
          <span className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-zinc-400" />
            API server
          </span>
          <span className="font-medium text-zinc-700">{serverStatus}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg px-2 py-2 transition-colors hover:bg-black/5">
          <span className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-zinc-400" />
            Latency
          </span>
          <span className="font-medium text-zinc-700">{formatMs(latencyMs)}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg px-2 py-2 transition-colors hover:bg-black/5">
          <span className="flex items-center gap-2">
            <Wifi className="h-3.5 w-3.5 text-zinc-400" />
            Last check
          </span>
          <span className="font-medium text-zinc-700">{formatTime(lastCheckedAt)}</span>
        </div>
        <div className="rounded-lg bg-black/5 px-2 py-2 text-[11px] text-zinc-600">
          {view.reason}
        </div>
        {errorMessage ? (
          <div className="rounded-lg bg-rose-50 px-2 py-2 text-[11px] text-rose-700">
            {errorMessage}
          </div>
        ) : null}
        <StatusLegend />
      </div>

      <div className="border-t border-black/5 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
        Portfolio Admin · Network
      </div>
    </PopoutShell>
  );
}
