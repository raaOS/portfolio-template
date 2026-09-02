'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

import type { LocationData } from './useGeolocation';

export function useAdminLogin(_location: LocationData | null) {
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [csrfToken, setCsrfToken] = useState<string>('');

  // Fetch CSRF token on load
  const fetchCSRF = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/check-auth', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setCsrfToken(data.csrfToken);
      }
    } catch (e) {
      console.error('CSRF fetch error:', e);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchCSRF();
    });
  }, [fetchCSRF]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      setError('Email dan password wajib diisi.');
      return;
    }

    setLoading(true);
    setError('');

    let currentToken = csrfToken;
    try {
      const res = await fetch('/api/auth/check-auth', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        currentToken = data.csrfToken;
        setCsrfToken(data.csrfToken);
      }
    } catch (e) {
      console.error('CSRF fetch error:', e);
    }

    if (!currentToken) {
      setError('CSRF token tidak tersedia. Silakan refresh halaman.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': currentToken,
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const redirectTarget = searchParams.get('redirect');
        // SECURITY FIX: Validasi redirect dengan URL-parser, bukan string
        // startsWith — `/\evil.com` atau `%5C%5Cevil.com` bisa lolos cek lama
        // karena browser menormalkan backslash menjadi forward slash.
        let safeRedirectTarget = '/admin';
        if (redirectTarget && redirectTarget.startsWith('/') && !redirectTarget.startsWith('//')) {
          try {
            const parsed = new URL(redirectTarget, window.location.origin);
            if (
              parsed.origin === window.location.origin &&
              !parsed.pathname.startsWith('/admin/login')
            ) {
              safeRedirectTarget = parsed.pathname + parsed.search + parsed.hash;
            }
          } catch {
            // abaikan, tetap fallback ke /admin
          }
        }

        window.location.href = safeRedirectTarget;
      } else {
        // Small delay to discourage brute-force attempts
        await new Promise((resolve) => setTimeout(resolve, 400));

        let message = 'Login failed. Please try again.';
        if (response.status === 500) {
          message =
            '⚠️ Backend Error: Masalah koneksi database (Internal Server Error). Pastikan server stabil.';
        } else {
          try {
            const data = await response.json();
            if (response.status === 401) {
              message = data?.error || 'Incorrect password. Please try again.';
            } else if (data?.error) {
              message = data.error;
            }
          } catch {
            // Ignore JSON parse errors
          }
        }
        setError(message);
      }
    } catch {
      setError('Unable to login. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    loading,
    error,
    handleSubmit,
  };
}
