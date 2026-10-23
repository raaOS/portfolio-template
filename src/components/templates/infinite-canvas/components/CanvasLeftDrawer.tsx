'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  User,
  MessageCircle,
  Mail,
  StickyNote,
  Phone,
  MapPin,
  Send,
  Star,
  Cpu,
  Briefcase,
  Copy,
  Check,
  Plus,
  Minus,
  Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { AboutData } from '@/types/about';
import type { HardSkill } from '@/types/hardSkill';
import type { WorkExperience } from '@/types/experience';
import type { ContactData } from '@/types/contact';
import type { Testimonial } from '@/types/testimonial';
import type { SiteProfileHeader } from '@/types/template';
import { buildWhatsAppLink } from '@/utils/whatsappLink';

export type CanvasLeftPanelType = 'about' | 'wa' | 'contact' | 'notes';

interface CanvasLeftDrawerProps {
  activePanel: CanvasLeftPanelType | null;
  onClose: () => void;
  about?: AboutData;
  hardSkills?: HardSkill[];
  experiences?: WorkExperience[];
  contact?: ContactData;
  testimonials?: Testimonial[];
  site?: SiteProfileHeader;
}

interface QuickNote {
  id: string;
  text: string;
  date: string;
  color: string;
}

const NOTE_COLORS = [
  'bg-amber-100 border-amber-300 text-amber-950',
  'bg-yellow-100 border-yellow-300 text-yellow-950',
  'bg-blue-100 border-blue-300 text-blue-950',
  'bg-emerald-100 border-emerald-300 text-emerald-950',
];

export function CanvasLeftDrawer({
  activePanel,
  onClose,
  about,
  hardSkills,
  experiences,
  contact,
  testimonials,
  site,
}: CanvasLeftDrawerProps) {
  const { locale } = useLanguage();
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSent, setContactSent] = useState(false);

  // Local Sticky Notes state with localStorage persistence
  const [notes, setNotes] = useState<QuickNote[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('canvas_left_notes');
        if (saved) return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return [
      {
        id: '1',
        text: 'Halo! Selamat datang di Portfolio Infinite Canvas.\n\nJelajahi 10 karya terpilih di kanvas dengan drag dan scroll zoom. Klik salah satu karya untuk melihat detail proyek.',
        date: 'Baru Saja',
        color: NOTE_COLORS[0],
      },
      {
        id: '2',
        text: 'Quick Tip:\nBuka panel About Me untuk melihat profil lengkap, skill, dan pengalaman kerja. Gunakan WA untuk komunikasi langsung!',
        date: 'Kemarin',
        color: NOTE_COLORS[2],
      },
    ];
  });

  const [newNoteText, setNewNoteText] = useState('');

  // Persist notes
  useEffect(() => {
    try {
      localStorage.setItem('canvas_left_notes', JSON.stringify(notes));
    } catch {
      // ignore
    }
  }, [notes]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleAddNote = () => {
    if (!newNoteText.trim()) return;
    const randomColor = NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)];
    const newNote: QuickNote = {
      id: Date.now().toString(),
      text: newNoteText.trim(),
      date: 'Baru Saja',
      color: randomColor,
    };
    setNotes((prev) => [newNote, ...prev]);
    setNewNoteText('');
  };

  const handleDeleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  // Derive profile display info
  const profileName = site?.title || about?.hero?.title || 'Portfolio';
  const profileRole =
    about?.hero?.title && about.hero.title !== profileName
      ? about.hero.title
      : about?.professional?.motto?.badge || 'Creative Professional';
  const profileBio =
    about?.professional?.bio?.content ||
    about?.professional?.motto?.quote ||
    'Selamat datang di portofolio interaktif saya.';
  const avatarUrl =
    site?.avatarUrl ||
    (about?.hero?.backgroundTrail?.[0]
      ? typeof about.hero.backgroundTrail[0] === 'string'
        ? about.hero.backgroundTrail[0]
        : about.hero.backgroundTrail[0].src
      : undefined);
  const isAvailable = about?.hero?.availability?.status !== 'booked';
  const availabilityText =
    about?.hero?.availability?.text || (isAvailable ? 'Available for new projects' : 'Currently booked');

  // Contact info
  const email = contact?.info?.email || 'contact@example.com';
  const phone = contact?.info?.phone || '';
  const address = contact?.info?.address || '';
  const waUrl = buildWhatsAppLink(
    contact?.info?.socialMedia?.whatsapp || phone,
    'Halo! Saya tertarik dengan karya di portofolio Anda dan ingin berdiskusi lebih lanjut.'
  ) || '#';

  const copyEmail = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactMessage.trim()) return;
    const mailto = `mailto:${email}?subject=${encodeURIComponent(
      contactSubject || 'Inquiry dari Portfolio'
    )}&body=${encodeURIComponent(contactMessage)}`;
    window.open(mailto, '_blank');
    setContactSent(true);
    setTimeout(() => setContactSent(false), 4000);
  };

  // Title per panel
  const panelTitles: Record<CanvasLeftPanelType, { title: string; subtitle: string; icon: React.ReactNode }> = {
    about: {
      title: 'About Me',
      subtitle: locale === 'en' ? 'Profile, Skills & Career History' : 'Profil, Keahlian & Riwayat Karir',
      icon: <User className="w-4 h-4 text-neutral-800 dark:text-neutral-200" />,
    },
    wa: {
      title: locale === 'en' ? 'WhatsApp & Testimonials' : 'WhatsApp & Testimoni',
      subtitle: locale === 'en' ? 'Direct Connection & Fast Response' : 'Koneksi Langsung & Respon Cepat',
      icon: <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
    },
    contact: {
      title: locale === 'en' ? 'Contact Me' : 'Hubungi Saya',
      subtitle: locale === 'en' ? 'Direct Inquiries, Socials & Messaging' : 'Kontak, Media Sosial & Pesan Langsung',
      icon: <Mail className="w-4 h-4 text-sky-600 dark:text-sky-400" />,
    },
    notes: {
      title: locale === 'en' ? 'Notes & Memos' : 'Noted & Catatan',
      subtitle: locale === 'en' ? 'Interactive Visitor Sticky Notes' : 'Memo Interaktif Pengunjung',
      icon: <StickyNote className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
    },
  };

  return (
    <AnimatePresence>
      {activePanel && (
        <>
          {/* Backdrop Blur Overlay */}
          <motion.div
            key="left-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs cursor-pointer"
            aria-hidden="true"
          />

          {/* Left Slide Drawer */}
          <motion.div
            key="left-drawer-panel"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed top-0 left-0 bottom-0 z-50 w-full max-w-md sm:max-w-lg bg-white/95 dark:bg-neutral-900/95 backdrop-blur-2xl border-r border-neutral-200 dark:border-neutral-800 flex flex-col select-text"
          >
            {/* macOS Window Title Bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-black/10 dark:border-white/10 bg-gray-100/90 dark:bg-neutral-800/90 backdrop-blur-md select-none shrink-0">
              {/* macOS Window Title Bar */}
              <div className="group/traffic flex items-center gap-[7px] shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Tutup panel"
                  style={{ width: 12, height: 12, minWidth: 12, minHeight: 12, maxWidth: 12, maxHeight: 12 }}
                  className="relative p-0 m-0 border-0 rounded-full bg-[#FF5F57] hover:brightness-95 active:brightness-90 flex items-center justify-center cursor-pointer outline-none ring-1 ring-black/15 shrink-0"
                >
                  <X className="w-2 h-2 text-black/60 opacity-0 group-hover/traffic:opacity-100 transition-opacity stroke-[3]" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Tutup panel"
                  style={{ width: 12, height: 12, minWidth: 12, minHeight: 12, maxWidth: 12, maxHeight: 12 }}
                  className="relative p-0 m-0 border-0 rounded-full bg-[#FEBC2E] hover:brightness-95 active:brightness-90 flex items-center justify-center cursor-pointer outline-none ring-1 ring-black/15 shrink-0"
                >
                  <Minus className="w-2 h-2 text-black/60 opacity-0 group-hover/traffic:opacity-100 transition-opacity stroke-[3]" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Tutup panel"
                  style={{ width: 12, height: 12, minWidth: 12, minHeight: 12, maxWidth: 12, maxHeight: 12 }}
                  className="relative p-0 m-0 border-0 rounded-full bg-[#28C840] hover:brightness-95 active:brightness-90 flex items-center justify-center cursor-pointer outline-none ring-1 ring-black/15 shrink-0"
                >
                  <Plus className="w-2 h-2 text-black/60 opacity-0 group-hover/traffic:opacity-100 transition-opacity stroke-[3]" />
                </button>
                <div className="ml-2.5 flex items-center gap-2">
                  {panelTitles[activePanel].icon}
                  <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    {panelTitles[activePanel].title}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                title="Tutup (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Panel Content Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {/* 1. ABOUT ME PANEL */}
              {activePanel === 'about' && (
                <div className="space-y-6">
                  {/* Profile Card */}
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60">
                    {avatarUrl ? (
                      <div className="relative w-20 h-20 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-700 shrink-0">
                        <img
                          src={avatarUrl}
                          alt={profileName}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center text-2xl font-bold shrink-0">
                        {profileName.charAt(0) || 'P'}
                      </div>
                    )}

                    <div className="flex-1 text-center sm:text-left space-y-1">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-[10px] text-neutral-700 dark:text-neutral-300 mb-1">
                        <span className={`h-1.5 w-1.5 rounded-full ${isAvailable ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                        <span className="font-mono font-medium">{availabilityText}</span>
                      </div>
                      <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">{profileName}</h2>
                      <p className="text-xs font-mono text-neutral-500 dark:text-neutral-400">{profileRole}</p>
                    </div>
                  </div>

                  {/* Bio */}
                  {profileBio && (
                    <div className="space-y-1.5">
                      <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-400 dark:text-neutral-500 font-semibold">
                        {locale === 'en' ? 'About Me' : 'Tentang Saya'}
                      </h3>
                      <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-line bg-white dark:bg-neutral-900/60 p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800">
                        {profileBio}
                      </p>
                    </div>
                  )}

                  {/* Hard Skills Matrix */}
                  {hardSkills && hardSkills.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
                        <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-700 dark:text-neutral-300 font-bold">
                          {locale === 'en' ? 'Skills & Technology' : 'Keahlian & Teknologi'} ({hardSkills.length})
                        </h3>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {hardSkills.map((skill) => (
                          <div
                            key={skill.id}
                            className="flex items-center gap-2 p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/70 dark:border-neutral-700/60"
                          >
                            {skill.iconUrl ? (
                              <img
                                src={skill.iconUrl}
                                alt={skill.name}
                                className="w-5 h-5 object-contain rounded shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-5 h-5 rounded bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[9px] font-bold text-neutral-800 dark:text-neutral-200 shrink-0">
                                {skill.name.charAt(0)}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <span className="text-neutral-900 dark:text-white text-xs font-medium block truncate">
                                {skill.name}
                              </span>
                              {skill.level && (
                                <span className="text-[9px] font-mono text-neutral-500 dark:text-neutral-400 block">
                                  {skill.level}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Career Experience */}
                  {experiences && experiences.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
                        <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-700 dark:text-neutral-300 font-bold">
                          {locale === 'en' ? 'Work Experience' : 'Pengalaman Kerja'} ({experiences.length})
                        </h3>
                      </div>
                      <div className="space-y-3 pl-2">
                        {experiences.map((exp, idx) => (
                          <div
                            key={exp.id || idx}
                            className="relative pl-4 border-l-2 border-neutral-200 dark:border-neutral-700 space-y-1"
                          >
                            <span className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-neutral-900 dark:bg-white ring-4 ring-white dark:ring-neutral-900" />
                            <div className="flex items-center justify-between">
                              <span className="text-neutral-900 dark:text-white text-xs font-bold">{exp.position}</span>
                              <span className="text-[10px] font-mono text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                                {exp.year}
                              </span>
                            </div>
                            <p className="text-neutral-600 dark:text-neutral-400 text-xs font-medium">{exp.company}</p>
                            {exp.description && exp.description.length > 0 && (
                              <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
                                {Array.isArray(exp.description) ? exp.description.join(' ') : exp.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 2. WA (WHATSAPP & TESTIMONIALS) PANEL */}
              {activePanel === 'wa' && (
                <div className="space-y-6">
                  {/* WhatsApp Direct Hero Card */}
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30 dark:border-emerald-500/20 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white">
                        <MessageCircle className="w-5 h-5 fill-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Chat Langsung WhatsApp</h3>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">Respon cepat dalam hitungan jam</p>
                      </div>
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                      Hubungi saya langsung di WhatsApp untuk mendiskusikan penawaran proyek, kolaborasi kreatif, atau sekadar menyapa.
                    </p>
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4 fill-white" />
                      <span>Mulai Obrolan WhatsApp ↗</span>
                    </a>
                  </div>

                  {/* Client Testimonials Section */}
                  {testimonials && testimonials.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-700 dark:text-neutral-300 font-bold">
                          {locale === 'en' ? 'Client Testimonials' : 'Testimoni Klien'} ({testimonials.length})
                        </h3>
                      </div>
                      <div className="space-y-2.5">
                        {testimonials.map((t) => (
                          <div
                            key={t.id}
                            className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/70 dark:border-neutral-700/60 space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-neutral-900 dark:text-white text-xs font-bold">{t.name}</span>
                              {t.company && (
                                <span className="text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
                                  {t.company}
                                </span>
                              )}
                            </div>
                            <p className="text-neutral-600 dark:text-neutral-300 text-xs italic leading-relaxed">
                              &ldquo;{t.content || t.notificationText}&rdquo;
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3. HUBUNGI SAYA (CONTACT) PANEL */}
              {activePanel === 'contact' && (
                <div className="space-y-6">
                  {/* Contact info list */}
                  <div className="space-y-2.5">
                    {email && (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/70 dark:border-neutral-700/60">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-lg bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 text-neutral-700 dark:text-neutral-200 shrink-0">
                            <Mail className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] font-mono uppercase text-neutral-400 block">Email</span>
                            <a
                              href={`mailto:${email}`}
                              className="text-xs font-semibold text-neutral-900 dark:text-white hover:underline truncate block"
                            >
                              {email}
                            </a>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={copyEmail}
                          className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                          title="Salin Email"
                        >
                          {copiedEmail ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    )}

                    {phone && (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/70 dark:border-neutral-700/60">
                        <div className="p-2 rounded-lg bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 text-neutral-700 dark:text-neutral-200 shrink-0">
                          <Phone className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[10px] font-mono uppercase text-neutral-400 block">Telepon / WhatsApp</span>
                          <a
                            href={`tel:${phone}`}
                            className="text-xs font-semibold text-neutral-900 dark:text-white hover:underline"
                          >
                            {phone}
                          </a>
                        </div>
                      </div>
                    )}

                    {address && (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/70 dark:border-neutral-700/60">
                        <div className="p-2 rounded-lg bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 text-neutral-700 dark:text-neutral-200 shrink-0">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[10px] font-mono uppercase text-neutral-400 block">Lokasi</span>
                          <span className="text-xs font-semibold text-neutral-900 dark:text-white">{address}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Social Media Links */}
                  {contact?.info?.socialMedia && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-semibold">
                        Media Sosial & Jejaring
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
                              className="px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 text-xs font-mono text-neutral-700 dark:text-neutral-300 capitalize transition-colors"
                            >
                              {platform} ↗
                            </a>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Message Form */}
                  <form onSubmit={handleSendMessage} className="space-y-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-semibold">
                      Kirim Pesan Cepat
                    </h4>
                    <input
                      type="text"
                      placeholder="Subjek / Keperluan"
                      value={contactSubject}
                      onChange={(e) => setContactSubject(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                    />
                    <textarea
                      placeholder="Tuliskan pesan atau ide kolaborasi Anda di sini..."
                      rows={4}
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white resize-none"
                    />
                    <button
                      type="submit"
                      className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold text-xs hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Kirim via Email</span>
                    </button>
                    {contactSent && (
                      <p className="text-xs text-center text-emerald-600 dark:text-emerald-400 font-medium">
                        Klien email Anda telah terbuka!
                      </p>
                    )}
                  </form>
                </div>
              )}

              {/* 4. NOTED (STICKY NOTES) PANEL */}
              {activePanel === 'notes' && (
                <div className="space-y-5">
                  {/* Add New Note input */}
                  <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 space-y-2.5">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-semibold">
                      Tambah Catatan Cepat
                    </h4>
                    <textarea
                      placeholder="Tulis memo atau catatan pengingat di sini..."
                      rows={3}
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white resize-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddNote}
                      disabled={!newNoteText.trim()}
                      className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Simpan Catatan</span>
                    </button>
                  </div>

                  {/* Notes Grid */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-semibold">
                      Daftar Memo ({notes.length})
                    </h4>
                    {notes.map((note) => (
                      <div
                        key={note.id}
                        className={`relative p-4 rounded-xl border transition-transform hover:-translate-y-0.5 ${note.color}`}
                      >
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-black/10">
                          <span className="text-[10px] font-mono opacity-60 uppercase font-semibold">{note.date}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteNote(note.id)}
                            className="p-1 rounded text-black/40 hover:text-black/80 hover:bg-black/5 transition-colors cursor-pointer"
                            title="Hapus Catatan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-xs whitespace-pre-wrap leading-relaxed font-sans">{note.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
