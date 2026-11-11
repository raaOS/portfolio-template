'use client';

import { useEffect, useSyncExternalStore } from 'react';

type ConnectionStatus = 'connected' | 'error' | 'checking' | 'disconnected';
type ServerStatus = 'online' | 'checking' | 'degraded' | 'offline';

interface HealthPayload {
  status?: string;
  timestamp?: string;
  database?: string;
  databaseBackend?: string;
  databaseLatencyMs?: number;
  environment?: string;
}

interface DataStatusSnapshot {
  isLoading: boolean;
  connectionStatus: ConnectionStatus;
  serverStatus: ServerStatus;
  latencyMs: number | null;
  lastCheckedAt: number | null;
  errorMessage: string | null;
  health: HealthPayload | null;
}

const POLL_INTERVAL_MS = 30_000;

// PERF: server snapshot harus referensi yang stabil. Object literal baru tiap
// call memicu "result of getServerSnapshot should be cached to avoid an
// infinite loop" dari useSyncExternalStore.
const SERVER_SNAPSHOT: DataStatusSnapshot = Object.freeze({
  isLoading: false,
  connectionStatus: 'checking',
  serverStatus: 'checking',
  latencyMs: null,
  lastCheckedAt: null,
  errorMessage: null,
  health: null,
});

let snapshot: DataStatusSnapshot = {
  isLoading: false,
  connectionStatus: 'checking',
  serverStatus: 'checking',
  latencyMs: null,
  lastCheckedAt: null,
  errorMessage: null,
  health: null,
};

let runtimeStarted = false;
let intervalId: number | null = null;
let inFlight: Promise<void> | null = null;

const listeners = new Set<() => void>();

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot(): DataStatusSnapshot {
  return SERVER_SNAPSHOT;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function publish(next: Partial<DataStatusSnapshot>) {
  const merged = { ...snapshot, ...next };
  if (
    merged.isLoading === snapshot.isLoading &&
    merged.connectionStatus === snapshot.connectionStatus &&
    merged.serverStatus === snapshot.serverStatus &&
    merged.latencyMs === snapshot.latencyMs &&
    merged.lastCheckedAt === snapshot.lastCheckedAt &&
    merged.errorMessage === snapshot.errorMessage &&
    merged.health === snapshot.health
  ) {
    return;
  }
  snapshot = merged;
  listeners.forEach((listener) => listener());
}

async function checkStatusInternal() {
  if (typeof window === 'undefined') return;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const startedAt = performance.now();
    try {
      // JANGAN pakai `navigator.onLine` sebagai penentu di sini. Nilai itu
      // hanya dugaan OS/browser (sering `false` saat Wi-Fi tanpa internet,
      // hotspot HP, VPN, atau bangun dari sleep) padahal request ke origin
      // yang sama tetap jalan — mis. dev server di LAN `192.168.x.x`.
      // Dulu short-circuit ini membuat widget "Cloudflare D1" memerah
      // "Browser sedang offline" padahal `/api/health` menjawab 200 dan D1
      // sehat. Satu-satunya bukti adalah request sungguhan di bawah.
      publish({ connectionStatus: 'checking', serverStatus: 'checking', errorMessage: null });
      const response = await fetch('/api/health', { cache: 'no-store' });
      const latencyMs = Math.round(performance.now() - startedAt);
      const data = (await response.json()) as HealthPayload;

      if (data.database === 'connected' && data.databaseBackend === 'cloudflare-d1') {
        publish({
          isLoading: false,
          connectionStatus: 'connected',
          serverStatus: response.ok ? 'online' : 'degraded',
          latencyMs,
          lastCheckedAt: Date.now(),
          errorMessage: null,
          health: data,
        });
      } else {
        publish({
          isLoading: false,
          connectionStatus: 'disconnected',
          serverStatus: response.ok ? 'online' : 'degraded',
          latencyMs,
          lastCheckedAt: Date.now(),
          errorMessage: 'D1 tidak berhasil dibaca dari /api/health',
          health: data,
        });
      }
    } catch (error) {
      // Request benar-benar gagal. Baru di sini status offline browser dipakai,
      // dan hanya sebagai keterangan tambahan — bukan pengganti pesan asli.
      const browserOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
      const realMessage = error instanceof Error ? error.message : 'API health tidak terjangkau';
      publish({
        isLoading: false,
        connectionStatus: 'error',
        serverStatus: 'offline',
        latencyMs: null,
        lastCheckedAt: Date.now(),
        errorMessage: browserOffline ? `Browser melaporkan offline · ${realMessage}` : realMessage,
        health: null,
      });
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

function ensureRuntime() {
  if (typeof window === 'undefined' || runtimeStarted) return;
  runtimeStarted = true;

  void checkStatusInternal();
  intervalId = window.setInterval(() => {
    if (!document.hidden) {
      void checkStatusInternal();
    }
  }, POLL_INTERVAL_MS);
}

/**
 * Shared data-status state. Multiple admin components dapat memanggil hook ini
 * tanpa membuat ulang interval poll atau request `/api/health` ganda.
 *
 * Runtime di-start sekali saat hook dipanggil pertama kali dan dibiarkan hidup
 * selama sesi admin. Tidak ada cleanup per-unmount agar pindah halaman tidak
 * memicu polling restart yang menambah latency persepsi.
 */
export function useDataStatus() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    ensureRuntime();
  }, []);

  return {
    isLoading: current.isLoading,
    connectionStatus: current.connectionStatus,
    serverStatus: current.serverStatus,
    latencyMs: current.latencyMs,
    lastCheckedAt: current.lastCheckedAt,
    errorMessage: current.errorMessage,
    health: current.health,
    deployStatus: 'idle' as const,
    checkStatus: checkStatusInternal,
    triggerSync: async () => Promise.resolve(),
    saveSettings: async () => Promise.resolve({ success: true }),
  };
}

/**
 * Manual stop, exposed for tests / sign-out flows. Production code biasanya
 * tidak perlu memanggil ini.
 */
export function stopDataStatusRuntime() {
  if (intervalId !== null) {
    window.clearInterval(intervalId);
    intervalId = null;
  }
  runtimeStarted = false;
}
