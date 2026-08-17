import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAdminToken } from '@/lib/auth';
import AdminExplorerClient from '@/app/admin/projects/explorer/AdminExplorerClient';

export const metadata = {
  title: 'Explorer Manager | Portfolio Admin',
  description: 'Manage Project Explorer folders and files.',
};

export default async function AdminExplorerPage() {
  // Server-side auth guard
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value || cookieStore.get('admin-token')?.value;

  const isAuthenticated = token ? verifyAdminToken(token) : false;

  if (!isAuthenticated) {
    redirect('/admin/login');
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-500">
          Loading Explorer Manager...
        </div>
      }
    >
      <AdminExplorerClient />
    </Suspense>
  );
}
