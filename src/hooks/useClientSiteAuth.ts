'use client';

import { useCallback, useState } from 'react';

export interface ClientSiteAuthSnapshot {
  isAdmin: boolean;
  csrfToken: string;
  isLoading: boolean;
}

export function useClientSiteAuth(_siteId?: string) {
  const [isAdmin] = useState(false);
  const [csrfToken] = useState('');

  const checkAuth = useCallback(async () => {
    // Client auth system removed — always unauthenticated.
  }, []);

  const logout = useCallback(async () => {
    window.location.reload();
  }, []);

  return {
    isAdmin,
    csrfToken,
    isLoading: false,
    logout,
    refreshAuth: checkAuth,
  };
}
