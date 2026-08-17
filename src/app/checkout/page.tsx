'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Zap,
  Globe,
  Lock,
  Laptop,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { PLAN_BASE_PRICES } from '@/constants/plans';

function normalizePlanParam(planParam: string | null): 'lite' | 'pro' {
  return planParam === 'lite' || planParam === 'pro' ? planParam : 'pro';
}

function CheckoutPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [plan, setPlan] = useState<'lite' | 'pro'>(() => normalizePlanParam(searchParams.get('plan')));
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerWhatsapp, setBuyerWhatsapp] = useState('');
  const [desiredSlug, setDesiredSlug] = useState('nanda-design');
  
  const [slugStatus, setSlugStatus] = useState<{
    checking: boolean;
    available?: boolean;
    reason?: string;
  }>({ checking: false, available: true, reason: 'Slug tersedia' });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [paymentActive, setPaymentActive] = useState(true);
  const templateId = searchParams.get('template')?.trim() || '';
  const [verificationHours, setVerificationHours] = useState('08:00 – 22:00 WIB (maks. 1x24 jam)');

  // Template surcharge (harga tambahan bila template berbayar) — diambil dari
  // endpoint publik yang mengeksekusi resolveOrderTemplate yang sama dengan POST
  // checkout agar nominal UI selalu sinkron dengan tagihan aktual.
  const [templateInfo, setTemplateInfo] = useState<{
    templateName?: string;
    extraAmount: number;
    total: number;
    loading: boolean;
    error?: string;
  }>({
    extraAmount: 0,
    total: 0,
    loading: true
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams({ plan });
      if (templateId) params.set('template', templateId);
      setTemplateInfo((prev) => ({ ...prev, loading: true, error: undefined }));
      try {
        const res = await fetch(`/api/billing/template-price?${params.toString()}`);
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.available) {
          setTemplateInfo({
            templateName: data.templateName,
            extraAmount: data.extraAmount,
            total: data.total,
            loading: false
          });
        } else {
          setTemplateInfo({
            extraAmount: 0,
            total: PLAN_BASE_PRICES[plan],
            loading: false,
            error: data.error
          });
        }
      } catch {
        if (cancelled) return;
        setTemplateInfo({
          extraAmount: 0,
          total: PLAN_BASE_PRICES[plan],
          loading: false
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [plan, templateId]);

  // Fetch payment config for verification hours
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/billing/payment-info');
        const data = await res.json();
        if (data.success && data.verificationHours) {
          setVerificationHours(data.verificationHours);
        }
        if (data.success && typeof data.isActive === 'boolean') {
          setPaymentActive(data.isActive);
        }
      } catch {
        // Keep default
      }
    })();
  }, []);

  // Debounced Slug Check
  useEffect(() => {
    if (!desiredSlug || desiredSlug.trim().length < 3) {
      return;
    }

    const timer = setTimeout(async () => {
      setSlugStatus({ checking: true });
      try {
        const res = await fetch(`/api/billing/checkout?slug=${encodeURIComponent(desiredSlug.trim())}`);
        const data = await res.json();
        setSlugStatus({
          checking: false,
          available: data.available,
          reason: data.reason
        });
      } catch {
        setSlugStatus({ checking: false, available: false, reason: 'Gagal memeriksa ketersediaan slug' });
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [desiredSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!slugStatus.available) {
      setErrorMessage('Silakan pilih slug ID yang tersedia terlebih dahulu.');
      return;
    }

    if (!paymentActive) {
      setErrorMessage('Pembayaran sedang tidak aktif. Silakan coba lagi nanti.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerName,
          buyerEmail,
          buyerWhatsapp,
          plan,
          desiredSlug: desiredSlug.trim().toLowerCase(),
          templateId: templateId || undefined
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal memproses pesanan');
      }

      router.push(data.redirectUrl);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Terjadi kesalahan sistem');
      setLoading(false);
    }
  };

  const currentPrice = PLAN_BASE_PRICES[plan];
  const totalPrice = templateInfo.loading ? currentPrice : templateInfo.total;
  const formatRupiah = (num: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

  return (
    <div className="min-h-screen bg-slate-900 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.22),rgba(255,255,255,0))] text-slate-800 flex items-center justify-center p-4 sm:p-6 lg:p-10 font-sans selection:bg-blue-600 selection:text-white">
      
      {/* Subtle Desktop Pattern */}
      <div className="fixed inset-0 pointer-events-none opacity-15 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:28px_28px]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 22 }}
        className="relative z-10 w-full max-w-5xl bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/60 ring-1 ring-slate-900/10 overflow-hidden"
      >
        {/* macOS Window Header Bar */}
        <div className="h-12 bg-slate-100/90 border-b border-slate-200/70 px-5 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500 border border-rose-600/30" />
            <span className="w-3 h-3 rounded-full bg-amber-500 border border-amber-600/30" />
            <span className="w-3 h-3 rounded-full bg-emerald-500 border border-emerald-600/30" />
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Laptop className="w-4 h-4 text-blue-600" />
            <span>Portfolio OS — Setup Assistant</span>
          </div>

          <div className="text-xs text-slate-400 font-medium hidden sm:block">
            Step 1 of 2
          </div>
        </div>

        {/* Spacious 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12">
          
          {/* LEFT SIDE: Airy Visual Showcase & Perks */}
          <div className="lg:col-span-5 bg-slate-50/50 p-8 sm:p-10 lg:p-12 border-b lg:border-b-0 lg:border-r border-slate-200/70 flex flex-col justify-between space-y-8">
            <div className="space-y-6">
              
              <div className="space-y-1.5">
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  Portofolio OS {plan.toUpperCase()}
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Interaktif macOS desktop simulator untuk kredibilitas & personal branding profesional.
                </p>
              </div>

              {/* Price Banner */}
              <div className="py-2 border-y border-slate-200/80 space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-slate-400 font-medium">Harga Paket {plan.toUpperCase()}</span>
                  <span className="text-sm font-bold text-slate-700">{formatRupiah(currentPrice)}</span>
                </div>
                {templateInfo.extraAmount > 0 && (
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-slate-400 font-medium">
                      Template {templateInfo.templateName ? `"${templateInfo.templateName}"` : 'pilihan'}
                    </span>
                    <span className="text-sm font-bold text-slate-700">{formatRupiah(templateInfo.extraAmount)}</span>
                  </div>
                )}
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-semibold text-slate-500">Total Investasi</span>
                  <span className="text-2xl font-black text-blue-600 tracking-tight">
                    {templateInfo.loading ? '...' : formatRupiah(totalPrice)}
                  </span>
                </div>
                {templateInfo.error && (
                  <p className="text-[11px] text-rose-600 font-medium">{templateInfo.error}</p>
                )}
                <p className="text-[10px] leading-relaxed text-slate-500 font-medium">
                  Nominal tagihan akhir = harga di atas + kode unik (Rp1–999) yang muncul di struk pembayaran,
                  agar admin dapat mencocokkan pembayaran Anda secara manual.
                </p>
              </div>

              {/* Clean Feature Bullet Points */}
              <div className="space-y-3 pt-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Fitur Paket {plan.toUpperCase()} Included:
                </span>

                <ul className="text-xs text-slate-600 space-y-2.5 font-medium">
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Interface Desktop Simulator macOS V6</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Dashboard Pengelola Konten Self-Service</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{plan === 'pro' ? 'Unlimited Showcase Projects' : 'Maksimal 5 Project Showcase'}</span>
                  </li>
                  {plan === 'pro' ? (
                    <li className="flex items-start gap-2.5 text-blue-700 font-bold">
                      <Zap className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <span>Widget Chat Testimoni WhatsApp</span>
                    </li>
                  ) : (
                    <li className="flex items-start gap-2.5 text-slate-400 line-through">
                      <Lock className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                      <span>Widget Chat Testimoni WhatsApp (Pro)</span>
                    </li>
                  )}
                </ul>
              </div>
            </div>

            {/* Bottom Security Note */}
            <div className="flex items-center gap-2.5 text-xs text-slate-500 font-medium pt-4">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Aktivasi 1-Klik via Telegram Admin & Garansi Data.</span>
            </div>
          </div>

          {/* RIGHT SIDE: Airy & Spacious Form */}
          <div className="lg:col-span-7 p-8 sm:p-10 lg:p-12 space-y-6">
            
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Plan Switcher Pills with Motion Layout Slider */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  1. Pilih Paket Langganan
                </label>

                <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 relative">
                  <button
                    type="button"
                    onClick={() => setPlan('lite')}
                    className={`relative py-3 px-4 rounded-xl text-xs font-bold transition-colors z-10 cursor-pointer ${
                      plan === 'lite' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {plan === 'lite' && (
                      <motion.div
                        layoutId="activePlanPill"
                        className="absolute inset-0 bg-white rounded-xl shadow-sm border border-slate-200/60 -z-10"
                        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                      />
                    )}
                    Lite — Rp {PLAN_BASE_PRICES.lite / 1000}rb
                  </button>

                  <button
                    type="button"
                    onClick={() => setPlan('pro')}
                    className={`relative py-3 px-4 rounded-xl text-xs font-bold transition-colors z-10 cursor-pointer ${
                      plan === 'pro' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {plan === 'pro' && (
                      <motion.div
                        layoutId="activePlanPill"
                        className="absolute inset-0 bg-white rounded-xl shadow-sm border border-slate-200/60 -z-10"
                        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                      />
                    )}
                    Pro — Rp {PLAN_BASE_PRICES.pro / 1000}rb
                  </button>
                </div>
              </div>

              {/* Hero Slug Input Group */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    2. URL / Username Portofolio Anda
                  </label>
                  <AnimatePresence mode="wait">
                    {desiredSlug.trim().length >= 3 && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-[11px] font-semibold"
                      >
                        {slugStatus.checking ? (
                          <span className="text-amber-600 animate-pulse">Memeriksa...</span>
                        ) : slugStatus.available ? (
                          <span className="text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> URL Tersedia
                          </span>
                        ) : (
                          <span className="text-rose-600 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> Terpakai
                          </span>
                        )}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-3.5 py-3 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-xs overflow-hidden">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400 select-none shrink-0 pr-2 border-r border-slate-200/80 mr-2">
                    <Globe className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>makeitbetter.my.id/</span>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="nanda-design"
                    value={desiredSlug}
                    onChange={(e) => {
                      const nextSlug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                      setDesiredSlug(nextSlug);
                      if (nextSlug.trim().length < 3) {
                        setSlugStatus({ checking: false, available: false });
                      }
                    }}
                    className="w-full min-w-0 bg-transparent text-xs text-slate-900 font-mono font-bold focus:outline-none"
                  />
                </div>
              </div>

              {/* Customer Contact Details */}
              <div className="space-y-4 pt-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  3. Informasi Kontak Pembeli
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <input
                      type="text"
                      required
                      placeholder="Nama Lengkap"
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 font-medium focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                  </div>

                  <div>
                    <input
                      type="email"
                      required
                      placeholder="Alamat Email"
                      value={buyerEmail}
                      onChange={(e) => setBuyerEmail(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 font-medium focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <input
                    type="tel"
                    required
                    placeholder="Nomor WhatsApp Active (e.g. 6281234567890)"
                    value={buyerWhatsapp}
                    onChange={(e) => setBuyerWhatsapp(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 font-medium focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
              </div>

              {/* Error Alert */}
              <AnimatePresence>
                {errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                    <span>{errorMessage}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {!paymentActive && !errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                    <span>Pembayaran sedang tidak aktif.</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Verification Operational Hours Banner */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-600 text-[11px] leading-relaxed flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-800">Verifikasi & Aktivasi Manual:</span> Bukti pembayaran Anda diverifikasi oleh tim kami pada jam operasional <strong>{verificationHours}</strong>.
                </div>
              </div>

              {/* Primary CTA Button */}
              <motion.button
                type="submit"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                disabled={loading || !slugStatus.available || !paymentActive}
                className="w-full flex justify-center items-center gap-2 py-3.5 px-6 rounded-2xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <span>Menyiapkan Pesanan...</span>
                ) : (
                  <>
                    <span>Lanjut Pembayaran ({formatRupiah(totalPrice)})</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>

            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-900 p-6 text-xs font-semibold text-white">
          Memuat checkout...
        </div>
      }
    >
      <CheckoutPageContent />
    </Suspense>
  );
}
