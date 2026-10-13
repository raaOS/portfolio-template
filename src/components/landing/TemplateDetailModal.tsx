'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { X, ExternalLink, MessageCircle, ShoppingBag, CheckCircle2 } from 'lucide-react';
import { formatIdr, BASE_PRICE } from '@/constants/pricing';
import type { TemplateItem } from './templates';

interface TemplateDetailModalProps {
  template: TemplateItem | null;
  basePrice?: number;
  adminWhatsapp?: string;
  onClose: () => void;
}

export function TemplateDetailModal({
  template,
  basePrice = BASE_PRICE,
  adminWhatsapp,
  onClose,
}: TemplateDetailModalProps) {
  // Tutup dengan Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Kunci scroll body saat modal aktif
  useEffect(() => {
    if (template) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [template]);

  if (!template) return null;

  // Format link WhatsApp
  const cleanPhone = (adminWhatsapp || '').replace(/[^0-9]/g, '');
  const waTarget = cleanPhone ? (cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone) : '';
  const waMessage = encodeURIComponent(
    `Halo Make it Better Studio, saya tertarik memesan template portofolio "${template.name}". Boleh info ketersediaan slot dan proses setup-nya?`
  );
  const waHref = waTarget
    ? `https://wa.me/${waTarget}?text=${waMessage}`
    : `https://wa.me/?text=${waMessage}`;

  return (
    <div className="wave-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="wave-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tombol Tutup */}
        <button
          type="button"
          className="wave-modal-close"
          onClick={onClose}
          aria-label="Tutup dialog"
        >
          <X size={18} />
        </button>

        {/* Media Preview Mockup */}
        <div className="wave-modal-media">
          <Image
            src={template.imageUrl}
            alt={`Mockup ${template.name}`}
            fill
            className="wave-modal-img"
            sizes="(max-width: 768px) 100vw, 680px"
            priority
          />
          <div className="wave-modal-media-overlay" />
          <span className="wave-modal-badge">{template.badge}</span>
        </div>

        {/* Konten & Penjelasan */}
        <div className="wave-modal-content">
          <div className="wave-modal-header">
            <div>
              <p className="wave-modal-subtitle">{template.subtitle}</p>
              <h2 className="wave-modal-title">{template.name}</h2>
            </div>
            <div className="wave-modal-price-box">
              <span className="wave-modal-price-label">Investasi</span>
              <span className="wave-modal-price">{formatIdr(basePrice)}</span>
            </div>
          </div>

          <p className="wave-modal-desc">{template.description}</p>

          {/* Fitur Unggulan */}
          <div className="wave-modal-features">
            <h3 className="wave-modal-features-title">Fitur & Keunggulan</h3>
            <ul className="wave-modal-features-list">
              {template.features.map((feat, i) => (
                <li key={i} className="wave-modal-feature-item">
                  <CheckCircle2 size={16} className="wave-feature-icon" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Garansi & Keamanan */}
          <div className="wave-modal-guarantee">
            <span>✨ Sekali Bayar • Termasuk Source Code, Admin Panel Mandiri, & Setup Cloudflare.</span>
          </div>

          {/* Aksi Bisnis */}
          <div className="wave-modal-actions">
            {/* 1. Live Preview */}
            <Link
              href={template.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="wave-btn wave-btn-preview"
            >
              <ExternalLink size={16} />
              <span>Live Preview</span>
            </Link>

            {/* 2. Pesan Sekarang (Alur Checkout Sistem) */}
            <Link
              href={`/checkout?template=${template.id}`}
              className="wave-btn wave-btn-order"
            >
              <ShoppingBag size={16} />
              <span>Pesan Sekarang</span>
            </Link>

            {/* 3. Konsultasi / Pesan via WhatsApp */}
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="wave-btn wave-btn-wa"
            >
              <MessageCircle size={16} />
              <span>Tanya via WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
