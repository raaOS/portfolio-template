'use client';

import React, { useState, useEffect, use, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Copy,
  Check,
  QrCode,
  Upload,
  UploadCloud,
  MessageCircle,
  RefreshCw,
  AlertCircle,
  Laptop,
  CheckCircle2,
  Clock,
  Landmark,
  Printer,
  ShieldCheck,
  ShieldAlert,
  Link2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface OrderData {
  id: string;
  desired_slug: string;
  buyer_name: string;
  buyer_email: string;
  buyer_whatsapp: string;
  plan: string;
  amount: number;
  payment_method: string;
  payment_proof_url?: string | null;
  cancel_reason?: string | null;
  status: string;
  expires_at: string;
  created_at: string;
}

interface PublicQRISAccount {
  id: string;
  label: string;
  imageUrl: string;
  isActive: boolean;
  hasDynamicPayload: boolean;
}

interface PaymentInfo {
  qrisImageUrl: string;
  qrisAccounts?: PublicQRISAccount[];
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  paymentInstructions: string;
  verificationHours: string;
  adminWhatsapp: string;
  isActive: boolean;
}

interface DynamicQRISAccountItem {
  id: string;
  label: string;
  imageUrl?: string;
  qrisPayload?: string;
}

export default function OrderDetailsPage({ params }: { params: Promise<{ orderId: string }> }) {
  const resolvedParams = use(params);
  const orderId = resolvedParams.orderId;
  const searchParams = useSearchParams();
  const accessToken = useMemo(() => searchParams.get('token') || '', [searchParams]);

  const [order, setOrder] = useState<OrderData | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [dynamicQrisAccounts, setDynamicQrisAccounts] = useState<DynamicQRISAccountItem[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const [copiedBank, setCopiedBank] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [receiptAnimationRun, setReceiptAnimationRun] = useState(0);

  const [proofUrl, setProofUrl] = useState('');
  const [submittingProof, setSubmittingProof] = useState(false);
  const [proofMessage, setProofMessage] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploadingProofFile, setUploadingProofFile] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // M1: countdown batas bayar live (update 1 detik). Timer hanya aktif saat
  // status yang benar-benar menampilkan countdown — hemat CPU/baterai di device
  // lemah/mobile (tidak ada re-render 1x/detik saat status terminal).
  const [now, setNow] = useState<number>(() => Date.now());
  const needsCountdown =
    order?.status === 'pending_payment' || order?.status === 'waiting_verification';
  useEffect(() => {
    if (!needsCountdown) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [needsCountdown]);

  const fetchOrder = useCallback(async () => {
    try {
      const tokenParam = accessToken ? `?token=${encodeURIComponent(accessToken)}` : '';
      const res = await fetch(`/api/billing/orders/${orderId}${tokenParam}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Pesanan tidak ditemukan');
      }
      setOrder(data.order);
      if (data.order.payment_proof_url) {
        setProofUrl(data.order.payment_proof_url);
      }
    } catch (fetchError: unknown) {
      setError(fetchError instanceof Error ? fetchError.message : 'Gagal memuat detail pesanan');
    } finally {
      setLoading(false);
    }
  }, [orderId, accessToken]);

  const isTerminalStatus =
    order?.status === 'activated' || order?.status === 'canceled' || order?.status === 'expired';

  useEffect(() => {
    if (isTerminalStatus) return;

    const initialFetch = window.setTimeout(() => void fetchOrder(), 0);
    const interval = setInterval(fetchOrder, 10000);
    return () => {
      clearTimeout(initialFetch);
      clearInterval(interval);
    };
  }, [fetchOrder, isTerminalStatus]);

  // Fetch payment config and dynamic QRIS accounts
  useEffect(() => {
    (async () => {
      const tokenParam = accessToken ? `?token=${encodeURIComponent(accessToken)}` : '';
      try {
        const [infoRes, qrisRes] = await Promise.all([
          fetch('/api/billing/payment-info'),
          fetch(`/api/billing/orders/${orderId}/qris${tokenParam}`)
        ]);

        const infoData = await infoRes.json();
        if (infoData.success) {
          setPaymentInfo(infoData);
        }

        const qrisData = await qrisRes.json();
        if (qrisData.success && qrisData.enabled && Array.isArray(qrisData.accounts)) {
          setDynamicQrisAccounts(qrisData.accounts);
          setSelectedAccountId(qrisData.selectedAccountId || qrisData.accounts[0]?.id || '');
        }
      } catch {
        // Fallback
      }
    })();
  }, [orderId, accessToken]);

  const handleCopyId = () => {
    if (!order) return;
    navigator.clipboard.writeText(order.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyBank = (bankNum: string) => {
    if (!bankNum || bankNum === '-') return;
    navigator.clipboard.writeText(bankNum);
    setCopiedBank(true);
    setTimeout(() => setCopiedBank(false), 2000);
  };

  const handleCopyAmount = (amt: number) => {
    if (!amt) return;
    navigator.clipboard.writeText(String(amt));
    setCopiedAmount(true);
    setTimeout(() => setCopiedAmount(false), 2000);
  };

  const handlePrintReceipt = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // clipboard tidak tersedia di beberapa konteks
    }
  };

  const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setProofFile(file);
    if (file) setProofMessage('');
  };

  const handleUploadProofFile = async () => {
    if (!proofFile) return;

    setUploadingProofFile(true);
    setProofMessage('');
    try {
      const formData = new FormData();
      formData.append('file', proofFile);
      formData.append('token', accessToken);

      const res = await fetch(`/api/billing/orders/${orderId}/proof-upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal mengunggah bukti pembayaran');
      }
      setProofFile(null);
      setProofUrl(data.proofUrl || '');
      setProofMessage('Bukti pembayaran berhasil diunggah! Admin sedang memverifikasi pesanan Anda.');
      await fetchOrder();
    } catch (uploadError: unknown) {
      const message = uploadError instanceof Error ? uploadError.message : 'Gagal mengunggah bukti pembayaran';
      setProofMessage(`Error: ${message}`);
    } finally {
      setUploadingProofFile(false);
    }
  };

  // M1: sisa waktu verifikasi pembayaran.
  const expiresMs = order ? new Date(order.expires_at).getTime() - now : 0;
  const formatCountdown = (ms: number) => {
    if (ms <= 0) return '0j 0m 0d';
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return days > 0
      ? `${days}d ${hours}j ${minutes}m ${seconds}d`
      : `${hours}j ${minutes}m ${seconds}d`;
  };
  const countdownUrgent = expiresMs < 60 * 60 * 1000; // < 1 jam

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proofUrl.trim()) return;

    setSubmittingProof(true);
    setProofMessage('');

    try {
      const res = await fetch(`/api/billing/orders/${orderId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proofUrl: proofUrl.trim(), token: accessToken })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal mengunggah bukti pembayaran');
      }

      setProofMessage('Bukti pembayaran berhasil diunggah! Admin sedang memverifikasi pesanan Anda.');
      await fetchOrder();
    } catch (submitError: unknown) {
      const message = submitError instanceof Error ? submitError.message : 'Gagal mengunggah bukti pembayaran';
      setProofMessage(`Error: ${message}`);
    } finally {
      setSubmittingProof(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-3 text-xs font-semibold">
          <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
          <span>Memuat status pesanan...</span>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-2xl border border-slate-200">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-900 mb-2">Pesanan Tidak Ditemukan</h2>
          <p className="text-xs text-slate-500 mb-6">{error || 'ID pesanan yang Anda masukkan tidak valid.'}</p>
          <a
            href="/checkout"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-all"
          >
            Kembali Ke Form Checkout
          </a>
        </div>
      </div>
    );
  }

  const selectedAccount =
    dynamicQrisAccounts.find((a) => a.id === selectedAccountId) || dynamicQrisAccounts[0];

  const adminWa = (paymentInfo?.adminWhatsapp || process.env.NEXT_PUBLIC_ADMIN_WA || '628123456789').replace(/\D/g, '');
  const selectedLabel = selectedAccount ? selectedAccount.label : 'QRIS';
  const waText = encodeURIComponent(
    `Halo Admin, saya sudah memesan Portfolio OS ${order.plan.toUpperCase()}.\nOrder ID: ${order.id}\nNama: ${order.buyer_name}\nSlug: ${order.desired_slug}\nMetode: ${selectedLabel}`
  );
  const waUrl = `https://wa.me/${adminWa}?text=${waText}`;

  const formatRupiah = (num: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

  const verificationHours = paymentInfo?.verificationHours || '08:00 – 22:00 WIB (maks. 1x24 jam)';
  const bankName = paymentInfo?.bankName || 'Bank';
  const bankAccountNumber = paymentInfo?.bankAccountNumber || '-';
  const bankAccountName = paymentInfo?.bankAccountName || '-';
  const paymentInstructions = paymentInfo?.paymentInstructions || 'Transfer tepat sesuai nominal tagihan.';

  // Fallback static accounts
  const staticAccounts = paymentInfo?.qrisAccounts?.filter((a) => a.isActive && a.imageUrl) || [];
  const primaryStaticImage = paymentInfo?.qrisImageUrl || staticAccounts[0]?.imageUrl || '';

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#e7f0f4] text-slate-800 flex flex-col items-center justify-start px-4 py-10 sm:px-6 sm:py-14 lg:px-8 font-sans selection:bg-slate-900 selection:text-white print:bg-white print:p-0">
      
      {/* Top Utility Actions (Non-printable) */}
      <div className="w-full max-w-xl mb-5 flex items-center justify-between px-2 text-xs font-semibold text-slate-500 print:hidden">
        <div className="flex items-center gap-2">
          <Laptop className="w-4 h-4 text-slate-700" />
          <span>Portfolio OS — Payment Receipt</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void handleCopyLink()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 hover:bg-white text-slate-600 hover:text-slate-950 border border-slate-300 transition-all text-xs shadow-sm"
            title="Salin tautan pesanan ini — simpan untuk cek status kapan saja"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Link2 className="w-3.5 h-3.5 text-slate-700" />}
            <span className="hidden sm:inline">{copiedLink ? 'Tautan Tersalin' : 'Salin Link Pesanan'}</span>
          </button>
          <button
            onClick={() => setReceiptAnimationRun((run) => run + 1)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 hover:bg-white text-slate-600 hover:text-slate-950 border border-slate-300 transition-all text-xs shadow-sm"
            title="Putar Ulang Animasi Struk"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-700" />
            <span className="hidden sm:inline">Ulangi Animasi</span>
          </button>
          <button
            onClick={handlePrintReceipt}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 hover:bg-white text-slate-600 hover:text-slate-950 border border-slate-300 transition-all text-xs shadow-sm"
            title="Cetak Struk Pembayaran"
          >
            <Printer className="w-3.5 h-3.5 text-slate-700" />
            <span>Cetak Struk</span>
          </button>
        </div>
      </div>

      <div className="relative w-full max-w-2xl print:max-w-none">
        {/* Printer head: the receipt starts behind its black slot. */}
        <motion.div
          key={`printer-${receiptAnimationRun}`}
          aria-hidden="true"
          animate={{ y: [0, 0, 1.5, -1, 1, 0], rotate: [0, 0, 0.08, -0.08, 0.05, 0] }}
          transition={{ duration: 6.2, delay: 0.45, ease: 'easeInOut' }}
          className="pointer-events-none relative z-30 h-24 sm:h-28 rounded-[22px] border border-slate-400/90 bg-[linear-gradient(180deg,#f8fafc_0%,#a9afb6_38%,#eef0f2_68%,#8d949c_100%)] shadow-[0_15px_24px_rgba(51,65,85,0.28),inset_0_2px_2px_rgba(255,255,255,0.95),inset_0_-2px_3px_rgba(15,23,42,0.28)] print:hidden"
        >
          <div className="absolute inset-x-3 top-2 h-1/2 rounded-[16px] bg-[linear-gradient(180deg,rgba(255,255,255,0.75),rgba(255,255,255,0))]" />
          <motion.div
            className="absolute inset-x-[8%] bottom-1 z-40 h-3 translate-y-1/2 rounded-full bg-black shadow-[inset_0_3px_4px_rgba(0,0,0,0.95),0_2px_3px_rgba(15,23,42,0.35)]"
            animate={{ opacity: [0.72, 1, 0.78, 1, 0.72] }}
            transition={{ duration: 1.05, delay: 0.55, repeat: 5, ease: 'easeInOut' }}
          />
        </motion.div>

        <motion.div
          key={`${order.id}-${receiptAnimationRun}`}
          initial={{ height: 0, y: -8 }}
          animate={{ height: 'auto', y: 0, x: [0, -0.7, 0.7, -0.5, 0.5, 0] }}
          transition={{
            height: { duration: 5.8, delay: 0.65, ease: [0.12, 0.72, 0.16, 1] },
            y: { duration: 0.8, delay: 0.65, ease: 'easeOut' },
            x: { duration: 5.8, delay: 0.65, ease: 'linear' },
          }}
          className="relative z-10 mx-auto -mt-5 w-[88%] max-w-xl overflow-hidden border-x border-slate-200/80 bg-[#fffefb] bg-[linear-gradient(90deg,rgba(15,23,42,0.018)_1px,transparent_1px)] bg-[length:5px_5px] shadow-[0_24px_38px_rgba(51,65,85,0.24)] font-sans sm:w-[80%] print:mt-0 print:h-auto print:w-full print:max-w-none print:overflow-visible print:border-0 print:shadow-none"
        >
        {/* Receipt Header Bar */}
        <div className="px-5 pb-4 pt-7 text-slate-950 sm:px-7 sm:pt-8">
          <div className="text-center">
            <h1 className="text-3xl font-black uppercase tracking-tight sm:text-4xl">Receipt</h1>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">Portfolio OS • Struk Pembayaran</p>
          </div>

          <span
            className={`mx-auto mt-3 block w-fit rounded-full border px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider ${
              order.status === 'activated'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                : order.status === 'waiting_verification' || order.status === 'activating'
                ? 'border-amber-300 bg-amber-50 text-amber-700'
                : order.status === 'canceled'
                ? 'border-rose-300 bg-rose-50 text-rose-700'
                : 'border-slate-300 bg-slate-100 text-slate-700'
            }`}
          >
            {order.status === 'pending_payment'
              ? 'Menunggu Pembayaran'
              : order.status === 'waiting_verification'
              ? 'Verifikasi Admin'
              : order.status === 'activating'
              ? 'Mengaktifkan...'
              : order.status === 'activated'
              ? 'Terverifikasi & Aktif'
              : order.status === 'canceled'
              ? 'Dibatalkan'
              : order.status}
          </span>
        </div>

        <div className="mx-6 border-t-2 border-slate-800 sm:mx-8" />

        {/* Receipt Body */}
        <div className="space-y-4 p-4 sm:p-6">

          {/* Struk Metadata Section */}
          <div className="grid grid-cols-1 gap-3 border-b border-dashed border-slate-300 pb-3 text-xs sm:grid-cols-2">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">No. Struk / Order ID</span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="font-mono text-sm font-extrabold text-slate-900">{order.id}</span>
                <button
                  onClick={handleCopyId}
                  className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
                  title="Salin Order ID"
                >
                  {copiedId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

            <div className="sm:text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tanggal Order</span>
              <span className="font-mono text-xs font-semibold text-slate-700 mt-1 block">
                {order.created_at ? new Date(order.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
              </span>
            </div>
          </div>

          {/* Customer & Target Details */}
          <div className="space-y-1.5 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 text-xs font-sans">
            <div className="flex flex-col items-start gap-1 border-b border-slate-200/60 pb-1.5 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-slate-500 font-medium">Pemesan:</span>
              <span className="font-bold text-slate-900">{order.buyer_name} ({order.buyer_email})</span>
            </div>
            <div className="flex flex-col items-start gap-1 border-b border-slate-200/60 pb-1.5 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-slate-500 font-medium">Target Website:</span>
              <span className="font-mono font-bold text-blue-600">makeitbetter.my.id/{order.desired_slug}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500 font-medium">Paket Terpilih:</span>
              <span className="font-extrabold text-slate-900 uppercase bg-white px-2.5 py-0.5 rounded border border-slate-200">
                {order.plan} PLAN
              </span>
            </div>
          </div>

          {/* Compact bill summary */}
          <div className="border-y border-slate-800 py-3 text-xs">
            <div className="flex items-center justify-between gap-3 text-slate-600">
              <span>Portfolio OS {order.plan.toUpperCase()}</span>
              <span className="font-mono">{formatRupiah(order.amount)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div>
                <span className="block font-black uppercase text-slate-950">Total Bayar</span>
                <span className="text-[10px] text-slate-500">Sesuai digit terakhir</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-black text-slate-950">{formatRupiah(order.amount)}</span>
                <button
                  onClick={() => handleCopyAmount(order.amount)}
                  className="rounded bg-slate-100 p-1 text-slate-700 transition-colors hover:bg-slate-200"
                  title="Salin Nominal Tagihan"
                >
                  {copiedAmount ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {/* M1: Countdown batas bayar — hanya untuk status pembayaran aktif */}
            {(order.status === 'pending_payment' || order.status === 'waiting_verification') && (
              <div className={`mt-2.5 flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${
                order.status === 'waiting_verification'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : countdownUrgent
                  ? 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {order.status === 'waiting_verification' ? 'Menunggu verifikasi admin —' : 'Sisa batas waktu bayar:'}
                </span>
                <span className="font-mono font-extrabold tabular-nums">{formatCountdown(expiresMs)}</span>
              </div>
            )}

            {order.status === 'expired' && (
              <div className="mt-2.5 flex items-center justify-between gap-3 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1.5 text-[11px] font-medium">
                <span className="flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Order kedaluwarsa — upload bukti tetap dapat diproses manual.
                </span>
              </div>
            )}
          </div>

          {/* Canceled Order Banner */}
          {order.status === 'canceled' && (
            <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-3">
              <div className="flex items-center gap-2.5 text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <h3 className="text-[11px] font-extrabold uppercase tracking-wide">Pesanan Dibatalkan</h3>
              </div>
              <p className="rounded-lg border border-rose-200/80 bg-white p-2 text-[11px] font-medium text-rose-900">
                <strong>Alasan:</strong> {order.cancel_reason || 'Bukti pembayaran tidak sesuai atau mutasi tidak terdeteksi.'}
              </p>
            </div>
          )}

          {/* Expired Order Banner */}
          {order.status === 'expired' && (
            <div className="space-y-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-2.5 text-amber-700">
                <Clock className="h-4 w-4 shrink-0" />
                <h3 className="text-[11px] font-extrabold uppercase tracking-wide">Pesanan Kedaluwarsa</h3>
              </div>
              <p className="text-[11px] font-medium text-amber-900">
                Batas waktu pembayaran 24 jam telah lewat. Jika sudah terlanjur membayar, silakan unggah bukti di
                bagian "Bukti Pembayaran" di bawah untuk verifikasi manual. Jika belum membayar, buat pesanan baru
                untuk mendapatkan QRIS dan nominal pembayaran baru.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href="/checkout"
                  className="inline-flex items-center justify-center rounded-lg bg-amber-600 px-3.5 py-2 text-[11px] font-bold text-white shadow-sm transition-all hover:bg-amber-700"
                >
                  Buat Pesanan Baru
                </a>
                <a
                  href={`https://wa.me/${adminWa}?text=${encodeURIComponent(
                    `Halo Admin, pesanan saya ${order.id} (Slug: ${order.desired_slug}) kedaluwarsa, namun saya sudah terlanjur melakukan transfer/scan QRIS. Mohon bantuan verifikasi manual.`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3.5 py-2 text-[11px] font-bold text-amber-900 shadow-xs transition-all hover:bg-amber-100`"
                >
                  <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                  Bantuan WA (Terlanjur Bayar)
                </a>
              </div>
            </div>
          )}

          {/* Payment Section (QRIS & Bank Transfer Struk) — hidden when expired/activated/canceled */}
          {order.status !== 'activated' && order.status !== 'canceled' && order.status !== 'expired' && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 font-bold text-blue-600">
                    <QrCode className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-900">Pembayaran</h3>
                    <p className="text-[10px] text-slate-500">{paymentInstructions}</p>
                  </div>
                </div>
              </div>

              {/* Multi-QRIS Account Tab Switcher */}
              {dynamicQrisAccounts.length > 1 && (
                <div className="flex flex-col items-stretch gap-2 rounded-xl border border-slate-200/80 bg-slate-50 p-1.5 sm:flex-row sm:items-center">
                  <span className="text-[11px] font-bold text-slate-500 px-2">Pilih Akun QRIS:</span>
                  <div className="flex flex-wrap gap-1">
                    {dynamicQrisAccounts.map((acc) => (
                      <button
                        key={acc.id}
                        onClick={() => setSelectedAccountId(acc.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          selectedAccountId === acc.id || (!selectedAccountId && acc === dynamicQrisAccounts[0])
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        {acc.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* QRIS & Bank Grid */}
              <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2">
                
                {/* QRIS Container */}
                <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                  {selectedAccount?.qrisPayload ? (
                    <>
                      <div className="flex h-32 w-32 items-center justify-center rounded-lg border border-slate-200 bg-white p-2 shadow-xs">
                        <QRCodeSVG value={selectedAccount.qrisPayload} size={112} />
                      </div>
                      <span className="hidden">
                        ✓ {selectedAccount.label} (Nominal Auto)
                      </span>
                      <span className="mt-2.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-700">
                        {selectedAccount.label}
                      </span>
                    </>
                  ) : primaryStaticImage ? (
                    <>
                      <img
                        src={primaryStaticImage}
                        alt="Scan QRIS Statis"
                        className="h-32 w-32 rounded-lg border border-slate-200 bg-white p-1.5 object-contain shadow-xs"
                      />
                      <span className="mt-2.5 text-[10px] font-bold text-slate-500">Scan QRIS</span>
                    </>
                  ) : (
                    <div className="p-4 text-[11px] text-slate-500">QRIS belum dikonfigurasi</div>
                  )}
                </div>

                {/* Bank Transfer Container */}
                <div className="flex flex-col justify-center space-y-2 rounded-xl bg-slate-900 p-3 font-mono text-xs text-white shadow-sm">
                  <div>
                    <div className="mb-2 flex items-center gap-2 border-b border-slate-800 pb-1.5">
                      <Landmark className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-extrabold text-white font-sans uppercase tracking-wider">Transfer Bank</span>
                    </div>

                    <div className="space-y-2 text-slate-300">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-slate-400">Bank:</span>
                        <span className="font-extrabold text-white font-sans">{bankName}</span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-slate-400">No. Rek:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-amber-300 font-mono">{bankAccountNumber}</span>
                          {bankAccountNumber !== '-' && (
                            <button
                              onClick={() => handleCopyBank(bankAccountNumber)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                              title="Salin No Rekening"
                            >
                              {copiedBank ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-slate-400">Atas Nama:</span>
                        <span className="font-bold text-white font-sans text-right">{bankAccountName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-2 font-sans text-[10px] text-slate-400">
                    Nominal: <strong className="font-mono text-amber-300">{formatRupiah(order.amount)}</strong>
                  </div>
                </div>

              </div>

              {/* Operating Verification Notice */}
              <div className="flex items-center gap-2 rounded-lg border border-amber-200/90 bg-amber-50 p-2 text-[10px] text-amber-800">
                <Clock className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span>
                  <strong>Verifikasi:</strong> {verificationHours}
                </span>
              </div>
            </div>
          )}

          {/* Activated Success Banner */}
          {order.status === 'activated' && (
            <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
              <h3 className="text-sm font-extrabold text-emerald-900">Portfolio OS Aktif</h3>
              <p className="text-[11px] text-slate-600">
                <code className="font-mono font-bold text-slate-900">makeitbetter.my.id/{order.desired_slug}</code>
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                <a
                  href={`/${order.desired_slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white shadow-sm shadow-emerald-600/20 transition-all hover:bg-emerald-700"
                >
                  Buka Website
                </a>
              </div>
            </div>
          )}

          {/* Form Upload Bukti Bayar — hidden when activated or canceled (H3: expired tetap bisa upload) */}
          {order.status !== 'activated' && order.status !== 'canceled' && (
            <div className="space-y-2 pt-1">
              <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-600" /> Bukti Pembayaran
              </h3>

              {order.status === 'expired' && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[10px] text-amber-800">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span>
                    <strong>Order Anda telah kedaluwarsa.</strong> Jika sudah terlanjur membayar, silakan upload
                    bukti sekarang — admin akan tetap membantu verifikasi manual.
                  </span>
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                {/* Upload file dari galeri/HP */}
                <div className="flex flex-1 items-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50/50 px-3 py-2">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleProofFileChange}
                    className="hidden"
                    id="proof-file-input"
                  />
                  <label
                    htmlFor="proof-file-input"
                    className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700"
                  >
                    <UploadCloud className="h-3.5 w-3.5" /> Pilih Gambar
                  </label>
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-600">
                    {proofFile ? proofFile.name : 'JPG/PNG/WebP, maks 5MB'}
                  </span>
                  <button
                    type="button"
                    disabled={!proofFile || uploadingProofFile}
                    onClick={() => void handleUploadProofFile()}
                    className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white transition-all hover:bg-slate-800 disabled:opacity-40"
                  >
                    {uploadingProofFile ? 'Mengunggah...' : 'Unggah'}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                <span>atau tempel link bukti</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              <form onSubmit={handleSubmitProof} className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="url"
                  placeholder="URL bukti transfer (mis. link gambar)"
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={submittingProof}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 disabled:opacity-50"
                >
                  {submittingProof ? 'Mengirim...' : 'Kirim URL'}
                </button>
              </form>

              {proofMessage && (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-[11px] font-medium text-emerald-700">
                  {proofMessage}
                </p>
              )}

              {/* Alternative WA Contact */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-2">
                <span className="text-[11px] font-medium text-slate-500">Perlu konfirmasi cepat?</span>
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white shadow-sm shadow-emerald-600/20 transition-all hover:bg-emerald-700"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Chat Admin
                </a>
              </div>
            </div>
          )}

          {/* Receipt Footer */}
          <div className="space-y-1 border-t border-dashed border-slate-300 pt-3 text-center text-[10px] text-slate-400">
            <div className="flex items-center justify-center gap-1 font-bold text-slate-600">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Struk Terverifikasi Portfolio OS</span>
            </div>
            <p className="text-[10px] leading-relaxed">
              Simpan tautan halaman ini (klik "Salin Link Pesanan" di atas) — tanpa tautan ini Anda tidak
              dapat melihat status pesanan kembali.
            </p>
          </div>

        </div>
          <div
            aria-hidden="true"
            className="absolute inset-x-0 -bottom-3 h-3 bg-transparent"
            style={{
              backgroundImage:
                'linear-gradient(135deg, #fffefb 50%, transparent 50%), linear-gradient(225deg, #fffefb 50%, transparent 50%)',
              backgroundPosition: '0 0, 8px 0',
              backgroundSize: '16px 16px',
              backgroundRepeat: 'repeat-x',
            }}
          />
        </motion.div>
      </div>
    </div>
  );
}
