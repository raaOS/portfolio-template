import { redirect } from 'next/navigation';

interface PreviewActionPageProps {
  params: Promise<{
    template: string;
    action: string;
  }>;
}

/**
 * Preview Action Sub-route:
 * Menangani URL seperti:
 * - /preview/infinite-canvas/login -> redirect ke /admin/login?redirect=/preview/infinite-canvas
 * - /preview/infinite-canvas/admin -> redirect ke /admin/login?redirect=/preview/infinite-canvas
 */
export default async function PreviewActionPage({ params }: PreviewActionPageProps) {
  const { template, action } = await params;

  if (action === 'login' || action === 'admin') {
    redirect(`/admin/login?redirect=/preview/${encodeURIComponent(template)}`);
  }

  // Fallback jika aksi lain diketikkan: kembalikan ke halaman preview template utama
  redirect(`/preview/${encodeURIComponent(template)}`);
}
