'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TicketPercent, Plus, Save, RefreshCw, Archive, Pencil, X, Wand2 } from 'lucide-react';
import { getWritableCsrfToken } from '@/lib/security/client-csrf';
import { formatIdr } from '@/constants/pricing';
import { TEMPLATES } from '@/lib/templates/registry';

/**
 * Panel Kupon (v1.3.93) — CRUD kupon diskon checkout. OWNER ONLY.
 *
 * - Kupon dihitung SERVER (`checkoutPricing`); panel ini hanya input aturan.
 * - Kupon dan diskon bundel TIDAK ditumpuk: checkout memakai yang lebih besar.
 * - Kode boleh diketik sendiri atau diacak (huruf/angka tanpa 0/O/1/I).
 * - Penghapusan = arsip (soft delete): riwayat pemakaian tetap tersimpan.
 * - Jam ditampilkan WIB; yang dikirim ke server selalu ISO UTC.
 */

interface CouponRow {
  id: string;
  code: string;
  kind: 'percent' | 'fixed';
  value: number;
  min_subtotal: number;
  max_discount: number | null;
  applies_to: string | null;
  starts_at: string | null;
  ends_at: string | null;
  max_redemptions: number | null;
  max_per_email: number | null;
  is_active: number;
  note: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  redeemed_count: number;
  discount_total: number;
}

interface FormState {
  id: string | null;
  code: string;
  kind: 'percent' | 'fixed';
  value: string;
  minSubtotal: string;
  maxDiscount: string;
  maxRedemptions: string;
  maxPerEmail: string;
  startsAt: string;
  endsAt: string;
  note: string;
  isActive: boolean;
  appliesTo: string[];
}

const EMPTY_FORM: FormState = {
  id: null,
  code: '',
  kind: 'percent',
  value: '10',
  minSubtotal: '',
  maxDiscount: '',
  maxRedemptions: '',
  maxPerEmail: '',
  startsAt: '',
  endsAt: '',
  note: '',
  isActive: true,
  appliesTo: [],
};

function wibInputValue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const formatted = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return formatted.replace(' ', 'T');
}

function wibInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatWib(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'short',
  })} WIB`;
}

function parseAppliesTo(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

function couponStatusLabel(coupon: CouponRow): { label: string; tone: string } {
  if (coupon.archived_at || coupon.is_active !== 1) {
    return { label: 'Arsip', tone: 'bg-gray-100 text-gray-600' };
  }
  const now = Date.now();
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) {
    return { label: 'Terjadwal', tone: 'bg-sky-100 text-sky-700' };
  }
  if (coupon.ends_at && new Date(coupon.ends_at).getTime() < now) {
    return { label: 'Berakhir', tone: 'bg-amber-100 text-amber-700' };
  }
  if (coupon.max_redemptions !== null && coupon.redeemed_count >= coupon.max_redemptions) {
    return { label: 'Kuota penuh', tone: 'bg-rose-100 text-rose-700' };
  }
  return { label: 'Aktif', tone: 'bg-emerald-100 text-emerald-700' };
}

export default function CouponsPanel() {
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadCoupons = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/coupons', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setCoupons(Array.isArray(data.coupons) ? data.coupons : []);
    } catch (err) {
      console.error('[CouponsPanel] Gagal memuat kupon:', err);
      setError(err instanceof Error ? err.message : 'Gagal memuat daftar kupon.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void loadCoupons(), 0);
    return () => clearTimeout(timer);
  }, [loadCoupons]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormOpen(true);
    setStatus('');
    setError('');
  };

  const openEdit = (coupon: CouponRow) => {
    setForm({
      id: coupon.id,
      code: coupon.code,
      kind: coupon.kind,
      value: String(coupon.value),
      minSubtotal: coupon.min_subtotal ? String(coupon.min_subtotal) : '',
      maxDiscount: coupon.max_discount === null ? '' : String(coupon.max_discount),
      maxRedemptions: coupon.max_redemptions === null ? '' : String(coupon.max_redemptions),
      maxPerEmail: coupon.max_per_email === null ? '' : String(coupon.max_per_email),
      startsAt: wibInputValue(coupon.starts_at),
      endsAt: wibInputValue(coupon.ends_at),
      note: coupon.note || '',
      isActive: coupon.is_active === 1 && !coupon.archived_at,
      appliesTo: parseAppliesTo(coupon.applies_to),
    });
    setFormOpen(true);
    setStatus('');
    setError('');
  };

  const generateCode = async () => {
    try {
      const token = getWritableCsrfToken();
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
        credentials: 'include',
        body: JSON.stringify({ action: 'generate', prefix: 'HEMAT' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.code === 'string') {
        setForm((prev) => ({ ...prev, code: data.code }));
      }
    } catch {
      // Kode bisa diketik manual bila generator gagal.
    }
  };

  const toggleTemplate = (templateId: string) => {
    setForm((prev) => ({
      ...prev,
      appliesTo: prev.appliesTo.includes(templateId)
        ? prev.appliesTo.filter((id) => id !== templateId)
        : [...prev.appliesTo, templateId],
    }));
  };

  const submitForm = async () => {
    setIsSaving(true);
    setError('');
    setStatus('');
    try {
      const token = getWritableCsrfToken();
      const payload = {
        action: form.id ? 'update' : 'create',
        id: form.id || undefined,
        code: form.code,
        kind: form.kind,
        value: Number(form.value),
        minSubtotal: form.minSubtotal ? Number(form.minSubtotal) : 0,
        maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
        maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
        maxPerEmail: form.maxPerEmail ? Number(form.maxPerEmail) : null,
        startsAt: wibInputToIso(form.startsAt),
        endsAt: wibInputToIso(form.endsAt),
        note: form.note,
        isActive: form.isActive,
        appliesTo: form.appliesTo,
      };
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      setStatus(data.message || 'Kupon disimpan.');
      setFormOpen(false);
      setForm(EMPTY_FORM);
      await loadCoupons();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan kupon.');
    } finally {
      setIsSaving(false);
    }
  };

  const archive = async (coupon: CouponRow) => {
    if (!window.confirm(`Arsipkan kupon ${coupon.code}? Kupon tidak bisa dipakai lagi, riwayat tetap tersimpan.`)) {
      return;
    }
    setBusyId(coupon.id);
    setError('');
    setStatus('');
    try {
      const token = getWritableCsrfToken();
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
        credentials: 'include',
        body: JSON.stringify({ action: 'archive', id: coupon.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setStatus(data.message || 'Kupon diarsipkan.');
      await loadCoupons();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengarsipkan kupon.');
    } finally {
      setBusyId(null);
    }
  };

  const activeCount = useMemo(
    () => coupons.filter((coupon) => couponStatusLabel(coupon).label === 'Aktif').length,
    [coupons]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/50 px-6 py-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <TicketPercent size={16} className="text-amber-600" />
          <span>
            {isLoading
              ? 'Memuat…'
              : `${coupons.length} kupon · ${activeCount} aktif`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadCoupons()}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={13} />
            Segarkan
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-amber-700"
          >
            <Plus size={14} />
            Kupon Baru
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {status && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {status}
          </div>
        )}

        {formOpen && (
          <div className="rounded-xl border border-amber-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">
                {form.id ? `Ubah kupon ${form.code}` : 'Kupon baru'}
              </h3>
              <button
                onClick={() => setFormOpen(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Tutup form"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="coupon-code" className="mb-1 block text-xs font-semibold text-gray-700">Kode kupon</label>
                <div className="flex gap-2">
                  <input
                    id="coupon-code"
                    value={form.code}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
                      }))
                    }
                    placeholder="HEMAT-ABC23"
                    className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm uppercase text-gray-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  />
                  <button
                    type="button"
                    onClick={() => void generateCode()}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Wand2 size={13} />
                    Acak
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Huruf A–Z, angka, garis bawah, tanda hubung. 3–32 karakter. Huruf kecil otomatis jadi besar.
                </p>
              </div>

              <div>
                <label htmlFor="coupon-kind" className="mb-1 block text-xs font-semibold text-gray-700">Jenis diskon</label>
                <select
                  id="coupon-kind"
                  value={form.kind}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, kind: e.target.value as 'percent' | 'fixed' }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                >
                  <option value="percent">Persen (%)</option>
                  <option value="fixed">Nominal (Rp)</option>
                </select>
              </div>

              <div>
                <label htmlFor="coupon-value" className="mb-1 block text-xs font-semibold text-gray-700">
                  {form.kind === 'percent' ? 'Potongan (%)' : 'Potongan (Rp)'}
                </label>
                <input
                  id="coupon-value"
                  value={form.value}
                  inputMode="numeric"
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, value: e.target.value.replace(/[^0-9]/g, '') }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {form.kind === 'percent' ? '1–90%.' : 'Minimal Rp1.000.'}
                </p>
              </div>

              <div>
                <label htmlFor="coupon-min-subtotal" className="mb-1 block text-xs font-semibold text-gray-700">
                  Minimal belanja (Rp, opsional)
                </label>
                <input
                  id="coupon-min-subtotal"
                  value={form.minSubtotal}
                  inputMode="numeric"
                  placeholder="0"
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      minSubtotal: e.target.value.replace(/[^0-9]/g, ''),
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                />
              </div>

              <div>
                <label htmlFor="coupon-max-discount" className="mb-1 block text-xs font-semibold text-gray-700">
                  Maksimal potongan (Rp, opsional)
                </label>
                <input
                  id="coupon-max-discount"
                  value={form.maxDiscount}
                  inputMode="numeric"
                  placeholder="tanpa batas"
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      maxDiscount: e.target.value.replace(/[^0-9]/g, ''),
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                />
              </div>

              <div>
                <label htmlFor="coupon-max-redemptions" className="mb-1 block text-xs font-semibold text-gray-700">
                  Kuota pemakaian (opsional)
                </label>
                <input
                  id="coupon-max-redemptions"
                  value={form.maxRedemptions}
                  inputMode="numeric"
                  placeholder="tanpa batas"
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      maxRedemptions: e.target.value.replace(/[^0-9]/g, ''),
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                />
              </div>

              <div>
                <label htmlFor="coupon-max-per-email" className="mb-1 block text-xs font-semibold text-gray-700">
                  Batas per email (opsional)
                </label>
                <input
                  id="coupon-max-per-email"
                  value={form.maxPerEmail}
                  inputMode="numeric"
                  placeholder="tanpa batas"
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      maxPerEmail: e.target.value.replace(/[^0-9]/g, ''),
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Best-effort: pembeli yang ganti email tetap bisa memakai kode.
                </p>
              </div>

              <div>
                <label htmlFor="coupon-starts-at" className="mb-1 block text-xs font-semibold text-gray-700">
                  Mulai berlaku (WIB, opsional)
                </label>
                <input
                  id="coupon-starts-at"
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm((prev) => ({ ...prev, startsAt: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                />
              </div>

              <div>
                <label htmlFor="coupon-ends-at" className="mb-1 block text-xs font-semibold text-gray-700">
                  Berakhir (WIB, opsional)
                </label>
                <input
                  id="coupon-ends-at"
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm((prev) => ({ ...prev, endsAt: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                />
              </div>

              <div className="sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-gray-700">
                  Berlaku untuk template
                </span>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATES.map((template) => {
                    const active = form.appliesTo.includes(template.id);
                    return (
                      <button
                        key={template.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleTemplate(template.id)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          active
                            ? 'border-amber-300 bg-amber-50 text-amber-800'
                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {template.name}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Tidak memilih apa pun = berlaku untuk semua template.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="coupon-note" className="mb-1 block text-xs font-semibold text-gray-700">
                  Catatan internal (opsional)
                </label>
                <input
                  id="coupon-note"
                  value={form.note}
                  maxLength={200}
                  placeholder="contoh: promo Instagram November"
                  onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                />
              </div>

              <label htmlFor="coupon-is-active" className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  id="coupon-is-active"
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                Kupon aktif
              </label>
            </div>

            <div className="mt-5 flex items-center gap-2">
              <button
                onClick={() => void submitForm()}
                disabled={isSaving}
                className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-700 disabled:opacity-50"
              >
                <Save size={15} />
                {isSaving ? 'Menyimpan…' : 'Simpan Kupon'}
              </button>
              <button
                onClick={() => setFormOpen(false)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-gray-500">Memuat daftar kupon…</p>
        ) : coupons.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-8 text-center text-sm text-gray-500">
            Belum ada kupon. Klik <strong>Kupon Baru</strong> untuk membuat kode promo pertama.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/70 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Kode</th>
                  <th className="px-4 py-2.5 font-semibold">Potongan</th>
                  <th className="px-4 py-2.5 font-semibold">Pemakaian</th>
                  <th className="px-4 py-2.5 font-semibold">Periode</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {coupons.map((coupon) => {
                  const badge = couponStatusLabel(coupon);
                  const templates = parseAppliesTo(coupon.applies_to);
                  return (
                    <tr key={coupon.id} className="align-top">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-semibold text-gray-900">
                          {coupon.code}
                        </span>
                        {templates.length > 0 && (
                          <span className="mt-1 block text-[11px] text-gray-500">
                            {templates
                              .map((id) => TEMPLATES.find((t) => t.id === id)?.name || id)
                              .join(', ')}
                          </span>
                        )}
                        {coupon.note && (
                          <span className="mt-0.5 block text-[11px] italic text-gray-400">
                            {coupon.note}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {coupon.kind === 'percent'
                          ? `${coupon.value}%`
                          : formatIdr(coupon.value)}
                        {coupon.min_subtotal > 0 && (
                          <span className="mt-0.5 block text-[11px] text-gray-500">
                            min. {formatIdr(coupon.min_subtotal)}
                          </span>
                        )}
                        {coupon.max_discount !== null && (
                          <span className="mt-0.5 block text-[11px] text-gray-500">
                            maks. {formatIdr(coupon.max_discount)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {coupon.redeemed_count}
                        {coupon.max_redemptions !== null ? ` / ${coupon.max_redemptions}` : ' / ∞'}
                        <span className="mt-0.5 block text-[11px] text-gray-500">
                          potongan {formatIdr(coupon.discount_total)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px] leading-relaxed text-gray-600">
                        <span className="block">Mulai: {formatWib(coupon.starts_at)}</span>
                        <span className="block">Akhir: {formatWib(coupon.ends_at)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.tone}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEdit(coupon)}
                            className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-50"
                            title="Ubah kupon"
                          >
                            <Pencil size={14} />
                          </button>
                          {!coupon.archived_at && (
                            <button
                              onClick={() => void archive(coupon)}
                              disabled={busyId === coupon.id}
                              className="rounded-lg border border-gray-200 bg-white p-1.5 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                              title="Arsipkan kupon"
                            >
                              <Archive size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 text-xs leading-relaxed text-gray-500">
          <p className="mb-1 font-semibold text-gray-600">Cara kerja</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>Potongan dihitung server dari subtotal template yang memenuhi syarat.</li>
            <li>
              Kupon dan diskon bundel otomatis <strong>tidak ditumpuk</strong> — checkout memakai
              yang lebih besar. Jika nilainya sama, diskon bundel yang dipakai agar kuota kupon hemat.
            </li>
            <li>Total yang dibayar tidak pernah di bawah Rp1.000.</li>
            <li>Kuota direservasi saat order dibuat dan dilepas saat order batal/kedaluwarsa.</li>
            <li>Arsip = nonaktif permanen, bukan hapus: riwayat pemakaian tetap utuh.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
