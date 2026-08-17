import type { Metadata } from 'next';
import { generateMetadata as generateSEOMetadata } from '@/lib/seo';

export const metadata: Metadata = generateSEOMetadata({
  title: 'Admin - Client Dashboard',
  description: 'Manage client portfolio sites and project quotas',
  path: '/admin/client-dashboard',
});

export default function ClientDashboardPage() {
  return null;
}
