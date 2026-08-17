'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Pencil, Trash2 } from 'lucide-react';
import type { Comment } from '@/lib/magic';

const AITranslator = dynamic(() => import('@/components/features/AITranslator'), { ssr: false });

interface CommentItemProps {
  comment: Comment;
  isAdmin: boolean;
  editingCommentId: string | null;
  editingText: string;
  formatRelativeTime: (dateStr: string) => string;
  setEditingText: (text: string) => void;
  setEditingCommentId: (id: string | null) => void;
  handleStartEdit: (id: string | undefined, text: string) => void;
  handleSaveEdit: (id: string | undefined) => void;
  handleDeleteComment: (id: string | undefined) => void;
}

export function CommentItem({
  comment,
  isAdmin,
  editingCommentId,
  editingText,
  formatRelativeTime,
  setEditingText,
  setEditingCommentId,
  handleStartEdit,
  handleSaveEdit,
  handleDeleteComment,
}: CommentItemProps) {
  return (
    <div className="group">
      <div className="flex gap-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-[13px] font-bold uppercase text-white shadow-lg">
          {comment.name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-baseline gap-2">
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              {comment.name}
            </span>
            <span className="text-[10px] text-gray-400">
              {formatRelativeTime(comment.createdAt || comment.time || '')}
            </span>
          </div>
          {editingCommentId === comment.id ? (
            <div className="mt-1 space-y-2">
              <textarea
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                className="w-full rounded border border-indigo-200 p-2 text-sm outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                rows={2}
              />
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSaveEdit(comment.id)}
                  className="rounded bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  Simpan
                </button>
                <button
                  type="button"
                  onClick={() => setEditingCommentId(null)}
                  className="rounded bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <div className="group/text relative flex items-start gap-2">
              <p className="flex-1 whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                {comment.text}
              </p>
              {isAdmin && (
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/text:opacity-100">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(comment.id, comment.text)}
                    className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                    title="Edit Ulasan"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteComment(comment.id)}
                    className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                    title="Hapus Ulasan"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
          <AITranslator text={comment.text} compact={true} />
        </div>
      </div>

      {/* Render Replies (Read-Only) */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-13 mt-4 space-y-4 border-l-2 border-gray-100 pl-4 dark:border-gray-800">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="flex gap-3">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-[10px] font-bold uppercase text-gray-600 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700">
                {reply.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex-1">
                <div className="mb-1 flex items-baseline gap-2">
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                    {reply.name}
                  </span>
                  <span className="text-[9px] text-gray-400">
                    {formatRelativeTime(reply.createdAt || reply.time || '')}
                  </span>
                </div>
                {editingCommentId === reply.id ? (
                  <div className="mt-1 space-y-2">
                    <textarea
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      className="w-full rounded border border-indigo-200 p-2 text-xs outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                      rows={2}
                    />
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(reply.id)}
                        className="rounded bg-indigo-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-indigo-700"
                      >
                        Simpan
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCommentId(null)}
                        className="rounded bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="group/text relative flex items-start gap-2">
                    <p className="flex-1 text-xs text-gray-700 dark:text-gray-400">
                      {reply.text}
                    </p>
                    {isAdmin && (
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/text:opacity-100">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(reply.id, reply.text)}
                          className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                          title="Edit Balasan"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(reply.id)}
                          className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                          title="Hapus Balasan"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <AITranslator text={reply.text} compact={true} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
