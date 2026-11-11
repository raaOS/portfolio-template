import { notFound } from 'next/navigation';
import { isStorefrontDeployment } from '@/lib/storefront';
import CheckoutForm from './CheckoutForm';

/**
 * Gerbang checkout (v1.3.82).
 *
 * Middleware sudah mem-404-kan `/checkout` di deployment klien
 * (`STOREFRONT_ONLY_PREFIXES`), tapi halaman ini dulu komponen client murni
 * sehingga tidak punya penjaga sendiri. Sekarang penjaganya ada di server:
 * satu-satunya jalur yang boleh merender form adalah deployment toko.
 *
 * `searchParams` membuat rute ini dirender saat request (bukan HTML statis
 * yang bisa disajikan langsung dari asset binding tanpa melewati Worker),
 * sekaligus memungkinkan tautan `?template=os-desktop` dari demo hero
 * langsung memilih template di form.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string | string[] }>;
}) {
  if (!isStorefrontDeployment()) notFound();

  const { template } = await searchParams;
  const initialTemplateId = Array.isArray(template) ? template[0] : template;

  return <CheckoutForm initialTemplateId={initialTemplateId} />;
}
