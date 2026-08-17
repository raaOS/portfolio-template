'use client';

/**
 * Realtime Sync Hook — Polling versi data untuk mendeteksi pembaruan.
 *
 * Mengirim request ke `/api/data/version` setiap 30 detik untuk mengecek
 * apakah ada data baru di database. Interval dioptimasi untuk quota Cloudflare/D1.
 *
 * @module realtimeSync
 */
import { useEffect, useRef } from 'react';

// Cloudflare/D1 quota guard — interval 5s adalah peninggalan era
// "instant admin sync" yang berlebihan untuk skala portfolio. Hitungan
// kasar: admin tab open 1 jam = 720 polls = 720 invocations untuk single
// admin session, sementara payload dari `/api/data/version` cuma version
// string (~50 bytes). Naikkan ke 30s mengurangi invocations 6×; admin
// tetap dapat update otomatis dalam ≤30s, atau bisa manual refresh kalau
// urgent. /api/data/version juga sudah Edge runtime jadi cost per panggil
// rendah, tapi panggilan yang tidak perlu tetap counted di limit.
const POLL_INTERVAL_MS = 30000;

async function fetchDataVersion(): Promise<string | null> {
  const response = await fetch('/api/data/version', { cache: 'no-store' });
  if (!response.ok) return null;
  const data = (await response.json().catch(() => null)) as { lastUpdated?: string | null } | null;
  return data?.lastUpdated || null;
}

interface UseRealtimeSyncOptions {
  onUpdate: () => void;
  onUnavailable?: () => void;
  enabled?: boolean;
}

type Subscriber = {
  onUpdate: () => void;
  onUnavailable?: () => void;
};

// Module-level shared runtime. Polling jalan sekali untuk semua subscriber
// sehingga pindah antar halaman admin tidak memicu reset interval +
// re-initialize timestamp. Ini pemicu utama "burst" request dan refetch yang
// bikin transisi terasa lambat.
let lastTimestamp: string | null = null;
let isInitialized = false;
let intervalId: ReturnType<typeof setInterval> | null = null;
let pollInFlight = false;

const subscribers = new Set<Subscriber>();

async function pollOnce() {
  if (pollInFlight) return;
  pollInFlight = true;
  try {
    const newTimestamp = await fetchDataVersion();

    if (!newTimestamp) {
      subscribers.forEach((sub) => sub.onUnavailable?.());
      return;
    }

    if (!isInitialized) {
      lastTimestamp = newTimestamp;
      isInitialized = true;
      return;
    }

    if (newTimestamp !== lastTimestamp) {
      lastTimestamp = newTimestamp;
      subscribers.forEach((sub) => sub.onUpdate());
    }
  } catch {
    subscribers.forEach((sub) => sub.onUnavailable?.());
  } finally {
    pollInFlight = false;
  }
}

function ensureRuntime() {
  if (typeof window === 'undefined' || intervalId !== null) return;
  void pollOnce();
  intervalId = setInterval(() => {
    if (typeof document !== 'undefined' && document.hidden) return;
    void pollOnce();
  }, POLL_INTERVAL_MS);
}

function maybeStopRuntime() {
  if (subscribers.size === 0 && intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
    // NOTE: kita biarkan `lastTimestamp` & `isInitialized` tetap supaya
    // saat ada subscriber baru muncul, kita tidak nge-fire onUpdate palsu
    // karena re-initialize. Reset hanya saat halaman benar-benar reload.
  }
}

export function useRealtimeSync({
  onUpdate,
  onUnavailable,
  enabled = true,
}: UseRealtimeSyncOptions) {
  const onUpdateRef = useRef(onUpdate);
  const onUnavailableRef = useRef(onUnavailable);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);
  useEffect(() => {
    onUnavailableRef.current = onUnavailable;
  }, [onUnavailable]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const subscriber: Subscriber = {
      onUpdate: () => onUpdateRef.current(),
      onUnavailable: () => onUnavailableRef.current?.(),
    };

    subscribers.add(subscriber);
    ensureRuntime();

    return () => {
      subscribers.delete(subscriber);
      // Defer stop ke microtask supaya unmount→remount cepat (StrictMode /
      // navigation transition) tidak nge-restart polling.
      queueMicrotask(maybeStopRuntime);
    };
  }, [enabled]);
}

export async function checkForUpdates(lastKnownTimestamp: string | null): Promise<{
  hasUpdate: boolean;
  newTimestamp: string | null;
}> {
  try {
    const newTimestamp = await fetchDataVersion();
    return {
      hasUpdate: Boolean(newTimestamp && newTimestamp !== lastKnownTimestamp),
      newTimestamp: newTimestamp || lastKnownTimestamp,
    };
  } catch (error) {
    console.error('[RealtimeSync] Check for updates failed:', error);
    return { hasUpdate: false, newTimestamp: lastKnownTimestamp };
  }
}
