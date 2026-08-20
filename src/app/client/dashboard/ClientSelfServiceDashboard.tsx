'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  FilePlus2,
  FolderKanban,
  LayoutGrid,
  Loader2,
  LogOut,
  MessageSquare,
  Monitor,
  RefreshCw,
  Rocket,
} from 'lucide-react';
import type { GalleryItem, Project } from '@/types/projects';
import type { PlanQuota } from '@/lib/product/sitePlan';
import type { SiteStorageUsage } from '@/lib/product/siteStorageUsage';
import type { ChatHistoryMessage, Testimonial } from '@/types/testimonial';
import { useToast } from '@/contexts/ToastContext';
import '@/app/admin/desktop/admin-desktop.css';

import { ClientWindowFrame, type ClientWindowState } from './components/ClientWindowFrame';
import { ProjectsModulePanel } from './components/ProjectsModulePanel';
import { ContentModulePanel } from './components/ContentModulePanel';
import { SystemModulePanel } from './components/SystemModulePanel';
import { TestimonialsModulePanel } from './components/TestimonialsModulePanel';
import { ClientOnboardingWizard } from './components/ClientOnboardingWizard';
import { AnalyticsModulePanel } from './components/AnalyticsModulePanel';

// ════════════════════════════════════════════════════════════════
//  TYPES
// ════════════════════════════════════════════════════════════════

export type ClientFeatureSummary = {
  whatsappTestimonials: boolean;
  testimonialLimit: number;
};

export type ClientSiteSummary = {
  id: string;
  slug: string;
  name: string;
  plan: 'lite' | 'pro';
  status: string;
  quota: PlanQuota;
  features?: ClientFeatureSummary;
  usage: {
    projects: number;
    storage: SiteStorageUsage;
  };
};

export type ClientAuthResponse = {
  authenticated: boolean;
  csrfToken?: string;
  client?: {
    email: string;
    site: ClientSiteSummary;
  };
};

export type ProjectsResponse = {
  success: boolean;
  data?: {
    projects?: Project[];
  };
  error?: string;
  errorCode?: string;
};

export type TestimonialsResponse = {
  success: boolean;
  data?: {
    testimonials: Testimonial[];
    lastUpdated: string;
    feature: ClientFeatureSummary;
  };
  error?: string;
  errorCode?: string;
};

export type UploadResponse = {
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

export type TestimonialDraft = {
  id?: string;
  name: string;
  notificationText: string;
  company: string;
  role: string;
  content: string;
  messagesText: string;
  isActive: boolean;
};

export type ClientContentProfile = {
  heroTitle: string;
  availabilityStatus: 'available' | 'booked' | 'limited';
  availabilityText: string;
  mottoBadge: string;
  mottoQuote: string;
  bio: string;
  email: string;
  whatsapp: string;
  linkedin: string;
  phone: string;
  address: string;
  instagram: string;
  behance: string;
  contactHeadline: string;
  contactSubtext: string;
};

export type ClientStatisticsDraft = {
  years: string;
  projects: string;
  designTools: string;
  clientSatisfaction: string;
};

export type WorkExperienceDraft = {
  id: string;
  year: string;
  duration: string;
  company: string;
  position: string;
  descriptionText: string;
  imageUrl: string;
  isActive: boolean;
};

export type HardSkillLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';

export type HardSkillDraft = {
  id: string;
  name: string;
  level: HardSkillLevel;
  description: string;
  iconUrl: string;
  isActive: boolean;
};

export type ClientContentDraft = {
  profile: ClientContentProfile;
  statistics: ClientStatisticsDraft;
  workExperience: WorkExperienceDraft[];
  hardSkills: HardSkillDraft[];
};

export type ClientContentResponse = {
  success: boolean;
  data?: ClientContentDraft;
  error?: string;
  errorCode?: string;
};

export type ClientSystemDraft = {
  wallpaperBlur: number;
  activeWallpaperId: string;
  wallpapers: Array<{
    id: string;
    name: string;
    type?: 'image' | 'video';
    url: string;
    posterUrl?: string;
  }>;
  stickyNote: {
    text: string;
    color: string;
  };
  dockLabels: {
    projects: string;
    contact: string;
    whatsapp: string;
    notes: string;
    about: string;
  };
};

export type ClientSystemResponse = {
  success: boolean;
  data?: ClientSystemDraft;
  error?: string;
  errorCode?: string;
};

export type ClientModuleId = 'projects' | 'content' | 'system' | 'communication' | 'analytics';

// ════════════════════════════════════════════════════════════════
//  MODULE DEFINITIONS
// ════════════════════════════════════════════════════════════════

const MODULE_DEFS: Array<{
  id: ClientModuleId;
  label: string;
  icon: typeof FolderKanban;
  iconColor: string;
  iconBg: string;
  defaultWidth: number;
  defaultHeight: number;
}> = [
  {
    id: 'projects',
    label: 'Karya & Media',
    icon: FolderKanban,
    iconColor: 'text-white',
    iconBg: 'bg-zinc-800',
    defaultWidth: 1100,
    defaultHeight: 700,
  },
  {
    id: 'content',
    label: 'Konten & Berkas',
    icon: FilePlus2,
    iconColor: 'text-white',
    iconBg: 'bg-blue-600',
    defaultWidth: 1000,
    defaultHeight: 700,
  },
  {
    id: 'system',
    label: 'Sistem & Tampilan',
    icon: Monitor,
    iconColor: 'text-white',
    iconBg: 'bg-cyan-600',
    defaultWidth: 900,
    defaultHeight: 650,
  },
  {
    id: 'communication',
    label: 'Komunikasi',
    icon: MessageSquare,
    iconColor: 'text-white',
    iconBg: 'bg-emerald-600',
    defaultWidth: 1000,
    defaultHeight: 700,
  },
  {
    id: 'analytics',
    label: 'Analitik Site',
    icon: BarChart3,
    iconColor: 'text-white',
    iconBg: 'bg-purple-600',
    defaultWidth: 1000,
    defaultHeight: 700,
  },
];

// ════════════════════════════════════════════════════════════════
//  CONSTANTS
// ════════════════════════════════════════════════════════════════

const PROJECT_IMAGE_MAX_SIZE_BYTES = 10 * 1024 * 1024;
const PROJECT_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/avif';
const PROJECT_IMAGE_TYPES = new Set(PROJECT_IMAGE_ACCEPT.split(','));
const PROJECT_VIDEO_MAX_SIZE_BYTES = 200 * 1024 * 1024;
const PROJECT_VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime';
const PROJECT_VIDEO_TYPES = new Set(PROJECT_VIDEO_ACCEPT.split(','));

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

const defaultTestimonialFeature: ClientFeatureSummary = {
  whatsappTestimonials: false,
  testimonialLimit: 0,
};

const emptyTestimonialDraft: TestimonialDraft = {
  name: '',
  notificationText: '',
  company: '',
  role: '',
  content: '',
  messagesText: '',
  isActive: true,
};

const emptyClientContentDraft: ClientContentDraft = {
  profile: {
    heroTitle: '',
    availabilityStatus: 'available',
    availabilityText: '',
    mottoBadge: '',
    mottoQuote: '',
    bio: '',
    email: '',
    whatsapp: '',
    linkedin: '',
    phone: '',
    address: '',
    instagram: '',
    behance: '',
    contactHeadline: '',
    contactSubtext: '',
  },
  statistics: {
    years: '',
    projects: '',
    designTools: '',
    clientSatisfaction: '',
  },
  workExperience: [],
  hardSkills: [],
};

const emptyClientSystemDraft: ClientSystemDraft = {
  wallpaperBlur: 0,
  activeWallpaperId: '',
  wallpapers: [],
  stickyNote: {
    text: '',
    color: '#fef08a',
  },
  dockLabels: {
    projects: '',
    contact: '',
    whatsapp: '',
    notes: '',
    about: '',
  },
};

function createWorkExperienceDraft(): WorkExperienceDraft {
  return {
    id: `client-exp-${Date.now()}`,
    year: String(new Date().getFullYear()),
    duration: '',
    company: '',
    position: '',
    descriptionText: '',
    imageUrl: '',
    isActive: true,
  };
}

function createHardSkillDraft(): HardSkillDraft {
  return {
    id: `hard-client-${Date.now()}`,
    name: '',
    level: 'Intermediate',
    description: '',
    iconUrl: '',
    isActive: true,
  };
}

// ════════════════════════════════════════════════════════════════
//  HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════

function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov)(?:\?|#|$)/i.test(url);
}

function draftFromProject(project: Project): ProjectDraft {
  const galleryFromItems =
    project.galleryItems?.map((item) => item.src).filter((src) => src && src !== project.cover) ??
    [];

  return {
    id: project.id,
    title: project.title,
    client: project.client,
    year: String(project.year),
    tags: project.tags.join(', '),
    description: project.description,
    cover: project.cover,
    gallery: galleryFromItems.length > 0 ? galleryFromItems : (project.gallery ?? []),
    status: project.status,
  };
}

function splitTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
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

function testimonialMessagesToText(messages: ChatHistoryMessage[] | undefined) {
  if (!Array.isArray(messages) || messages.length === 0) return '';

  return messages
    .map((message) => `${message.isMe ? 'Saya' : 'Client'}: ${message.text}`)
    .join('\n');
}

function draftFromTestimonial(testimonial: Testimonial): TestimonialDraft {
  return {
    id: testimonial.id,
    name: testimonial.name,
    notificationText: testimonial.notificationText,
    company: testimonial.company || '',
    role: testimonial.role || '',
    content: testimonial.content || '',
    messagesText: testimonialMessagesToText(testimonial.messages),
    isActive: testimonial.isActive !== false,
  };
}

function parseTestimonialMessages(value: string): ChatHistoryMessage[] | undefined {
  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 100);

  if (lines.length === 0) return undefined;

  return lines.map((line, index) => {
    const lower = line.toLowerCase();
    const isMe = lower.startsWith('saya:') || lower.startsWith('me:') || lower.startsWith('owner:');
    const text = line.replace(/^(saya|me|owner|client|klien):\s*/i, '').trim();

    return {
      id: index + 1,
      text,
      isMe,
      time: '09:00',
      type: 'text' as const,
    };
  });
}

function buildTestimonialPayload(draft: TestimonialDraft) {
  return {
    name: draft.name.trim(),
    notificationText: draft.notificationText.trim(),
    company: draft.company.trim() || undefined,
    role: draft.role.trim() || undefined,
    content: draft.content.trim() || undefined,
    messages: parseTestimonialMessages(draft.messagesText),
    isActive: draft.isActive,
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

function validateImageFile(file: File, label: string) {
  if (!PROJECT_IMAGE_TYPES.has(file.type)) {
    throw new Error(`${label} harus JPG, PNG, WebP, atau AVIF`);
  }
  if (file.size <= 0) throw new Error(`${label} kosong`);
  if (file.size > PROJECT_IMAGE_MAX_SIZE_BYTES) {
    throw new Error(`${label} maksimal ${PROJECT_IMAGE_MAX_SIZE_BYTES / 1024 / 1024} MB`);
  }
}

function validateVideoFile(file: File) {
  if (!PROJECT_VIDEO_TYPES.has(file.type)) {
    throw new Error('Video harus MP4, WebM, atau QuickTime');
  }
  if (file.size <= 0) throw new Error('Video kosong');
  if (file.size > PROJECT_VIDEO_MAX_SIZE_BYTES) {
    throw new Error(`Video maksimal ${PROJECT_VIDEO_MAX_SIZE_BYTES / 1024 / 1024} MB`);
  }
}

function formatStorageMb(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 MB';
  if (value >= 1024) return `${(value / 1024).toFixed(value >= 10240 ? 0 : 1)} GB`;
  if (value >= 10) return `${value.toFixed(0)} MB`;
  return `${value.toFixed(2)} MB`;
}

// ════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ════════════════════════════════════════════════════════════════

let nextZIndex = 100;

function getStaggerOffset(windowCount: number) {
  const base = 60;
  return {
    x: base + (windowCount % 6) * 40,
    y: base + (windowCount % 6) * 40,
  };
}

export default function ClientSelfServiceDashboard() {
  const { showError, showSuccess } = useToast();
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);
  const [site, setSite] = useState<ClientSiteSummary | null>(null);
  const [email, setEmail] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [draft, setDraft] = useState<ProjectDraft>(emptyDraft);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [testimonialFeature, setTestimonialFeature] =
    useState<ClientFeatureSummary>(defaultTestimonialFeature);
  const [testimonialDraft, setTestimonialDraft] = useState<TestimonialDraft>(emptyTestimonialDraft);
  const [contentDraft, setContentDraft] =
    useState<ClientContentDraft>(emptyClientContentDraft);
  const [systemDraft, setSystemDraft] = useState<ClientSystemDraft>(emptyClientSystemDraft);
  const [isContentLoaded, setIsContentLoaded] = useState(false);
  const [isSystemLoaded, setIsSystemLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isTestimonialEditorOpen, setIsTestimonialEditorOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  // ── Window management state ────────────────────────────────
  const [openWindows, setOpenWindows] = useState<ClientWindowState[]>([]);
  const windowCountRef = useRef(0);

  const openModuleWindow = useCallback((moduleId: ClientModuleId) => {
    setOpenWindows((prev) => {
      const existing = prev.find((w) => w.moduleId === moduleId);
      if (existing) {
        nextZIndex++;
        return prev.map((w) =>
          w.id === existing.id ? { ...w, zIndex: nextZIndex, isMinimized: false } : w
        );
      }

      const def = MODULE_DEFS.find((d) => d.id === moduleId);
      if (!def) return prev;

      windowCountRef.current++;
      nextZIndex++;
      const offset = getStaggerOffset(windowCountRef.current);

      const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
      const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
      const w = Math.min(def.defaultWidth, vw - 80);
      const h = Math.min(def.defaultHeight, vh - 80);

      const newWin: ClientWindowState = {
        id: `client-${moduleId}-${Date.now()}`,
        moduleId,
        title: def.label,
        icon: def.icon,
        iconColor: def.iconColor,
        isMinimized: false,
        isMaximized: false,
        zIndex: nextZIndex,
        x: Math.max(20, Math.min(offset.x, vw - w - 20)),
        y: Math.max(40, Math.min(offset.y, vh - h - 40)),
        width: w,
        height: h,
      };

      return [...prev, newWin];
    });
  }, []);

  const closeWindow = useCallback((windowId: string) => {
    setOpenWindows((prev) => prev.filter((w) => w.id !== windowId));
  }, []);

  const minimizeWindow = useCallback((windowId: string) => {
    setOpenWindows((prev) => prev.map((w) => (w.id === windowId ? { ...w, isMinimized: true } : w)));
  }, []);

  const toggleMaximize = useCallback((windowId: string) => {
    setOpenWindows((prev) =>
      prev.map((w) => (w.id === windowId ? { ...w, isMaximized: !w.isMaximized } : w))
    );
  }, []);

  const bringToFront = useCallback((windowId: string) => {
    nextZIndex++;
    setOpenWindows((prev) =>
      prev.map((w) => (w.id === windowId ? { ...w, zIndex: nextZIndex, isMinimized: false } : w))
    );
  }, []);

  const updatePosition = useCallback((windowId: string, x: number, y: number) => {
    setOpenWindows((prev) => prev.map((w) => (w.id === windowId ? { ...w, x, y } : w)));
  }, []);

  const updateSize = useCallback((windowId: string, width: number, height: number) => {
    setOpenWindows((prev) => prev.map((w) => (w.id === windowId ? { ...w, width, height } : w)));
  }, []);

  // ── Derived state ──────────────────────────────────────────

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

  const isSiteActive = site?.status === 'active';
  const canUseTestimonials =
    testimonialFeature.whatsappTestimonials ||
    site?.features?.whatsappTestimonials === true ||
    site?.plan === 'pro';
  const testimonialLimit =
    testimonialFeature.testimonialLimit ||
    site?.features?.testimonialLimit ||
    (site?.plan === 'pro' ? 20 : 0);
  const isTestimonialLimitReached = testimonials.length >= testimonialLimit;
  const isProjectLimitReached = site ? site.usage.projects >= site.quota.projectLimit : false;
  const projectCreateBlocker = !site
    ? 'Site belum termuat.'
    : !isSiteActive
      ? 'Site sedang suspended. Hubungi admin untuk mengaktifkan kembali.'
      : isProjectLimitReached
        ? `Quota project ${site.quota.projectLimit} sudah penuh. Hubungi admin untuk upgrade quota.`
        : '';
  const hasPublishedProjects = projects.some((project) => project.status === 'published');
  const maxGalleryItems = site ? Math.max(0, site.quota.mediaPerProject - 1) : 0;
  const remainingGallerySlots = Math.max(0, maxGalleryItems - draft.gallery.length);
  const storagePercent =
    site?.usage.storage.available && site.quota.storageMb > 0
      ? Math.min(100, (site.usage.storage.mb / site.quota.storageMb) * 100)
      : 0;
  const isDraftValid = Boolean(
    draft.title.trim() &&
    draft.client.trim() &&
    draft.description.trim() &&
    draft.cover.trim() &&
    Number.isFinite(Number.parseInt(draft.year, 10))
  );
  const isTestimonialDraftValid = Boolean(
    testimonialDraft.name.trim() && testimonialDraft.notificationText.trim()
  );
  const isContentDraftValid = Boolean(
    contentDraft.profile.heroTitle.trim() &&
      contentDraft.profile.bio.trim() &&
      contentDraft.workExperience.every(
        (item) =>
          item.year.trim() &&
          item.duration.trim() &&
          item.company.trim() &&
          item.position.trim()
      ) &&
      contentDraft.hardSkills.every((skill) => skill.name.trim())
  );
  const canEditSystem = Boolean(site);


  // ── Data loading ───────────────────────────────────────────

  const loadDashboard = useCallback(async (initial = true) => {
    if (initial) {
      setIsLoading(true);
      setIsContentLoaded(false);
      setIsSystemLoaded(false);
    }
    try {
      const authResponse = await fetch('/api/client/check-auth', {
        credentials: 'include',
        cache: 'no-store',
      });
      const authData = await readJson<ClientAuthResponse>(authResponse);
      if (!authData.authenticated || !authData.client) {
        window.location.href = '/client/login';
        return;
      }

      setCsrfToken(authData.csrfToken || '');
      const currentSite = authData.client.site;
      setSite(currentSite);
      setEmail(authData.client.email);

      const contentResponse = await fetch('/api/client/content', {
        credentials: 'include',
        cache: 'no-store',
      });
      const contentData = await readJson<ClientContentResponse>(contentResponse);
      setContentDraft(contentData.data ?? emptyClientContentDraft);
      setIsContentLoaded(true);

      if (currentSite.plan === 'pro') {
        const systemResponse = await fetch('/api/client/system', {
          credentials: 'include',
          cache: 'no-store',
        });
        const systemData = await readJson<ClientSystemResponse>(systemResponse);
        setSystemDraft(systemData.data ?? emptyClientSystemDraft);
        setIsSystemLoaded(true);
      } else {
        setSystemDraft(emptyClientSystemDraft);
        setIsSystemLoaded(false);
      }

      const params = new URLSearchParams({ siteId: currentSite.id });
      const projectsResponse = await fetch(`/api/projects?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const projectsData = await readJson<ProjectsResponse>(projectsResponse);
      const loadedProjects = projectsData.data?.projects ?? [];
      setProjects(loadedProjects);

      if (
        loadedProjects.length === 0 &&
        typeof window !== 'undefined' &&
        sessionStorage.getItem('onboarding_dismissed') !== 'true'
      ) {
        setShowOnboardingWizard(true);
      }

      const feature = currentSite.features || {
        whatsappTestimonials: currentSite.plan === 'pro',
        testimonialLimit: currentSite.plan === 'pro' ? 20 : 0,
      };
      setTestimonialFeature(feature);
      if (feature.whatsappTestimonials) {
        const testimonialsResponse = await fetch('/api/client/testimonials', {
          credentials: 'include',
          cache: 'no-store',
        });
        const testimonialsData = await readJson<TestimonialsResponse>(testimonialsResponse);
        setTestimonials(testimonialsData.data?.testimonials ?? []);
        setTestimonialFeature(testimonialsData.data?.feature ?? feature);
      } else {
        setTestimonials([]);
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Gagal memuat dashboard client');
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  // ── Editor state helpers ───────────────────────────────────

  const closeEditor = () => {
    setIsEditorOpen(false);
    setDraft(emptyDraft);
  };

  const startCreate = () => {
    setDraft(emptyDraft);
    setIsEditorOpen(true);
  };

  const startEdit = (project: Project) => {
    setDraft(draftFromProject(project));
    setIsEditorOpen(true);
  };

  const closeTestimonialEditor = () => {
    setIsTestimonialEditorOpen(false);
    setTestimonialDraft(emptyTestimonialDraft);
  };

  const startCreateTestimonial = () => {
    setTestimonialDraft(emptyTestimonialDraft);
    setIsTestimonialEditorOpen(true);
  };

  const startEditTestimonial = (testimonial: Testimonial) => {
    setTestimonialDraft(draftFromTestimonial(testimonial));
    setIsTestimonialEditorOpen(true);
  };

  const removeGalleryItem = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      gallery: prev.gallery.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  // ── Upload handlers ────────────────────────────────────────

  const uploadImage = async (file: File, target: 'cover' | 'gallery') => {
    if (!site) throw new Error('Site belum siap');
    validateImageFile(file, target === 'cover' ? 'Cover' : 'Gallery image');

    const formData = new FormData();
    formData.set('file', file);
    const endpoint =
      target === 'cover'
        ? `/api/client/sites/${encodeURIComponent(site.id)}/project-cover`
        : `/api/client/sites/${encodeURIComponent(site.id)}/project-media`;
    const response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'x-csrf-token': csrfToken,
      },
      body: formData,
    });
    const data = await readJson<UploadResponse>(response);
    const publicUrl = data.url || data.publicUrl;
    if (!publicUrl) throw new Error('Upload selesai tetapi URL kosong');
    return publicUrl;
  };

  const uploadVideo = async (file: File) => {
    if (!site) throw new Error('Site belum siap');
    validateVideoFile(file);

    const presignResponse = await fetch(
      `/api/client/sites/${encodeURIComponent(site.id)}/project-video/presign`,
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
    const presigned = await readJson<UploadResponse>(presignResponse);
    if (!presigned.uploadUrl || !presigned.publicUrl) {
      throw new Error('Upload URL video tidak lengkap');
    }

    const isInternalUploadUrl = presigned.uploadUrl.startsWith('/');
    const uploadResponse = await fetch(presigned.uploadUrl, {
      method: 'PUT',
      credentials: isInternalUploadUrl ? 'include' : 'omit',
      headers: {
        'Content-Type': file.type,
        'Cache-Control': presigned.cacheControl || 'public, max-age=31536000, immutable',
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

    return presigned.publicUrl;
  };

  const handleCoverChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    setIsBusy(true);
    try {
      const url = await uploadImage(file, 'cover');
      setDraft((prev) => ({ ...prev, cover: url }));
      showSuccess('Cover diupload');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Gagal upload cover');
    } finally {
      setIsBusy(false);
    }
  };

  const handleGalleryImagesChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = '';
    if (files.length === 0) return;

    if (remainingGallerySlots <= 0) {
      showError(`Slot gallery ${site?.plan || ''} sudah penuh`);
      return;
    }

    const selectedFiles = files.slice(0, remainingGallerySlots);
    setIsBusy(true);
    try {
      const urls: string[] = [];
      for (const file of selectedFiles) {
        urls.push(await uploadImage(file, 'gallery'));
      }
      setDraft((prev) => ({ ...prev, gallery: [...prev.gallery, ...urls] }));
      await loadDashboard(false);
      showSuccess(`${urls.length} image diupload`);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Gagal upload gallery image');
    } finally {
      setIsBusy(false);
    }
  };

  const handleGalleryVideoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    if (remainingGallerySlots <= 0) {
      showError(`Slot gallery ${site?.plan || ''} sudah penuh`);
      return;
    }

    setIsBusy(true);
    try {
      const url = await uploadVideo(file);
      setDraft((prev) => ({ ...prev, gallery: [...prev.gallery, url] }));
      await loadDashboard(false);
      showSuccess('Video gallery diupload');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Gagal upload video gallery');
    } finally {
      setIsBusy(false);
    }
  };

  // ── CRUD submit/delete handlers ────────────────────────────

  const submitProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!site) return;
    if (!isSiteActive) {
      showError('Site tidak aktif');
      return;
    }
    if (!draft.id && isProjectLimitReached) {
      showError(`Quota project ${site.plan} sudah penuh`);
      return;
    }
    if (!isDraftValid) {
      showError('Lengkapi title, client, tahun, deskripsi, dan cover URL');
      return;
    }

    setIsBusy(true);
    try {
      const method = draft.id ? 'PUT' : 'POST';
      const url = draft.id
        ? `/api/projects/${encodeURIComponent(draft.id)}?${new URLSearchParams({
            siteId: site.id,
          }).toString()}`
        : '/api/projects';
      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          ...buildProjectPayload(draft),
          id: draft.id,
          siteId: site.id,
        }),
      });
      await readJson(response);
      await loadDashboard(false);
      closeEditor();
      showSuccess('Project tersimpan');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Gagal menyimpan project');
    } finally {
      setIsBusy(false);
    }
  };

  const deleteProject = async (project: Project) => {
    if (!site) return;
    if (!window.confirm(`Hapus project "${project.title}"?`)) return;

    setIsBusy(true);
    try {
      const params = new URLSearchParams({ siteId: site.id });
      const response = await fetch(`/api/projects/${encodeURIComponent(project.id)}?${params}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'x-csrf-token': csrfToken,
        },
      });
      await readJson(response);
      await loadDashboard(false);
      closeEditor();
      showSuccess('Project dihapus');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Gagal menghapus project');
    } finally {
      setIsBusy(false);
    }
  };

  const submitTestimonial = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!site) return;
    if (!isSiteActive) {
      showError('Site tidak aktif');
      return;
    }
    if (!canUseTestimonials) {
      showError('WhatsApp Testimoni tersedia untuk Pro');
      return;
    }
    if (!testimonialDraft.id && isTestimonialLimitReached) {
      showError(`Quota testimoni Pro sudah penuh (${testimonialLimit})`);
      return;
    }
    if (!isTestimonialDraftValid) {
      showError('Lengkapi nama dan preview notifikasi');
      return;
    }

    setIsBusy(true);
    try {
      const method = testimonialDraft.id ? 'PUT' : 'POST';
      const response = await fetch('/api/client/testimonials', {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          ...buildTestimonialPayload(testimonialDraft),
          id: testimonialDraft.id,
        }),
      });
      await readJson(response);
      await loadDashboard(false);
      closeTestimonialEditor();
      showSuccess('Testimoni tersimpan');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Gagal menyimpan testimoni');
    } finally {
      setIsBusy(false);
    }
  };

  const deleteTestimonial = async (testimonial: Testimonial) => {
    if (!window.confirm(`Hapus testimoni "${testimonial.name}"?`)) return;

    setIsBusy(true);
    try {
      const response = await fetch('/api/client/testimonials', {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ id: testimonial.id }),
      });
      await readJson(response);
      await loadDashboard(false);
      closeTestimonialEditor();
      showSuccess('Testimoni dihapus');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Gagal menghapus testimoni');
    } finally {
      setIsBusy(false);
    }
  };

  const submitContent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!site) return;
    if (!isSiteActive) {
      showError('Site tidak aktif');
      return;
    }
    if (!isContentDraftValid) {
      showError('Lengkapi judul profil, bio, pengalaman, dan nama skill');
      return;
    }

    setIsBusy(true);
    try {
      const response = await fetch('/api/client/content', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify(contentDraft),
      });
      await readJson(response);
      await loadDashboard(false);
      showSuccess('Konten profil tersimpan');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Gagal menyimpan konten profil');
    } finally {
      setIsBusy(false);
    }
  };

  const submitSystem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!site) return;
    if (!isSiteActive) {
      showError('Site tidak aktif');
      return;
    }
    if (!canEditSystem) {
      showError('Sistem & Tampilan tersedia untuk Pro');
      return;
    }

    setIsBusy(true);
    try {
      const response = await fetch('/api/client/system', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          wallpaperBlur: systemDraft.wallpaperBlur,
          activeWallpaperId: systemDraft.activeWallpaperId || undefined,
          stickyNote: systemDraft.stickyNote,
          dockLabels: systemDraft.dockLabels,
        }),
      });
      await readJson(response);
      await loadDashboard(false);
      showSuccess('Sistem & tampilan tersimpan');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Gagal menyimpan sistem & tampilan');
    } finally {
      setIsBusy(false);
    }
  };

  const logout = async () => {
    setIsBusy(true);
    try {
      await fetch('/api/client/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'x-csrf-token': csrfToken,
        },
      });
    } finally {
      window.location.href = '/client/login';
    }
  };

  // ── Module card definitions (for desktop icons) ────────────

  const moduleCards = [
    {
      id: 'projects' as const,
      label: 'Karya & Media',
      tier: 'Lite & Pro',
      status: isProjectLimitReached ? 'Quota penuh' : 'Aktif',
      description: 'Kelola project, cover, dan galeri karya',
      helper: projectCreateBlocker || `${projects.length}/${site?.quota.projectLimit ?? 0} project terpakai`,
      Icon: FolderKanban,
      iconClass: 'bg-zinc-800 text-white',
      enabled: Boolean(site),
    },
    {
      id: 'content' as const,
      label: 'Konten & Berkas',
      tier: 'Lite & Pro',
      status: isContentLoaded ? 'Aktif' : 'Loading',
      description: 'Kelola profil, pengalaman, keahlian, dan info kontak',
      helper: 'Tersedia untuk semua paket tanpa bantuan Master.',
      Icon: FilePlus2,
      iconClass: 'bg-blue-600 text-white',
      enabled: Boolean(site) && isContentLoaded,
    },
    {
      id: 'system' as const,
      label: 'Sistem & Tampilan',
      tier: 'Pro',
      status: canEditSystem ? (isSystemLoaded ? 'Aktif' : 'Loading') : 'Terkunci',
      description: 'Atur wallpaper, dock, widget, dan efek OS',
      helper:
        canEditSystem
          ? 'Pengaturan aman Pro yang tidak mengubah engine OS.'
          : 'Upgrade ke Pro untuk opsi tampilan lanjutan.',
      Icon: Monitor,
      iconClass: 'bg-cyan-600 text-white',
      enabled: Boolean(site),
    },
    {
      id: 'communication' as const,
      label: 'Komunikasi',
      tier: 'Pro',
      status: canUseTestimonials ? 'Aktif' : 'Terkunci',
      description: 'Kelola testimoni dan komunikasi client',
      helper: canUseTestimonials
        ? `${testimonials.length}/${testimonialLimit} testimoni`
        : 'Tersedia untuk paket Pro.',
      Icon: MessageSquare,
      iconClass: 'bg-emerald-600 text-white',
      enabled: Boolean(site),
    },
    {
      id: 'analytics' as const,
      label: 'Analitik Site',
      tier: 'Lite & Pro',
      status: 'Aktif',
      description: 'Statistik pengunjung, view project, & aplikasi OS',
      helper: 'Analitik internal tanpa tracking script pihak ketiga.',
      Icon: BarChart3,
      iconClass: 'bg-purple-600 text-white',
      enabled: Boolean(site),
    },
    {
      id: 'bento-studio' as const,
      label: 'Bento Studio',
      tier: 'Pro',
      status: site?.plan === 'pro' ? 'Aktif' : 'Terkunci',
      description: 'Kustomisasi per-section template Landing Bento',
      helper:
        site?.plan === 'pro'
          ? 'Susun section, variant, animasi, & theme lalu publish.'
          : 'Upgrade ke Pro untuk kustomisasi template.',
      Icon: LayoutGrid,
      iconClass: 'bg-emerald-700 text-white',
      enabled: Boolean(site) && site?.plan === 'pro',
      route: '/client/studio',
    },
  ];

  // ════════════════════════════════════════════════════════════
  //  RENDER — Desktop OS Environment
  // ════════════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <div className="admin-desktop">
        <div className="admin-desktop-wallpaper" />
        <div className="flex h-full items-center justify-center text-zinc-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading client dashboard
        </div>
      </div>
    );
  }

  return (
    <div className="admin-desktop">
      <div className="admin-desktop-wallpaper" />

      {/* ── Top Menu Bar ──────────────────────────────────────── */}
      <div className="admin-menubar">
        <div className="admin-menubar-left">
          <span className="admin-menubar-logo">◆</span>
          <span className="admin-menubar-title">
            {site?.name || 'Client Dashboard'}
          </span>
          {site && (
            <span className="admin-menubar-status">
              <span
                className="admin-menubar-status-dot"
                style={{
                  background: isSiteActive ? '#22c55e' : '#f59e0b',
                }}
              />
              {site.slug} / {site.plan.toUpperCase()}
            </span>
          )}
        </div>
        <div className="admin-menubar-right">
          <span className="admin-menubar-time">{email}</span>
          <button
            type="button"
            className="admin-menubar-btn text-indigo-400 font-semibold"
            onClick={() => setShowOnboardingWizard(true)}
            title="Onboarding Wizard 3-Menit"
          >
            <Rocket className="h-4 w-4 text-indigo-400" />
            <span className="hidden md:inline ml-1 text-xs">Wizard 3-Menit</span>
          </button>
          <button
            type="button"
            className="admin-menubar-btn"
            onClick={() => void loadDashboard(false)}
            disabled={isBusy}
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isBusy ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            className="admin-menubar-btn admin-menubar-btn-danger"
            onClick={logout}
            disabled={isBusy}
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Desktop Zone Icons (Module Launcher) ─────────────── */}
      <div className="admin-desktop-zones">
        {moduleCards.map((module) => {
          const Icon = module.Icon;
          return (
            <button
              key={module.id}
              type="button"
              className="admin-zone-folder"
              onClick={() => {
                if (module.route) {
                  window.location.href = module.route;
                  return;
                }
                openModuleWindow(module.id as ClientModuleId);
              }}
              disabled={!module.enabled}
              style={!module.enabled ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
            >
              <div className={`admin-zone-folder-icon ${module.iconClass}`}>
                <Icon className="h-10 w-10" />
              </div>
              <span className="admin-zone-folder-label">{module.label}</span>
              <span className="admin-zone-folder-desc">
                {module.description}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#a1a1aa' }}>
                {module.tier} / {module.status}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Suspended Site Warning ─────────────────────────── */}
      {site && !isSiteActive && (
        <div style={{ position: 'fixed', top: 44, left: '50%', transform: 'translateX(-50%)', zIndex: 9998, maxWidth: 600, width: '90%' }}>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Site sedang suspended</p>
                <p className="mt-0.5 text-xs leading-5">
                  Project masih bisa dilihat, tetapi perubahan dan upload baru dikunci sampai admin
                  mengaktifkan site kembali.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Active Windows ─────────────────────────────────── */}
      {openWindows.map((win) => (
        <ClientWindowFrame
          key={win.id}
          win={win}
          onClose={closeWindow}
          onMinimize={minimizeWindow}
          onToggleMaximize={toggleMaximize}
          onBringToFront={bringToFront}
          onUpdatePosition={updatePosition}
          onUpdateSize={updateSize}
        >
          {win.moduleId === 'projects' && site && (
            <ProjectsModulePanel
              site={site}
              projects={projects}
              filteredProjects={filteredProjects}
              draft={draft}
              search={search}
              isEditorOpen={isEditorOpen}
              isBusy={isBusy}
              isSiteActive={isSiteActive}
              isProjectLimitReached={isProjectLimitReached}
              projectCreateBlocker={projectCreateBlocker}
              hasPublishedProjects={hasPublishedProjects}
              storagePercent={storagePercent}
              maxGalleryItems={maxGalleryItems}
              remainingGallerySlots={remainingGallerySlots}
              isDraftValid={isDraftValid}
              PROJECT_IMAGE_ACCEPT={PROJECT_IMAGE_ACCEPT}
              PROJECT_VIDEO_ACCEPT={PROJECT_VIDEO_ACCEPT}
              formatStorageMb={formatStorageMb}
              isVideoUrl={isVideoUrl}
              setSearch={setSearch}
              setDraft={setDraft}
              startCreate={startCreate}
              startEdit={startEdit}
              closeEditor={closeEditor}
              removeGalleryItem={removeGalleryItem}
              handleCoverChange={handleCoverChange}
              handleGalleryImagesChange={handleGalleryImagesChange}
              handleGalleryVideoChange={handleGalleryVideoChange}
              submitProject={submitProject}
              deleteProject={deleteProject}
            />
          )}

          {win.moduleId === 'content' && (
            <ContentModulePanel
              contentDraft={contentDraft}
              isBusy={isBusy}
              isSiteActive={isSiteActive}
              isContentLoaded={isContentLoaded}
              isContentDraftValid={isContentDraftValid}
              setContentDraft={setContentDraft}
              createWorkExperienceDraft={createWorkExperienceDraft}
              createHardSkillDraft={createHardSkillDraft}
              submitContent={submitContent}
            />
          )}

          {win.moduleId === 'system' && (
            <SystemModulePanel
              siteId={site?.id}
              csrfToken={csrfToken}
              showToast={(msg, type) => (type === 'error' ? showError(msg) : showSuccess(msg))}
              systemDraft={systemDraft}
              isBusy={isBusy}
              isSiteActive={isSiteActive}
              canEditSystem={canEditSystem}
              isSystemLoaded={isSystemLoaded}
              setSystemDraft={setSystemDraft}
              submitSystem={submitSystem}
            />
          )}

          {win.moduleId === 'communication' && (
            <TestimonialsModulePanel
              site={site}
              testimonials={testimonials}
              testimonialDraft={testimonialDraft}
              isTestimonialEditorOpen={isTestimonialEditorOpen}
              isBusy={isBusy}
              isSiteActive={isSiteActive}
              canUseTestimonials={canUseTestimonials}
              testimonialLimit={testimonialLimit}
              isTestimonialLimitReached={isTestimonialLimitReached}
              isTestimonialDraftValid={isTestimonialDraftValid}
              setTestimonialDraft={setTestimonialDraft}
              startCreateTestimonial={startCreateTestimonial}
              startEditTestimonial={startEditTestimonial}
              closeTestimonialEditor={closeTestimonialEditor}
              submitTestimonial={submitTestimonial}
              deleteTestimonial={deleteTestimonial}
            />
          )}

          {win.moduleId === 'analytics' && site && (
            <AnalyticsModulePanel siteId={site.id} />
          )}
        </ClientWindowFrame>
      ))}

      {/* ── Bottom Taskbar ────────────────────────────────── */}
      {openWindows.length > 0 && (
        <div className="admin-taskbar">
          <div className="admin-taskbar-inner">
            {openWindows.map((win) => {
              const Icon = win.icon;
              return (
                <button
                  key={win.id}
                  type="button"
                  className={`admin-taskbar-item ${win.isMinimized ? 'admin-taskbar-item-minimized' : ''}`}
                  onClick={() => bringToFront(win.id)}
                >
                  <Icon className={`h-4 w-4 ${win.iconColor}`} />
                  <span className="admin-taskbar-item-label">{win.title}</span>
                  <span className="admin-taskbar-dot" />
                </button>
              );
            })}
          </div>
        </div>
      )}
      {/* ── Onboarding Wizard Modal ──────────────────────── */}
      {site && (
        <ClientOnboardingWizard
          isOpen={showOnboardingWizard}
          onClose={() => {
            setShowOnboardingWizard(false);
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('onboarding_dismissed', 'true');
            }
          }}
          onComplete={() => {
            setShowOnboardingWizard(false);
            void loadDashboard();
          }}
          site={site}
          csrfToken={csrfToken}
          showToast={(msg, type) => (type === 'error' ? showError(msg) : showSuccess(msg))}
        />
      )}
    </div>
  );
}
