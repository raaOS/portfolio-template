'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { id, type Dictionary } from '@/dictionaries/id';
import { en } from '@/dictionaries/en';

export type Locale = 'id' | 'en';

const dictionaries: Record<Locale, Dictionary> = { id, en };

export const localeMeta: Record<
  Locale,
  { htmlLang: string; intlLocale: string; label: string; shortLabel: string }
> = {
  id: {
    htmlLang: 'id',
    intlLocale: 'id-ID',
    label: 'Bahasa Indonesia',
    shortLabel: 'ID',
  },
  en: {
    htmlLang: 'en',
    intlLocale: 'en-US',
    label: 'English',
    shortLabel: 'EN',
  },
};

const STORAGE_KEY = 'portfolio-os-ui-locale';

interface LanguageContextType {
  locale: Locale;
  dictionary: Dictionary;
  meta: (typeof localeMeta)[Locale];
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;
  return value.toLowerCase().startsWith('en')
    ? 'en'
    : value.toLowerCase().startsWith('id')
      ? 'id'
      : null;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('id');

  useEffect(() => {
    const saved = normalizeLocale(window.localStorage.getItem(STORAGE_KEY));
    const nextLocale = saved ?? 'id';
    const timer = window.setTimeout(() => setLocaleState(nextLocale), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const meta = localeMeta[locale];
    document.documentElement.lang = meta.htmlLang;
    document.documentElement.dataset.locale = locale;
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextLocale);
    } catch {
      // Local storage can be unavailable in private browsing.
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'id' ? 'en' : 'id');
  }, [locale, setLocale]);

  const value = useMemo<LanguageContextType>(
    () => ({
      locale,
      dictionary: dictionaries[locale],
      meta: localeMeta[locale],
      setLocale,
      toggleLocale,
    }),
    [locale, setLocale, toggleLocale]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextType {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}

export function useDictionary(): Dictionary {
  return useLanguage().dictionary;
}
