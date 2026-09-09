import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAdminToken } from '@/lib/auth';
import { verifySiteUserJWT } from '@/crud/shared/auth/session';
import AdminDashboardClient from './AdminDashboardClient';

export default async function AdminPage() {
  // Server-side auth guard
  const cookieStore = await cookies();
  const siteUserToken = cookieStore.get('site_user_token')?.value;
  const adminToken = cookieStore.get('admin_token')?.value || cookieStore.get('admin-token')?.value;

  let isAuthenticated = false;
  if (siteUserToken) {
    const session = await verifySiteUserJWT(siteUserToken);
    isAuthenticated = session?.role === 'admin';
  }
  if (!isAuthenticated && adminToken) {
    isAuthenticated = verifyAdminToken(adminToken);
  }

  if (!isAuthenticated) {
    redirect('/admin/login');
  }

  return (
    <Suspense fallback={null}>
      <AdminDashboardClient />
    </Suspense>
  );
}
