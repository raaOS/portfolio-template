'use client';

import { FormEvent, useEffect, useState } from 'react';
import { KeyRound, Loader2, LogIn, Mail } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useSearchParams } from 'next/navigation';

type LoginBootstrap = {
  csrfToken?: string;
};

export default function ClientLoginForm() {
  const { showError, showSuccess } = useToast();
  const searchParams = useSearchParams();
  const siteSlugFromQuery = (searchParams.get('site') || '').trim().toLowerCase();
  const [siteSlug, setSiteSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const authResponse = await fetch('/api/client/check-auth', {
          credentials: 'include',
          cache: 'no-store',
        });
        const authData = await authResponse.json().catch(() => ({}));
        if (authData?.authenticated === true) {
          window.location.href = '/client/dashboard';
          return;
        }

        const loginResponse = await fetch('/api/client/login', {
          credentials: 'include',
          cache: 'no-store',
        });
        const data = (await loginResponse.json().catch(() => ({}))) as LoginBootstrap;
        if (!cancelled) {
          setCsrfToken(data.csrfToken || '');
          setSiteSlug(siteSlugFromQuery);
          setIsLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          showError(error instanceof Error ? error.message : 'Gagal memuat login client');
          setIsLoading(false);
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [showError, siteSlugFromQuery]);

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!csrfToken) {
      showError('CSRF token belum siap');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/client/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          siteSlug: siteSlug.trim(),
          email: email.trim(),
          password,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Login gagal');
      }

      showSuccess('Login client berhasil');
      window.location.href = '/client/dashboard';
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Login gagal');
      setIsSubmitting(false);
    }
  };

  const submitPasswordReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!csrfToken) {
      showError('CSRF token belum siap');
      return;
    }

    setIsResetSubmitting(true);
    try {
      const response = await fetch('/api/client/password-reset/request', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          siteSlug: siteSlug.trim(),
          email: email.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Gagal meminta reset');
      }

      showSuccess(
        typeof data?.message === 'string'
          ? data.message
          : 'Jika akses client cocok, link reset dikirim ke email.'
      );
      setIsResetMode(false);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Gagal meminta reset');
    } finally {
      setIsResetSubmitting(false);
    }
  };

  const isBusy = isLoading || isSubmitting || isResetSubmitting;

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 py-10 text-zinc-950">
      <form
        onSubmit={isResetMode ? submitPasswordReset : submitLogin}
        className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
      >
        <div>
          <h1 className="text-lg font-semibold">Client Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {isResetMode
              ? 'Minta link reset ke email client terdaftar.'
              : 'Masuk dengan akses site portfolio.'}
          </p>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-zinc-600">Site slug</span>
            <input
              value={siteSlug}
              onChange={(event) => setSiteSlug(event.target.value.toLowerCase())}
              disabled={isBusy}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-500 disabled:bg-zinc-100"
              placeholder="studio-client"
              autoComplete="organization"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-zinc-600">Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isBusy}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-500 disabled:bg-zinc-100"
              placeholder="client@example.com"
              autoComplete="email"
            />
          </label>
          {!isResetMode ? (
            <label className="block">
              <span className="text-xs font-medium text-zinc-600">Password</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isBusy}
                type="password"
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-500 disabled:bg-zinc-100"
                autoComplete="current-password"
              />
            </label>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={
            isBusy ||
            !siteSlug.trim() ||
            !email.trim() ||
            (!isResetMode && !password)
          }
          className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          {isSubmitting || isLoading || isResetSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isResetMode ? (
            <Mail className="h-4 w-4" />
          ) : (
            <LogIn className="h-4 w-4" />
          )}
          {isResetMode ? 'Kirim Link Reset' : 'Masuk'}
        </button>

        <button
          type="button"
          disabled={isBusy}
          onClick={() => setIsResetMode((current) => !current)}
          className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-zinc-200 px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <KeyRound className="h-4 w-4" />
          {isResetMode ? 'Kembali ke Login' : 'Lupa Password'}
        </button>
      </form>
    </main>
  );
}
