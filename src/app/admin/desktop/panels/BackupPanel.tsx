'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, DatabaseBackup, Download, HardDrive, Clock, Play } from 'lucide-react';
import { getWritableCsrfToken } from '@/lib/security/client-csrf';

interface BackupEntry {
  key: string;
  size: number;
  uploaded?: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** Key berbentuk ISO `2026-10-05T01-00-00-000Z` → tampilan tanggal lokal (WIB). */
function formatDateFromKey(key: string) {
  const base =
    key
      .split('/')
      .pop()
      ?.replace(/\.json$/, '') ?? '';
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/.exec(base);
  const date = match
    ? new Date(`${match[1]}T${match[2]}:${match[3]}:${match[4]}Z`)
    : new Date(base);

  if (Number.isNaN(date.getTime())) return base;

  return date.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function BackupPanel() {
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [keepCount, setKeepCount] = useState(7);
  const [d1Configured, setD1Configured] = useState(true);
  const [r2Configured, setR2Configured] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const fetchBackups = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/backup');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBackups(data.backups || []);
      setKeepCount(data.keepCount ?? 7);
      setD1Configured(!!data.d1Configured);
      setR2Configured(!!data.r2Configured);
    } catch (err) {
      console.error('[BackupPanel] Failed to fetch backups:', err);
      setError('Gagal memuat daftar backup. Coba segarkan.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load awal ditunda ke macrotask berikutnya agar tidak memanggil setState
  // secara sinkron di dalam effect (rule react-hooks/set-state-in-effect).
  useEffect(() => {
    const timer = setTimeout(() => void fetchBackups(), 0);
    return () => clearTimeout(timer);
  }, [fetchBackups]);

  const runBackup = async () => {
    setIsBackingUp(true);
    setError('');
    setStatus('');
    try {
      const token = getWritableCsrfToken();
      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': token,
        },
        credentials: 'include',
        body: '{}',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      setStatus(`Backup berhasil dibuat (${formatBytes(data.size || 0)}).`);
      await fetchBackups();
    } catch (err) {
      console.error('[BackupPanel] Backup failed:', err);
      setError(err instanceof Error ? err.message : 'Backup gagal dijalankan.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const envWarning = !d1Configured || !r2Configured;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-gray-50/50 px-6 py-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <DatabaseBackup size={16} className="text-emerald-600" />
          <span>{isLoading ? 'Memuat…' : `${backups.length} backup tersimpan`}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void fetchBackups()}
            disabled={isLoading || isBackingUp}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            Segarkan
          </button>
          <button
            onClick={() => void runBackup()}
            disabled={isLoading || isBackingUp || envWarning}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            <Play size={14} className={isBackingUp ? 'animate-pulse' : ''} />
            {isBackingUp ? 'Menjalankan…' : 'Backup Sekarang'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
          Backup otomatis setiap hari pukul 01:00 WIB melalui cron — 7 backup terakhir disimpan di
          penyimpanan cloud.
        </div>

        {envWarning && (
          <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700">
            Konfigurasi belum lengkap: D1 {d1Configured ? 'siap' : 'belum di-set'}, R2{' '}
            {r2Configured ? 'siap' : 'belum di-set'}. Backup tidak bisa dijalankan sampai env
            lengkap.
          </div>
        )}

        {status && (
          <div className="mb-4 rounded-xl border border-emerald-100 bg-white px-4 py-3 text-xs text-emerald-700">
            {status}
          </div>
        )}

        {error ? (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : isLoading && backups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <DatabaseBackup className="mb-4 h-8 w-8 animate-pulse text-emerald-400" />
            <p className="text-sm text-gray-500">Memuat daftar backup…</p>
          </div>
        ) : backups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <HardDrive className="mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500">Belum ada backup. Jalankan backup pertama.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 font-medium">Tanggal</th>
                  <th className="px-4 py-3 font-medium">Ukuran</th>
                  <th className="px-4 py-3 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr key={backup.key} className="border-b border-gray-50 last:border-b-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-gray-800">
                        <Clock size={14} className="text-gray-400" />
                        {formatDateFromKey(backup.key)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatBytes(backup.size)}</td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={'/api/admin/backup/download?key=' + encodeURIComponent(backup.key)}
                        download
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                      >
                        <Download size={14} />
                        Unduh
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-400">
              Menampilkan {backups.length} dari maksimal {keepCount} backup terbaru.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
