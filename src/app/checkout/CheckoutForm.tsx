'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BASE_PRICE, formatIdr } from '@/constants/pricing';
import { TEMPLATES } from '@/lib/templates/registry';

/**
 * Form checkout (client). Gerbang `isStorefrontDeployment()` ada di
 * `page.tsx` (server) — komponen ini tidak boleh dipanggil di situs klien.
 *
 * Sejak v1.3.93 pembeli boleh memilih SATU ATAU BEBERAPA template dalam satu
 * checkout (satu order, satu pembayaran QRIS). Harga & diskon di layar adalah
 * hasil `/api/billing/quote` (dihitung server dari D1 owner); nominal yang
 * ditagih selalu dihitung ulang oleh `createOrder` dengan modul yang sama.
 *
 * `initialTemplateId` datang dari `?template=<id>` (mis. tombol "Pesan" di
 * overlay demo hero). Nilai tak dikenal jatuh ke template pertama.
 */
interface QuoteItem {
  templateId: string;
  name: string;
  listPrice: number;
  discount: number;
  finalPrice: number;
}

interface QuoteData {
  success: boolean;
  items: QuoteItem[];
  itemCount: number;
  subtotal: number;
  bundlePercent: number;
  bundleDiscount: number;
  couponCode: string | null;
  couponDiscount: number;
  appliedDiscount: number;
  appliedSource: 'none' | 'bundle' | 'coupon';
  total: number;
  couponMessage: string | null;
}

const NORMALIZE_COUPON = (value: string) =>
  value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');

export default function CheckoutForm({ initialTemplateId }: { initialTemplateId?: string }) {
  const router = useRouter();
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerWhatsapp, setBuyerWhatsapp] = useState('');
  const [desiredSlug, setDesiredSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugSuggestions, setSlugSuggestions] = useState<string[]>([]);
  const [slugStatus, setSlugStatus] = useState<{
    slug: string;
    state: 'idle' | 'checking' | 'available' | 'unavailable';
    message: string;
  }>({ slug: '', state: 'idle', message: '' });
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const known = TEMPLATES.find((t) => t.id === initialTemplateId);
    return [known ? known.id : TEMPLATES[0].id];
  });
  const [couponInput, setCouponInput] = useState('');
  const [couponApplied, setCouponApplied] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [paymentActive, setPaymentActive] = useState(true);

  // Harga tampil fallback; sumber sebenarnya adalah respons quote (D1 owner).
  const [basePrice, setBasePrice] = useState(BASE_PRICE);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setBuyerName(name);

    const clean = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24);

    if (clean) {
      const suggestions = [clean, `${clean}-portfolio`, `karya-${clean}`];
      setSlugSuggestions(suggestions);
      if (!slugTouched) {
        setDesiredSlug(clean);
      }
    } else {
      setSlugSuggestions([]);
      if (!slugTouched) {
        setDesiredSlug('');
      }
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/billing/payment-info');
        const data = await res.json();
        if (data.success && typeof data.isActive === 'boolean') {
          setPaymentActive(data.isActive);
        }
        if (typeof data.basePrice === 'number' && data.basePrice > 0) {
          setBasePrice(data.basePrice);
        }
      } catch {
        // Keep default
      }
    })();
  }, []);

  // Cek ketersediaan slug real-time (endpoint GET yang sudah ada, rate limit
  // 30/menit). Debounce 600 ms supaya mengetik tidak membanjiri D1; pembatalan
  // via AbortController mencegah hasil lama menimpa hasil baru.
  useEffect(() => {
    const slug = desiredSlug.trim();
    if (slug.length < 3) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSlugStatus({ slug, state: 'checking', message: 'Memeriksa ketersediaan alamat…' });
      try {
        const res = await fetch(`/api/billing/checkout?slug=${encodeURIComponent(slug)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (data.available) {
          setSlugStatus({
            slug,
            state: 'available',
            message: `Nama alamat "${data.slug ?? slug}" tersedia.`,
          });
        } else {
          setSlugStatus({
            slug,
            state: 'unavailable',
            message: data.reason || 'Alamat ini tidak bisa dipakai.',
          });
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') return;
        // Kegagalan jaringan bukan alasan memblokir pembeli: server tetap
        // memvalidasi slug saat submit.
        setSlugStatus({ slug, state: 'idle', message: '' });
      }
    }, 600);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [desiredSlug]);

  // Hitung ulang rincian harga setiap pilihan template / kupon berubah.
  // Debounce pendek agar klik cepat beberapa template hanya memicu satu request.
  const selectedKey = selectedIds.join(',');
  useEffect(() => {
    const ids = selectedKey ? selectedKey.split(',') : [];
    // Minimal satu template selalu terpilih (toggleTemplate menahannya), jadi
    // cabang kosong hanya jaring pengaman — jangan setState di body effect.
    if (ids.length === 0) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setQuoteLoading(true);
      try {
        const res = await fetch('/api/billing/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateIds: ids, couponCode: couponApplied || undefined }),
          signal: controller.signal,
        });
        const data = (await res.json()) as QuoteData;
        if (res.ok && data.success) {
          setQuote(data);
          if (typeof data.items?.[0]?.listPrice === 'number' && data.items[0].listPrice > 0) {
            setBasePrice(data.items[0].listPrice);
          }
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') return;
        // Biarkan nilai terakhir tampil; createOrder tetap menghitung ulang.
      } finally {
        setQuoteLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [selectedKey, couponApplied]);

  const toggleTemplate = (id: string) => {
    setErrorMessage('');
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        // Minimal satu template harus tetap dipilih.
        return prev.length === 1 ? prev : prev.filter((item) => item !== id);
      }
      return TEMPLATES.filter((t) => prev.includes(t.id) || t.id === id).map((t) => t.id);
    });
  };

  const applyCoupon = useCallback(() => {
    const code = NORMALIZE_COUPON(couponInput);
    setErrorMessage('');
    if (code.length < 3) {
      setCouponApplied(null);
      setErrorMessage('Kode kupon terlalu pendek.');
      return;
    }
    setCouponInput(code);
    setCouponApplied(code);
  }, [couponInput]);

  const clearCoupon = useCallback(() => {
    setCouponApplied(null);
    setCouponInput('');
  }, []);

  const slugCheck =
    slugStatus.slug === desiredSlug.trim() ? slugStatus : { state: 'idle' as const, message: '' };

  const total = quote?.total ?? basePrice * selectedIds.length;
  const itemCount = quote?.itemCount ?? selectedIds.length;
  const subtotal = quote?.subtotal ?? basePrice * selectedIds.length;
  const couponNotice = useMemo(() => {
    if (!quote) return null;
    if (quote.couponMessage) return quote.couponMessage;
    if (quote.appliedSource === 'bundle' && couponApplied) {
      return 'Kupon valid, tetapi diskon bundel otomatis lebih besar — diskon bundel yang dipakai (tidak ditumpuk).';
    }
    if (quote.couponCode && quote.appliedSource === 'coupon') {
      // Pakai `appliedDiscount` (bukan `couponDiscount` mentah) supaya angka di
      // sini selalu sama dengan baris diskon di ringkasan — kupon nominal besar
      // dipangkas oleh batas bawah Rp1.000.
      return `Kupon ${quote.couponCode} dipakai — potongan ${formatIdr(quote.appliedDiscount)}.`;
    }
    return null;
  }, [quote, couponApplied]);
  const couponError = Boolean(quote?.couponMessage);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!paymentActive) {
      setErrorMessage('Pembayaran sedang tidak aktif. Silakan coba lagi nanti.');
      return;
    }

    if (slugCheck.state === 'unavailable') {
      setErrorMessage(slugCheck.message || 'Alamat website tidak tersedia. Pilih alamat lain.');
      return;
    }

    // Kode yang diketik tapi belum ditekan "Terapkan" dulu terbuang diam-diam →
    // pembeli tertagih harga penuh. Blokir supaya selisih harga tidak mengejutkan.
    const pendingCoupon = NORMALIZE_COUPON(couponInput);
    if (pendingCoupon && pendingCoupon !== couponApplied) {
      setErrorMessage(
        'Kode kupon belum diterapkan. Klik "Terapkan" untuk memakainya, atau kosongkan kolom kupon.'
      );
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerName: buyerName.trim(),
          buyerEmail: buyerEmail.trim(),
          buyerWhatsapp: buyerWhatsapp.trim(),
          desiredSlug: desiredSlug.trim().toLowerCase(),
          templateIds: selectedIds,
          couponCode: couponApplied || undefined,
        }),
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

  return (
    <div className="checkout-page">
      <nav className="checkout-nav">
        <Link href="/" className="checkout-logo">
          Make it Better Studio
        </Link>
      </nav>

      <div className="checkout-container">
        <div className="checkout-info">
          <h1>Checkout</h1>
          <p className="checkout-desc">
            Pilih satu atau beberapa template sekaligus. Semua template yang dipilih
            dibayar dalam satu tagihan QRIS dan bisa diakses dari satu akun.
          </p>

          <div className="checkout-price-box">
            <span className="checkout-price-label">
              Total pembayaran · {itemCount} template
            </span>
            <span className="checkout-price-value">
              {quoteLoading && !quote ? '…' : formatIdr(total)}
            </span>
          </div>

          <ul className="checkout-includes">
            <li>Source code template lengkap</li>
            <li>Admin panel self-service</li>
            <li>Setup dan deploy ke Cloudflare</li>
            <li>Media pipeline (R2 + kompresi otomatis)</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="checkout-form">
          <div className="checkout-field">
            <label htmlFor="checkout-name">Nama lengkap</label>
            <input
              id="checkout-name"
              type="text"
              required
              placeholder="Nama Anda"
              value={buyerName}
              onChange={handleNameChange}
            />
          </div>

          <div className="checkout-field">
            <label htmlFor="checkout-slug">Alamat website yang diinginkan (Slug URL)</label>
            <input
              id="checkout-slug"
              type="text"
              required
              placeholder="contoh: budi-kreatif"
              value={desiredSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setDesiredSlug(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, '')
                    .replace(/^-+/, '')
                );
              }}
            />
            <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#666' }}>
              Nama alamat website Anda:{' '}
              <code style={{ background: '#1a1a1a', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 600, color: '#e5e5e5' }}>
                {desiredSlug || 'nama-anda'}
              </code>
              <br />
              Nama ini <strong>akan dipakai</strong> untuk situs Anda. Alamat lengkapnya
              kami kabarkan saat situs online (nama ini tidak bisa dipakai pembeli lain).
              Situs baru aktif setelah pembayaran diverifikasi serta setup selesai
              (maksimal 1×24 jam kerja), dan nanti bisa disambungkan ke domain pribadi
              (.com / .id) kapan saja bila diperlukan.
            </div>

            {slugCheck.state !== 'idle' && (
              <div
                role="status"
                aria-live="polite"
                style={{
                  marginTop: '0.35rem',
                  fontSize: '0.75rem',
                  color:
                    slugCheck.state === 'available'
                      ? '#4ade80'
                      : slugCheck.state === 'unavailable'
                        ? '#f87171'
                        : '#888',
                }}
              >
                {slugCheck.state === 'available' ? '✓ ' : slugCheck.state === 'unavailable' ? '✕ ' : ''}
                {slugCheck.message}
              </div>
            )}

            {slugSuggestions.length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#666', marginRight: '0.5rem' }}>Pilihan saran:</span>
                <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.25rem' }}>
                  {slugSuggestions.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => {
                        setDesiredSlug(sug);
                        setSlugTouched(true);
                      }}
                      style={{
                        fontSize: '0.72rem',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '9999px',
                        border: desiredSlug === sug ? '1px solid #60a5fa' : '1px solid #333',
                        background: desiredSlug === sug ? '#172554' : '#111',
                        color: desiredSlug === sug ? '#bfdbfe' : '#94a3b8',
                        fontWeight: desiredSlug === sug ? 600 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="checkout-field">
            <label htmlFor="checkout-email">Email</label>
            <input
              id="checkout-email"
              type="email"
              required
              placeholder="email@contoh.com"
              value={buyerEmail}
              onChange={(e) => setBuyerEmail(e.target.value)}
            />
          </div>

          <div className="checkout-field">
            <label htmlFor="checkout-wa">Nomor WhatsApp</label>
            <input
              id="checkout-wa"
              type="tel"
              required
              placeholder="6281234567890"
              value={buyerWhatsapp}
              onChange={(e) => setBuyerWhatsapp(e.target.value)}
            />
          </div>

          <fieldset className="checkout-field checkout-templates">
            <legend>Pilih template (boleh lebih dari satu)</legend>
            <div className="checkout-template-grid">
              {TEMPLATES.map((t) => {
                const active = selectedIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleTemplate(t.id)}
                    className={`checkout-template-card${active ? ' active' : ''}`}
                  >
                    <span className="checkout-template-check" aria-hidden="true">
                      {active ? '✓' : ''}
                    </span>
                    <span className="checkout-template-body">
                      <span className="checkout-template-name">{t.name}</span>
                      <span className="checkout-template-desc">{t.description}</span>
                      <span className="checkout-template-price">{formatIdr(basePrice)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="checkout-field">
            <label htmlFor="checkout-coupon">Kode kupon (opsional)</label>
            <div className="checkout-coupon-row">
              <input
                id="checkout-coupon"
                type="text"
                placeholder="HEMAT-XXXXX"
                value={couponInput}
                onChange={(e) => {
                  const next = e.target.value.toUpperCase();
                  setCouponInput(next);
                  if (couponApplied && NORMALIZE_COUPON(next) !== couponApplied) {
                    setCouponApplied(null);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyCoupon();
                  }
                }}
                autoComplete="off"
              />
              {couponApplied ? (
                <button type="button" className="checkout-coupon-btn" onClick={clearCoupon}>
                  Hapus
                </button>
              ) : (
                <button type="button" className="checkout-coupon-btn" onClick={applyCoupon}>
                  Terapkan
                </button>
              )}
            </div>
            {couponNotice && (
              <div
                role="status"
                aria-live="polite"
                className={`checkout-coupon-note${couponError ? ' error' : ''}`}
              >
                {couponNotice}
              </div>
            )}
          </div>

          <div className="checkout-summary" aria-live="polite">
            <div className="checkout-summary-row">
              <span>Subtotal ({itemCount} template)</span>
              <span>{formatIdr(subtotal)}</span>
            </div>
            {quote && quote.appliedSource === 'bundle' && quote.appliedDiscount > 0 && (
              <div className="checkout-summary-row discount">
                <span>Diskon bundel {quote.bundlePercent}%</span>
                <span>−{formatIdr(quote.appliedDiscount)}</span>
              </div>
            )}
            {quote && quote.appliedSource === 'coupon' && quote.appliedDiscount > 0 && (
              <div className="checkout-summary-row discount">
                <span>Kupon {quote.couponCode}</span>
                <span>−{formatIdr(quote.appliedDiscount)}</span>
              </div>
            )}
            <div className="checkout-summary-row total">
              <span>Total</span>
              <span>{formatIdr(total)}</span>
            </div>
            <p className="checkout-summary-hint">
              Halaman berikutnya menampilkan kode unik QRIS (≤ Rp999) yang ditambahkan ke
              nominal ini agar pembayaran Anda mudah dicocokkan.
            </p>
          </div>

          {errorMessage && <div className="checkout-error">{errorMessage}</div>}

          {!paymentActive && !errorMessage && (
            <div className="checkout-warning">Pembayaran sedang tidak aktif.</div>
          )}

          <button type="submit" disabled={loading || !paymentActive} className="checkout-btn">
            {loading ? 'Memproses...' : `Pesan — ${formatIdr(total)}`}
          </button>

          <p className="checkout-consent">
            Dengan memesan, Anda menyetujui{' '}
            <Link href="/syarat-ketentuan" target="_blank" rel="noopener noreferrer">
              Syarat &amp; Ketentuan
            </Link>{' '}
            dan{' '}
            <Link href="/kebijakan-privasi" target="_blank" rel="noopener noreferrer">
              Kebijakan Privasi
            </Link>{' '}
            Make it Better Studio.
          </p>
        </form>
      </div>

      <style jsx>{`
        .checkout-page {
          min-height: 100vh;
          background: #0a0a0a;
          color: #e5e5e5;
          font-family: var(--font-sans);
          -webkit-font-smoothing: antialiased;
        }

        .checkout-nav {
          padding: 20px 32px;
          max-width: 860px;
          margin: 0 auto;
        }

        .checkout-logo {
          font-size: 16px;
          font-weight: 700;
          color: #fff;
          text-decoration: none;
          letter-spacing: -0.02em;
        }

        .checkout-container {
          max-width: 860px;
          margin: 0 auto;
          padding: 40px 32px 80px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 48px;
          align-items: start;
        }

        @media (max-width: 720px) {
          .checkout-container {
            grid-template-columns: 1fr;
            gap: 32px;
            padding: 24px 20px 60px;
          }
        }

        .checkout-info h1 {
          font-size: 28px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 8px;
          letter-spacing: -0.02em;
        }

        .checkout-desc {
          font-size: 14px;
          color: #888;
          line-height: 1.6;
          margin: 0 0 24px;
        }

        .checkout-price-box {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          padding: 16px 0;
          border-top: 1px solid #222;
          border-bottom: 1px solid #222;
          margin-bottom: 24px;
        }

        .checkout-price-label {
          font-size: 14px;
          color: #888;
        }

        .checkout-price-value {
          font-size: 24px;
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.02em;
          white-space: nowrap;
        }

        .checkout-includes {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .checkout-includes li {
          font-size: 13px;
          color: #888;
          padding: 6px 0;
          border-bottom: 1px solid #1a1a1a;
        }

        .checkout-includes li::before {
          content: '—  ';
          color: #444;
        }

        .checkout-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .checkout-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        fieldset.checkout-field {
          border: none;
          padding: 0;
          margin: 0;
          min-width: 0;
        }

        .checkout-field label,
        .checkout-field legend {
          font-size: 13px;
          font-weight: 500;
          color: #888;
          padding: 0;
        }

        .checkout-field input {
          background: #111;
          border: 1px solid #222;
          border-radius: 8px;
          padding: 12px 14px;
          font-size: 14px;
          color: #e5e5e5;
          outline: none;
          transition: border-color 0.15s;
          font-family: inherit;
          width: 100%;
        }

        .checkout-field input:focus {
          border-color: #555;
        }

        .checkout-field input::placeholder {
          color: #444;
        }

        .checkout-template-grid {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 4px;
        }

        .checkout-template-card {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          width: 100%;
          text-align: left;
          background: #111;
          border: 1px solid #222;
          border-radius: 10px;
          padding: 12px 14px;
          cursor: pointer;
          font-family: inherit;
          transition: border-color 0.15s, background 0.15s;
        }

        .checkout-template-card:hover {
          border-color: #333;
        }

        .checkout-template-card.active {
          border-color: #60a5fa;
          background: #101a2b;
        }

        .checkout-template-check {
          flex: 0 0 auto;
          width: 18px;
          height: 18px;
          margin-top: 2px;
          border-radius: 5px;
          border: 1px solid #444;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          line-height: 1;
          color: #0a0a0a;
          background: transparent;
        }

        .checkout-template-card.active .checkout-template-check {
          background: #60a5fa;
          border-color: #60a5fa;
        }

        .checkout-template-body {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .checkout-template-name {
          font-size: 14px;
          font-weight: 600;
          color: #e5e5e5;
        }

        .checkout-template-desc {
          font-size: 12px;
          color: #777;
          line-height: 1.45;
        }

        .checkout-template-price {
          font-size: 12px;
          color: #94a3b8;
          margin-top: 2px;
        }

        .checkout-coupon-row {
          display: flex;
          gap: 8px;
        }

        .checkout-coupon-row input {
          flex: 1;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .checkout-coupon-btn {
          padding: 0 16px;
          border-radius: 8px;
          border: 1px solid #333;
          background: #1a1a1a;
          color: #e5e5e5;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          white-space: nowrap;
          transition: background 0.15s, border-color 0.15s;
        }

        .checkout-coupon-btn:hover {
          background: #222;
          border-color: #444;
        }

        .checkout-coupon-note {
          font-size: 12px;
          color: #4ade80;
          line-height: 1.5;
          margin-top: 2px;
        }

        .checkout-coupon-note.error {
          color: #f87171;
        }

        .checkout-summary {
          border-top: 1px solid #222;
          border-bottom: 1px solid #222;
          padding: 14px 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .checkout-summary-row {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          font-size: 13px;
          color: #888;
        }

        .checkout-summary-row.discount {
          color: #4ade80;
        }

        .checkout-summary-row.total {
          font-size: 16px;
          font-weight: 700;
          color: #fff;
          padding-top: 6px;
          border-top: 1px dashed #262626;
        }

        .checkout-summary-hint {
          margin: 0;
          font-size: 11px;
          line-height: 1.55;
          color: #666;
        }

        .checkout-error {
          font-size: 13px;
          color: #f87171;
          padding: 10px 14px;
          border: 1px solid #422;
          border-radius: 8px;
          background: #1a0a0a;
        }

        .checkout-warning {
          font-size: 13px;
          color: #c90;
          padding: 10px 14px;
          border: 1px solid #432;
          border-radius: 8px;
          background: #1a1500;
        }

        .checkout-btn {
          padding: 14px 24px;
          font-size: 15px;
          font-weight: 600;
          color: #0a0a0a;
          background: #fff;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: opacity 0.15s;
          font-family: inherit;
          margin-top: 8px;
        }

        .checkout-btn:hover:not(:disabled) {
          opacity: 0.85;
        }

        .checkout-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .checkout-consent {
          margin-top: 12px;
          font-size: 11.5px;
          line-height: 1.6;
          color: #94a3b8;
          text-align: center;
        }

        .checkout-consent :global(a) {
          color: #cbd5e1;
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .checkout-consent :global(a:hover) {
          color: #fff;
        }
      `}</style>
    </div>
  );
}
