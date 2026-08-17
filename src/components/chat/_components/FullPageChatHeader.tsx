import React from 'react';
import { Video, Phone, MoreVertical } from 'lucide-react';
import { useDictionary } from '@/contexts/LanguageContext';

export default function FullPageChatHeader() {
  const t = useDictionary();

  return (
    <div className="z-10 flex h-[60px] shrink-0 items-center justify-between border-b border-[#d1d7db] bg-[#f0f2f5] px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2">
        {/* Avatar */}
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/50 bg-gray-200">
          <img
            src={`https://ui-avatars.com/api/?background=ffffff&color=000000&name=R&size=128&bold=true&length=1`}
            alt="Portfolio Owner"
            className="h-full w-full object-cover"
          />
        </div>

        <div className="ml-1 flex flex-col">
          <span className="line-clamp-1 text-sm font-semibold leading-tight text-[#111b21]">
            Portfolio Owner
          </span>
          <span className="text-[11px] font-medium leading-tight text-[#00a884]">
            {t.chat.online}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-[#54656f]">
        <Video size={20} className="cursor-not-allowed opacity-50" />
        <Phone size={18} className="cursor-not-allowed opacity-50" />
        <MoreVertical size={20} className="cursor-pointer" />
      </div>
    </div>
  );
}
