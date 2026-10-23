'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Receipt,
  RefreshCw,
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import { getWritableCsrfToken } from '@/lib/security/client-csrf';

type OrderStatus =
  | 'pending_payment'
  | 'waiting_verification'
  | 'activating'
  | 'activated'
  | 'canceled'
  | 'expired'
  | 'failed';

/** Field yang ditampilkan saja — `access_token_hash` sengaja TIDAK dideklarasikan. */
interface OrderItem {
  id: string;
  desired_slug: string;
  buyer_name: string;
  buyer_email: string;
  buyer_whatsapp: string;
  amount: number;
  status: OrderStatus;
  payment_proof_url?: string | null;
  cancel_reason?: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

interface OrdersListPayload {
  success: boolean;
  orders?: OrderItem[];
  page?: number;
  limit?: number;
  hasMore?: boolean;
  total?: number;
  error?: string;
}

interface OrderActionPayload {
  success: boolean;
  message?: string;
  error?: string;
}

const PAGE_LIMIT = 10;

const STATUS_OPTIONS: Array<{ value: OrderStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Semua Status' },
  { value: 'pending_payment', label: 'Menunggu Pembayaran' },
  { value: 'waiting_verification', label: 'Menunggu Verifikasi' },
  { value: 'activating', label: 'Aktivasi' },
  { value: 'activated', label: 'Aktif' },
  { value: 'canceled', label: 'Dibatalkan' },
  { value: 'expired', label: 'Kedaluwarsa' },
  { value: 'failed', label: 'Gagal' },
];

const STATUS_BADGE: Record<OrderStatus, string> = {
  pending_payment: 'bg-amber-50 text-amber-700 border-amber-200',
  waiting_verification: 'bg-blue-50 text-blue-700 border-blue-200',
  activating: 'bg-violet-50 text-violet-700 border-violet-200',
  activated: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  canceled: 'bg-gray-100 text-gray-600 border-gray-200',
  expired: 'bg-orange-50 text-orange-700 border-orange-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: 'Menunggu Pembayaran',
  waiting_verification: 'Menunggu Verifikasi',
  activating: 'Aktivasi',
  activated: 'Aktif',
  canceled: 'Dibatalkan',
  expired: 'Kedaluwarsa',
  failed: 'Gagal',
};

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function formatRupiah(amount: number) {
  return rupiahFormatter.format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function OrdersPanel() {
  const { csrfToken, isAdmin, isLoading: authLoading } = useAdminAuth();
  const { confirm, prompt } = useConfirm();
  const { showSuccess, showError } = useToast();

  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  const loadOrders = useCallback(async () => {
    if (authLoading || !isAdmin) return;

    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_LIMIT) });
      if (search) params.set('search', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/admin/orders?${params.toString()}`, {
        credentials: 'include',
      });
      const payload = (await res.json()) as OrdersListPayload;
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || `HTTP ${res.status}`);
      }
      setOrders(payload.orders ?? []);
      setTotal(payload.total ?? 0);
    } catch (err) {
      console.error('[OrdersPanel] Gagal memuat order:', err);
      setError(err instanceof Error ? err.message : 'Gagal memuat daftar order. Coba segarkan.');
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, isAdmin, page, search, statusFilter]);

  // Load awal ditunda ke macrotask berikutnya agar tidak memanggil setState
  // secara sinkron di dalam effect (rule react-hooks/set-state-in-effect).
  useEffect(() => {
    const timer = window.setTimeout(() => void loadOrders(), 0);
    return () => window.clearTimeout(timer);
  }, [loadOrders]);

  const runAction = async (
    order: OrderItem,
    action: 'activate' | 'cancel' | 'reopen'
  ): Promise<void> => {
    const body: Record<string, unknown> = { orderId: order.id, action };

    if (action === 'activate') {
      const isExpired = order.status === 'expired';
      const ok = await confirm({
        title: isExpired ? 'Aktifkan order kedaluwarsa?' : 'Aktifkan order ini?',
        message: isExpired
          ? `Order ${order.id} berstatus kedaluwarsa dan akan diproses aktivasi telat (allowExpired). Pastikan mutasi pembayaran sudah dicek manual.`
          : `Order ${order.id} akan diproses aktivasi dan email "website sedang disiapkan" dikirim ke pembeli. Pastikan bukti pembayaran sudah diverifikasi.`,
        confirmText: 'Aktifkan',
        cancelText: 'Batal',
        tone: 'warning',
      });
      if (!ok) return;
      if (isExpired) body.allowExpired = true;
    }

    if (action === 'cancel') {
      const reason = await prompt({
        title: `Batalkan order ${order.id}?`,
        message: 'Bukti bayar akan dihapus dari database dan R2. Alasan wajib diisi untuk audit.',
        placeholder: 'Contoh: bukti bayar tidak valid / mutasi tidak ditemukan',
        confirmText: 'Batalkan Order',
        cancelText: 'Kembali',
        tone: 'danger',
        required: true,
      });
      if (reason === null) return;
      body.cancelReason = reason;
    }

    if (action === 'reopen') {
      const ok = await confirm({
        title: 'Buka kembali order?',
        message: `Order ${order.id} akan kembali ke antrean verifikasi. Pembeli perlu mengunggah ulang bukti bayar sebelum aktivasi.`,
        confirmText: 'Buka Kembali',
        cancelText: 'Kembali',
        tone: 'warning',
      });
      if (!ok) return;
    }

    setBusyId(order.id);
    setError('');
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': getWritableCsrfToken(csrfToken),
        },
        body: JSON.stringify(body),
      });
      const payload = (await res.json()) as OrderActionPayload;
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || 'Gagal memproses order');
      }
      showSuccess(payload.message || 'Order berhasil diperbarui');
      await loadOrders();
    } catch (err) {
      console.error('[OrdersPanel] Aksi order gagal:', err);
      const message = err instanceof Error ? err.message : 'Gagal memproses order';
      setError(message);
      showError(message);
    } finally {
      setBusyId(null);
    }
  };

  const applySearch = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const changeStatus = (value: OrderStatus | 'all') => {
    setPage(1);
    setStatusFilter(value);
  };

  const goToPage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return;
    setPage(nextPage);
  };

  const isBusy = busyId !== null;
  const showSkeleton = isLoading && orders.length === 0;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar: search + filter status + refresh */}
      <div className="shrink-0 border-b border-gray-100 bg-gray-50/50 px-6 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <form onSubmit={applySearch} className="flex items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Cari id, slug, nama, email…"
                aria-label="Cari order"
                className="w-56 rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              Cari
            </button>
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setSearch('');
                  setPage(1);
                }}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-500 shadow-sm transition-colors hover:bg-gray-50"
              >
                Reset
              </button>
            )}
          </form>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(event) => changeStatus(event.target.value as OrderStatus | 'all')}
              aria-label="Filter status order"
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadOrders()}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              Segarkan
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          {isLoading && orders.length > 0
            ? 'Memperbarui…'
            : `${orders.length} order ditampilkan · ${total} total`}
        </p>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-6" data-lenis-prevent>
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {showSkeleton ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Receipt className="mb-4 h-8 w-8 animate-pulse text-gray-400" />
            <p className="text-sm text-gray-500">Memuat daftar order…</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Receipt className="mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500">Tidak ada order untuk filter ini.</p>
          </div>
        ) : (
          <div className={`space-y-4 ${isLoading ? 'opacity-60' : ''}`}>
            {orders.map((order) => {
              const canActivate =
                order.status === 'waiting_verification' || order.status === 'expired';
              const canCancel =
                order.status !== 'canceled' &&
                order.status !== 'activated' &&
                order.status !== 'activating';
              const canReopen = order.status === 'canceled' || order.status === 'failed';
              const badge = STATUS_BADGE[order.status] ?? STATUS_BADGE.pending_payment;
              const statusLabel = STATUS_LABEL[order.status] ?? order.status;

              return (
                <article
                  key={order.id}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-gray-900">
                          {order.id}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge}`}
                        >
                          {statusLabel}
                        </span>
                      </div>

                      <p className="text-sm font-medium text-gray-800">{order.buyer_name}</p>
                      <p className="text-xs text-gray-500">
                        Slug:{' '}
                        <span className="font-mono text-gray-700">{order.desired_slug || '-'}</span>
                      </p>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>WA: {order.buyer_whatsapp || '-'}</span>
                        <span>Email: {order.buyer_email || '-'}</span>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                        <span>Dibuat: {formatDate(order.created_at)}</span>
                        <span>Kedaluwarsa: {formatDate(order.expires_at)}</span>
                      </div>

                      {order.cancel_reason && (
                        <p className="text-xs text-red-500">
                          Alasan batal: {order.cancel_reason}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-start gap-2 lg:items-end">
                      <p className="text-base font-semibold text-gray-900">
                        {formatRupiah(order.amount)}
                      </p>
                      {order.payment_proof_url ? (
                        <a
                          href={order.payment_proof_url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 underline-offset-2 hover:underline"
                        >
                          Lihat bukti bayar
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">Belum ada bukti bayar</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                    {canActivate && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void runAction(order, 'activate')}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Aktifkan
                      </button>
                    )}
                    {canCancel && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void runAction(order, 'cancel')}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" />
                        Batalkan
                      </button>
                    )}
                    {canReopen && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void runAction(order, 'reopen')}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Buka Kembali
                      </button>
                    )}
                    {!canActivate && !canCancel && !canReopen && (
                      <span className="text-xs text-gray-400">
                        Tidak ada tindakan untuk status ini.
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination sederhana */}
      {!showSkeleton && total > 0 && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-gray-100 bg-gray-50/50 px-6 py-3">
          <span className="text-xs text-gray-500">
            Halaman {page} dari {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1 || isLoading}
              aria-label="Halaman sebelumnya"
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages || isLoading}
              aria-label="Halaman berikutnya"
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
