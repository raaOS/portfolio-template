'use client';

import { Eye, EyeOff, Lock, Mail } from 'lucide-react';

interface LoginFormProps {
  email: string;
  password: string;
  showPassword: boolean;
  loading: boolean;
  error: string;
  isEnabled: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function LoginForm({
  email,
  password,
  showPassword,
  loading,
  error,
  isEnabled,
  onEmailChange,
  onPasswordChange,
  onTogglePassword,
  onSubmit,
}: LoginFormProps) {
  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <div>
        <label htmlFor="email" className="sr-only">
          Email
        </label>
        <div className="flex gap-2">
          <input
            id="email"
            name="email"
            type="email"
            required
            disabled={!isEnabled}
            className="relative block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-blue-500 focus:outline-none focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 sm:text-sm"
            placeholder="Enter admin email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
          />
          <div className="flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-gray-500">
            <Mail className="h-4 w-4" />
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="password" className="sr-only">
          Password
        </label>
        <div className="flex gap-2">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            disabled={!isEnabled}
            className="relative block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-blue-500 focus:outline-none focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 sm:text-sm"
            placeholder="Enter admin password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
          />
          <button
            type="button"
            onClick={onTogglePassword}
            disabled={!isEnabled}
            className="flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-gray-500 hover:bg-gray-50 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-100"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
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
          disabled={!isEnabled || loading}
          className={`group flex w-full items-center justify-center gap-2 rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
            isEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'cursor-not-allowed bg-gray-400'
          }`}
        >
          {loading ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Lock className="h-4 w-4 text-blue-200" />
          )}
          <span suppressHydrationWarning>
            {loading ? 'Signing in...' : !isEnabled ? 'Aktifkan Lokasi untuk Login' : 'Sign in'}
          </span>
        </button>
      </div>
    </form>
  );
}
