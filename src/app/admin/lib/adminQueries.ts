import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { AboutData } from '@/types/about';
import type { ContactData } from '@/types/contact';
import type { ExperienceData } from '@/types/experience';
import type { GalleryFeaturedData } from '@/types/gallery';
import type { HardSkill } from '@/types/hardSkill';
import type { Label } from '@/types/labels';
import type { Project } from '@/types/projects';
import type { TestimonialData } from '@/types/testimonial';
import type { NoteData } from '@/components/os/ui/elements/StickyNoteItem';
import type { SiteQuota, SiteQuotaOverride } from '@/lib/product/siteQuota';
import type { SiteStorageUsage } from '@/lib/product/siteStorageUsage';
import type { SiteAnalyticsSummary } from '@/lib/services/analyticsService';
import aboutFallback from '@/data/about.json';
import contactFallback from '@/data/contact.json';
import experienceFallback from '@/data/experience.json';
import galleryFeaturedFallback from '@/data/gallery-featured.json';
import hardSkillsFallback from '@/data/hardSkills.json';
import labelsFallback from '@/data/labels.json';
import projectsFallback from '@/data/projects.json';
import stickyNotesFallback from '@/data/sticky-notes.json';
import testimonialFallback from '@/data/testimonial.json';

export const ADMIN_DATA_STALE_TIME = 15 * 60 * 1000;
export const ADMIN_DATA_GC_TIME = 60 * 60 * 1000;

export const ADMIN_QUERY_KEYS = {
  about: ['admin', 'about'] as const,
  aboutPhilosophy: ['admin', 'about', 'philosophy'] as const,
  analytics: ['admin', 'analytics'] as const,
  clientSites: ['admin', 'client-sites'] as const,
  commentCounts: ['comments', 'counts'] as const,
  contact: ['admin', 'contact'] as const,
  experience: ['admin', 'experience'] as const,
  galleryFeatured: ['admin', 'gallery', 'featured'] as const,
  hardSkills: ['admin', 'hard-skills'] as const,
  labels: ['admin', 'labels'] as const,
  leads: ['admin', 'leads'] as const,
  projects: ['projects', 'admin'] as const,
  stickyNotes: ['admin', 'sticky-notes'] as const,
  testimonial: ['admin', 'testimonial'] as const,
};

export const ADMIN_PREFETCH_HREFS = [
  '/admin/projects',
  '/admin/client-dashboard',
  '/admin/content/experience',
  '/admin/communications/notifications',
  '/admin/communications/contacts',
  '/admin/communications/messages',
  '/admin/content/profile',
  '/admin/content/skills',
  '/admin/content/archive',
  '/admin/system/appearance',
  '/admin/system/widgets',
  '/admin/system/dock',
  '/admin/system/sounds',
  '/admin/content/labels',
] as const;

export interface AdminProjectsResponse {
  data?: {
    projects?: Project[];
    lastUpdated?: string;
  };
}

export interface AdminSiteSummary {
  id: string;
  slug: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  quota: SiteQuota;
  quotaOverride: SiteQuotaOverride;
  usage: {
    projects: number;
    storage: SiteStorageUsage;
  };
  clientAccess: {
    id: string;
    email: string;
    status: string;
    updatedAt: string;
    lastLoginAt: string | null;
  } | null;
  customDomain: {
    customDomain: string | null;
    status: string;
    sslStatus: string;
  } | null;
}

export interface AdminSitesResponse {
  sites: AdminSiteSummary[];
  defaultSiteId: string | null;
}

export interface Lead extends Record<string, unknown> {
  id: string;
  createdAt: string;
  name: string;
  contact: string;
  contactType: 'WhatsApp' | 'Email';
  message: string;
}

const placeholderHardSkills = (
  (hardSkillsFallback as unknown as { skills?: Partial<HardSkill>[] }).skills || []
).map((skill) => ({ iconUrl: '', ...skill })) as HardSkill[];

const placeholderTestimonial = testimonialFallback as unknown as TestimonialData;
const placeholderTestimonials = {
  ...placeholderTestimonial,
  testimonials: (placeholderTestimonial.testimonials || []).map((testimonial) => ({
    ...testimonial,
    id: String(testimonial.id),
  })),
} satisfies TestimonialData;

export const ADMIN_PLACEHOLDER_DATA = {
  about: aboutFallback as AboutData,
  contact: contactFallback as ContactData,
  experience: experienceFallback as ExperienceData,
  galleryFeatured: galleryFeaturedFallback as GalleryFeaturedData,
  hardSkills: placeholderHardSkills,
  labels: labelsFallback as Label[],
  leads: [] as Lead[],
  clientSites: {
    sites: [],
    defaultSiteId: null,
  } satisfies AdminSitesResponse,
  projects: {
    data: {
      projects: (projectsFallback as { projects?: Project[] }).projects || [],
      lastUpdated: new Date(0).toISOString(),
    },
  } satisfies AdminProjectsResponse,
  stickyNotes: stickyNotesFallback as NoteData[],
  testimonial: placeholderTestimonials,
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'include' });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message =
      typeof errorData?.error === 'string' ? errorData.error : `Request failed: ${response.status}`;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function fetchAdminAbout() {
  return fetchJson<AboutData>('/api/about');
}

export function fetchAdminAboutFresh() {
  return fetchJson<AboutData>('/api/about?fresh=true');
}

export function fetchAdminAboutPhilosophy() {
  return fetchJson('/api/about/philosophy');
}

export async function fetchAdminAnalytics(): Promise<SiteAnalyticsSummary> {
  const data = await fetchJson<{ summary?: SiteAnalyticsSummary }>('/api/analytics');
  if (!data.summary) throw new Error('Ringkasan analitik tidak tersedia');
  return data.summary;
}

export function fetchAdminCommentCounts() {
  return fetchJson<{
    comments?: Record<string, unknown[]>;
    data?: { comments?: Record<string, unknown[]> };
  }>('/api/comments').then((data) => {
    const counts: Record<string, number> = {};
    const commentsBySlug = data.data?.comments ?? data.comments;

    if (commentsBySlug) {
      Object.entries(commentsBySlug).forEach(([slug, commentsList]) => {
        const commentsArr = Array.isArray(commentsList) ? commentsList : [];
        counts[slug] = commentsArr.reduce<number>(
          (acc, comment) => acc + 1 + ((comment as { replies?: unknown[] }).replies?.length || 0),
          0
        );
      });
    }

    return counts;
  });
}

export function fetchAdminContact() {
  return fetchJson<ContactData>('/api/contact');
}

export function fetchAdminExperience() {
  return fetchJson<ExperienceData>('/api/experience');
}

export function fetchAdminGalleryFeatured() {
  return fetchJson<GalleryFeaturedData>('/api/gallery/featured');
}

export function fetchAdminHardSkills() {
  return fetchJson<HardSkill[]>('/api/hard-skills').then((data) =>
    Array.isArray(data) ? data : []
  );
}

export function fetchAdminLabels() {
  return fetchJson<Label[]>('/api/about/labels').then((data) => (Array.isArray(data) ? data : []));
}

export function fetchAdminLeads() {
  return fetchJson<Lead[]>('/api/leads').then((data) => (Array.isArray(data) ? data : []));
}

export function fetchAdminSites() {
  return fetchJson<AdminSitesResponse>('/api/admin/sites');
}

export function fetchAdminProjects() {
  return fetchJson<AdminProjectsResponse>('/api/projects');
}

export function fetchAdminProjectsFresh() {
  return fetchJson<AdminProjectsResponse>('/api/projects?fresh=true');
}

export function fetchAdminStickyNotes() {
  return fetchJson<NoteData[]>('/api/sticky-notes').then((data) =>
    Array.isArray(data) ? data : []
  );
}

export function fetchAdminTestimonials() {
  return fetchJson<TestimonialData>('/api/testimonial');
}

function prefetch<T>(queryClient: QueryClient, queryKey: QueryKey, queryFn: () => Promise<T>) {
  return queryClient.prefetchQuery({
    queryKey,
    queryFn,
    staleTime: ADMIN_DATA_STALE_TIME,
    gcTime: ADMIN_DATA_GC_TIME,
  });
}

function prefetchJobsForRoute(href: string) {
  if (href.startsWith('/admin/projects')) {
    return [
      (queryClient: QueryClient) =>
        prefetch(queryClient, ADMIN_QUERY_KEYS.projects, fetchAdminProjects),
      (queryClient: QueryClient) =>
        prefetch(queryClient, ADMIN_QUERY_KEYS.labels, fetchAdminLabels),
      (queryClient: QueryClient) =>
        prefetch(queryClient, ADMIN_QUERY_KEYS.commentCounts, fetchAdminCommentCounts),
    ];
  }

  if (href.startsWith('/admin/client-dashboard')) {
    return [
      (queryClient: QueryClient) =>
        prefetch(queryClient, ADMIN_QUERY_KEYS.clientSites, fetchAdminSites),
      (queryClient: QueryClient) =>
        prefetch(queryClient, ADMIN_QUERY_KEYS.labels, fetchAdminLabels),
    ];
  }

  if (href.startsWith('/admin/content/profile')) {
    return [
      (queryClient: QueryClient) => prefetch(queryClient, ADMIN_QUERY_KEYS.about, fetchAdminAbout),
      (queryClient: QueryClient) =>
        prefetch(queryClient, ADMIN_QUERY_KEYS.projects, fetchAdminProjects),
      (queryClient: QueryClient) =>
        prefetch(queryClient, ADMIN_QUERY_KEYS.aboutPhilosophy, fetchAdminAboutPhilosophy),
    ];
  }

  if (href.startsWith('/admin/content/skills')) {
    return [
      (queryClient: QueryClient) => prefetch(queryClient, ADMIN_QUERY_KEYS.about, fetchAdminAbout),
      (queryClient: QueryClient) =>
        prefetch(queryClient, ADMIN_QUERY_KEYS.hardSkills, fetchAdminHardSkills),
    ];
  }

  if (href.startsWith('/admin/content/archive')) {
    return [
      (queryClient: QueryClient) =>
        prefetch(queryClient, ADMIN_QUERY_KEYS.projects, fetchAdminProjects),
      (queryClient: QueryClient) =>
        prefetch(queryClient, ADMIN_QUERY_KEYS.galleryFeatured, fetchAdminGalleryFeatured),
    ];
  }

  if (href.startsWith('/admin/content/experience')) {
    return [
      (queryClient: QueryClient) =>
        prefetch(queryClient, ADMIN_QUERY_KEYS.experience, fetchAdminExperience),
    ];
  }

  if (href.startsWith('/admin/content/labels')) {
    return [
      (queryClient: QueryClient) =>
        prefetch(queryClient, ADMIN_QUERY_KEYS.labels, fetchAdminLabels),
    ];
  }

  if (href.startsWith('/admin/system/appearance')) {
    return [
      (queryClient: QueryClient) => prefetch(queryClient, ADMIN_QUERY_KEYS.about, fetchAdminAbout),
      (queryClient: QueryClient) =>
        prefetch(queryClient, ADMIN_QUERY_KEYS.projects, fetchAdminProjects),
    ];
  }

  if (href.startsWith('/admin/system/widgets')) {
    return [
      (queryClient: QueryClient) => prefetch(queryClient, ADMIN_QUERY_KEYS.about, fetchAdminAbout),
      (queryClient: QueryClient) =>
        prefetch(queryClient, ADMIN_QUERY_KEYS.stickyNotes, fetchAdminStickyNotes),
    ];
  }

  if (href.startsWith('/admin/system/dock') || href.startsWith('/admin/system/sounds')) {
    return [
      (queryClient: QueryClient) => prefetch(queryClient, ADMIN_QUERY_KEYS.about, fetchAdminAbout),
    ];
  }

  if (href.startsWith('/admin/communications/notifications')) {
    return [
      (queryClient: QueryClient) =>
        prefetch(queryClient, ADMIN_QUERY_KEYS.testimonial, fetchAdminTestimonials),
      (queryClient: QueryClient) =>
        prefetch(queryClient, ADMIN_QUERY_KEYS.projects, fetchAdminProjects),
      (queryClient: QueryClient) => prefetch(queryClient, ADMIN_QUERY_KEYS.about, fetchAdminAbout),
    ];
  }

  if (href.startsWith('/admin/communications/contacts')) {
    return [
      (queryClient: QueryClient) =>
        prefetch(queryClient, ADMIN_QUERY_KEYS.contact, fetchAdminContact),
    ];
  }

  if (href.startsWith('/admin/communications/messages')) {
    return [
      (queryClient: QueryClient) => prefetch(queryClient, ADMIN_QUERY_KEYS.leads, fetchAdminLeads),
    ];
  }

  if (href.startsWith('/admin/communications/feedback')) {
    return [];
  }

  return [];
}

export function prefetchAdminRoute(queryClient: QueryClient, href: string) {
  const jobs = prefetchJobsForRoute(href);
  if (jobs.length === 0) return Promise.resolve([]);

  return Promise.allSettled(jobs.map((job) => job(queryClient)));
}

export function warmAdminCrudQueries(queryClient: QueryClient) {
  return Promise.allSettled([
    prefetch(queryClient, ADMIN_QUERY_KEYS.projects, fetchAdminProjects),
    prefetch(queryClient, ADMIN_QUERY_KEYS.about, fetchAdminAbout),
    prefetch(queryClient, ADMIN_QUERY_KEYS.experience, fetchAdminExperience),
    prefetch(queryClient, ADMIN_QUERY_KEYS.testimonial, fetchAdminTestimonials),
    prefetch(queryClient, ADMIN_QUERY_KEYS.contact, fetchAdminContact),
    prefetch(queryClient, ADMIN_QUERY_KEYS.leads, fetchAdminLeads),
    prefetch(queryClient, ADMIN_QUERY_KEYS.clientSites, fetchAdminSites),
    prefetch(queryClient, ADMIN_QUERY_KEYS.labels, fetchAdminLabels),
    prefetch(queryClient, ADMIN_QUERY_KEYS.commentCounts, fetchAdminCommentCounts),
  ]);
}
