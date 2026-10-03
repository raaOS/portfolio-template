'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Clock, Activity, ChevronDown, Database, FileJson } from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  timestamp: string;
  source: 'kv' | 'relational';
  entityType?: string;
  metadata?: Record<string, unknown>;
}

export default function ActivityLogPanel() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/audit-logs');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error('[ActivityLogPanel] Failed to fetch logs:', err);
      setError('Gagal memuat log aktivitas. Coba segarkan.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load awal ditunda ke macrotask berikutnya (pola yang sama dengan OrdersPanel)
  // agar tidak memanggil setState secara sinkron di dalam effect.
  useEffect(() => {
    const timer = setTimeout(() => void fetchLogs(), 0);
    return () => clearTimeout(timer);
  }, [fetchLogs]);

  const toggleLog = (id: string) => {
    setExpandedLogs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatMetadata = (metadata?: Record<string, unknown>) => {
    if (!metadata) return [];
    return Object.entries(metadata)
      .filter(([key]) => !['userAgent'].includes(key))
      .slice(0, 8)
      .map(([key, value]) => {
        const displayValue =
          typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
            ? String(value)
            : JSON.stringify(value);
        return `${key}: ${displayValue}`;
      });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-gray-50/50 px-6 py-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Activity size={16} className="text-slate-500" />
          <span>
            {isLoading ? 'Memuat…' : `${logs.length} entri terakhir`}
          </span>
        </div>
        <button
          onClick={() => void fetchLogs()}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          Segarkan
        </button>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {error ? (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : isLoading && logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Activity className="mb-4 h-8 w-8 animate-pulse text-slate-400" />
            <p className="text-sm text-gray-500">Memuat log aktivitas…</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Clock className="mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500">Belum ada aktivitas yang dicatat.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log, index) => {
              const metaItems = formatMetadata(log.metadata);
              const isExpanded = !!expandedLogs[log.id];
              return (
                <div key={log.id} className="relative flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-100 bg-slate-50">
                      <div className="h-2 w-2 rounded-full bg-slate-500" />
                    </div>
                    {index !== logs.length - 1 && <div className="mt-2 h-full w-px bg-gray-200" />}
                  </div>
                  <div
                    className={`mb-2 flex-1 rounded-xl border bg-white p-4 shadow-sm transition-all duration-200 ${
                      metaItems.length > 0
                        ? 'cursor-pointer hover:border-slate-200 hover:bg-slate-50/5'
                        : ''
                    } ${isExpanded ? 'border-slate-200 bg-slate-50/5 ring-1 ring-slate-500/5' : 'border-gray-100'}`}
                    onClick={() => {
                      if (metaItems.length > 0) toggleLog(log.id);
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-gray-800">{log.action}</p>
                          <span
                            className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500"
                            title={
                              log.source === 'kv'
                                ? 'Sumber: blob app_kv (writer lama)'
                                : 'Sumber: tabel relasional audit_logs'
                            }
                          >
                            {log.source === 'kv' ? <FileJson size={10} /> : <Database size={10} />}
                            {log.source === 'kv' ? 'KV' : 'DB'}
                          </span>
                          {log.entityType && (
                            <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">
                              {log.entityType}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
                          <Clock size={12} />
                          <span>{formatDate(log.timestamp)}</span>
                        </div>
                      </div>
                      {metaItems.length > 0 && (
                        <ChevronDown
                          size={16}
                          className={`shrink-0 text-gray-400 transition-transform duration-200 ${
                            isExpanded ? 'rotate-180 text-slate-500' : ''
                          }`}
                        />
                      )}
                    </div>
                    {metaItems.length > 0 && (
                      <div
                        className={`grid transition-all duration-300 ease-in-out ${
                          isExpanded ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0 mt-0'
                        }`}
                      >
                        <div className="overflow-hidden">
                          <div className="space-y-1 rounded-lg bg-gray-50 px-3 py-2">
                            {metaItems.map((item) => (
                              <div key={item} className="truncate text-[11px] text-gray-500">
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}