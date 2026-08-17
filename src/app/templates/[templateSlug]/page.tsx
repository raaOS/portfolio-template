import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { templateRegistryService } from '@/lib/services/templateRegistryService';
import { PLAN_BASE_PRICES, formatIdr } from '@/constants/plans';
import {
  ArrowLeft,
  Eye,
  Sparkles,
  Check,
  Crown,
  Zap,
  CheckCircle2,
  Tag,
} from 'lucide-react';

export const revalidate = 60;

interface TemplateDetailPageProps {
  params: Promise<{ templateSlug: string }>;
}

export default async function TemplateDetailPage({ params }: TemplateDetailPageProps) {
  const { templateSlug } = await params;
  const template = await templateRegistryService.getTemplateMetadata(templateSlug);

  if (!template) {
    notFound();
  }

  const isPro = template.tierRequired === 'pro';
  const tierKey = isPro ? 'pro' : 'lite';
  const basePrice = PLAN_BASE_PRICES[tierKey];
  const templatePrice = Math.max(0, Number(template.priceIdr) || 0);
  const totalPrice = basePrice + templatePrice;

  return (
    <div className="min-h-screen w-full bg-[#0a0b0e] text-slate-100 selection:bg-emerald-500 selection:text-black">
      {/* Top Navigation Bar */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0b0e]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/templates"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 transition hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-400" />
            <span>Kembali ke Katalog Templates</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href={`/templates/${template.id}/demo`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/30 hover:bg-white/10"
            >
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
              <span>Live Demo Interaktif</span>
            </Link>
            <Link
              href={`/checkout?plan=${template.tierRequired}&template=${template.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-xs font-bold text-slate-950 shadow-md transition active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 text-slate-950" />
              <span>Dapatkan Template Ini</span>
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10 mx-auto max-w-4xl px-6 py-12">
        {/* Category & Tier Header */}
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 font-mono text-xs font-medium text-emerald-300">
            Kategori: {template.category.toUpperCase()}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-mono text-xs font-semibold ${
              isPro
                ? 'border border-amber-500/30 bg-amber-500/10 text-amber-300'
                : 'border border-slate-700 bg-slate-800/80 text-slate-300'
            }`}
          >
            {isPro ? <Crown className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
            <span>{isPro ? 'PRO TIER' : 'LITE TIER'}</span>
          </span>
        </div>

        <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl text-white">{template.name}</h1>
        <p className="mt-3 text-base leading-relaxed text-slate-300">{template.description}</p>

        {/* Transparent Pricing Block */}
        <div className="mt-6 rounded-3xl border border-white/10 bg-[#111319] p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-400">
              <Tag className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">
                Harga Paket {isPro ? 'PRO' : 'LITE'} + Template
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Paket {formatIdr(basePrice)}
              {templatePrice > 0 && <> + Template {formatIdr(templatePrice)}</>}
            </p>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Investasi
            </div>
            <div className="text-3xl font-black text-emerald-400 tracking-tight">
              {formatIdr(totalPrice)}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Sekali bayar · dikenakan saat aktivasi order
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="mt-8 rounded-3xl border border-white/10 bg-[#111319] p-8 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">Fitur Utama</h2>
          </div>
          {template.features && (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2">
              {template.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs text-slate-200">
                  <Check className="mt-0.5 w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="leading-relaxed">{f}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Compatibility Block */}
        <div className="mt-6 rounded-3xl border border-white/10 bg-[#111319] p-8">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">Kompatibilitas Data Multi-Tenant</h2>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-300">
            Template ini 100% kompatibel dengan arsitektur Portfolio OS. Seluruh proyek, riwayat pengalaman, keahlian teknis, dan informasi kontak akan otomatis terisi tanpa perlu memasukkan ulang data.
          </p>
        </div>
      </main>
    </div>
  );
}
