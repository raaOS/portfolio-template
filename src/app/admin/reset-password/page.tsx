import type { Metadata, Viewport } from 'next';
import ResetPasswordForm from './ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Atur Ulang Password | Portfolio OS',
  description: 'Buat password baru dari tautan reset.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#f9fafb',
  width: 'device-width',
  initialScale: 1,
};

interface ResetPasswordPageProps {
  searchParams?: Promise<{
    token?: string | string[];
  }>;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;
  const token = Array.isArray(params?.token) ? params.token[0] : params?.token;

  return <ResetPasswordForm token={token ?? ''} />;
}
