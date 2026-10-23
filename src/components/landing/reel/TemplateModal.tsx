'use client';

import { useEffect, useRef } from 'react';
import { ArrowUpRight, MessageCircle, X } from 'lucide-react';
import { formatIdr } from '@/constants/pricing';
import { buildOrderHref, type ReelTemplate } from './reelData';

interface TemplateModalProps {
  template: ReelTemplate | null;
  basePrice: number;
  adminWhatsapp: string;
  showPrice: boolean;
  onClose: () => void;
}

/**
 * Popup detail template: pilihan "Live Preview" (tab baru ke route preview)
 * dan "Pesan" (WhatsApp dengan pesan prefill, atau `/checkout` bila nomor
 * WA belum diisi).
 *
 * Saat terbuka: scroll halaman dikunci (dikompensasi lebar scrollbar agar
 * tidak ada lompatan layout), fokus dipindahkan ke tombol tutup, Tab dijaga
 * tetap di dalam dialog, dan fokus dikembalikan ke kartu asal saat ditutup.
 */
export default function TemplateModal({
  template,
  basePrice,
  adminWhatsapp,
  showPrice,
  onClose,
}: TemplateModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!template) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const previousOverflow = document.body.style.overflow;
    const previousPadding = document.body.style.paddingRight;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPadding;
      previouslyFocused?.focus?.();
    };
  }, [template, onClose]);

  if (!template) return null;

  const orderHref = buildOrderHref(adminWhatsapp, template, basePrice);
  const opensInNewTab = orderHref.startsWith('https://');

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-modal-title"
        aria-describedby="template-modal-desc"
        ref={dialogRef}
      >
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Tutup detail template"
          ref={closeRef}
        >
          <X size={18} aria-hidden />
        </button>

        <p className="modal-kicker">Template portfolio</p>
        <h2 id="template-modal-title">{template.name}</h2>
        <p id="template-modal-desc" className="modal-desc">
          {template.description}
        </p>

        {showPrice && (
          <p className="modal-price">
            {formatIdr(basePrice)}
            <span>sekali bayar — source code, admin panel &amp; setup Cloudflare</span>
          </p>
        )}

        <div className="modal-actions">
          <a
            className="modal-btn modal-btn-primary"
            href={orderHref}
            target={opensInNewTab ? '_blank' : undefined}
            rel={opensInNewTab ? 'noopener noreferrer' : undefined}
          >
            <MessageCircle size={16} aria-hidden />
            Pesan
          </a>
          <a
            className="modal-btn modal-btn-ghost"
            href={template.previewUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Live Preview
            <ArrowUpRight size={16} aria-hidden />
          </a>
        </div>

        <p className="modal-note">
          {opensInNewTab
            ? 'Pesan dibuka di WhatsApp dengan data template & harga sudah terisi. Live Preview membuka demo penuh di tab baru.'
            : 'Nomor WhatsApp belum diatur — Pesan diarahkan ke halaman checkout. Live Preview membuka demo penuh di tab baru.'}
        </p>
      </div>
    </div>
  );
}
