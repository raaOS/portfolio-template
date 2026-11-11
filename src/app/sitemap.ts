import { MetadataRoute } from 'next';
import { allProjectsAsync } from '@/lib/projects';
import { DEFAULT_SITE_URL } from '@/lib/constants';
import { isStorefrontDeployment } from '@/lib/storefront';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;

  const projects = await allProjectsAsync();

  const staticUrls: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/projects`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/preview/os-desktop`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/preview/infinite-canvas`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/cv`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/syarat-ketentuan`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/kebijakan-privasi`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ];

  // Halaman jualan hanya ada di build owner (`STOREFRONT=true`); build klien
  // menghapus variabel itu sehingga route-nya 404 — jangan diindeks.
  const storefrontUrls: MetadataRoute.Sitemap = isStorefrontDeployment()
    ? [
        {
          url: `${baseUrl}/fitur`,
          lastModified: new Date(),
          changeFrequency: 'monthly',
          priority: 0.9,
        },
        {
          url: `${baseUrl}/harga`,
          lastModified: new Date(),
          changeFrequency: 'monthly',
          priority: 0.9,
        },
        {
          url: `${baseUrl}/cara-pesan`,
          lastModified: new Date(),
          changeFrequency: 'monthly',
          priority: 0.8,
        },
        {
          url: `${baseUrl}/panduan`,
          lastModified: new Date(),
          changeFrequency: 'monthly',
          priority: 0.5,
        },
      ]
    : [];

  // URL dinamis dari project
  const projectUrls: MetadataRoute.Sitemap = projects
    .filter((project) => project.status !== 'draft') // Hanya publish project
    .map((project) => ({
      url: `${baseUrl}/projects/${project.slug}`,
      lastModified: project.updatedAt ? new Date(project.updatedAt) : new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    }));

  return [...staticUrls, ...storefrontUrls, ...projectUrls];
}
