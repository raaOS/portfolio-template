'use client';

import useSWR from 'swr';
import FullPageChat from '@/components/chat/FullPageChat';
import { type Locale, useLanguage } from '@/contexts/LanguageContext';
import { localizeText } from '@/lib/i18n/contentLocalization';
import type { ContactData } from '@/types/contact';

interface FullPageChatContactInfo {
  email?: string;
  socialMedia?: {
    linkedin?: string;
    instagram?: string;
    twitter?: string;
    behance?: string;
    whatsapp?: string;
  };
  headline?: string;
  subtext?: string;
}

interface ContactWindowProps {
  initialData?: ContactData | null;
  siteId?: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to load contact data');
  }
  return res.json() as Promise<ContactData>;
};

function toContactInfo(
  data: ContactData | undefined,
  locale: Locale
): FullPageChatContactInfo | undefined {
  if (!data) return undefined;
  return {
    email: data.info?.email,
    socialMedia: data.info?.socialMedia,
    headline: localizeText(data.content?.headline, locale),
    subtext: localizeText(data.content?.subtext, locale),
  };
}

export default function ContactWindow({ initialData, siteId = 'default-site' }: ContactWindowProps) {
  const { locale } = useLanguage();
  const contactUrl = `/api/contact?siteId=${encodeURIComponent(siteId)}`;
  const { data } = useSWR(contactUrl, fetcher, {
    fallbackData: initialData ?? undefined,
    revalidateOnFocus: false,
    revalidateIfStale: false,
    shouldRetryOnError: false,
    revalidateOnMount: !initialData,
  });

  return <FullPageChat embedded contactInfo={toContactInfo(data, locale)} />;
}
