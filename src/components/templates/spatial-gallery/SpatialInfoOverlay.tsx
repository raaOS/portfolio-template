'use client';

// ═══════════════════════════════════════════════════════════════════
// SpatialInfoOverlay — konten inti CRUD untuk template Spatial Gallery.
// Parity dengan demo macOS (2026-11-15, keputusan owner): tab bar mini
// kanan-atas membuka panel slide-over gelap dari kanan berisi About,
// Kontak (chat macOS FullPageChat), Testimoni, Skills, dan CV.
// Overlay DOM murni — TIDAK menyentuh mesin 3D SpatialScene.
// ═══════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import {
  X,
  User,
  Mail,
  MessageSquare,
  Brain,
  FileText,
  Star,
  Phone,
  MapPin,
  Copy,
  Check,
  Cpu,
  Sparkles,
  Briefcase,
  Languages,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitch from '@/components/shared/LanguageSwitch';
import FullPageChat from '@/components/chat/FullPageChat';
import { localizeText } from '@/lib/i18n/contentLocalization';
import type { PortfolioTemplateData } from '@/types/template';
import type { SoftSkillItem } from '@/types/about';

export type SpatialInfoPanelType = 'about' | 'contact' | 'testimonials' | 'skills' | 'cv';

interface SpatialInfoOverlayProps {
  data?: PortfolioTemplateData;
}

const PANEL_ICONS: Record<SpatialInfoPanelType, React.ReactNode> = {
  about: <User className="h-4 w-4" />,
  contact: <Mail className="h-4 w-4" />,
  testimonials: <MessageSquare className="h-4 w-4" />,
  skills: <Brain className="h-4 w-4" />,
  cv: <FileText className="h-4 w-4" />,
};

export function SpatialInfoOverlay({ data }: SpatialInfoOverlayProps) {
  const { locale } = useLanguage();
  const [activePanel, setActivePanel] = useState<SpatialInfoPanelType | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Hormati lightbox/detail project yang mungkin terbuka di atas overlay
      if (document.querySelector('[class*="z-[100]"]')) return;
      setActivePanel(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const about = data?.about;
  const contact = data?.contact;
  const testimonials = data?.testimonials || [];
  const hardSkills = data?.hardSkills || [];
  const experiences = data?.experiences || [];

  // Normalisasi soft skills (pola InterestsTab macOS): items baru, fallback teks lama.
  const softSkills: SoftSkillItem[] =
    about?.softSkills?.items ||
    about?.softSkills?.texts?.map((text, i) => ({
      text,
      description: about?.softSkills?.descriptions?.[i] || '',
      isDraft: false,
    })) ||
    [];
  const visibleSoftSkills = softSkills.filter((item) => !item.isDraft);

  // Derive profil (pola CanvasLeftDrawer)
  const profileName = data?.site?.title || about?.hero?.title || 'Portfolio';
  const profileRole =
    about?.hero?.title && about.hero.title !== profileName
      ? about.hero.title
      : about?.professional?.motto?.badge || 'Creative Professional';
  const profileBio =
    about?.professional?.bio?.content || about?.professional?.motto?.quote || '';
  const avatarUrl =
    data?.site?.avatarUrl ||
    (about?.hero?.backgroundTrail?.[0]
      ? typeof about.hero.backgroundTrail[0] === 'string'
        ? about.hero.backgroundTrail[0]
        : about.hero.backgroundTrail[0].src
      : undefined);
  const isAvailable = about?.hero?.availability?.status !== 'booked';
  const availabilityText =
    about?.hero?.availability?.text ||
    (isAvailable
      ? locale === 'en'
        ? 'Available for new projects'
        : 'Tersedia untuk proyek baru'
      : locale === 'en'
        ? 'Currently booked'
        : 'Sedang booked');

  const email = contact?.info?.email || '';
  const phone = contact?.info?.phone || '';
  const address = contact?.info?.address || '';

  // Mapping kontak untuk chat macOS (pola ContactWindow OS) — pesan visitor
  // dikirim via /api/chat/send dan masuk sistem chat admin.
  const chatContactInfo = {
    email: contact?.info?.email,
    socialMedia: contact?.info?.socialMedia,
    headline: localizeText(contact?.content?.headline, locale),
    subtext: localizeText(contact?.content?.subtext, locale),
  };

  const panelLabels: Record<SpatialInfoPanelType, { title: string; subtitle: string }> = {
    about: {
      title: locale === 'en' ? 'About Me' : 'Tentang Saya',
      subtitle:
        locale === 'en' ? 'Profile & short biography' : 'Profil & biografi singkat',
    },
    contact: {
      title: locale === 'en' ? 'Contact Me' : 'Hubungi Saya',
      subtitle:
        locale === 'en' ? 'Info, socials & direct chat' : 'Info, media sosial & chat langsung',
    },
    testimonials: {
      title: locale === 'en' ? 'Testimonials' : 'Testimoni',
      subtitle: locale === 'en' ? 'What clients say' : 'Apa kata klien',
    },
    skills: {
      title: locale === 'en' ? 'Skills' : 'Keahlian',
      subtitle:
        locale === 'en' ? 'Technical & interpersonal' : 'Teknis & interpersonal',
    },
    cv: {
      title: locale === 'en' ? 'Curriculum Vitae' : 'Riwayat Karir',
      subtitle: locale === 'en' ? 'Work experience history' : 'Riwayat pengalaman kerja',
    },
  };

  const copyEmail = () => {
    if (navigator.clipboard && email) {
      navigator.clipboard.writeText(email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  return (
    <>
      {/* Tab bar mini kanan-atas (floating) */}
      <nav
        data-testid="spatial-info-tabbar"
        aria-label={locale === 'en' ? 'Portfolio information menu' : 'Menu informasi portofolio'}
        className="fixed top-4 right-4 z-40 flex items-center gap-1 rounded-full border border-white/15 bg-neutral-900/80 p-1.5 backdrop-blur-md select-none"
      >
        {(Object.keys(PANEL_ICONS) as SpatialInfoPanelType[]).map((panel) => (
          <button
            key={panel}
            type="button"
            onClick={() => setActivePanel((prev) => (prev === panel ? null : panel))}
            aria-label={panelLabels[panel].title}
            aria-pressed={activePanel === panel}
            title={panelLabels[panel].title}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors cursor-pointer ${
              activePanel === panel
                ? 'bg-white/20 text-white'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            {PANEL_ICONS[panel]}
          </button>
        ))}
        <div className="mx-1 h-5 w-px bg-white/15" aria-hidden="true" />
        <div className="flex items-center gap-1.5 pr-1 pl-0.5 text-white/70">
          <Languages className="h-3.5 w-3.5" />
          <LanguageSwitch />
        </div>
      </nav>

      {/* Panel slide-over gelap dari kanan (pola CanvasProjectSlideOver) */}
      <AnimatePresence>
        {activePanel && (
          <>
            <motion.div
              key="spatial-info-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setActivePanel(null)}
              className="fixed inset-0 z-40 bg-black/45 backdrop-blur-xs cursor-pointer"
              aria-hidden="true"
            />
            <motion.aside
              key="spatial-info-panel"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed top-0 right-0 bottom-0 z-50 flex w-full max-w-md sm:max-w-lg flex-col border-l border-white/10 bg-neutral-950/95 text-neutral-100 backdrop-blur-2xl select-text"
              role="dialog"
              aria-modal="true"
              aria-label={panelLabels[activePanel].title}
            >
              {/* Header jendela */}
              <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-white/5 px-4 py-3 backdrop-blur-md select-none">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white/80">{PANEL_ICONS[activePanel]}</span>
                    <span className="truncate text-xs font-semibold">
                      {panelLabels[activePanel].title}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] font-mono text-white/40">
                    {panelLabels[activePanel].subtitle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActivePanel(null)}
                  aria-label={locale === 'en' ? 'Close panel' : 'Tutup panel'}
                  className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Isi panel */}
              <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
                {/* ── ABOUT ── */}
                {activePanel === 'about' && (
                  <div className="space-y-5">
                    <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                      {avatarUrl ? (
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/15">
                          <img
                            src={avatarUrl}
                            alt={profileName}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl font-bold text-neutral-950">
                          {profileName.charAt(0) || 'P'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-2.5 py-0.5 text-[10px] text-white/80">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${isAvailable ? 'animate-pulse bg-emerald-400' : 'bg-amber-400'}`}
                          />
                          <span className="font-mono font-medium">{availabilityText}</span>
                        </div>
                        <h2 className="truncate text-lg font-bold tracking-tight">{profileName}</h2>
                        <p className="font-mono text-xs text-white/50">{profileRole}</p>
                      </div>
                    </div>

                    {profileBio && (
                      <div className="space-y-1.5">
                        <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-white/40">
                          {locale === 'en' ? 'About Me' : 'Tentang Saya'}
                        </h3>
                        <p className="whitespace-pre-line rounded-xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-neutral-200">
                          {profileBio}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── CONTACT ── */}
                {activePanel === 'contact' && (
                  <div className="space-y-5">
                    {(email || phone || address) && (
                      <div className="space-y-2.5">
                        {email && (
                          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="shrink-0 rounded-lg border border-white/15 bg-black/40 p-2 text-white/80">
                                <Mail className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <span className="block font-mono text-[10px] uppercase text-white/40">
                                  Email
                                </span>
                                <a
                                  href={`mailto:${email}`}
                                  className="block truncate text-xs font-semibold hover:underline"
                                >
                                  {email}
                                </a>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={copyEmail}
                              className="rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
                              title={locale === 'en' ? 'Copy email' : 'Salin Email'}
                            >
                              {copiedEmail ? (
                                <Check className="h-4 w-4 text-emerald-400" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        )}
                        {phone && (
                          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                            <div className="shrink-0 rounded-lg border border-white/15 bg-black/40 p-2 text-white/80">
                              <Phone className="h-4 w-4" />
                            </div>
                            <div>
                              <span className="block font-mono text-[10px] uppercase text-white/40">
                                {locale === 'en' ? 'Phone / WhatsApp' : 'Telepon / WhatsApp'}
                              </span>
                              <a href={`tel:${phone}`} className="text-xs font-semibold hover:underline">
                                {phone}
                              </a>
                            </div>
                          </div>
                        )}
                        {address && (
                          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                            <div className="shrink-0 rounded-lg border border-white/15 bg-black/40 p-2 text-white/80">
                              <MapPin className="h-4 w-4" />
                            </div>
                            <div>
                              <span className="block font-mono text-[10px] uppercase text-white/40">
                                {locale === 'en' ? 'Location' : 'Lokasi'}
                              </span>
                              <span className="text-xs font-semibold">{address}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {contact?.info?.socialMedia && (
                      <div className="space-y-2">
                        <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-white/40">
                          {locale === 'en' ? 'Social Media' : 'Media Sosial'}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(contact.info.socialMedia)
                            .filter(([, url]) => Boolean(url))
                            .map(([platform, url]) => (
                              <a
                                key={platform}
                                href={typeof url === 'string' && url.startsWith('http') ? url : `https://${url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 font-mono text-xs capitalize text-white/80 transition-colors hover:bg-white/20"
                              >
                                {platform} ↗
                              </a>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Chat macOS — jalur pesan visitor sama dengan demo macOS */}
                    <div className="space-y-3 border-t border-white/10 pt-4">
                      <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-white/40">
                        {locale === 'en' ? 'Send a Message' : 'Kirim Pesan Langsung'}
                      </h4>
                      <div
                        data-testid="spatial-info-chat"
                        className="h-[380px] overflow-hidden rounded-xl border border-white/15"
                      >
                        <FullPageChat embedded contactInfo={chatContactInfo} />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── TESTIMONIALS ── */}
                {activePanel === 'testimonials' && (
                  <div className="space-y-3">
                    {testimonials.length > 0 ? (
                      testimonials.map((t) => (
                        <div
                          key={t.id}
                          className="space-y-1.5 rounded-xl border border-white/10 bg-white/5 p-4"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">{t.name}</span>
                            {t.company && (
                              <span className="font-mono text-[10px] text-white/40">{t.company}</span>
                            )}
                          </div>
                          <p className="text-xs italic leading-relaxed text-neutral-300">
                            &ldquo;{t.content || t.notificationText}&rdquo;
                          </p>
                        </div>
                      ))
                    ) : (
                      <Star className="mx-auto h-6 w-6 text-white/20" />
                    )}
                  </div>
                )}

                {/* ── SKILLS ── */}
                {activePanel === 'skills' && (
                  <div className="space-y-5">
                    {hardSkills.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Cpu className="h-4 w-4 text-white/70" />
                          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white/70">
                            {locale === 'en' ? 'Technical Stack' : 'Keahlian Teknis'} ({hardSkills.length})
                          </h3>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {hardSkills.map((skill) => (
                            <div
                              key={skill.id}
                              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2"
                            >
                              {skill.iconUrl ? (
                                <img
                                  src={skill.iconUrl}
                                  alt={skill.name}
                                  className="h-5 w-5 shrink-0 rounded object-contain"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white/15 text-[9px] font-bold">
                                  {skill.name.charAt(0)}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-medium">{skill.name}</span>
                                {skill.level && (
                                  <span className="block font-mono text-[9px] text-white/40">
                                    {skill.level}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {visibleSoftSkills.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-white/70" />
                          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white/70">
                            {locale === 'en' ? 'Interpersonal Skills' : 'Keahlian Interpersonal'} (
                            {visibleSoftSkills.length})
                          </h3>
                        </div>
                        <div className="space-y-2">
                          {visibleSoftSkills.map((item, idx) => (
                            <div
                              key={idx}
                              className="space-y-1 rounded-xl border border-white/10 bg-white/5 p-3"
                            >
                              <span className="block text-xs font-bold">
                                {localizeText(item.text, locale)}
                              </span>
                              {item.description && (
                                <p className="whitespace-pre-line text-xs leading-relaxed text-neutral-400">
                                  {localizeText(item.description, locale)}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {hardSkills.length === 0 && visibleSoftSkills.length === 0 && (
                      <p className="text-xs italic text-white/30">
                        {locale === 'en' ? 'No skills to display.' : 'Belum ada keahlian ditampilkan.'}
                      </p>
                    )}
                  </div>
                )}

                {/* ── CV ── */}
                {activePanel === 'cv' && (
                  <div className="space-y-3">
                    {experiences.length > 0 ? (
                      experiences.map((exp, idx) => (
                        <div
                          key={exp.id || idx}
                          className="relative space-y-1 border-l-2 border-white/15 pl-4"
                        >
                          <span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-white ring-4 ring-neutral-950" />
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">{exp.position}</span>
                            <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/60">
                              {exp.year}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-white/60">{exp.company}</p>
                          {exp.description && exp.description.length > 0 && (
                            <p className="text-xs leading-relaxed text-neutral-400">
                              {Array.isArray(exp.description) ? exp.description.join(' ') : exp.description}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center gap-2 text-white/30">
                        <Briefcase className="h-4 w-4" />
                        <p className="text-xs italic">
                          {locale === 'en' ? 'No experience data found.' : 'Belum ada data pengalaman.'}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default SpatialInfoOverlay;
