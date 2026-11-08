'use client';

import { useEffect, useState } from 'react';

/**
 * Wizard aktivasi media (deferred R2, v1.3.78).
 *
 * Tampil HANYA saat URL memuat `?onboard=<token>` dan token valid — situs
 * publik tanpa token tidak pernah berubah. Komponen membaca token dari
 * `window.location.search` (BUKAN `useSearchParams`) supaya halaman home yang
 * ISR tidak membakar token ke cache HTML. Endpoint status publik read-only:
 * `/api/onboarding/r2-status?token=...`.
 *
 * Alur yang dipandu (klien):
 *  1. Login dash.cloudflare.com pakai akun yang dibuatkan owner (cek WA).
 *  2. Buka R2 → Enable → verifikasi pembayaran PayPal/kartu debit (GRATIS).
 *  3. Kabari owner via WhatsApp → owner klik "Selesaikan Setup" di portal.
 *
 * Kredensial TIDAK PERNAH dirender di situs — hanya lewat WhatsApp owner.
 */

type WizardPending = {
  status: 'menunggu-aktivasi';
  siteName: string;
  dashboardUrl: string;
  whatsappUrl: string;
};

type WizardState = WizardPending | { status: 'selesai' } | null;

export default function R2ActivationWizard() {
  const [state, setState] = useState<WizardState>(null);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('onboard');
    if (!token) return;

    let cancelled = false;
    fetch(`/api/onboarding/r2-status?token=${encodeURIComponent(token)}`)
      .then(async (res) => (res.ok ? ((await res.json()) as WizardState) : null))
      .then((data) => {
        if (
          !cancelled &&
          data &&
          (data.status === 'menunggu-aktivasi' || data.status === 'selesai')
        ) {
          setState(data);
        }
      })
      .catch(() => {
        // Jaringan/infra gagal → overlay tetap tidak tampil (fail-closed).
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state) return null;

  if (state.status === 'selesai') {
    return (
      <div className="fixed bottom-4 right-4 z-[100001] max-w-xs rounded-xl border border-emerald-200 bg-white p-4 shadow-xl">
        <p className="text-sm font-semibold text-emerald-700">✅ Media aktif</p>
        <p className="mt-1 text-xs text-slate-600">
          Aktivasi media untuk situs ini sudah selesai. Silakan upload foto &amp; video di ruang
          admin.
        </p>
        <button
          type="button"
          onClick={() => setState(null)}
          className="mt-2 text-xs font-medium text-slate-500 underline hover:text-slate-700"
        >
          Tutup
        </button>
      </div>
    );
  }

  const { siteName, dashboardUrl, whatsappUrl } = state;

  return (
    <div
      className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Aktivasi media situs"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
          Aktivasi media — 5 menit
        </p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">
          Aktifkan media untuk situs <span className="text-indigo-600">{siteName}</span>
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Website kamu sudah online! Tinggal satu langkah gratis agar upload foto &amp; video
          berfungsi. <strong>GRATIS — tanpa tagihan</strong>, hanya verifikasi akun.
        </p>

        <ol className="mt-4 space-y-3 text-sm text-slate-700">
          <li className="rounded-lg bg-slate-50 p-3">
            <strong>1. Buka dasbor Cloudflare</strong>
            <p className="mt-1 text-slate-600">
              Login pakai akun Cloudflare yang dibuatkan untuk kamu (cek WhatsApp) —{' '}
              <strong>bukan akun pribadi</strong>.
            </p>
            <a
              href={dashboardUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
            >
              Buka dasbor Cloudflare →
            </a>
          </li>
          <li className="rounded-lg bg-slate-50 p-3">
            <strong>2. Aktifkan R2</strong>
            <p className="mt-1 text-slate-600">
              Klik <strong>R2</strong> → <strong>Enable R2</strong> → lengkapi verifikasi dengan{' '}
              <strong>PayPal</strong> atau <strong>kartu debit berlogo Visa/Mastercard</strong>.
              Tidak ada biaya — portfolio kamu jauh di bawah batas gratis.
            </p>
          </li>
          <li className="rounded-lg bg-slate-50 p-3">
            <strong>3. Kabari kami</strong>
            <p className="mt-1 text-slate-600">
              Setelah selesai, kirim WhatsApp di bawah ini. Media aktif maksimal 1×24 jam (kami
              yang menyelesaikan dari sisi admin).
            </p>
            {whatsappUrl ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                💬 Kabari via WhatsApp
              </a>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                Hubungi admin via WhatsApp seperti biasa setelah langkah 2 selesai.
              </p>
            )}
          </li>
        </ol>

        <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
          Kartu &amp; password kamu hanya dimasukkan di halaman resmi Cloudflare — tidak pernah
          melewati situs ini. Sebaiknya ganti password Cloudflare setelah login pertama.
        </p>

        <button
          type="button"
          onClick={() => setState(null)}
          className="mt-4 w-full rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
        >
          Nanti saja — tutup dulu
        </button>
      </div>
    </div>
  );
}
