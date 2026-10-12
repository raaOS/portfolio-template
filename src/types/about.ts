export interface TrailItem {
  src: string;
  isActive: boolean;
  slug?: string; // Optional slug for navigation
}

export interface AboutHero {
  title: string;
  title_id?: string;
  backgroundTrail: (string | TrailItem)[];
  backgroundColor?: string;
  textColor?: string;
  ballColor?: string;
  capColor?: string;
  availability?: {
    status: 'available' | 'booked' | 'limited';
    text: string; // e.g. "Available for new projects"
    text_id?: string; // e.g. "Tersedia untuk proyek baru"
  };
}

export interface AboutMotto {
  badge: string;
  badge_id?: string;
  quote: string;
  quote_id?: string;
}

export interface AboutBio {
  content: string;
  content_id?: string;
}

export interface AboutContacts {
  email: string;
  whatsapp: string;
  linkedin: string;
}

export interface AboutProfessional {
  contacts?: AboutContacts;
  motto: AboutMotto;
  bio: AboutBio;
}

export interface AboutSoftSkill {
  text: string;
  text_id?: string;
  description: string;
  description_id?: string;
}

export interface SoftSkillItem {
  text: string;
  description: string;
  isDraft?: boolean;
}

export interface AboutSoftSkills {
  items?: SoftSkillItem[];
  /** @deprecated Use items array instead */
  texts?: string[];
  /** @deprecated Use items array with text_id instead */
  texts_id?: string[];
  /** @deprecated Use items array with description instead */
  descriptions?: string[];
  /** @deprecated Use items array with description_id instead */
  descriptions_id?: string[];
}

// Workflow types for interactive flowchart (Hapus PhilosophyStep legacy)
export interface WorkflowSubStep {
  id: string;
  title: string;
  description: string;
  status?: 'default' | 'in-progress' | 'completed' | 'pending';
}

export interface WorkflowStep {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  description: string;
  type: 'phase' | 'decision' | 'terminator';
  color: 'amber' | 'blue' | 'purple' | 'rose' | 'emerald';
  icon: string;
  subSteps: WorkflowSubStep[];
  nextSteps: string[];
  loopTargets: string[];
}

export interface DesignPhilosophy {
  heading: string;
  subheading: string;
  workflowSteps: WorkflowStep[];
}

// OS Configuration Types
export interface Wallpaper {
  id: string;
  url: string;
  name?: string;
  type?: 'image' | 'video';
  /**
   * Optional poster image URL for video wallpapers. Generated server-side by
   * the upload pipeline (`/api/upload`) so the admin grid and skeleton screens
   * have an instant thumbnail without having to decode the MP4.
   */
  posterUrl?: string;
  startTime?: number; // Optional custom start time in seconds
}

export interface WallpaperConfig {
  activeWallpaperId: string;
  collection: Wallpaper[];
  blur?: number; // 0-20px
}

export type DesktopIconSize = 'small' | 'medium' | 'large';

export interface DesktopIconPosition {
  // Legacy pixel values — kept for backward compatibility with existing saves.
  x: number;
  y: number;
  zIndex?: number;
  size?: DesktopIconSize;
  // Percentage-based (responsive). Optional supaya data lama tetap valid;
  // kalau ada, lebih diprioritaskan daripada pixel legacy saat render.
  xPct?: number;
  yPct?: number;
  // Reference screen dimensions saat admin save — dipakai untuk clamping
  // cerdas dan fallback proporsional bila data legacy (pixel only).
  refScreenWidth?: number;
  refScreenHeight?: number;
}

export interface DesktopPreferences {
  visibleProjectIds: string[];
  maxIcons: number;
  layout: 'grid' | 'scattered';
  iconPositions?: Record<string, DesktopIconPosition>; // Saved positions
}

export interface DockItemConfig {
  label?: string;
  iconUrl?: string;
  isHidden?: boolean;
  order?: number;
}

export interface DockPreferences {
  [key: string]: DockItemConfig;
}

export interface WindowPreference {
  // Legacy pixel-based (keep for fallback)
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  zIndex?: number;
  // Percentage-based for responsive positioning
  xPct?: number;
  yPct?: number;
  widthPct?: number;
  heightPct?: number;
  // Reference screen dimensions (when admin saved)
  refScreenWidth?: number;
  refScreenHeight?: number;
  isOpenByDefault?: boolean;
}

export interface WindowPreferences {
  [key: string]: WindowPreference;
}

export interface SoundSetting {
  path: string;
  volume: number;
}

export interface SoundConfig {
  [key: string]: SoundSetting;
}

export type LoaderStyle = 'deck-reveal' | 'hello';

export interface LoaderConfig {
  enabled: boolean;
  /** Gaya loader — enum supaya nanti bisa tambah gaya lain tanpa breaking change. */
  style: LoaderStyle;
  /**
   * ID project yang cover-nya dipakai sebagai layer gambar loader (maks 10).
   * Hanya dipakai gaya `deck-reveal`; diabaikan untuk `hello`.
   */
  imageProjectIds: string[];
  /** Total durasi animasi dalam ms (hanya gaya `deck-reveal`). */
  durationMs?: number;
  /** Warna placeholder layer (hex) (hanya gaya `deck-reveal`). */
  accentColor?: string;
  /** Tampilkan counter [0]→[100] (hanya gaya `deck-reveal`). */
  showCounter?: boolean;
}

export interface AboutData {
  hero: AboutHero;
  professional: AboutProfessional;
  softSkills: AboutSoftSkills;
  designPhilosophy?: DesignPhilosophy;

  // OS & Template Configuration
  desktopPreferences?: DesktopPreferences;
  wallpaperConfig?: WallpaperConfig;
  dockConfig?: DockPreferences;
  windowPreferences?: WindowPreferences;
  islandNotifications?: AboutIslandNotification[];
  soundConfig?: SoundConfig;
  spatialGalleryConfig?: SpatialGalleryConfig;
  loaderConfig?: LoaderConfig;

  labels?: {
    experienceTitle?: string;
    experienceSubtitle?: string;
    freelanceTitle?: string;
    workExperienceTitle?: string;
    portfolioPreviewTitle?: string;
  };
  lastUpdated: string;
}

export interface SpatialGalleryConfig {
  centerModelUrl?: string; // e.g. '/models/helmet.glb' or R2 URL
  centerModelName?: string;
  materialStyle?: 'glass' | 'original'; // 'glass' (crystal) or 'original'
  modelScale?: number; // scale multiplier: 0.5 to 2.0 (default: 1.0)
}

export interface UpdateAboutData {
  hero?: Partial<AboutHero>;
  professional?: Partial<AboutProfessional>;
  softSkills?: Partial<AboutSoftSkills>;
  designPhilosophy?: Partial<DesignPhilosophy>;

  // OS & Template Configuration
  desktopPreferences?: Partial<DesktopPreferences>;
  wallpaperConfig?: WallpaperConfig;
  dockConfig?: DockPreferences;
  windowPreferences?: WindowPreferences;
  islandNotifications?: AboutIslandNotification[];
  soundConfig?: SoundConfig;
  spatialGalleryConfig?: SpatialGalleryConfig;
  loaderConfig?: LoaderConfig;

  labels?: Partial<AboutData['labels']>;
}

export interface ChatMessage {
  id: number;
  text: string;
  isMe: boolean;
  time: string;
  status: 'sent' | 'read';
}

export interface AboutIslandNotification {
  id: string;
  name: string;
  message: string;
  avatar: string;
  isActive: boolean;
  conversation: ChatMessage[];
  status: string;
}

export interface ContactProfile {
  id: string;
  name: string;
  avatar: string;
  status: string;
  conversation: ChatMessage[];
}
