'use client';

import React from 'react';
import { Mail, Phone, MapPin, MessageCircle } from 'lucide-react';

interface BentoContactData {
  email?: string;
  phone?: string;
  location?: string;
  address?: string;
  info?: {
    email?: string;
    phone?: string;
    address?: string;
    socialMedia?: { whatsapp?: string };
  };
}

export function BentoContact({
  contact,
  variant = 'centered',
}: {
  contact?: BentoContactData;
  variant?: 'centered' | 'split';
}) {
  if (!contact) return null;
  const email = contact.email || contact.info?.email;
  const phone = contact.phone || contact.info?.phone || contact.info?.socialMedia?.whatsapp;
  const location = contact.location || contact.address || contact.info?.address;

  const badge = (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--bento-accent)_30%,white)] bg-[color-mix(in_srgb,var(--bento-accent)_10%,white)] px-3 py-1 text-xs font-mono font-semibold text-[var(--bento-accent)]">
      <MessageCircle className="h-3.5 w-3.5" />
      <span>Mari Berkolaborasi</span>
    </div>
  );

  const actions = (
    <div className="flex flex-wrap items-center gap-4">
      {email && (
        <a
          href={`mailto:${email}`}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--bento-accent)] hover:brightness-110 px-6 py-3 text-xs font-bold text-white transition shadow-xs"
        >
          <Mail className="h-4 w-4" />
          <span>{email}</span>
        </a>
      )}

      {phone && (
        <a
          href={`https://wa.me/${String(phone).replace(/[^0-9]/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-100 px-6 py-3 text-xs font-semibold text-zinc-800 transition shadow-xs"
        >
          <Phone className="h-4 w-4 text-[var(--bento-accent)]" />
          <span>WhatsApp</span>
        </a>
      )}
    </div>
  );

  if (variant === 'split') {
    return (
      <section id="contact" className="rounded-3xl border border-zinc-200/90 bg-white p-8 shadow-xs hover:border-zinc-300 transition">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center">
          <div className="space-y-4">
            {badge}
            <h2 className="text-3xl font-extrabold text-zinc-900 tracking-tight sm:text-4xl">
              Tertarik Bekerja Sama?
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed max-w-md font-normal">
              Terbuka untuk kesempatan kerja full-time, proyek freelance, atau diskusi seputar pengembangan aplikasi web modern.
            </p>
          </div>

          <div className="space-y-4">
            {actions}
            {location && (
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono font-medium">
                <MapPin className="h-3.5 w-3.5 text-[var(--bento-accent)]" />
                <span>{location}</span>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="contact" className="rounded-3xl border border-zinc-200/90 bg-gradient-to-br from-white via-zinc-50 to-[color-mix(in_srgb,var(--bento-accent)_8%,white)] p-8 shadow-xs hover:border-zinc-300 transition">
      <div className="mx-auto max-w-2xl text-center space-y-4">
        {badge}

        <h2 className="text-3xl font-extrabold text-zinc-900 tracking-tight sm:text-4xl">
          Tertarik Bekerja Sama?
        </h2>

        <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed max-w-lg mx-auto font-normal">
          Terbuka untuk kesempatan kerja full-time, proyek freelance, atau diskusi seputar pengembangan aplikasi web modern.
        </p>

        <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
          {actions}
        </div>

        {location && (
          <div className="pt-2 flex items-center justify-center gap-1.5 text-xs text-zinc-400 font-mono font-medium">
            <MapPin className="h-3.5 w-3.5 text-[var(--bento-accent)]" />
            <span>{location}</span>
          </div>
        )}
      </div>
    </section>
  );
}
