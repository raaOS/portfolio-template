'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, Send } from 'lucide-react';

export default function LupaPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => null);

      if (res.ok) {
        setDone(true);
        // Pesan generik dari server — jawaban yang sama untuk semua kasus.
        setMessage(data?.message || 'Jika email terdaftar, tautan sudah dikirim.');
      } else {
        setError(data?.error || 'Gagal mengirim permintaan. Coba lagi.');
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
              <Mail className="h-6 w-6 text-blue-600" aria-hidden="true" />
            </div>
          </div>
          <h2 className="mt-4 text-center text-3xl font-extrabold text-gray-900">Lupa Password?</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Masukkan email admin Anda. Kami kirimkan tautan untuk membuat password baru.
          </p>
        </div>

        {done ? (
          <div className="rounded-md border border-green-200 bg-green-50 p-4 text-center text-sm text-green-800" role="status">
            {message}
          </div>
        ) : (
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="reset-email" className="sr-only">
                Email
              </label>
              <div className="flex gap-2">
                <input
                  id="reset-email"
                  name="email"
                  type="email"
                  required
                  className="relative block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  placeholder="Enter admin email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <div className="flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-gray-500">
                  <Mail className="h-4 w-4" />
                </div>
              </div>
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
                  <Send className="h-4 w-4 text-blue-200" />
                )}
                <span>{loading ? 'Mengirim...' : 'Kirim Tautan Reset'}</span>
              </button>
            </div>
          </form>
        )}

        <div className="text-center">
          <Link
            href="/admin/login"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-500 hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            Kembali ke login
          </Link>
        </div>
      </div>
    </div>
  );
}
