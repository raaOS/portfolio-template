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
      className="absolute select-none bg-[#1c1c24]/90 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-md w-80 md:w-96 space-y-5 transition-all duration-300 hover:border-indigo-500/40 hover:shadow-indigo-500/10"
      style={style}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 pb-3 border-b border-white/10">
        <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
          <Send className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-white text-sm font-semibold tracking-tight">{headline}</h3>
          <p className="text-white/40 text-[10px] font-mono">Hubungi & Testimoni</p>
        </div>
      </div>

      <p className="text-white/60 text-xs leading-relaxed">{subtext}</p>

      {/* Direct Contact Links */}
      <div className="space-y-2">
        {email && (
          <a
            href={`mailto:${email}`}
            className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/15 transition-colors text-xs text-white/90 group"
          >
            <Mail className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="truncate">{email}</span>
          </a>
        )}
        {phone && (
          <a
            href={`tel:${phone}`}
            className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/15 transition-colors text-xs text-white/90 group"
          >
            <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{phone}</span>
          </a>
        )}
        {address && (
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/5 text-xs text-white/60">
            <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="truncate">{address}</span>
          </div>
        )}
      </div>

      {/* Social Media Links */}
      {social && Object.values(social).some(Boolean) && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
          {social.linkedin && (
            <a
              href={social.linkedin}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-[10px] font-mono text-white/80 transition-colors"
            >
              LinkedIn ↗
            </a>
          )}
          {social.instagram && (
            <a
              href={social.instagram}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-[10px] font-mono text-white/80 transition-colors"
            >
              Instagram ↗
            </a>
          )}
          {social.whatsapp && (
            <a
              href={social.whatsapp.startsWith('http') ? social.whatsapp : `https://wa.me/${social.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-[10px] font-mono text-emerald-300 transition-colors"
            >
              WhatsApp ↗
            </a>
          )}
          {social.behance && (
            <a
              href={social.behance}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-[10px] font-mono text-white/80 transition-colors"
            >
              Behance ↗
            </a>
          )}
          {social.twitter && (
            <a
              href={social.twitter}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-[10px] font-mono text-white/80 transition-colors"
            >
              Twitter/X ↗
            </a>
          )}
        </div>
      )}

      {/* Testimonials if present */}
      {testimonials && testimonials.length > 0 && (
        <div className="pt-3 border-t border-white/10 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-amber-400">
            <Star className="w-3 h-3 fill-amber-400" />
            <span>Testimoni Klien</span>
          </div>
          <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
            {testimonials.slice(0, 3).map((t) => (
              <div key={t.id} className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-white text-xs font-semibold">{t.name}</span>
                  {t.company && <span className="text-[10px] text-white/40">{t.company}</span>}
                </div>
                <p className="text-white/70 text-[11px] italic leading-relaxed">
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
