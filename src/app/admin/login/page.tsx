import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminLoginClient from './_components/AdminLoginClient';
import { verifySiteUserJWT } from '@/crud/shared/auth/session';
import { isSessionRevoked } from '@/crud/shared/auth/guard';

export const metadata: Metadata = {
  title: 'Admin Login | Portfolio OS',
  description: 'Access the admin dashboard.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#f9fafb',
  width: 'device-width',
  initialScale: 1,
};

interface AdminLoginPageProps {
  searchParams?: Promise<{
    redirect?: string | string[];
  }>;
}

function getSafeRedirectTarget(value?: string | string[]) {
  const target = Array.isArray(value) ? value[0] : value;

  if (!target || !target.startsWith('/') || target.startsWith('//')) {
    return '/admin';
  }

  if (target.startsWith('/admin/login')) {
    return '/admin';
  }

  return target;
}

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const cookieStore = await cookies();
  const token = cookieStore.get('site_user_token')?.value;

  if (token) {
    const session = await verifySiteUserJWT(token);
    // Sesi yang sudah dicabut (password pernah diganti setelah token terbit)
    // jangan dianggap login — pemiliknya harus masuk ulang dengan password baru.
    if (session && !(await isSessionRevoked(session))) {
      const params = await searchParams;
      redirect(getSafeRedirectTarget(params?.redirect));
    }
  }

  return <AdminLoginClient />;
}
