'use client';

import { useCallback, useEffect, useState } from 'react';

export interface ClientSiteAuthSnapshot {
  isAdmin: boolean;
  csrfToken: string;
  isLoading: boolean;
}

export function useClientSiteAuth(siteId?: string) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [csrfToken, setCsrfToken] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch(`/api/client/check-auth?t=${Date.now()}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));

      const isAuthenticated = data.authenticated === true;
      const clientSiteId = data.client?.site?.id;
      const clientSiteSlug = data.client?.site?.slug;

      const matchesSite =
        isAuthenticated &&
        Boolean(
          (siteId && (clientSiteId === siteId || clientSiteSlug === siteId)) ||
          (!siteId && (clientSiteId || clientSiteSlug))
        );

      setIsAdmin(matchesSite);
      setCsrfToken(data.csrfToken || '');
    } catch {
      setIsAdmin(false);
      setCsrfToken('');
    } finally {
      setIsLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    queueMicrotask(() => {
      void checkAuth();
    });
  }, [checkAuth]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/client/logout', {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
        credentials: 'include',
      });
    } catch (err) {
      console.warn('[useClientSiteAuth] Logout error:', err);
    } finally {
      setIsAdmin(false);
      window.location.reload();
    }
  }, [csrfToken]);

  return {
    isAdmin,
    csrfToken,
    isLoading,
    logout,
    refreshAuth: checkAuth,
  };
}
