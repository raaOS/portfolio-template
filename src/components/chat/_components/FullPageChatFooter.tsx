import React, { useRef } from 'react';
import { Plus, Send } from 'lucide-react';
import EmojiPicker from '@/components/chat/EmojiPicker';
import { useDictionary } from '@/contexts/LanguageContext';

interface FullPageChatFooterProps {
  onSend: (text: string) => void;
  isSending: boolean;
  /** Mode jembatan WhatsApp: tombol attachment disembunyikan (tidak berfungsi). */
  whatsappMode?: boolean;
}

/**
 * Footer jendela chat. v1.3.69: logika perekam suara & transkripsi dihapus
 * bersama rute /api/chat/voice (mati tanpa FEATURE_AI, dan di mode jembatan
 * WhatsApp tombolnya sudah lama disembunyikan). Chat kini teks + emoji;
 * tombol kirim selalu tampil di kedua mode.
 *
 * @module FullPageChatFooter
 */
export default function FullPageChatFooter({
  onSend,
  isSending,
  whatsappMode = false,
}: FullPageChatFooterProps) {
  const t = useDictionary();
  const [inputValue, setInputValue] = React.useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (inputValue.trim() && !isSending) {
      onSend(inputValue.trim());
      setInputValue('');
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setInputValue((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  return (
    <div className="pb-safe z-10 flex shrink-0 items-center gap-3 border-t border-[#d1d7db] bg-[#f0f2f5] px-3 py-2.5 dark:border-white/5 dark:bg-[#202c33]">
      <div className="flex items-center gap-3 text-[#54656f] dark:text-[#8696a0]">
        <EmojiPicker onEmojiSelect={handleEmojiSelect} />
        {!whatsappMode && (
          <Plus className="h-6 w-6 cursor-pointer transition-colors hover:text-[#111b21] dark:hover:text-white" />
        )}
      </div>

      <div className="flex min-h-[40px] flex-1 items-center rounded-[10px] bg-white px-4 py-2 shadow-sm dark:bg-[#2a3942]">
        <input
          ref={inputRef}
          type="text"
          placeholder={t.chat.inputPlaceholder}
          className="w-full border-none bg-transparent text-[14.5px] text-[#111b21] outline-none placeholder:text-[#8696a0] focus:outline-none dark:text-[#e9edef]"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          disabled={isSending}
        />
      </div>

      <button
        onClick={handleSend}
        disabled={isSending || !inputValue.trim()}
        aria-label="Kirim pesan"
        className="rounded-full p-2 text-[#00a884] transition-opacity disabled:text-[#54656f] disabled:opacity-50 dark:disabled:text-[#8696a0]"
      >
        <Send className="h-6 w-6" />
      </button>
    </div>
  );
}
