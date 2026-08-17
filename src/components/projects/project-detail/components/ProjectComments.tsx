'use client';

import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'motion/react';
import type { Comment } from '@/lib/magic';

// Lazy load heavy CommentSection component
const CommentSection = dynamic(() => import('@/components/features/CommentSection'), {
  loading: () => <div className="h-32 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />,
  ssr: false,
});

interface ProjectCommentsProps {
  slug: string;
  siteId?: string;
  comments: Comment[];
  setComments: (comments: Comment[]) => void;
  allowComments?: boolean;
  sectionId?: string;
  withDivider?: boolean;
  isVisible?: boolean;
  animated?: boolean;
  className?: string;
  isAdmin?: boolean;
}

export function ProjectComments({
  slug,
  siteId = 'default-site',
  comments,
  setComments,
  allowComments = true,
  sectionId,
  withDivider = true,
  isVisible = true,
  animated = false,
  className = '',
  isAdmin = false,
}: ProjectCommentsProps) {
  if (!allowComments) return null;

  const content = (
    <div
      id={sectionId}
      className={[
        withDivider ? 'border-t border-gray-200 pt-6 dark:border-gray-800' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <CommentSection
        slug={slug}
        siteId={siteId}
        comments={comments}
        setComments={setComments}
        isAdmin={isAdmin}
      />
    </div>
  );

  if (!animated) return isVisible ? content : null;

  return (
    <AnimatePresence initial={false}>
      {isVisible && (
        <motion.div
          key="project-comments-panel"
          initial={{ height: 0, opacity: 0, y: -10 }}
          animate={{ height: 'auto', opacity: 1, y: 0 }}
          exit={{ height: 0, opacity: 0, y: -10 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden"
        >
          {content}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
