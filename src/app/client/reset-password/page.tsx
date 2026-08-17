import { Suspense } from 'react';
import ResetPasswordForm from './ResetPasswordForm';

export const dynamic = 'force-dynamic';

export default function ClientResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 py-10 text-zinc-950">
          <div className="h-20 w-full max-w-sm animate-pulse rounded-lg bg-white" />
        </main>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
