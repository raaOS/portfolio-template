'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import {
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ExternalLink,
  AlertCircle,
  MessageCircle,
  Eye,
  X,
  CreditCard,
  ShieldAlert,
  ArrowUpRight,
  ShieldCheck,
  Link2,
  ChevronDown,
} from 'lucide-react';

interface OrderItem {
  id: string;
  site_id?: string | null;
  desired_slug: string;
  buyer_name: string;
  buyer_email: string;
  buyer_whatsapp: string;
  plan: string;
  amount: number;
  payment_method: string;
  payment_proof_url?: string | null;
  cancel_reason?: string | null;
  status: 'pending_payment' | 'waiting_verification' | 'activating' | 'activated' | 'failed' | 'expired' | 'canceled';
  expires_at: string;
  created_at: string;
  updated_at: string;
}

const STATUS_TABS = [
  { id: 'all', label: 'Semua Order' },
  { id: 'pending_payment', label: 'Pending' },
  { id: 'waiting_verification', label: 'Menunggu Verifikasi' },
  { id: 'activated', label: 'Aktif' },
  { id: 'canceled', label: 'Dibatalkan / Refund' },
  { id: 'expired', label: 'Expired' }
];

export default function OrdersPanel() {
  const { csrfToken } = useAdminAuth();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  // Modal State for Image Viewer
  const [viewImageModalUrl, setViewImageModalUrl] = useState<string | null>(null);

  // Modal State for Cancellation Reason
  const [cancelModalOrder, setCancelModalOrder] = useState<OrderItem | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [customReasonInput, setCustomReasonInput] = useState('');

  // M4: gate konfirmasi mutasi sebelum aktivasi (cegah human error admin).
  const [activateModalOrder, setActivateModalOrder] = useState<OrderItem | null>(null);
  const [mutationChecked, setMutationChecked] = useState(false);
  const [lateProofUrl, setLateProofUrl] = useState('');

  // L1: pagination.
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalOrders, setTotalOrders] = useState(0);

  const fetchOrders = useCallback(async (targetPage: number, replace: boolean) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      params.set('page', String(targetPage));
      params.set('limit', '50');

      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        const incoming: OrderItem[] = data.orders || [];
        setOrders((prev) => (replace ? incoming : [...prev, ...incoming.filter((o) => !prev.some((p) => p.id === o.id))]));
        setHasMore(Boolean(data.hasMore));
        setTotalOrders(Number(data.total || 0));
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  // Debounce fetch — reset ke halaman 1 saat filter/search berubah.
  useEffect(() => {
    const timer = setTimeout(() => void fetchOrders(1, true), 300);
    return () => clearTimeout(timer);
  }, [fetchOrders]);

  // FIX #47: Polling ringan setiap 30 detik agar admin melihat order baru
  // tanpa harus klik Refresh.
  useEffect(() => {
    const interval = setInterval(() => void fetchOrders(1, true), 30_000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    void fetchOrders(nextPage, false);
  };

  const handleOpenActivateModal = (order: OrderItem) => {
    setActivateModalOrder(order);
    setMutationChecked(false);
    setLateProofUrl('');
  };

  const handleConfirmActivate = async () => {
    if (!activateModalOrder) return;
    if (!mutationChecked) return;

    setActionLoading(activateModalOrder.id);
    setMessage('');
    try {
      const isLate = activateModalOrder.status === 'expired';
      const body: Record<string, unknown> = {
        orderId: activateModalOrder.id,
        action: 'activate',
        allowExpired: isLate || undefined,
      };
      if (isLate && lateProofUrl.trim()) {
        body.proofUrl = lateProofUrl.trim();
      }
      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal mengaktifkan order');
      }
      setMessage(`🎉 Order ${activateModalOrder.id} Berhasil Diaktifkan! Site: ${data.siteId || ''}`);
      setActivateModalOrder(null);
      await fetchOrders(1, true);
    } catch (err: unknown) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Gagal'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenCancelModal = (order: OrderItem) => {
    setCancelModalOrder(order);
    setCancelReasonInput('Bukti transfer tidak valid / mutasi saldo tidak ditemukan di m-Banking/QRIS');
    setCustomReasonInput('');
  };

  const handleConfirmCancel = async () => {
    if (!cancelModalOrder) return;
    const finalReason =
      cancelReasonInput === 'custom'
        ? customReasonInput.trim() || 'Dibatalkan oleh Admin'
        : cancelReasonInput;

    setActionLoading(cancelModalOrder.id);
    setMessage('');
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        credentials: 'include',
        body: JSON.stringify({
          orderId: cancelModalOrder.id,
          action: 'cancel',
          cancelReason: finalReason
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal membatalkan order');
      }
      setMessage(`❌ Order ${cancelModalOrder.id} Berhasil Dibatalkan. Alasan: "${finalReason}"`);
      setCancelModalOrder(null);
      await fetchOrders(1, true);
    } catch (err: unknown) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Gagal'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const formatRupiah = (num: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

  const formatTimestamp = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50/50 h-full overflow-y-auto text-slate-800 font-sans selection:bg-blue-600 selection:text-white [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      
      {/* Header Section */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/80 text-blue-600 flex items-center justify-center shrink-0 shadow-xs">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Kelola Transaksi Pembayaran
            </h1>
            <p className="text-xs text-slate-500">
              Rekap order checkout, verifikasi bukti bayar QRIS/Transfer, dan kelola refund.
            </p>
          </div>
        </div>

        <button
          onClick={() => void fetchOrders(1, true)}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 shadow-xs transition-all disabled:opacity-50 active:scale-95"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Alert Banner Message */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 font-medium flex items-center justify-between shadow-xs"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{message}</span>
            </div>
            <button onClick={() => setMessage('')} className="p-1 text-blue-500 hover:text-slate-900 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls Bar: Tab Slider & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        
        {/* Animated Sliding Light Tab Filter */}
        <div className="relative flex items-center gap-1 bg-slate-200/60 p-1.5 rounded-xl border border-slate-200/80 text-xs font-semibold select-none overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {STATUS_TABS.map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setStatusFilter(tab.id); setPage(1); }}
                className={`relative px-3.5 py-1.5 rounded-lg transition-colors z-10 whitespace-nowrap shrink-0 ${
                  isActive ? 'text-slate-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute inset-0 bg-white rounded-lg shadow-xs border border-slate-200/80 -z-10"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div className="relative min-w-[260px] flex-1 sm:flex-initial">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari Order ID, Nama, Email, WA, Slug..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 font-medium transition-all shadow-xs"
          />
        </div>
      </div>

      {/* Symmetrical Light Data Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <table className="w-full text-left text-xs text-slate-700 border-collapse">
            <thead className="bg-slate-50/80 text-slate-500 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-200/80 select-none">
              <tr>
                <th className="py-3 px-3.5 font-semibold whitespace-nowrap min-w-[130px]">Order ID & Waktu</th>
                <th className="py-3 px-3.5 font-semibold whitespace-nowrap min-w-[150px]">Pembeli</th>
                <th className="py-3 px-3.5 font-semibold whitespace-nowrap min-w-[120px]">Paket & Slug</th>
                <th className="py-3 px-3.5 font-semibold text-right whitespace-nowrap min-w-[100px]">Nominal Unik</th>
                <th className="py-3 px-3.5 font-semibold text-center whitespace-nowrap min-w-[100px]">Bukti Bayar</th>
                <th className="py-3 px-3.5 font-semibold whitespace-nowrap min-w-[140px]">Status & Catatan</th>
                <th className="py-3 px-3.5 font-semibold text-right whitespace-nowrap min-w-[160px]">Aksi Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading && orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                    <span className="text-xs font-semibold">Memuat data transaksi...</span>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <AlertCircle className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                    <span className="text-xs font-medium">Tidak ada transaksi yang cocok dengan filter.</span>
                  </td>
                </tr>
              ) : (
                orders.map((ord) => {
                  const isPendingVerif = ord.status === 'waiting_verification';
                  const isActivated = ord.status === 'activated';
                  const isCanceled = ord.status === 'canceled';

                  return (
                    <tr key={ord.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* ID & Date */}
                      <td className="py-3.5 px-4 align-top">
                        <span className="font-mono font-bold text-slate-900 text-xs block tracking-tight">{ord.id}</span>
                        <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">{formatTimestamp(ord.created_at)}</span>
                      </td>

                      {/* Buyer Details */}
                      <td className="py-3.5 px-4 align-top space-y-0.5">
                        <span className="font-semibold text-slate-900 text-xs block">{ord.buyer_name}</span>
                        <span className="text-[11px] text-slate-500 block font-mono">{ord.buyer_email}</span>
                        <a
                          href={`https://wa.me/${ord.buyer_whatsapp}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-emerald-600 hover:text-emerald-700 font-mono transition-colors pt-0.5 font-semibold"
                        >
                          <MessageCircle className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>{ord.buyer_whatsapp}</span>
                        </a>
                      </td>

                      {/* Plan & Slug */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 font-extrabold text-[10px] uppercase">
                            {ord.plan}
                          </span>
                        </div>
                        <span className="font-mono text-emerald-700 text-xs block font-bold tracking-tight">
                          /{ord.desired_slug}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 align-top text-right font-mono font-bold text-blue-600 text-xs">
                        {formatRupiah(ord.amount)}
                      </td>

                      {/* Bukti Bayar */}
                      <td className="py-3.5 px-4 align-top text-center">
                        {ord.payment_proof_url ? (
                          <button
                            onClick={() => setViewImageModalUrl(ord.payment_proof_url || null)}
                            className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all border border-slate-200 shadow-xs active:scale-95"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>Lihat Resi</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-mono inline-block py-1">Belum Upload</span>
                        )}
                      </td>

                      {/* Status & Cancel Reason */}
                      <td className="py-3.5 px-4 align-top space-y-1.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider whitespace-nowrap shrink-0 ${
                            isActivated
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isPendingVerif
                              ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                              : isCanceled
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            isActivated ? 'bg-emerald-500' : isPendingVerif ? 'bg-amber-500' : isCanceled ? 'bg-rose-500' : 'bg-slate-400'
                          }`} />
                          <span className="whitespace-nowrap">
                            {ord.status === 'pending_payment'
                              ? 'Pending'
                              : ord.status === 'waiting_verification'
                              ? 'Menunggu Verifikasi'
                              : ord.status === 'activated'
                              ? 'Aktif'
                              : ord.status === 'canceled'
                              ? 'Dibatalkan'
                              : ord.status}
                          </span>
                        </span>

                        {isCanceled && ord.cancel_reason && (
                          <div className="p-2 rounded-lg bg-rose-50/80 border border-rose-200/80 text-[10px] text-rose-800 leading-normal max-w-xs font-medium whitespace-normal">
                            <strong className="text-rose-900">Alasan:</strong> {ord.cancel_reason}
                          </div>
                        )}
                      </td>

                      {/* Action Buttons Symmetrically Aligned */}
                      <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap shrink-0">
                          {ord.status === 'waiting_verification' && (
                            <button
                              onClick={() => handleOpenActivateModal(ord)}
                              disabled={actionLoading === ord.id}
                              className="h-8 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all disabled:opacity-50 inline-flex items-center justify-center gap-1.5 shadow-xs active:scale-95 whitespace-nowrap shrink-0"
                              title="Verifikasi & Aktifkan Order (cek mutasi dulu)"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span className="whitespace-nowrap">Aktifkan</span>
                            </button>
                          )}

                          {ord.status === 'expired' && (
                            <button
                              onClick={() => handleOpenActivateModal(ord)}
                              disabled={actionLoading === ord.id}
                              className="h-8 px-3.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition-all disabled:opacity-50 inline-flex items-center justify-center gap-1.5 shadow-xs active:scale-95 whitespace-nowrap shrink-0"
                              title="Pembeli sudah bayar tapi order kedaluwarsa — aktivasi manual setelah cek mutasi"
                            >
                              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                              <span className="whitespace-nowrap">Aktivasi (Late)</span>
                            </button>
                          )}

                          {ord.status !== 'canceled' && ord.status !== 'activated' && ord.status !== 'activating' && (
                            <button
                              onClick={() => handleOpenCancelModal(ord)}
                              disabled={actionLoading === ord.id}
                              className="h-8 px-3.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 hover:text-rose-800 text-xs font-semibold transition-all disabled:opacity-50 inline-flex items-center justify-center gap-1.5 active:scale-95 whitespace-nowrap shrink-0"
                              title="Batalkan Order / Refund"
                            >
                              <XCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                              <span className="whitespace-nowrap">Batalkan</span>
                            </button>
                          )}

                          {isActivated && (
                            <a
                              href={`/${ord.desired_slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all inline-flex items-center justify-center active:scale-95 shrink-0"
                              title="Buka Website Portofolio"
                            >
                              <ArrowUpRight className="w-4 h-4 text-blue-600 shrink-0" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* L1: pagination footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200/80 px-4 py-3 text-[11px] text-slate-500">
          <span className="font-medium">
            Menampilkan {orders.length} dari {totalOrders} transaksi
          </span>
          {hasMore && (
            <button
              onClick={handleLoadMore}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition-all disabled:opacity-50 active:scale-95"
            >
              <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
              Muat Lebih Banyak
            </button>
          )}
        </div>
      </div>

      {/* Modal View Image Resi Transfer */}
      <AnimatePresence>
        {viewImageModalUrl && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 p-5 space-y-4 shadow-2xl relative"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-600" /> Gambar Resi Bukti Transfer
                </h3>
                <button
                  onClick={() => setViewImageModalUrl(null)}
                  className="p-1 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-slate-900 rounded-xl p-2 max-h-[65vh] overflow-auto flex justify-center border border-slate-800">
                <img
                  src={viewImageModalUrl}
                  alt="Resi Bukti Transfer Pembayaran"
                  className="max-h-[58vh] object-contain rounded-lg"
                />
              </div>

              <div className="flex justify-between items-center text-xs pt-1">
                <a
                  href={viewImageModalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                >
                  <span>Buka Gambar Asli</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={() => setViewImageModalUrl(null)}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors shadow-xs"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Alasan Pembatalan Order */}
      <AnimatePresence>
        {cancelModalOrder && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full border border-slate-200 p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-sm font-bold text-rose-600 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600" /> Batalkan Order {cancelModalOrder.id}
                </h3>
                <button
                  onClick={() => setCancelModalOrder(null)}
                  className="p-1 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-600 font-medium">
                Pilih alasan pembatalan untuk pembeli <strong className="text-slate-900">{cancelModalOrder.buyer_name}</strong>:
              </p>

              <div className="space-y-2 text-xs">
                {[
                  'Bukti transfer tidak valid / mutasi saldo tidak ditemukan di m-Banking/QRIS',
                  'Permintaan refund dari pembeli (Garansi Money-Back 3 Hari)',
                  'Batas waktu pembayaran berakhir (Expired)',
                  'custom'
                ].map((reasonOption) => (
                  <label
                    key={reasonOption}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      cancelReasonInput === reasonOption
                        ? 'bg-rose-50 border-rose-300 text-rose-900 font-semibold'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="cancelReasonOption"
                      value={reasonOption}
                      checked={cancelReasonInput === reasonOption}
                      onChange={() => setCancelReasonInput(reasonOption)}
                      className="mt-0.5 accent-rose-600 shrink-0"
                    />
                    <span className="text-xs leading-snug">
                      {reasonOption === 'custom' ? 'Tuliskan Alasan Kustom Lainnya...' : reasonOption}
                    </span>
                  </label>
                ))}
              </div>

              {cancelReasonInput === 'custom' && (
                <textarea
                  rows={3}
                  placeholder="Tuliskan alasan pembatalan kustom..."
                  value={customReasonInput}
                  onChange={(e) => setCustomReasonInput(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-600 font-medium transition-all"
                />
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  onClick={() => setCancelModalOrder(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={() => void handleConfirmCancel()}
                  disabled={actionLoading === cancelModalOrder.id}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs disabled:opacity-50 transition-all"
                >
                  {actionLoading === cancelModalOrder.id ? 'Memproses...' : 'Konfirmasi Batalkan'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Konfirmasi Aktivasi (M4: gate cek mutasi + H3: late activation) */}
      <AnimatePresence>
        {activateModalOrder && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full border border-slate-200 p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-sm font-bold text-emerald-600 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  {activateModalOrder.status === 'expired' ? 'Aktivasi Order Kedaluwarsa (Late)' : 'Verifikasi & Aktifkan Order'}
                </h3>
                <button
                  onClick={() => setActivateModalOrder(null)}
                  className="p-1 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-slate-600 space-y-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Order</span>
                  <strong className="text-slate-900">{activateModalOrder.id}</strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Pembeli</span>
                  <strong className="text-slate-900">{activateModalOrder.buyer_name}</strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Total</span>
                  <strong className="text-slate-900">{formatRupiah(Number(activateModalOrder.amount) || 0)}</strong>
                </div>
                {activateModalOrder.status === 'expired' && (
                  <div className="flex justify-between gap-2 text-amber-700">
                    <span className="text-amber-600">Batas pembayaran</span>
                    <strong>{formatTimestamp(activateModalOrder.expires_at)}</strong>
                  </div>
                )}
              </div>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white cursor-pointer transition-all hover:border-emerald-300">
                <input
                  type="checkbox"
                  checked={mutationChecked}
                  onChange={(e) => setMutationChecked(e.target.checked)}
                  className="mt-0.5 accent-emerald-600 shrink-0"
                />
                <span className="text-xs leading-snug text-slate-700">
                  Saya sudah <strong>cek mutasi masuk secara manual</strong> (m-Banking / aplikasi QRIS merchant) dan
                  dana terkonfirmasi diterima sebesar nominal order ini.
                </span>
              </label>

              {activateModalOrder.status === 'expired' && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-amber-500" />
                    URL Bukti Pembayaran (opsional, untuk arsip & notifikasi Telegram)
                  </p>
                  <input
                    type="url"
                    value={lateProofUrl}
                    onChange={(e) => setLateProofUrl(e.target.value)}
                    placeholder="https://cdn.../bukti-bayar.jpg"
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-medium transition-all"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  onClick={() => setActivateModalOrder(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={() => void handleConfirmActivate()}
                  disabled={!mutationChecked || actionLoading === activateModalOrder.id}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {actionLoading === activateModalOrder.id ? 'Memproses...' : 'Konfirmasi Aktivasi'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
