'use client';

import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  FolderPlus,
  Layout,
  Loader2,
  Rocket,
  Sparkles,
  User,
  Wand2,
  X,
} from 'lucide-react';
import type { ClientSiteSummary } from '../ClientSelfServiceDashboard';

interface ClientOnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  site: ClientSiteSummary;
  csrfToken?: string;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export function ClientOnboardingWizard({
  isOpen,
  onClose,
  onComplete,
  site,
  csrfToken,
  showToast,
}: ClientOnboardingWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMagicLoading, setIsMagicLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Step 1 State: Profile
  const [profileData, setProfileData] = useState({
    heroTitle: site.name || 'Portofolio Profesional',
    heroSubtitle: 'Fullstack Developer & UI/UX Designer',
    shortBio: 'Selamat datang! Saya seorang profesional yang berdedikasi membangun produk digital modern, cepat, dan estetik.',
    email: '',
    github: '',
  });

  // Step 2 State: First Project
  const [projectData, setProjectData] = useState({
    title: '',
    client: 'Client Project',
    year: new Date().getFullYear().toString(),
    tags: 'React, Next.js, Tailwind',
    description: '',
    cover: '/assets/projects/cover-placeholder.webp',
  });

  // Step 3 State: Template Selection
  const [selectedTemplate, setSelectedTemplate] = useState<'os-desktop'>('os-desktop');

  if (!isOpen) return null;


  const publicSiteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/${site.slug}`
    : `/${site.slug}`;

  // Magic AI Auto-Fill Handler
  const handleMagicAiFill = async () => {
    setIsMagicLoading(true);
    try {
      const res = await fetch('/api/admin/projects/magic-complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({
          projectTitle: projectData.title || 'Platform E-Commerce Modern',
          projectDescription: projectData.description || 'Aplikasi web e-commerce berkecepatan tinggi dengan antarmuka intuitif.',
          tone: 'tech',
          commentCount: 3,
        }),
      });

      if (!res.ok) throw new Error('Gagal menggunakan Magic AI');

      await res.json();
      setProjectData((prev) => ({
        ...prev,
        title: prev.title || 'NextGen E-Commerce Platform',
        client: prev.client || 'Enterprise Retail Client',
        tags: prev.tags || 'Next.js, Cloudflare, TypeScript, Tailwind',
        description:
          prev.description ||
          'Solusi e-commerce generasi terbaru yang dioptimalkan untuk performa tinggi, animasi halus, dan arsitektur serverless edge.',
      }));

      showToast('✨ Data project berhasil terisi otomatis dengan Magic AI!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Magic AI gagal', 'error');
    } finally {
      setIsMagicLoading(false);
    }
  };

  // Step 1 Next
  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileData.heroTitle.trim()) {
      showToast('Judul profil wajib diisi', 'error');
      return;
    }
    setStep(2);
  };

  // Step 2 Next
  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectData.title.trim() || !projectData.description.trim()) {
      showToast('Judul dan deskripsi project wajib diisi', 'error');
      return;
    }
    setStep(3);
  };

  // Final Step 3 & 4 Submit: Save everything to D1
  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      // 1. Save Profile Content
      const contentRes = await fetch('/api/client/content', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({
          profile: {
            heroTitle: profileData.heroTitle,
            heroSubtitle: profileData.heroSubtitle,
            shortBio: profileData.shortBio,
            statusBadge: 'Tersedia untuk project baru',
            badgeLinkText: 'Diskusi Project',
            badgeLinkUrl: '#contact',
            contactEmail: profileData.email,
            socialGithub: profileData.github,
          },
          workExperience: [],
          hardSkills: [
            { name: 'TypeScript', level: 'Advanced' },
            { name: 'React / Next.js', level: 'Expert' },
            { name: 'Tailwind CSS', level: 'Expert' },
          ],
        }),
      });

      if (!contentRes.ok) {
        throw new Error('Gagal menyimpan profil');
      }

      // 2. Save First Project
      if (projectData.title.trim()) {
        const projectRes = await fetch('/api/projects', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
          },
          body: JSON.stringify({
            title: projectData.title,
            client: projectData.client,
            year: projectData.year,
            tags: projectData.tags,
            description: projectData.description,
            cover: projectData.cover || '/assets/projects/cover-placeholder.webp',
            gallery: [],
            status: 'published',
            siteId: site.id,
          }),
        });

        if (!projectRes.ok) {
          throw new Error('Gagal menambahkan project pertama');
        }
      }

      // 3. Save Active Template Selection
      const templateRes = await fetch('/api/client/template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({
          templateId: selectedTemplate,
        }),
      });

      if (!templateRes.ok) {
        throw new Error('Gagal menyimpan pilihan template');
      }

      setStep(4);
      showToast('🎉 Onboarding selesai! Site Anda siap dipublikasikan.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal memproses onboarding', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = () => {
    void navigator.clipboard.writeText(publicSiteUrl);
    setCopiedLink(true);
    showToast('Link publik berhasil disalin!', 'success');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/20 bg-zinc-900/95 text-white shadow-2xl backdrop-blur-xl">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md">
              <Rocket className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Onboarding 3-Menit</h2>
              <p className="text-xs text-zinc-400">Siapkan portofolio profesional Anda dalam sekejap</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
            title="Lewati Wizard"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="grid grid-cols-4 border-b border-white/10 bg-black/20 text-center text-xs">
          {[
            { num: 1, label: '1. Profil', icon: User },
            { num: 2, label: '2. Project', icon: FolderPlus },
            { num: 3, label: '3. Template', icon: Layout },
            { num: 4, label: '4. Selesai', icon: Sparkles },
          ].map((s) => {
            const IconComponent = s.icon;
            const isActive = step === s.num;
            const isCompleted = step > s.num;
            return (
              <div
                key={s.num}
                className={`flex items-center justify-center gap-1.5 py-2.5 font-medium transition ${
                  isActive
                    ? 'border-b-2 border-indigo-400 bg-white/5 text-indigo-400'
                    : isCompleted
                      ? 'text-emerald-400'
                      : 'text-zinc-500'
                }`}
              >
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <IconComponent className="h-3.5 w-3.5" />
                )}
                <span>{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="p-6">
          {/* STEP 1: Profil Singkat */}
          {step === 1 && (
            <form onSubmit={handleStep1Submit} className="space-y-4">
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-3.5 text-xs text-indigo-200">
                💡 **Langkah 1:** Masukkan nama dan profil singkat yang akan tampil di halaman depan portofolio Anda.
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300">Nama / Judul Portofolio *</label>
                  <input
                    type="text"
                    required
                    value={profileData.heroTitle}
                    onChange={(e) => setProfileData({ ...profileData, heroTitle: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    placeholder="Contoh: Alex Rivers"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300">Peran / Subtitle *</label>
                  <input
                    type="text"
                    required
                    value={profileData.heroSubtitle}
                    onChange={(e) => setProfileData({ ...profileData, heroSubtitle: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    placeholder="Contoh: Senior Frontend Developer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300">Bio Singkat *</label>
                <textarea
                  rows={3}
                  required
                  value={profileData.shortBio}
                  onChange={(e) => setProfileData({ ...profileData, shortBio: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  placeholder="Jelaskan spesialisasi dan keahlian Anda..."
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300">Email Kontak</label>
                  <input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    placeholder="alex@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300">Link GitHub / LinkedIn</label>
                  <input
                    type="text"
                    value={profileData.github}
                    onChange={(e) => setProfileData({ ...profileData, github: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    placeholder="https://github.com/username"
                  />
                </div>
              </div>

              <div className="flex justify-between border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-4 py-2 text-xs font-medium text-zinc-400 hover:bg-white/5 hover:text-white"
                >
                  Lewati
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500"
                >
                  <span>Lanjut: Tambah Project</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: Quick Project Add + Magic AI */}
          {step === 2 && (
            <form onSubmit={handleStep2Submit} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-purple-500/20 bg-purple-500/10 p-3.5">
                <div className="text-xs text-purple-200">
                  ✨ **Langkah 2:** Tambahkan project pertama Anda. Bingung mengisinya? Pakai **Magic AI**!
                </div>
                <button
                  type="button"
                  onClick={handleMagicAiFill}
                  disabled={isMagicLoading}
                  className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md hover:opacity-90 disabled:opacity-50"
                >
                  {isMagicLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="h-3.5 w-3.5" />
                  )}
                  <span>Magic AI Auto-Fill</span>
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300">Judul Project *</label>
                  <input
                    type="text"
                    required
                    value={projectData.title}
                    onChange={(e) => setProjectData({ ...projectData, title: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm text-white outline-none focus:border-indigo-500"
                    placeholder="Contoh: E-Commerce Mobile App"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300">Kategori / Client</label>
                  <input
                    type="text"
                    value={projectData.client}
                    onChange={(e) => setProjectData({ ...projectData, client: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm text-white outline-none focus:border-indigo-500"
                    placeholder="Fintech / Internal Project"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300">Tech Stack Tags</label>
                <input
                  type="text"
                  value={projectData.tags}
                  onChange={(e) => setProjectData({ ...projectData, tags: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm text-white outline-none focus:border-indigo-500"
                  placeholder="React, Node.js, Tailwind"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300">Deskripsi Project *</label>
                <textarea
                  rows={3}
                  required
                  value={projectData.description}
                  onChange={(e) => setProjectData({ ...projectData, description: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm text-white outline-none focus:border-indigo-500"
                  placeholder="Jelaskan latar belakang, tantangan, dan solusi project ini..."
                />
              </div>

              <div className="flex justify-between border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium text-zinc-400 hover:bg-white/5 hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Kembali</span>
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500"
                >
                  <span>Lanjut: Pilih Template</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Template Selector */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs text-emerald-200">
                🎨 **Langkah 3:** Pilih tema tampilan awal portofolio Anda. Anda dapat menggantinya kapan saja nanti.
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {[
                  {
                    id: 'os-desktop',
                    name: '💻 OS Desktop Simulator',
                    desc: 'Antarmuka bergaya macOS lengkap dengan Window Manager, Dock, & Spotlight.',
                    badge: 'Bawaan / Populer',
                  },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTemplate(t.id as typeof selectedTemplate)}
                    className={`relative rounded-xl border p-4 text-left transition ${
                      selectedTemplate === t.id
                        ? 'border-indigo-500 bg-indigo-500/15 shadow-lg shadow-indigo-500/10'
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-white">{t.name}</h4>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-zinc-300">
                        {t.badge}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-zinc-400">{t.desc}</p>
                  </button>
                ))}
              </div>


              <div className="flex justify-between border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium text-zinc-400 hover:bg-white/5 hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Kembali</span>
                </button>
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-6 py-2.5 text-xs font-bold text-white shadow-xl hover:opacity-90 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Rocket className="h-4 w-4" />
                  )}
                  <span>Rilis & Publikasikan Site!</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Success Celebration & Preview */}
          {step === 4 && (
            <div className="space-y-5 text-center py-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-xl shadow-emerald-500/20 animate-bounce">
                <Sparkles className="h-8 w-8" />
              </div>

              <div>
                <h3 className="text-xl font-extrabold text-white">Selamat! Portofolio Anda Siap!</h3>
                <p className="mt-1 text-xs text-zinc-400">
                  Data profil, project pertama, dan template pilihan Anda telah aktif.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-left space-y-2">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Link Publik Portofolio Anda</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={publicSiteUrl}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-mono text-emerald-400 outline-none"
                  />
                  <button
                    type="button"
                    onClick={copyToClipboard}
                    className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
                  >
                    {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedLink ? 'Tersalin' : 'Salin'}</span>
                  </button>
                  <a
                    href={publicSiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Buka</span>
                  </a>
                </div>
              </div>

              <div className="border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    onComplete();
                    onClose();
                  }}
                  className="w-full rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-lg hover:bg-indigo-500"
                >
                  Masuk ke Client Dashboard OS 🚀
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
