'use client';

import { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Globe,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import type { CustomDomainRecord } from '@/lib/services/customDomainService';

interface CustomDomainSectionProps {
  siteId: string;
  csrfToken?: string;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export function CustomDomainSection({ siteId, csrfToken, showToast }: CustomDomainSectionProps) {
  const [domainRecord, setDomainRecord] = useState<CustomDomainRecord | null>(null);
  const [inputDomain, setInputDomain] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [copiedCname, setCopiedCname] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (siteId) {
      fetch(`/api/client/custom-domain?siteId=${encodeURIComponent(siteId)}`)
        .then((res) => {
          if (!res.ok) throw new Error('Gagal memuat domain');
          return res.json();
        })
        .then((json) => {
          if (isMounted) {
            setDomainRecord(json.data);
            if (json.data?.customDomain) setInputDomain(json.data.customDomain);
            setIsLoading(false);
          }
        })
        .catch((err) => {
          if (isMounted) {
            showToast(err instanceof Error ? err.message : 'Gagal memuat domain', 'error');
            setIsLoading(false);
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [siteId, showToast]);

  const handleSaveDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch('/api/client/custom-domain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({
          siteId,
          customDomain: inputDomain,
          action: 'register',
        }),
      });

      if (!res.ok) throw new Error('Gagal memperbarui domain kustom');
      const json = await res.json();
      setDomainRecord(json.data);
      showToast('Domain kustom berhasil disimpan. Silakan pasang CNAME di DNS Anda.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan domain', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyDomain = async () => {
    setIsVerifying(true);
    try {
      const res = await fetch('/api/client/custom-domain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({
          siteId,
          action: 'verify',
        }),
      });

      if (!res.ok) throw new Error('Gagal memverifikasi domain');
      const json = await res.json();
      setDomainRecord(json.data);
      if (json.data?.status === 'active') {
        showToast('🎉 Domain kustom & SSL berhasil diverifikasi dan Aktif!', 'success');
      } else {
        showToast('Verifikasi diproses. Pastikan CNAME sudah mengarah ke server.', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal memverifikasi', 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  const copyCname = () => {
    if (!domainRecord?.cnameTarget) return;
    void navigator.clipboard.writeText(domainRecord.cnameTarget);
    setCopiedCname(true);
    showToast('Target CNAME disalin!', 'success');
    setTimeout(() => setCopiedCname(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center text-xs text-zinc-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-indigo-600" />
        Memuat data custom domain...
      </div>
    );
  }

  const isDomainActive = domainRecord?.status === 'active';
  const isPending = domainRecord?.status === 'pending_cname';

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-indigo-600" />
          <div>
            <h3 className="text-xs font-bold text-zinc-900">Custom Domain & Cloudflare SSL for SaaS</h3>
            <p className="text-[11px] text-zinc-500">
              Gunakan domain milik Anda sendiri (misal `portfolio.pembeli.com`) dengan sertifikat SSL gratis.
            </p>
          </div>
        </div>

        {isDomainActive ? (
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Domain Aktif & SSL Active
          </span>
        ) : isPending ? (
          <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Menunggu DNS CNAME
          </span>
        ) : (
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
            Belum Diatur
          </span>
        )}
      </div>

      <form onSubmit={handleSaveDomain} className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-zinc-700">Domain Kustom Anda</label>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              value={inputDomain}
              onChange={(e) => setInputDomain(e.target.value)}
              placeholder="portfolio.namaanda.dev"
              className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-900 outline-none focus:border-indigo-500 focus:bg-white"
            />
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              <span>Simpan</span>
            </button>
          </div>
        </div>
      </form>

      {/* CNAME Instructions Card */}
      {domainRecord?.customDomain && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-zinc-800 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
              Petunjuk Pengaturan DNS (CNAME Record)
            </span>
            <button
              type="button"
              onClick={handleVerifyDomain}
              disabled={isVerifying}
              className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${isVerifying ? 'animate-spin' : ''}`} />
              <span>Verifikasi CNAME</span>
            </button>
          </div>

          <p className="text-[11px] text-zinc-600">
            Buka penyedia DNS domain Anda (Cloudflare, Namecheap, GoDaddy, dll.) lalu tambahkan rekaman CNAME berikut:
          </p>

          <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-lg border border-zinc-200 text-[11px] font-mono">
            <div>
              <span className="block text-[10px] text-zinc-400 font-sans">TYPE</span>
              <span className="font-bold text-zinc-800">CNAME</span>
            </div>
            <div>
              <span className="block text-[10px] text-zinc-400 font-sans">HOST / NAME</span>
              <span className="font-bold text-zinc-800 truncate block">{domainRecord.customDomain}</span>
            </div>
            <div>
              <span className="block text-[10px] text-zinc-400 font-sans">TARGET / VALUE</span>
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-600 truncate">{domainRecord.cnameTarget}</span>
                <button type="button" onClick={copyCname} className="text-zinc-400 hover:text-zinc-700">
                  {copiedCname ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
