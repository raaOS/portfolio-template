'use client';

import React from 'react';
import type { ContactData } from '@/types/contact';
import type { Testimonial } from '@/types/testimonial';
import { Mail, Phone, MapPin, Send, Star } from 'lucide-react';

interface CanvasContactProps {
  contact?: ContactData;
  testimonials?: Testimonial[];
  style?: React.CSSProperties;
}

export function CanvasContact({ contact, testimonials, style }: CanvasContactProps) {
  const email = contact?.info?.email;
  const phone = contact?.info?.phone;
  const address = contact?.info?.address;
  const social = contact?.info?.socialMedia;
  const headline = contact?.content?.headline || 'Mari Berkolaborasi';
  const subtext = contact?.content?.subtext || 'Punya ide proyek atau tawaran menarik? Hubungi saya kapan saja.';

  return (
    <div
      className="absolute select-none -translate-x-1/2 -translate-y-1/2 bg-white border border-neutral-200 rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)] w-80 md:w-96 space-y-5 transition-all duration-300 hover:border-neutral-400 hover:shadow-[0_12px_32px_rgba(0,0,0,0.1)]"
      style={style}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-100">
        <div className="p-2 rounded-lg bg-neutral-100 text-neutral-900">
          <Send className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-neutral-900 text-sm font-bold tracking-tight">{headline}</h3>
          <p className="text-neutral-400 text-[10px] font-mono uppercase tracking-wider">HUBUNGI & TESTIMONI</p>
        </div>
      </div>

      <p className="text-neutral-600 text-xs leading-relaxed">{subtext}</p>

      {/* Direct Contact Links */}
      <div className="space-y-2">
        {email && (
          <a
            href={`mailto:${email}`}
            className="flex items-center gap-2.5 p-2.5 rounded-xl bg-neutral-50/80 border border-neutral-200/80 hover:bg-neutral-100 hover:border-neutral-300 transition-colors text-xs text-neutral-800 font-medium group"
          >
            <Mail className="w-4 h-4 text-neutral-800 shrink-0" />
            <span className="truncate">{email}</span>
          </a>
        )}
        {phone && (
          <a
            href={`tel:${phone}`}
            className="flex items-center gap-2.5 p-2.5 rounded-xl bg-neutral-50/80 border border-neutral-200/80 hover:bg-neutral-100 hover:border-neutral-300 transition-colors text-xs text-neutral-800 font-medium group"
          >
            <Phone className="w-4 h-4 text-neutral-800 shrink-0" />
            <span>{phone}</span>
          </a>
        )}
        {address && (
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-neutral-50/80 border border-neutral-200/80 text-xs text-neutral-600 font-medium">
            <MapPin className="w-4 h-4 text-neutral-700 shrink-0" />
            <span className="truncate">{address}</span>
          </div>
        )}
      </div>

      {/* Social Media Links */}
      {social && Object.values(social).some(Boolean) && (
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-neutral-100">
          {social.linkedin && (
            <a
              href={social.linkedin}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-[10px] font-mono font-medium text-neutral-700 transition-colors"
            >
              LinkedIn ↗
            </a>
          )}
          {social.instagram && (
            <a
              href={social.instagram}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-[10px] font-mono font-medium text-neutral-700 transition-colors"
            >
              Instagram ↗
            </a>
          )}
          {social.whatsapp && (
            <a
              href={social.whatsapp.startsWith('http') ? social.whatsapp : `https://wa.me/${social.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-[10px] font-mono font-medium text-neutral-800 transition-colors"
            >
              WhatsApp ↗
            </a>
          )}
          {social.behance && (
            <a
              href={social.behance}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-[10px] font-mono font-medium text-neutral-700 transition-colors"
            >
              Behance ↗
            </a>
          )}
          {social.twitter && (
            <a
              href={social.twitter}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-[10px] font-mono font-medium text-neutral-700 transition-colors"
            >
              Twitter/X ↗
            </a>
          )}
        </div>
      )}

      {/* Testimonials if present */}
      {testimonials && testimonials.length > 0 && (
        <div className="pt-3 border-t border-neutral-100 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-neutral-900 font-bold">
            <Star className="w-3 h-3 fill-neutral-900 text-neutral-900" />
            <span>Testimoni Klien</span>
          </div>
          <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
            {testimonials.slice(0, 3).map((t) => (
              <div key={t.id} className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/70 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-900 text-xs font-semibold">{t.name}</span>
                  {t.company && <span className="text-[10px] text-neutral-500">{t.company}</span>}
                </div>
                <p className="text-neutral-600 text-[11px] italic leading-relaxed">
                  &ldquo;{t.content || t.notificationText}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
