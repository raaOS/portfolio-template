import React from 'react';
import { m, AnimatePresence } from 'motion/react';
import { CheckCheck } from 'lucide-react';
import { parseEmojiText } from '@/components/chat/AnimatedEmoji';
import TypingIndicator from './TypingIndicator';
import { useDictionary } from '@/contexts/LanguageContext';

interface ChatMessage {
  id: string;
  text: string;
  sender: 'visitor' | 'admin';
  timestamp: number;
  failed?: boolean;
}

interface FullPageChatMessagesProps {
  messages: ChatMessage[];
  isTyping: boolean;
  bottomRef: React.RefObject<HTMLDivElement | null>;
}

export default function FullPageChatMessages({
  messages,
  isTyping,
  bottomRef,
}: FullPageChatMessagesProps) {
  const t = useDictionary();

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col gap-2 overflow-y-auto bg-[#e5ddd5] px-4 py-4 dark:bg-[#0b141a]">
      {/* WhatsApp Pattern Background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: `url('/assets/whatsapp-bg.webp')`,
          backgroundSize: '400px',
          backgroundRepeat: 'repeat',
        }}
      />

      {/* Messages Container - above background */}
      <div className="relative z-10 flex w-full flex-col gap-2">
        <div className="z-10 mb-2 flex w-full justify-center">
          <span className="rounded-md bg-[#d9ddcf] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#54656f] shadow-sm dark:bg-[#1f2c34] dark:text-gray-300">
            {t.chat.today}
          </span>
        </div>
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => {
            const isMe = msg.sender === 'visitor';
            return (
              <m.div
                key={msg.id || idx}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`group relative flex max-w-[85%] flex-col ${isMe ? 'items-end self-end' : 'items-start self-start'}`}
              >
                <div
                  className={`relative rounded-2xl px-3 py-1.5 text-[13.5px] leading-relaxed shadow-sm ${
                    isMe
                      ? 'rounded-tr-none bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]'
                      : 'rounded-tl-none bg-white text-[#111b21] dark:bg-[#202c33] dark:text-[#e9edef]'
                  }`}
                  style={{ wordBreak: 'break-word' }}
                >
                  {/* Chat Tail SVG (Simplified) */}
                  <svg
                    viewBox="0 0 8 13"
                    width="8"
                    height="13"
                    className={`absolute top-0 ${isMe ? '-right-[8px] text-[#d9fdd3] dark:text-[#005c4b]' : '-left-[8px] scale-x-[-1] transform text-white dark:text-[#202c33]'} z-20 overflow-visible fill-current`}
                  >
                    <path d="M5.188 0H0v12.191L8 1.733V0h-2.812z"></path>
                  </svg>

                  <div className="whitespace-pre-wrap">{parseEmojiText(msg.text)}</div>

                  <div
                    className={`-mb-1 mt-1 flex items-center justify-end gap-1 ${isMe ? 'text-[#667781] dark:text-white/60' : 'text-[#667781] dark:text-white/50'}`}
                  >
                    <span className="text-[9px] font-bold uppercase tracking-tighter">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {msg.failed ? (
                      <span className="text-[9px] font-bold uppercase tracking-tighter text-red-500">
                        Gagal terkirim
                      </span>
                    ) : (
                      isMe && <CheckCheck className="h-3.5 w-3.5 text-blue-500" />
                    )}
                  </div>
                </div>
              </m.div>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && <TypingIndicator />}
        </AnimatePresence>
      </div>

      <div ref={bottomRef} className="relative z-10 h-2 w-full" />
    </div>
  );
}
