'use client';

import React, { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BASE_PRICE, formatIdr } from '@/constants/plans';

function CheckoutForm() {
  const router = useRouter();
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerWhatsapp, setBuyerWhatsapp] = useState('');
  const [templateId, setTemplateId] = useState('os-desktop');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [paymentActive, setPaymentActive] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/billing/payment-info');
        const data = await res.json();
        if (data.success && typeof data.isActive === 'boolean') {
          setPaymentActive(data.isActive);
        }
      } catch {
        // Keep default
      }
    })();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const TEMPLATES = [
    { id: 'os-desktop', label: 'OS Desktop', desc: 'Desktop simulator bergaya macOS' },
    { id: 'infinite-canvas', label: 'Infinite Canvas', desc: 'Drag dan zoom project cards' },
  ];

  const selectedTemplate = TEMPLATES.find((t) => t.id === templateId) || TEMPLATES[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

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
          buyerName: buyerName.trim(),
          buyerEmail: buyerEmail.trim(),
          buyerWhatsapp: buyerWhatsapp.trim(),
          templateId,
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
            Lengkapi data berikut untuk membuat pesanan. Setelah submit, Anda akan
            diarahkan ke halaman pembayaran QRIS.
          </p>

          <div className="checkout-price-box">
            <span className="checkout-price-label">Total pembayaran</span>
            <span className="checkout-price-value">{formatIdr(BASE_PRICE)}</span>
          </div>

          <ul className="checkout-includes">
            <li>Source code template lengkap</li>
            <li>Admin panel self-service</li>
            <li>Setup dan deploy ke Cloudflare</li>
            <li>AI assistant terintegrasi</li>
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
              onChange={(e) => setBuyerName(e.target.value)}
            />
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

          <div className="checkout-field" ref={dropdownRef}>
            <label>Pilih template</label>
            <button
              type="button"
              className="checkout-dropdown-trigger"
              onClick={() => setDropdownOpen((prev) => !prev)}
              aria-expanded={dropdownOpen}
            >
              <span>{selectedTemplate.label}</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#666"
                strokeWidth="2"
                className={`checkout-dropdown-chevron${dropdownOpen ? ' open' : ''}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <div className={`checkout-dropdown-menu${dropdownOpen ? ' open' : ''}`}>
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`checkout-dropdown-item${t.id === templateId ? ' active' : ''}`}
                  onClick={() => {
                    setTemplateId(t.id);
                    setDropdownOpen(false);
                  }}
                >
                  <span className="checkout-dropdown-item-label">{t.label}</span>
                  <span className="checkout-dropdown-item-desc">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {errorMessage && (
            <div className="checkout-error">{errorMessage}</div>
          )}

          {!paymentActive && !errorMessage && (
            <div className="checkout-warning">
              Pembayaran sedang tidak aktif.
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !paymentActive}
            className="checkout-btn"
          >
            {loading ? 'Memproses...' : `Pesan — ${formatIdr(BASE_PRICE)}`}
          </button>
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

        .checkout-field label {
          font-size: 13px;
          font-weight: 500;
          color: #888;
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
        }

        .checkout-field input:focus {
          border-color: #555;
        }

        .checkout-field input::placeholder {
          color: #444;
        }

        .checkout-dropdown-trigger {
          width: 100%;
          background: #111;
          border: 1px solid #222;
          border-radius: 8px;
          padding: 12px 14px;
          font-size: 14px;
          color: #e5e5e5;
          outline: none;
          transition: border-color 0.15s;
          font-family: inherit;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          text-align: left;
        }

        .checkout-dropdown-trigger:hover {
          border-color: #333;
        }

        .checkout-dropdown-chevron {
          transition: transform 0.2s ease;
        }

        .checkout-dropdown-chevron.open {
          transform: rotate(180deg);
        }

        .checkout-dropdown-menu {
          overflow: hidden;
          max-height: 0;
          opacity: 0;
          transition: max-height 0.25s ease, opacity 0.2s ease, margin 0.25s ease;
          margin-top: 0;
          border-radius: 8px;
          border: 1px solid transparent;
          background: #111;
        }

        .checkout-dropdown-menu.open {
          max-height: 200px;
          opacity: 1;
          margin-top: 6px;
          border-color: #222;
        }

        .checkout-dropdown-item {
          width: 100%;
          background: none;
          border: none;
          padding: 12px 14px;
          cursor: pointer;
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 2px;
          font-family: inherit;
          transition: background 0.12s;
        }

        .checkout-dropdown-item:hover {
          background: #1a1a1a;
        }

        .checkout-dropdown-item.active {
          background: #1a1a1a;
        }

        .checkout-dropdown-item + .checkout-dropdown-item {
          border-top: 1px solid #1a1a1a;
        }

        .checkout-dropdown-item-label {
          font-size: 14px;
          font-weight: 500;
          color: #e5e5e5;
        }

        .checkout-dropdown-item-desc {
          font-size: 12px;
          color: #666;
        }

        .checkout-error {
          font-size: 13px;
          color: #e55;
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
      `}</style>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div style={{
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          color: '#888',
          fontSize: '14px',
        }}>
          Memuat...
        </div>
      }
    >
      <CheckoutForm />
    </Suspense>
  );
}
