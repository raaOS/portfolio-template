'use client';

import { FormEvent, useMemo, useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const { showError, showSuccess } = useToast();
  const token = useMemo(() => (searchParams.get('token') || '').trim(), [searchParams]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const submitReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      showError('Token reset tidak ditemukan');
      return;
    }
    if (newPassword.length < 8) {
      showError('Password minimal 8 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      showError('Konfirmasi password tidak sama');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/client/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Reset password gagal');
      }

      setIsDone(true);
      showSuccess('Password berhasil diganti');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Reset password gagal');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 py-10 text-zinc-950">
      <form
        onSubmit={submitReset}
        className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
      >
        <div>
          <h1 className="text-lg font-semibold">Reset Password Client</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Buat password baru untuk akses dashboard portfolio.
          </p>
        </div>

        {isDone ? (
          <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            Password sudah diganti. Silakan kembali ke halaman login client.
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {!token ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Token reset tidak ditemukan. Minta link reset baru dari halaman login client.
              </div>
            ) : null}

            <label className="block">
              <span className="text-xs font-medium text-zinc-600">Password baru</span>
              <input
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                disabled={isSubmitting || !token}
                type="password"
                minLength={8}
                autoComplete="new-password"
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-500 disabled:bg-zinc-100"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-zinc-600">Konfirmasi password</span>
              <input
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={isSubmitting || !token}
                type="password"
                minLength={8}
                autoComplete="new-password"
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-500 disabled:bg-zinc-100"
              />
            </label>
          </div>
        )}

        {!isDone ? (
          <button
            type="submit"
            disabled={isSubmitting || !token || !newPassword || !confirmPassword}
            className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            Simpan Password Baru
          </button>
        ) : (
          <a
            href="/client/login"
            className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Ke Login Client
          </a>
        )}
      </form>
    </main>
  );
}
