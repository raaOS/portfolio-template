'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  FilePlus2,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import type { GalleryItem, Project } from '@/types/projects';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useToast } from '@/contexts/ToastContext';
import { getWritableCsrfToken } from '@/lib/security/client-csrf';
import {
  ADMIN_PLACEHOLDER_DATA,
  ADMIN_QUERY_KEYS,
  fetchAdminSites,
} from '../lib/adminQueries';
import type { AdminSiteSummary } from '../lib/adminQueries';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import { MasterSiteTable } from './components/MasterSiteTable';
import { MasterSiteEditorSidebar } from './components/MasterSiteEditorSidebar';
import { MasterProjectEditorSidebar } from './components/MasterProjectEditorSidebar';

export type ProjectsResponse = {
  success: boolean;
  data?: {
    projects?: Project[];
    lastUpdated?: string;
  };
  error?: string;
  errorCode?: string;
};

export type CoverUploadResponse = {
  success: boolean;
  key: string;
  url: string;
  publicUrl?: string;
  contentType: string;
  size: number;
  kind?: 'image' | 'video';
  uploadUrl?: string;
  cacheControl?: string;
};

export type SiteMutationResponse = {
  site: AdminSiteSummary | null;
};

export type ClientAccessMutationResponse = {
  clientAccess: AdminSiteSummary['clientAccess'];
};

export type DeleteSiteResponse = {
  success: boolean;
  deleted?: {
    siteId: string;
    slug: string;
    mediaObjects: number;
  };
};

export type ProjectDraft = {
  id?: string;
  title: string;
  client: string;
  year: string;
  tags: string;
  description: string;
  cover: string;
  gallery: string[];
  status: 'published' | 'draft';
};

export type SiteQuotaOverrideDraft = {
  projectLimit: string;
  storageMb: string;
  mediaPerProject: string;
};

export type SiteMasterDraft = {
  id?: string;
  name: string;
  slug: string;
  plan: 'lite' | 'pro';
  status: 'active' | 'suspended';
  billingStatus: 'trialing' | 'active' | 'past_due' | 'canceled';
  currentPeriodEnd: string;
  quotaOverride: SiteQuotaOverrideDraft;
  customDomain?: string;
};

export type ClientAccessDraft = {
  email: string;
  password: string;
  status: 'active' | 'suspended';
};

const PROJECT_COVER_MAX_SIZE_BYTES = 10 * 1024 * 1024;
const PROJECT_COVER_ACCEPT = 'image/jpeg,image/png,image/webp,image/avif';
const PROJECT_COVER_TYPES = new Set(PROJECT_COVER_ACCEPT.split(','));
const PROJECT_GALLERY_MAX_SIZE_BYTES = 10 * 1024 * 1024;
const PROJECT_GALLERY_ACCEPT = PROJECT_COVER_ACCEPT;
const PROJECT_GALLERY_TYPES = PROJECT_COVER_TYPES;
const PROJECT_GALLERY_VIDEO_MAX_SIZE_BYTES = 200 * 1024 * 1024;
const PROJECT_GALLERY_VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime';
const PROJECT_GALLERY_VIDEO_TYPES = new Set(PROJECT_GALLERY_VIDEO_ACCEPT.split(','));

const emptyDraft: ProjectDraft = {
  title: '',
  client: '',
  year: String(new Date().getFullYear()),
  tags: '',
  description: '',
  cover: '',
  gallery: [],
  status: 'draft',
};

const emptySiteDraft: SiteMasterDraft = {
  name: '',
  slug: '',
  plan: 'lite',
  status: 'active',
  billingStatus: 'trialing',
  currentPeriodEnd: '',
  quotaOverride: {
    projectLimit: '',
    storageMb: '',
    mediaPerProject: '',
  },
};

const emptyClientAccessDraft: ClientAccessDraft = {
  email: '',
  password: '',
  status: 'active',
};

function draftFromProject(project: Project): ProjectDraft {
  const galleryFromItems =
    project.galleryItems
      ?.map((item) => item.src)
      .filter((src) => src && src !== project.cover) ?? [];

  return {
    id: project.id,
    title: project.title,
    client: project.client,
    year: String(project.year),
    tags: project.tags.join(', '),
    description: project.description,
    cover: project.cover,
    gallery: galleryFromItems.length > 0 ? galleryFromItems : project.gallery ?? [],
    status: project.status,
  };
}

function siteDraftFromSummary(site: AdminSiteSummary): SiteMasterDraft {
  return {
    id: site.id,
    name: site.name,
    slug: site.slug,
    plan: site.plan,
    status: site.status === 'suspended' ? 'suspended' : 'active',
    billingStatus:
      site.billing?.status === 'active' ||
      site.billing?.status === 'past_due' ||
      site.billing?.status === 'canceled'
        ? site.billing.status
        : 'trialing',
    currentPeriodEnd: site.billing?.currentPeriodEnd ?? '',
    quotaOverride: {
      projectLimit: site.quotaOverride.projectLimit ? String(site.quotaOverride.projectLimit) : '',
      storageMb: site.quotaOverride.storageMb ? String(site.quotaOverride.storageMb) : '',
      mediaPerProject: site.quotaOverride.mediaPerProject
        ? String(site.quotaOverride.mediaPerProject)
        : '',
    },
    customDomain: site.customDomain?.customDomain ?? '',
  };
}

function clientAccessDraftFromSummary(site: AdminSiteSummary | null): ClientAccessDraft {
  return {
    email: site?.clientAccess?.email ?? '',
    password: '',
    status: site?.clientAccess?.status === 'suspended' ? 'suspended' : 'active',
  };
}

function normalizeSiteSlugInput(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function splitTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function quotaDraftValueToPayload(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isQuotaDraftValueValid(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed > 0 && String(parsed) === trimmed;
}

function isQuotaDraftValid(quotaOverride: SiteQuotaOverrideDraft) {
  return (
    isQuotaDraftValueValid(quotaOverride.projectLimit) &&
    isQuotaDraftValueValid(quotaOverride.storageMb) &&
    isQuotaDraftValueValid(quotaOverride.mediaPerProject)
  );
}

function buildSitePayload(draft: SiteMasterDraft) {
  return {
    ...draft,
    quotaOverride: {
      projectLimit: quotaDraftValueToPayload(draft.quotaOverride.projectLimit),
      storageMb: quotaDraftValueToPayload(draft.quotaOverride.storageMb),
      mediaPerProject: quotaDraftValueToPayload(draft.quotaOverride.mediaPerProject),
    },
  };
}

function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov)(?:\?|#|$)/i.test(url);
}

function buildGalleryItems(draft: ProjectDraft): GalleryItem[] {
  const items: GalleryItem[] = [];
  if (draft.cover.trim()) {
    items.push({
      kind: isVideoUrl(draft.cover) ? 'video' : 'image',
      src: draft.cover.trim(),
      alt: `${draft.title.trim()} cover`,
    });
  }

  draft.gallery.forEach((src, index) => {
    const trimmed = src.trim();
    if (!trimmed || trimmed === draft.cover.trim()) return;
    items.push({
      kind: isVideoUrl(trimmed) ? 'video' : 'image',
      src: trimmed,
      alt: `${draft.title.trim()} media ${index + 1}`,
    });
  });

  return items;
}

function buildProjectPayload(draft: ProjectDraft) {
  const year = Number.parseInt(draft.year, 10);

  return {
    title: draft.title.trim(),
    client: draft.client.trim(),
    year: Number.isFinite(year) ? year : new Date().getFullYear(),
    tags: splitTags(draft.tags),
    description: draft.description.trim(),
    cover: draft.cover.trim(),
    gallery: draft.gallery,
    galleryItems: buildGalleryItems(draft),
    coverWidth: 1200,
    coverHeight: 800,
    autoplay: false,
    muted: true,
    loop: false,
    playsInline: true,
    likes: 0,
    shares: 0,
    allowComments: true,
    status: draft.status,
  };
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof data?.error === 'string' ? data.error : `Request failed: ${response.status}`;
    const code = typeof data?.errorCode === 'string' ? ` (${data.errorCode})` : '';
    throw new Error(`${message}${code}`);
  }

  return data as T;
}

function validateProjectCoverFile(file: File) {
  if (!PROJECT_COVER_TYPES.has(file.type)) {
    throw new Error('Cover harus JPG, PNG, WebP, atau AVIF');
  }

  if (file.size <= 0) {
    throw new Error('Cover kosong');
  }

  if (file.size > PROJECT_COVER_MAX_SIZE_BYTES) {
    throw new Error(`Cover maksimal ${PROJECT_COVER_MAX_SIZE_BYTES / 1024 / 1024} MB`);
  }
}

function validateProjectGalleryFile(file: File) {
  if (!PROJECT_GALLERY_TYPES.has(file.type)) {
    throw new Error('Gallery harus JPG, PNG, WebP, atau AVIF');
  }

  if (file.size <= 0) {
    throw new Error('Gallery image kosong');
  }

  if (file.size > PROJECT_GALLERY_MAX_SIZE_BYTES) {
    throw new Error(`Gallery image maksimal ${PROJECT_GALLERY_MAX_SIZE_BYTES / 1024 / 1024} MB`);
  }
}

function validateProjectGalleryVideoFile(file: File) {
  if (!PROJECT_GALLERY_VIDEO_TYPES.has(file.type)) {
    throw new Error('Gallery video harus MP4, WebM, atau QuickTime');
  }

  if (file.size <= 0) {
    throw new Error('Gallery video kosong');
  }

  if (file.size > PROJECT_GALLERY_VIDEO_MAX_SIZE_BYTES) {
    throw new Error(
      `Gallery video maksimal ${PROJECT_GALLERY_VIDEO_MAX_SIZE_BYTES / 1024 / 1024} MB`
    );
  }
}

async function fetchClientProjects(siteId: string) {
  const params = new URLSearchParams({ siteId });
  const response = await fetch(`/api/projects?${params.toString()}`, {
    credentials: 'include',
  });
  const data = await readJson<ProjectsResponse>(response);
  return data.data?.projects ?? [];
}

async function uploadProjectCover({
  siteId,
  csrfToken,
  file,
}: {
  siteId: string;
  csrfToken: string;
  file: File;
}) {
  const formData = new FormData();
  formData.set('file', file);

  const response = await fetch(
    `/api/admin/sites/${encodeURIComponent(siteId)}/project-cover`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'x-csrf-token': csrfToken,
      },
      body: formData,
    }
  );

  const data = await readJson<CoverUploadResponse>(response);
  const publicUrl = data.url || data.publicUrl;
  if (!publicUrl) {
    throw new Error('Upload selesai tetapi URL cover kosong');
  }

  return {
    ...data,
    url: publicUrl,
  };
}

async function uploadProjectGalleryImage({
  siteId,
  csrfToken,
  file,
}: {
  siteId: string;
  csrfToken: string;
  file: File;
}) {
  const formData = new FormData();
  formData.set('file', file);

  const response = await fetch(
    `/api/admin/sites/${encodeURIComponent(siteId)}/project-media`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'x-csrf-token': csrfToken,
      },
      body: formData,
    }
  );

  const data = await readJson<CoverUploadResponse>(response);
  const publicUrl = data.url || data.publicUrl;
  if (!publicUrl) {
    throw new Error('Upload selesai tetapi URL gallery kosong');
  }

  return {
    ...data,
    url: publicUrl,
  };
}

async function uploadProjectGalleryVideo({
  siteId,
  csrfToken,
  file,
}: {
  siteId: string;
  csrfToken: string;
  file: File;
}) {
  const response = await fetch(
    `/api/admin/sites/${encodeURIComponent(siteId)}/project-video/presign`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        size: file.size,
      }),
    }
  );

  const data = await readJson<CoverUploadResponse>(response);
  if (!data.uploadUrl || !data.publicUrl) {
    throw new Error('Upload URL video tidak lengkap');
  }

  const isInternalUploadUrl = data.uploadUrl.startsWith('/');
  const uploadResponse = await fetch(data.uploadUrl, {
    method: 'PUT',
    credentials: isInternalUploadUrl ? 'include' : 'omit',
    headers: {
      'Content-Type': file.type,
      'Cache-Control': data.cacheControl || 'public, max-age=31536000, immutable',
      ...(isInternalUploadUrl ? { 'x-csrf-token': csrfToken } : {}),
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    const errorData = await uploadResponse.json().catch(() => ({}));
    throw new Error(
      typeof errorData?.error === 'string'
        ? errorData.error
        : `Upload video gagal (${uploadResponse.status})`
    );
  }

  return {
    ...data,
    url: data.publicUrl,
  };
}

async function saveSiteMasterDraft({
  draft,
  csrfToken,
}: {
  draft: SiteMasterDraft;
  csrfToken: string;
}) {
  const method = draft.id ? 'PUT' : 'POST';
  const response = await fetch('/api/admin/sites', {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify(buildSitePayload(draft)),
  });

  const data = await readJson<SiteMutationResponse>(response);
  if (!data.site) {
    throw new Error('Site tersimpan tetapi response kosong');
  }
  return data.site;
}

async function saveClientAccessDraft({
  siteId,
  draft,
  csrfToken,
}: {
  siteId: string;
  draft: ClientAccessDraft;
  csrfToken: string;
}) {
  const response = await fetch(
    `/api/admin/sites/${encodeURIComponent(siteId)}/client-access`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({
        email: draft.email,
        status: draft.status,
        ...(draft.password ? { password: draft.password } : {}),
      }),
    }
  );

  const data = await readJson<ClientAccessMutationResponse>(response);
  return data.clientAccess;
}

async function deleteSite({
  siteId,
  confirmSlug,
  csrfToken,
}: {
  siteId: string;
  confirmSlug: string;
  csrfToken: string;
}) {
  const response = await fetch('/api/admin/sites', {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify({
      id: siteId,
      confirmSlug,
      deleteMedia: true,
    }),
  });

  return readJson<DeleteSiteResponse>(response);
}

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function isSeedDemoSite(site: AdminSiteSummary) {
  return site.id === 'default-site' || site.slug === 'demo-designer';
}

export default function ClientDashboardPanel() {
  const queryClient = useQueryClient();
  const { csrfToken, isLoading: authLoading } = useAdminAuth();
  const { showSuccess, showError } = useToast();
  const { confirm } = useConfirm();

  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<ProjectDraft>(emptyDraft);
  const [siteDraft, setSiteDraft] = useState<SiteMasterDraft>(emptySiteDraft);
  const [clientAccessDraft, setClientAccessDraft] =
    useState<ClientAccessDraft>(emptyClientAccessDraft);
  const [clientAccessDraftSiteId, setClientAccessDraftSiteId] = useState('');
  const [deleteConfirmSlug, setDeleteConfirmSlug] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isCreatingSite, setIsCreatingSite] = useState(false);
  const [siteUrlOrigin] = useState(() =>
    typeof window === 'undefined' ? '' : window.location.origin.replace(/\/+$/, '')
  );

  // FIX #18: Track key R2 yang diupload selama sesi editor terbuka. Jika
  // editor ditutup TANPA menyimpan, file dihapus agar tidak jadi yatim +
  // tidak mengonsumsi kuota storage site secara permanen.
  const pendingUploadKeysRef = useRef<string[]>([]);

  const sitesQuery = useQuery({
    queryKey: ADMIN_QUERY_KEYS.clientSites,
    queryFn: fetchAdminSites,
    placeholderData: ADMIN_PLACEHOLDER_DATA.clientSites,
  });

  const allSites = useMemo(() => sitesQuery.data?.sites ?? [], [sitesQuery.data?.sites]);
  const sites = useMemo(() => allSites.filter((site) => !isSeedDemoSite(site)), [allSites]);
  const selectedVisibleSite = sites.find((site) => site.id === selectedSiteId) ?? null;
  const defaultVisibleSiteId = sites.find((site) => site.id === sitesQuery.data?.defaultSiteId)?.id;
  const effectiveSiteId = selectedVisibleSite?.id || defaultVisibleSiteId || sites[0]?.id || '';
  const selectedSite =
    selectedVisibleSite ?? sites.find((site) => site.id === effectiveSiteId) ?? null;
  const lastDraftSiteIdRef = useRef<string | null>(null);
  useEffect(() => {
    // FIX: Hanya re-inisialisasi draft saat ID site BERGANTI. Tanpa guard ini,
    // refetch (mis. window focus) membuat objek selectedSite baru → effect
    // terpicu ulang → draft yang sedang diedit tertimpa nilai server.
    if (selectedSite && !isCreatingSite && lastDraftSiteIdRef.current !== selectedSite.id) {
      lastDraftSiteIdRef.current = selectedSite.id;
      queueMicrotask(() => {
        setSiteDraft(siteDraftFromSummary(selectedSite));
      });
    }
  }, [selectedSite?.id, isCreatingSite, selectedSite]);

  const activeSiteDraft =
    isCreatingSite || (siteDraft.id && siteDraft.id === selectedSite?.id) || !selectedSite
      ? siteDraft
      : siteDraftFromSummary(selectedSite);
  const activeClientAccessDraft =
    selectedSite && clientAccessDraftSiteId === selectedSite.id
      ? clientAccessDraft
      : clientAccessDraftFromSummary(selectedSite);
  const activePublicSlug = activeSiteDraft.slug.trim();
  const activePublicUrl = activePublicSlug
    ? `${siteUrlOrigin || ''}/${activePublicSlug}`.replace(/^\/+/, '/')
    : '';
  const isSiteActive = selectedSite?.status === 'active';
  const isProjectLimitReached = selectedSite
    ? selectedSite.usage.projects >= selectedSite.quota.projectLimit
    : false;

  const projectsQuery = useQuery({
    queryKey: ['client-dashboard', 'projects', effectiveSiteId],
    queryFn: () => fetchClientProjects(effectiveSiteId),
    enabled: Boolean(effectiveSiteId),
    placeholderData: [],
  });

  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const filteredProjects = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return projects;

    return projects.filter((project) =>
      [project.title, project.client, project.status, project.tags.join(' ')]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    );
  }, [projects, search]);

  const discardPendingUploads = () => {
    const keys = pendingUploadKeysRef.current;
    pendingUploadKeysRef.current = [];
    if (!selectedSite || keys.length === 0) return;
    const token = getWritableCsrfToken(csrfToken);
    if (!token) return;
    for (const key of keys) {
      // Fire-and-forget: cleanup best-effort, jangan blokir UX.
      void fetch(`/api/admin/sites/${encodeURIComponent(selectedSite.id)}/project-media`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': token,
        },
        body: JSON.stringify({ key }),
      }).catch(() => {});
    }
  };

  const closeEditor = () => {
    discardPendingUploads();
    setIsEditorOpen(false);
    setDraft(emptyDraft);
  };

  const closeSiteCreator = () => {
    setIsCreatingSite(false);
    setSiteDraft(selectedSite ? siteDraftFromSummary(selectedSite) : emptySiteDraft);
    setClientAccessDraft(clientAccessDraftFromSummary(selectedSite));
    setClientAccessDraftSiteId(selectedSite?.id ?? '');
    setDeleteConfirmSlug('');
  };

  const invalidateDashboard = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.clientSites }),
      queryClient.invalidateQueries({ queryKey: ['client-dashboard', 'projects', effectiveSiteId] }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: async (nextDraft: ProjectDraft) => {
      if (!selectedSite) throw new Error('Site belum dipilih');
      const token = getWritableCsrfToken(csrfToken);
      const payload = buildProjectPayload(nextDraft);
      const method = nextDraft.id ? 'PUT' : 'POST';
      const url = nextDraft.id
        ? `/api/projects/${encodeURIComponent(nextDraft.id)}?${new URLSearchParams({
            siteId: selectedSite.id,
          }).toString()}`
        : '/api/projects';

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': token,
        },
        body: JSON.stringify({
          ...payload,
          id: nextDraft.id,
          siteId: selectedSite.id,
        }),
      });

      return readJson(response);
    },
    onSuccess: async () => {
      await invalidateDashboard();
      // Project tersimpan — media kini terikat ke project; jangan di-discard.
      pendingUploadKeysRef.current = [];
      closeEditor();
      showSuccess('Project tersimpan');
    },
    onError: (error: Error) => showError(error.message || 'Gagal menyimpan project'),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Project['status'] }) => {
      if (!selectedSite) throw new Error('Site belum dipilih');
      const token = getWritableCsrfToken(csrfToken);
      const params = new URLSearchParams({ siteId: selectedSite.id });
      const response = await fetch(`/api/projects/${encodeURIComponent(id)}?${params.toString()}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': token,
        },
        body: JSON.stringify({ id, siteId: selectedSite.id, status }),
      });

      return readJson(response);
    },
    onSuccess: async () => {
      await invalidateDashboard();
      showSuccess('Status project diperbarui');
    },
    onError: (error: Error) => showError(error.message || 'Gagal mengubah status'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!selectedSite) throw new Error('Site belum dipilih');
      const token = getWritableCsrfToken(csrfToken);
      const params = new URLSearchParams({ siteId: selectedSite.id });
      const response = await fetch(`/api/projects/${encodeURIComponent(id)}?${params.toString()}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'x-csrf-token': token,
        },
      });

      return readJson(response);
    },
    onSuccess: async () => {
      await invalidateDashboard();
      closeEditor();
      showSuccess('Project dihapus');
    },
    onError: (error: Error) => showError(error.message || 'Gagal menghapus project'),
  });

  const siteSaveMutation = useMutation({
    mutationFn: async (nextDraft: SiteMasterDraft) => {
      const token = getWritableCsrfToken(csrfToken);
      if (!token) throw new Error('CSRF token belum siap');
      return saveSiteMasterDraft({ draft: nextDraft, csrfToken: token });
    },
    onSuccess: async (site) => {
      const message = isCreatingSite ? 'Site dibuat' : 'Site tersimpan';
      setSelectedSiteId(site.id);
      setIsCreatingSite(false);
      setSiteDraft(siteDraftFromSummary(site));
      setClientAccessDraft(clientAccessDraftFromSummary(site));
      setClientAccessDraftSiteId(site.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.clientSites }),
        queryClient.invalidateQueries({ queryKey: ['client-dashboard', 'projects', site.id] }),
      ]);
      showSuccess(message);
    },
    onError: (error: Error) => showError(error.message || 'Gagal menyimpan site'),
  });

  const clientAccessSaveMutation = useMutation({
    mutationFn: async (nextDraft: ClientAccessDraft) => {
      if (!selectedSite) throw new Error('Site belum dipilih');
      const token = getWritableCsrfToken(csrfToken);
      if (!token) throw new Error('CSRF token belum siap');
      return saveClientAccessDraft({
        siteId: selectedSite.id,
        draft: nextDraft,
        csrfToken: token,
      });
    },
    onSuccess: async (clientAccess) => {
      setClientAccessDraft({
        email: clientAccess?.email ?? activeClientAccessDraft.email,
        password: '',
        status: clientAccess?.status === 'suspended' ? 'suspended' : 'active',
      });
      setClientAccessDraftSiteId(selectedSite?.id ?? '');
      await queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.clientSites });
      showSuccess('Akses client tersimpan');
    },
    onError: (error: Error) => showError(error.message || 'Gagal menyimpan akses client'),
  });

  const siteDeleteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSite) throw new Error('Site belum dipilih');
      const token = getWritableCsrfToken(csrfToken);
      if (!token) throw new Error('CSRF token belum siap');
      return deleteSite({
        siteId: selectedSite.id,
        confirmSlug: deleteConfirmSlug.trim(),
        csrfToken: token,
      });
    },
    onSuccess: async (data) => {
      setSelectedSiteId('');
      setSiteDraft(emptySiteDraft);
      setClientAccessDraft(emptyClientAccessDraft);
      setClientAccessDraftSiteId('');
      setDeleteConfirmSlug('');
      closeEditor();
      await queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.clientSites });
      showSuccess(`Site dihapus${data.deleted ? ` (${data.deleted.mediaObjects} media)` : ''}`);
    },
    onError: (error: Error) => showError(error.message || 'Gagal menghapus site'),
  });

  const coverUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedSite) throw new Error('Site belum dipilih');
      if (!isSiteActive) throw new Error('Site tidak aktif');

      validateProjectCoverFile(file);

      const token = getWritableCsrfToken(csrfToken);
      if (!token) throw new Error('CSRF token belum siap');

      return uploadProjectCover({
        siteId: selectedSite.id,
        csrfToken: token,
        file,
      });
    },
    onSuccess: (data) => {
      if (data.key) pendingUploadKeysRef.current.push(data.key);
      setDraft((prev) => ({ ...prev, cover: data.url }));
      showSuccess('Cover project diupload');
    },
    onError: (error: Error) => showError(error.message || 'Gagal upload cover'),
  });

  const galleryUploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      if (!selectedSite) throw new Error('Site belum dipilih');
      if (!isSiteActive) throw new Error('Site tidak aktif');
      if (files.length === 0) throw new Error('Pilih minimal 1 image gallery');

      const maxGalleryItems = Math.max(0, selectedSite.quota.mediaPerProject - 1);
      const remainingSlots = maxGalleryItems - draft.gallery.length;
      if (remainingSlots <= 0) {
        throw new Error(`Slot gallery ${selectedSite.plan} sudah penuh`);
      }

      const selectedFiles = files.slice(0, remainingSlots);
      if (selectedFiles.length < files.length) {
        throw new Error(`Maksimal tambah ${remainingSlots} image lagi untuk plan ini`);
      }

      selectedFiles.forEach(validateProjectGalleryFile);

      const token = getWritableCsrfToken(csrfToken);
      if (!token) throw new Error('CSRF token belum siap');

      const uploaded: CoverUploadResponse[] = [];
      for (const file of selectedFiles) {
        uploaded.push(
          await uploadProjectGalleryImage({
            siteId: selectedSite.id,
            csrfToken: token,
            file,
          })
        );
      }

      return uploaded;
    },
    onSuccess: async (items) => {
      const urls = items.map((item) => item.url);
      items.forEach((item) => {
        if (item.key) pendingUploadKeysRef.current.push(item.key);
      });
      setDraft((prev) => ({ ...prev, gallery: [...prev.gallery, ...urls] }));
      await queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.clientSites });
      showSuccess(`${items.length} gallery image diupload`);
    },
    onError: (error: Error) => showError(error.message || 'Gagal upload gallery'),
  });

  const galleryVideoUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedSite) throw new Error('Site belum dipilih');
      if (!isSiteActive) throw new Error('Site tidak aktif');
      const remainingSlots = Math.max(
        0,
        Math.max(0, selectedSite.quota.mediaPerProject - 1) - draft.gallery.length
      );
      if (remainingSlots <= 0) {
        throw new Error(`Slot gallery ${selectedSite.plan} sudah penuh`);
      }

      validateProjectGalleryVideoFile(file);

      const token = getWritableCsrfToken(csrfToken);
      if (!token) throw new Error('CSRF token belum siap');

      return uploadProjectGalleryVideo({
        siteId: selectedSite.id,
        csrfToken: token,
        file,
      });
    },
    onSuccess: async (item) => {
      if (item.key) pendingUploadKeysRef.current.push(item.key);
      setDraft((prev) => ({ ...prev, gallery: [...prev.gallery, item.url] }));
      await queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.clientSites });
      showSuccess('Gallery video diupload');
    },
    onError: (error: Error) => showError(error.message || 'Gagal upload gallery video'),
  });

  const isBusy =
    authLoading ||
    sitesQuery.isFetching ||
    projectsQuery.isFetching ||
    saveMutation.isPending ||
    statusMutation.isPending ||
    deleteMutation.isPending ||
    siteSaveMutation.isPending ||
    clientAccessSaveMutation.isPending ||
    siteDeleteMutation.isPending ||
    coverUploadMutation.isPending ||
    galleryUploadMutation.isPending ||
    galleryVideoUploadMutation.isPending;

  const canMutate = Boolean(selectedSite && isSiteActive && csrfToken);
  const projectCreateBlocker = !selectedSite
    ? 'Pilih client/site dulu.'
    : !isSiteActive
      ? 'Site sedang suspended. Aktifkan site sebelum menambah project.'
      : isProjectLimitReached
        ? `Quota project ${selectedSite.quota.projectLimit} sudah penuh. Naikkan quota add-on atau upgrade plan.`
        : !csrfToken
          ? 'Sesi admin belum siap. Refresh dashboard lalu coba lagi.'
          : '';
  const canUploadCover = canMutate && !coverUploadMutation.isPending;
  const maxGalleryItems = selectedSite ? Math.max(0, selectedSite.quota.mediaPerProject - 1) : 0;
  const remainingGallerySlots = Math.max(0, maxGalleryItems - draft.gallery.length);
  const canUploadGallery =
    canMutate &&
    !galleryUploadMutation.isPending &&
    !galleryVideoUploadMutation.isPending &&
    remainingGallerySlots > 0;
  const canSaveSite = Boolean(csrfToken && !siteSaveMutation.isPending);
  const canSaveClientAccess = Boolean(
    selectedSite &&
      csrfToken &&
      activeClientAccessDraft.email.trim() &&
      (selectedSite.clientAccess || activeClientAccessDraft.password.length >= 8) &&
      !clientAccessSaveMutation.isPending
  );
  const canDeleteSelectedSite = Boolean(
    selectedSite &&
      csrfToken &&
      deleteConfirmSlug.trim() === selectedSite.slug &&
      !siteDeleteMutation.isPending
  );
  const isDraftValid = Boolean(
    draft.title.trim() &&
    draft.client.trim() &&
    draft.description.trim() &&
    draft.cover.trim() &&
    Number.isFinite(Number.parseInt(draft.year, 10))
  );
  const isSiteDraftValid = Boolean(
    activeSiteDraft.name.trim() &&
      activeSiteDraft.slug.trim() &&
      isQuotaDraftValid(activeSiteDraft.quotaOverride)
  );

  const startCreate = () => {
    setIsCreatingSite(false);
    setDraft(emptyDraft);
    setIsEditorOpen(true);
  };

  const startCreateSite = () => {
    closeEditor();
    setIsCreatingSite(true);
    setSiteDraft(emptySiteDraft);
    setClientAccessDraft(emptyClientAccessDraft);
    setClientAccessDraftSiteId('');
    setDeleteConfirmSlug('');
  };

  const startEdit = (project: Project) => {
    setIsCreatingSite(false);
    setDraft(draftFromProject(project));
    setIsEditorOpen(true);
  };

  const onSelectSite = (site: AdminSiteSummary) => {
    setSelectedSiteId(site.id);
    setSiteDraft(siteDraftFromSummary(site));
    setClientAccessDraft(clientAccessDraftFromSummary(site));
    setClientAccessDraftSiteId(site.id);
    setDeleteConfirmSlug('');
    closeEditor();
    setIsCreatingSite(false);
  };

  const submitForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedSite) {
      showError('Site belum dipilih');
      return;
    }

    if (!isSiteActive) {
      showError('Site tidak aktif');
      return;
    }

    if (!draft.id && isProjectLimitReached) {
      showError(`Quota project ${selectedSite.plan} sudah penuh`);
      return;
    }

    if (!isDraftValid) {
      showError('Lengkapi title, client, tahun, deskripsi, dan cover URL');
      return;
    }

    saveMutation.mutate(draft);
  };

  const submitSiteForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedSlug = normalizeSiteSlugInput(activeSiteDraft.slug);
    const nextDraft = {
      ...activeSiteDraft,
      slug: normalizedSlug,
    };

    if (!nextDraft.name.trim() || !nextDraft.slug) {
      showError('Lengkapi nama dan slug site');
      return;
    }

    if (!isQuotaDraftValid(nextDraft.quotaOverride)) {
      showError('Quota custom harus berupa angka bulat positif atau kosong');
      return;
    }

    siteSaveMutation.mutate(nextDraft);
  };

  const copyPublicUrl = async () => {
    if (!activePublicUrl) {
      showError('Slug site belum tersedia');
      return;
    }

    try {
      await navigator.clipboard.writeText(activePublicUrl);
      showSuccess('Link site disalin');
    } catch {
      showError('Gagal menyalin link site');
    }
  };

  const saveClientAccess = () => {
    const nextDraft = {
      ...activeClientAccessDraft,
      email: activeClientAccessDraft.email.trim().toLowerCase(),
    };

    if (!selectedSite) {
      showError('Site belum dipilih');
      return;
    }

    if (!nextDraft.email) {
      showError('Email client wajib diisi');
      return;
    }

    if (!selectedSite.clientAccess && nextDraft.password.length < 8) {
      showError('Password awal client minimal 8 karakter');
      return;
    }

    clientAccessSaveMutation.mutate(nextDraft);
  };

  const confirmDeleteSite = async () => {
    if (!selectedSite) {
      showError('Site belum dipilih');
      return;
    }

    if (deleteConfirmSlug.trim() !== selectedSite.slug) {
      showError('Ketik slug site dengan tepat untuk menghapus');
      return;
    }

    const ok = await confirm({
      title: 'Hapus site?',
      message: `${selectedSite.name} dan semua media R2 dengan prefix site ini akan dihapus permanen.`,
      confirmText: 'Hapus Site',
      cancelText: 'Batal',
      tone: 'danger',
    });

    if (ok) siteDeleteMutation.mutate();
  };

  const handleCoverFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';

    if (!file) return;
    coverUploadMutation.mutate(file);
  };

  const handleGalleryFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = '';

    if (files.length === 0) return;
    galleryUploadMutation.mutate(files);
  };

  const handleGalleryVideoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';

    if (!file) return;
    galleryVideoUploadMutation.mutate(file);
  };

  const removeGalleryImage = (index: number) => {
    // Jika item yang dihapus adalah hasil upload sesi ini (belum disimpan),
    // hapus juga objek R2-nya sekarang agar tidak yatim.
    const removedUrl = draft.gallery[index];
    const pendingIndex = pendingUploadKeysRef.current.findIndex(
      (key) => removedUrl && (removedUrl.includes(key) || key.includes(encodeURIComponent(removedUrl.split('/').pop() || '')))
    );
    if (pendingIndex >= 0 && selectedSite) {
      const [key] = pendingUploadKeysRef.current.splice(pendingIndex, 1);
      const token = getWritableCsrfToken(csrfToken);
      if (token) {
        void fetch(`/api/admin/sites/${encodeURIComponent(selectedSite.id)}/project-media`, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': token,
          },
          body: JSON.stringify({ key }),
        }).catch(() => {});
      }
    }
    setDraft((prev) => ({
      ...prev,
      gallery: prev.gallery.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const confirmDelete = async (project: Project) => {
    const ok = await confirm({
      title: 'Hapus project?',
      message: `${project.title} akan dihapus dari site ${selectedSite?.name || ''}.`,
      confirmText: 'Hapus',
      cancelText: 'Batal',
      tone: 'danger',
    });

    if (ok) deleteMutation.mutate(project.id);
  };

  return (
    <div className="select-text flex h-full min-h-0 flex-col bg-zinc-50 text-zinc-900">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white px-5 py-4">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-zinc-950">Master Client CRUD</h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            {selectedSite
              ? `${selectedSite.name} / ${selectedSite.slug} / ${selectedSite.plan.toUpperCase()}`
              : 'Buat atau pilih client/site untuk mulai'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void invalidateDashboard()}
            disabled={isBusy || !selectedSite}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isBusy ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={startCreateSite}
            disabled={isBusy}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Building2 className="h-4 w-4" />
            Client/Site Baru
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[250px_minmax(0,1fr)_360px]">
        {/* Table sidebar */}
        <MasterSiteTable
          sites={sites}
          effectiveSiteId={effectiveSiteId}
          onSelectSite={onSelectSite}
        />

        <main className="min-h-0 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden p-4">
          {selectedSite ? (
            <>
              <section>
                <div className={`${isEditorOpen ? 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]' : ''}`}>
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
                      <div>
                        <h2 className="text-sm font-semibold text-zinc-950">
                          Projects ({filteredProjects.length})
                        </h2>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          Master project editor untuk site {selectedSite.name}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                          <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            className="h-9 w-56 rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-zinc-400"
                            placeholder="Cari project"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={startCreate}
                          disabled={!isSiteActive || isProjectLimitReached || isBusy}
                          title={projectCreateBlocker || undefined}
                          className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-950 px-3 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
                        >
                          <FilePlus2 className="h-4 w-4" />
                          Project Baru
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
                      <table className="w-full border-separate border-spacing-0 text-sm">
                        <thead>
                          <tr className="bg-zinc-50 text-left text-xs font-semibold uppercase text-zinc-500">
                            <th className="border-b border-zinc-200 px-4 py-3">Project</th>
                            <th className="border-b border-zinc-200 px-4 py-3">Status</th>
                            <th className="border-b border-zinc-200 px-4 py-3 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredProjects.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="px-4 py-14 text-center">
                                <FilePlus2 className="mx-auto mb-3 h-6 w-6 text-zinc-300" />
                                <p className="text-sm font-medium text-zinc-700">
                                  {search.trim()
                                    ? 'Tidak ada project sesuai pencarian'
                                    : 'Belum ada project di site ini'}
                                </p>
                                <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-zinc-500">
                                  {search.trim()
                                    ? 'Coba kata kunci lain.'
                                    : projectCreateBlocker ||
                                      'Tambah project pertama untuk mengaktifkan preview public site.'}
                                </p>
                              </td>
                            </tr>
                          ) : (
                            filteredProjects.map((project) => (
                              <tr key={project.id} className="hover:bg-zinc-50">
                                <td className="border-b border-zinc-100 px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 overflow-hidden rounded-md bg-zinc-100 ring-1 ring-zinc-200">
                                      {isVideoUrl(project.cover) ? (
                                        <video
                                          src={project.cover}
                                          muted
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        <div
                                          className="h-full w-full bg-cover bg-center"
                                          style={{
                                            backgroundImage: project.cover
                                              ? `url("${project.cover.replaceAll('"', '\\"')}")`
                                              : undefined,
                                          }}
                                        />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="truncate font-medium">{project.title}</div>
                                      <div className="truncate text-xs text-zinc-500">
                                        {project.client}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="border-b border-zinc-100 px-4 py-3">
                                  <span
                                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                      project.status === 'published'
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-zinc-100 text-zinc-700'
                                    }`}
                                  >
                                    {project.status}
                                  </span>
                                </td>
                                <td className="border-b border-zinc-100 px-4 py-3">
                                  <div className="flex justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => startEdit(project)}
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
                                      title="Edit project"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() => void confirmDelete(project)}
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                                      title="Hapus project"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Project Editor Sidebar */}
                  {isEditorOpen && (
                    <MasterProjectEditorSidebar
                      selectedSite={selectedSite}
                      draft={draft}
                      isBusy={isBusy}
                      isSiteActive={isSiteActive}
                      isDraftValid={isDraftValid}
                      canUploadCover={canUploadCover}
                      canUploadGallery={canUploadGallery}
                      maxGalleryItems={maxGalleryItems}
                      remainingGallerySlots={remainingGallerySlots}
                      savePending={saveMutation.isPending}
                      PROJECT_COVER_ACCEPT={PROJECT_COVER_ACCEPT}
                      PROJECT_GALLERY_ACCEPT={PROJECT_GALLERY_ACCEPT}
                      PROJECT_GALLERY_VIDEO_ACCEPT={PROJECT_GALLERY_VIDEO_ACCEPT}
                      isVideoUrl={isVideoUrl}
                      setDraft={setDraft}
                      closeEditor={closeEditor}
                      removeGalleryImage={removeGalleryImage}
                      handleCoverFileChange={handleCoverFileChange}
                      handleGalleryFilesChange={handleGalleryFilesChange}
                      handleGalleryVideoChange={handleGalleryVideoChange}
                      submitForm={submitForm}
                    />
                  )}
                </div>
              </section>
            </>
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center text-zinc-500">
              Pilih client/site dari panel kiri atau buat site baru.
            </div>
          )}
        </main>

        {/* Master Site Editor Sidebar */}
        <MasterSiteEditorSidebar
          selectedSite={selectedSite}
          isCreatingSite={isCreatingSite}
          activeSiteDraft={activeSiteDraft}
          activeClientAccessDraft={activeClientAccessDraft}
          activePublicUrl={activePublicUrl}
          activePublicSlug={activePublicSlug}
          deleteConfirmSlug={deleteConfirmSlug}
          canSaveSite={canSaveSite}
          isSiteDraftValid={isSiteDraftValid}
          canSaveClientAccess={canSaveClientAccess}
          canDeleteSelectedSite={canDeleteSelectedSite}
          isBusy={isBusy}
          siteSavePending={siteSaveMutation.isPending}
          siteSaveError={siteSaveMutation.error as Error | null}
          clientAccessPending={clientAccessSaveMutation.isPending}
          siteDeletePending={siteDeleteMutation.isPending}
          formatDate={formatDate}
          setSiteDraft={setSiteDraft}
          setClientAccessDraft={setClientAccessDraft}
          setClientAccessDraftSiteId={setClientAccessDraftSiteId}
          setDeleteConfirmSlug={setDeleteConfirmSlug}
          closeSiteCreator={closeSiteCreator}
          copyPublicUrl={copyPublicUrl}
          submitSiteForm={submitSiteForm}
          saveClientAccess={saveClientAccess}
          confirmDeleteSite={confirmDeleteSite}
        />
      </div>
    </div>
  );
}
