import { redirect } from 'next/navigation';

interface TenantLoginAliasPageProps {
  params: Promise<{ siteSlug: string }>;
}

export default async function TenantLoginAliasPage({ params }: TenantLoginAliasPageProps) {
  const { siteSlug } = await params;
  const query = new URLSearchParams({ site: siteSlug });

  redirect(`/client/login?${query.toString()}`);
}
