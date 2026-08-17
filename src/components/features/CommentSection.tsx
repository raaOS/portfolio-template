'use client';

import React, { useState, useEffect, startTransition } from 'react';
import { motion } from 'motion/react';
import type { Comment, CommentReply } from '@/lib/magic';
import { useToast } from '@/contexts/ToastContext';
import { CommentItem } from './CommentItem';
import { CommentForm } from './CommentForm';

interface CommentSectionProps {
  slug: string;
  siteId?: string;
  comments: Comment[];
  setComments: (comments: Comment[]) => void;
  className?: string;
  isExpanded?: boolean;
  isAdmin?: boolean;
}

export default function CommentSection({
  slug,
  siteId = 'default-site',
  comments,
  setComments,
  className = '',
  isAdmin = false,
}: CommentSectionProps) {
  // Guest Identity State
  const [guestName, setGuestName] = useState('');
  const [tempGuestName, setTempGuestName] = useState('');
  const [isSettingName, setIsSettingName] = useState(false);

  // Local Editing State (for admin inline edits)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const handleDeleteComment = (commentId: string | undefined) => {
    if (!commentId) return;
    const filterReplies = (list: CommentReply[]): CommentReply[] => {
      return list.filter((reply) => reply.id !== commentId);
    };
    const filterComment = (list: Comment[]): Comment[] => {
      return list
        .filter((c) => c.id !== commentId)
        .map((c) => ({
          ...c,
          replies: c.replies ? filterReplies(c.replies) : [],
        }));
    };
    setComments(filterComment(comments));
    if (editingCommentId === commentId) {
      setEditingCommentId(null);
    }
  };

  const handleStartEdit = (commentId: string | undefined, currentText: string) => {
    if (!commentId) return;
    setEditingCommentId(commentId);
    setEditingText(currentText);
  };

  const handleSaveEdit = (commentId: string | undefined) => {
    if (!commentId) return;
    if (!editingText.trim()) return;

    const updateReplies = (list: CommentReply[]): CommentReply[] => {
      return list.map((reply) => {
        if (reply.id === commentId) {
          return { ...reply, text: editingText.trim() };
        }
        return reply;
      });
    };

    const updateCommentText = (list: Comment[]): Comment[] => {
      return list.map((c) => {
        if (c.id === commentId) {
          return { ...c, text: editingText.trim() };
        }
        return {
          ...c,
          replies: c.replies ? updateReplies(c.replies) : [],
        };
      });
    };

    setComments(updateCommentText(comments));
    setEditingCommentId(null);
  };

  // Comment Input State
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showWarning } = useToast();

  // Load Guest Name from localStorage (Client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedName = localStorage.getItem('guest-name');
      startTransition(() => {
        if (savedName) {
          setGuestName(savedName);
        } else {
          setIsSettingName(true); // Prompt to set name if none exists
        }
      });
    }
  }, []);

  const handleSaveName = () => {
    if (!tempGuestName.trim()) return;
    const name = tempGuestName.trim();
    setGuestName(name);
    localStorage.setItem('guest-name', name);
    setIsSettingName(false);
  };

  const handlePostComment = async () => {
    if (!commentText.trim() || !guestName) return;

    setIsSubmitting(true);

    const newComment: Comment = {
      id: Date.now().toString(),
      text: commentText.trim(),
      name: guestName,
      time: new Date().toISOString(),
      likes: 0,
      replies: [],
    };

    const updatedComments = [newComment, ...comments];

    // Optimistic Update
    setComments(updatedComments);
    setCommentText(''); // Clear input immediately

    try {
      // Send to API with security fields (Honeypot is empty string)
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: slug,
          siteId,
          comment: newComment,
          website_url: '', // Anti-spam honeypot (must be empty)
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 429) {
          showWarning('Terlalu banyak komentar! Tunggu 10 detik.');
        } else {
          console.error('Server error:', errorData);
        }
      }
    } catch (error) {
      console.error('Failed to submit comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatRelativeTime = (dateString: string) => {
    if (!dateString) return 'Baru saja';
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Baru saja';

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} menit yang lalu`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} jam yang lalu`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} hari yang lalu`;

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) return `${diffInWeeks} minggu yang lalu`;

    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) return `${diffInMonths} bulan yang lalu`;

    return `${Math.floor(diffInDays / 365)} tahun yang lalu`;
  };

  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Accordion Toggle */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group flex w-full items-center justify-between py-2 text-gray-500 transition-colors hover:text-gray-900 dark:hover:text-white"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest">
            {comments.length} Komentar
          </span>
          {comments.length > 0 && !isOpen && (
            <div className="flex -space-x-2">
              {comments.slice(0, 3).map((c, i) => (
                <div
                  key={i}
                  className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-gray-200 text-[8px] font-bold uppercase text-gray-400 dark:border-gray-900 dark:bg-gray-800"
                >
                  {c.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
              ))}
            </div>
          )}
        </div>
        <svg
          className={`h-4 w-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Comments List (Collapsible / Smooth Accordion) */}
      <motion.div
        initial={false}
        animate={{
          height: isOpen ? 'auto' : 0,
          opacity: isOpen ? 1 : 0,
          marginBottom: isOpen ? 24 : 0,
        }}
        transition={{ duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }}
        className="overflow-hidden"
      >
        <div className="space-y-8 py-2">
          {comments.length === 0 ? (
            <p className="py-4 text-center text-[11px] italic text-gray-400">
              Belum ada komentar. Jadilah yang pertama! ✨
            </p>
          ) : (
            comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                isAdmin={isAdmin}
                editingCommentId={editingCommentId}
                editingText={editingText}
                formatRelativeTime={formatRelativeTime}
                setEditingText={setEditingText}
                setEditingCommentId={setEditingCommentId}
                handleStartEdit={handleStartEdit}
                handleSaveEdit={handleSaveEdit}
                handleDeleteComment={handleDeleteComment}
              />
            ))
          )}
        </div>
      </motion.div>

      {/* Input Section */}
      <CommentForm
        guestName={guestName}
        tempGuestName={tempGuestName}
        isSettingName={isSettingName}
        commentText={commentText}
        isSubmitting={isSubmitting}
        setTempGuestName={setTempGuestName}
        setIsSettingName={setIsSettingName}
        setCommentText={setCommentText}
        handleSaveName={handleSaveName}
        handlePostComment={handlePostComment}
      />
    </div>
  );
}
