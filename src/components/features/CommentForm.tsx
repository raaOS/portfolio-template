'use client';

import React from 'react';

interface CommentFormProps {
  guestName: string;
  tempGuestName: string;
  isSettingName: boolean;
  commentText: string;
  isSubmitting: boolean;
  setTempGuestName: (name: string) => void;
  setIsSettingName: (setting: boolean) => void;
  setCommentText: (text: string) => void;
  handleSaveName: () => void;
  handlePostComment: () => void;
}

export function CommentForm({
  guestName,
  tempGuestName,
  isSettingName,
  commentText,
  isSubmitting,
  setTempGuestName,
  setIsSettingName,
  setCommentText,
  handleSaveName,
  handlePostComment,
}: CommentFormProps) {
  return (
    <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
      {!guestName || isSettingName ? (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
            Isi namamu dulu untuk mulai berkomentar 😊
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={tempGuestName}
              onChange={(e) => setTempGuestName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveName();
                }
              }}
              placeholder="Ketik namamu..."
              className="flex-1 border-b border-none border-black/10 bg-transparent px-0 py-2.5 text-sm outline-none transition-all focus:border-red-500 focus:outline-none focus:ring-0 dark:border-white/10 dark:text-white"
            />
            <button
              type="button"
              onClick={handleSaveName}
              disabled={!tempGuestName.trim()}
              className="rounded-full border-none bg-[#E60023] px-6 py-2.5 text-sm font-bold text-white shadow-sm outline-none transition-colors hover:bg-[#ad001b] disabled:opacity-50"
            >
              Simpan
            </button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Komentar sebagai <span className="text-red-500">{guestName}</span>
            </p>
            <button
              type="button"
              onClick={() => {
                setTempGuestName(guestName);
                setIsSettingName(true);
              }}
              className="text-[11px] text-gray-300 underline decoration-dotted underline-offset-4 transition-colors hover:text-red-500"
            >
              Ganti nama
            </button>
          </div>
          <div className="relative">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handlePostComment();
                }
              }}
              placeholder="Tulis komentar..."
              className="w-full border-b border-none border-black/10 bg-transparent px-0 py-3 pr-12 text-sm outline-none transition-all focus:border-red-500 focus:outline-none focus:ring-0 dark:border-white/10 dark:text-white"
            />
            <button
              type="button"
              onClick={handlePostComment}
              disabled={!commentText.trim() || isSubmitting}
              className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-red-500 transition-colors hover:text-red-600 disabled:opacity-30"
            >
              <svg className="h-5 w-5 rotate-90" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
