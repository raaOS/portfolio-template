'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, KeyRound } from 'lucide-react';

interface ResetPasswordFormProps {
  token: string;
}

export default function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Token hilang (mis. link dipotong email) — langsung beri tahu, jangan
  // tampilkan form yang pasti gagal.
  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
            Tautan tidak valid — kode token tidak ditemukan. Minta tautan baru lewat halaman Lupa Password.
          </div>
          <Link
            href="/admin/lupa-password"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-500 hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            Minta tautan baru
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password tidak sama.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password baru minimal 8 karakter.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json().catch(() => null);

      if (res.ok) {
        setDone(true);
        setMessage(data?.message || 'Password baru sudah tersimpan. Silakan login.');
      } else {
        // Token kedaluwarsa/terpakai/penanda lain → pesan dari server.
        setError(data?.error || 'Tautan tidak valid atau sudah kedaluwarsa.');
      }
    } catch {
      setError('Jaringan bermasalah. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <KeyRound className="h-6 w-6 text-blue-600" aria-hidden="true" />
            </div>
          </div>
          <h2 className="mt-4 text-center text-3xl font-extrabold text-gray-900">Atur Ulang Password</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Buat password baru untuk akun admin Anda. Semua sesi login lama akan dicabut.
          </p>
        </div>

        {done ? (
          <div className="space-y-6 text-center">
            <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800" role="status">
              {message}
            </div>
            <Link
              href="/admin/login"
              className="inline-flex w-full items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Menuju Halaman Login
            </Link>
          </div>
        ) : (
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="new-password" className="sr-only">
                Password baru
              </label>
              <input
                id="new-password"
                name="new-password"
                type="password"
                required
                minLength={8}
                className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                placeholder="Password baru (min. 8 karakter)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="sr-only">
                Ulangi password baru
              </label>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                required
                minLength={8}
                className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                placeholder="Ulangi password baru"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="text-center text-sm text-red-600" role="alert">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group flex w-full items-center justify-center gap-2 rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <KeyRound className="h-4 w-4 text-blue-200" />
                )}
                <span>{loading ? 'Menyimpan...' : 'Simpan Password Baru'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
