import type { Metadata, Viewport } from 'next';
import LupaPasswordForm from './LupaPasswordForm';

export const metadata: Metadata = {
  title: 'Lupa Password | Portfolio OS',
  description: 'Minta tautan untuk mengatur ulang password admin.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#f9fafb',
  width: 'device-width',
  initialScale: 1,
};

export default function LupaPasswordPage() {
  return <LupaPasswordForm />;
}
