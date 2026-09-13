'use client';

import React from 'react';
import clsx from 'clsx';
import { motion } from 'motion/react';
import { type Locale, localeMeta, useLanguage } from '@/contexts/LanguageContext';

interface LanguageSwitchProps {
  className?: string;
}

const LOCALES: Locale[] = ['id', 'en'];

export default function LanguageSwitch({ className }: LanguageSwitchProps) {
  const { locale, setLocale, dictionary } = useLanguage();

  return (
    <div
      className={clsx(
        'relative inline-grid h-5 w-[66px] shrink-0 grid-cols-2 items-center overflow-hidden rounded-full border border-black/10 bg-black/5 p-0.5 text-[9px] font-black uppercase leading-none text-black/60 dark:border-white/15 dark:bg-white/10 dark:text-white/60',
        className
      )}
      role="group"
      aria-label={dictionary.language.label}
    >
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-[31px] rounded-full bg-white dark:bg-neutral-800 shadow-sm"
        animate={{ x: locale === 'id' ? 0 : 31 }}
        transition={{ type: 'spring', stiffness: 520, damping: 36, mass: 0.7 }}
      />
      {LOCALES.map((item) => {
        const selected = item === locale;
        return (
          <button
            key={item}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setLocale(item);
            }}
            className={clsx(
              'relative z-10 flex h-4 !min-h-0 !min-w-0 items-center justify-center rounded-full px-1 transition-colors',
              selected ? 'text-black dark:text-white' : 'hover:text-black dark:hover:text-white'
            )}
            aria-pressed={selected}
            title={`${dictionary.language.switchTo}: ${localeMeta[item].label}`}
          >
            {dictionary.language[item]}
          </button>
        );
      })}
    </div>
  );
}
