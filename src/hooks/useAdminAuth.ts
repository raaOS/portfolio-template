'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

const CHANNEL_NAME = 'admin-auth-sync';
const AUTH_CACHE_TTL = 45_000;

interface AdminAuthSnapshot {
  isAdmin: boolean;
  csrfToken: string;
  isLoading: boolean;
}

let authSnapshot: AdminAuthSnapshot = {
  isAdmin: false,
  csrfToken: '',
  isLoading: true,
};

let lastCheckedAt = 0;
let inFlightAuthCheck: Promise<void> | null = null;
let runtimeStarted = false;
let channel: BroadcastChannel | null = null;
// PERF: interval & visibility handler sengaja tidak di-cleanup. Runtime
// singleton seumur tab admin. Variable tetap di-assign agar referensi tidak
// di-GC + bisa diakses kalau nanti perlu shutdown manual.
let _intervalId: number | null = null;
let _visibilityHandler: (() => void) | null = null;

const listeners = new Set<() => void>();

function getSnapshot() {
  return authSnapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function publish(next: Partial<AdminAuthSnapshot>) {
  const merged = { ...authSnapshot, ...next };

  if (
    merged.isAdmin === authSnapshot.isAdmin &&
    merged.csrfToken === authSnapshot.csrfToken &&
    merged.isLoading === authSnapshot.isLoading
  ) {
    return;
  }

  authSnapshot = merged;
  listeners.forEach((listener) => listener());
}

async function checkAuth(force = false) {
  if (typeof window === 'undefined') return;

  const now = Date.now();
  if (!force && !authSnapshot.isLoading && now - lastCheckedAt < AUTH_CACHE_TTL) {
    return;
  }

  if (inFlightAuthCheck && !force) {
    return inFlightAuthCheck;
  }

  inFlightAuthCheck = (async () => {
    try {
      const response = await fetch(`/api/auth/check-auth?t=${Date.now()}`, {
        credentials: 'include',
      });
      const data = await response.json();
      const isAdmin = data.authenticated === true;
      const previousToken = authSnapshot.csrfToken;
      const csrfToken = typeof data.csrfToken === 'string' ? data.csrfToken : '';

      publish({
        isAdmin,
        csrfToken: csrfToken || (isAdmin ? previousToken : ''),
        isLoading: false,
      });

      if (channel && csrfToken && csrfToken !== previousToken) {
        channel.postMessage({
          type: 'token-update',
          token: csrfToken,
          isAdmin,
        });
      }
    } catch (error) {
      console.error('Failed to check admin auth:', error);
      publish({ isAdmin: false, csrfToken: '', isLoading: false });
    } finally {
      lastCheckedAt = Date.now();
      inFlightAuthCheck = null;
    }
  })();

  return inFlightAuthCheck;
}

function ensureAuthRuntime() {
  if (typeof window === 'undefined' || runtimeStarted) return;
  runtimeStarted = true;

  if (window.location.search.includes('logged_out=true')) {
    publish({ isAdmin: false, csrfToken: '', isLoading: false });
  }

  void checkAuth();

  if ('BroadcastChannel' in window) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => {
      const { type, token, isAdmin } = event.data || {};

      if (type === 'token-update' && typeof token === 'string') {
        publish({
          csrfToken: token,
          isAdmin: isAdmin === true,
          isLoading: false,
        });
      }

      if (type === 'logout') {
        publish({ isAdmin: false, csrfToken: '', isLoading: false });
        window.location.href = '/?logged_out=true';
      }
    };
  }

  const handleVisibilityChange = () => {
    if (!document.hidden) {
      void checkAuth(true);
    }
  };
  _visibilityHandler = handleVisibilityChange;

  document.addEventListener('visibilitychange', handleVisibilityChange);
  _intervalId = window.setInterval(() => {
    if (!document.hidden) {
      void checkAuth(true);
    }
  }, 60_000);
}

async function logoutWithSharedState() {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 10_000);

  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'x-csrf-token': authSnapshot.csrfToken,
      },
      credentials: 'include',
      signal: controller.signal,
    });

    publish({ isAdmin: false, csrfToken: '', isLoading: false });
    lastCheckedAt = Date.now();
    channel?.postMessage({ type: 'logout' });

    await new Promise((resolve) => setTimeout(resolve, 800));
    window.location.href = '/?logged_out=true';
  } catch (error) {
    console.error('Logout failed, forcing redirect:', error);
    publish({ isAdmin: false, csrfToken: '', isLoading: false });
    window.location.href = '/?logged_out=error';
  } finally {
    window.clearTimeout(timeoutId);
  }
}

/**
 * Shared admin auth state.
 *
 * Multiple admin components can call this hook without creating duplicate
 * /api/admin/check-auth requests, polling intervals, or BroadcastChannel
 * instances.
 *
 * PERF: tidak ada cleanup per-unmount. Runtime di-start sekali saat hook
 * dipanggil pertama kali dan dibiarkan hidup selama tab admin terbuka.
 * Cleanup sebelumnya (queueMicrotask + listeners.size check) bermasalah karena
 * unmount → cleanup terjadwal → mount baru tetap nge-publish `isLoading: true`
 * lalu re-fetch /api/admin/check-auth, bikin flicker spinner di tiap navigasi
 * antar menu CRUD.
 *
 * @example
 * ```tsx
 * const { isAdmin, csrfToken, isLoading, logout, refreshAuth } = useAdminAuth();
 * ```
 */
export function useAdminAuth() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    ensureAuthRuntime();
    // Sengaja tidak ada cleanup. Runtime singleton seumur tab.
  }, []);

  const logout = useCallback(async () => {
    await logoutWithSharedState();
  }, []);

  return {
    ...snapshot,
    logout,
    refreshAuth: () => checkAuth(true),
  };
}
