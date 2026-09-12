'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Lock, KeyRound, ShieldCheck, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useCsrfToken } from '@/hooks/useCsrfToken';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const [mounted, setMounted] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const csrfToken = useCsrfToken();

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!isOpen || !mounted) return null;

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: 'bg-gray-200' };

    let score = 0;
    if (pass.length >= 8) score += 1;
    if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score += 1;
    if (/\d/.test(pass)) score += 1;
    if (/[^a-zA-Z\d]/.test(pass)) score += 1;

    if (score <= 1 || pass.length < 8) {
      return { score: 1, label: 'Lemah', color: 'bg-red-500' };
    }
    if (score === 2 || score === 3) {
      return { score: 2, label: 'Sedang', color: 'bg-orange-500' };
    }
    return { score: 3, label: 'Sangat Kuat', color: 'bg-[#00AA5B]' };
  };

  const strength = getPasswordStrength(newPassword);

  const resetState = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccess(false);
    setShowOld(false);
    setShowNew(false);
    setShowConfirm(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!oldPassword) {
      setError('Password saat ini wajib diisi.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Password baru dan konfirmasi tidak cocok.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password baru harus minimal 8 karakter.');
      return;
    }

    if (newPassword === oldPassword) {
      setError('Password baru harus berbeda dari password saat ini.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken || '',
        },
        body: JSON.stringify({ currentPassword: oldPassword, newPassword }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Gagal mengubah password');
      }

      setSuccess(true);
      window.setTimeout(() => {
        handleClose();
      }, 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setIsLoading(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div
        className="animate-in fade-in zoom-in-95 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <ShieldCheck size={18} />
            </div>
            <h2 className="text-lg font-semibold text-gray-800">Keamanan</h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            disabled={isLoading || success}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          {success ? (
            <div className="animate-in slide-in-from-bottom-4 flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <ShieldCheck size={32} />
              </div>
              <h3 className="mb-2 text-xl font-bold text-gray-800">Password Berhasil Diubah!</h3>
              <p className="text-sm text-gray-500">
                Password login admin Anda telah diperbarui. Gunakan password baru saat login berikutnya.
              </p>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-left-4 space-y-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-xs leading-relaxed text-gray-500">
                  Ubah password login admin Anda dengan verifikasi password saat ini.
                </p>

                {error && (
                  <div className="animate-in slide-in-from-top-2 flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 p-4 text-red-600">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <p className="text-sm">{error}</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="change-old-password" className="text-sm font-medium text-gray-700">
                    Password Saat Ini
                  </label>
                  <div className="relative">
                    <Lock
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      size={16}
                    />
                    <input
                      id="change-old-password"
                      type={showOld ? 'text' : 'password'}
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-10 text-sm text-gray-800 placeholder-gray-400 transition-shadow focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Masukkan password saat ini"
                      required
                      disabled={isLoading}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOld((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label={showOld ? 'Sembunyikan password' : 'Tampilkan password'}
                    >
                      {showOld ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="change-new-password" className="text-sm font-medium text-gray-700">
                    Password Baru
                  </label>
                  <div className="relative">
                    <KeyRound
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      size={16}
                    />
                    <input
                      id="change-new-password"
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-10 text-sm text-gray-800 placeholder-gray-400 transition-shadow focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Minimal 8 karakter"
                      required
                      disabled={isLoading}
                      minLength={8}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label={showNew ? 'Sembunyikan password' : 'Tampilkan password'}
                    >
                      {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {newPassword.length > 0 && (
                    <div className="animate-in fade-in slide-in-from-top-1 mt-2">
                      <div className="flex h-1.5 w-full gap-1 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full transition-all duration-300 ${strength.score >= 1 ? strength.color : 'bg-transparent'}`}
                          style={{ width: '33.33%' }}
                        />
                        <div
                          className={`h-full transition-all duration-300 ${strength.score >= 2 ? strength.color : 'bg-transparent'}`}
                          style={{ width: '33.33%' }}
                        />
                        <div
                          className={`h-full transition-all duration-300 ${strength.score >= 3 ? strength.color : 'bg-transparent'}`}
                          style={{ width: '33.33%' }}
                        />
                      </div>
                      <p
                        className={`mt-1.5 text-xs font-medium ${
                          strength.score === 1
                            ? 'text-red-500'
                            : strength.score === 2
                              ? 'text-orange-500'
                              : 'text-[#00AA5B]'
                        }`}
                      >
                        Kekuatan: {strength.label}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="change-confirm-password" className="text-sm font-medium text-gray-700">
                    Konfirmasi Password Baru
                  </label>
                  <div className="relative">
                    <KeyRound
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      size={16}
                    />
                    <input
                      id="change-confirm-password"
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-10 text-sm text-gray-800 placeholder-gray-400 transition-shadow focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Ulangi password baru"
                      required
                      disabled={isLoading}
                      minLength={8}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label={showConfirm ? 'Sembunyikan password' : 'Tampilkan password'}
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isLoading || !oldPassword || !newPassword || !confirmPassword || strength.score < 1}
                    className="flex w-full items-center justify-center rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
                  >
                    {isLoading ? 'Menyimpan...' : 'Simpan Password Baru'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
