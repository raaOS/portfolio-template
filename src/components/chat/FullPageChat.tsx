'use client';

import React, { useEffect, useRef } from 'react';
import { m } from 'motion/react';
import FullPageChatHeader from './_components/FullPageChatHeader';
import FullPageChatMessages from './_components/FullPageChatMessages';
import FullPageChatFooter from './_components/FullPageChatFooter';
import { useChatSync } from '@/hooks/useChatSync';
import SystemNavFrame from '@/components/layout/SystemNavFrame';
import { useDictionary } from '@/contexts/LanguageContext';

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

interface FullPageChatProps {
  contactInfo?: FullPageChatContactInfo;
  embedded?: boolean;
}

export default function FullPageChat({ contactInfo, embedded = false }: FullPageChatProps) {
  const t = useDictionary();
  const bottomRef = useRef<HTMLDivElement>(null);
  // Jembatan WhatsApp (v1.3.68): nomor WA admin dari data contact — dibaca oleh
  // useChatSync untuk mematikan polling & meneruskan pesan ke wa.me.
  const whatsappNumber = contactInfo?.socialMedia?.whatsapp || null;
  const { messages, sendMessage, isSending, isAdminTyping, isWhatsAppBridge, syncError } =
    useChatSync(contactInfo?.subtext || t.chat.defaultPrompt, whatsappNumber);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAdminTyping]);

  const chatContent = (
    <div
      className={
        embedded
          ? 'relative flex h-full min-h-0 flex-1 overflow-hidden bg-transparent'
          : 'relative flex h-full min-h-[100dvh] flex-1 flex-col items-center justify-center overflow-hidden bg-[#0a0a0a] px-4 pb-32 pt-28'
      }
    >
      <m.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className={
          embedded
            ? 'relative z-10 flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#e5ddd5] dark:bg-[#0b141a]'
            : 'relative z-10 flex h-full w-full flex-col overflow-hidden bg-[#e5ddd5] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.4)] dark:bg-[#0b141a] md:h-[80vh] md:rounded-[2rem]'
        }
        style={embedded ? undefined : { maxWidth: '480px' }}
      >
        <FullPageChatHeader />
        {syncError && !isWhatsAppBridge && (
          <div className="animate-pulse border-b border-red-500/20 bg-red-500/10 px-4 py-1 text-center text-[10px] text-red-500">
            {t.chat.connectionInterrupted}
          </div>
        )}
        <FullPageChatMessages messages={messages} isTyping={isAdminTyping} bottomRef={bottomRef} />
        <FullPageChatFooter
          onSend={sendMessage}
          isSending={isSending}
          whatsappMode={isWhatsAppBridge}
        />
      </m.div>

      {!embedded && (
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center opacity-40 dark:opacity-20">
          <div className="h-[80vw] max-h-[800px] w-[80vw] max-w-[800px] rounded-full bg-[#00a884] opacity-50 mix-blend-screen blur-[120px]" />
        </div>
      )}
    </div>
  );

  if (embedded) {
    return chatContent;
  }

  return <SystemNavFrame hideFooter={true}>{chatContent}</SystemNavFrame>;
}
