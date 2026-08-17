'use client';

import React from 'react';
import { Loader2, Languages, RotateCcw, ExternalLink } from 'lucide-react';
import type { Comment } from '@/lib/magic';
import ShareSheet from '@/components/ui/ShareSheet';
import SystemNotification from '@/components/ui/SystemNotification';
import { usePathname } from 'next/navigation';
import { buildTenantProjectDetailHref } from '@/lib/routing/tenantRoutes';

interface ProjectInteractionBarProps {
  isProjectLiked: boolean;
  metrics: { likes: number; shares: number };
  comments: Comment[];
  translations: Record<string, string> | null;
  translateLoading: boolean;
  likePending: boolean;
  onLike: () => void;
  onShare: () => void;
  onTranslate: () => void;
  onScrollToComments: () => void;
  title?: string;
  orientation?: 'horizontal' | 'vertical';
  projectSlug?: string;
}

export function ProjectInteractionBar({
  isProjectLiked,
  metrics,
  comments,
  translations,
  translateLoading,
  likePending,
  onLike,
  onShare,
  onTranslate,
  onScrollToComments,
  title = 'Project',
  orientation = 'horizontal',
  projectSlug,
}: ProjectInteractionBarProps) {
  const pathname = usePathname();
  const [isShareOpen, setIsShareOpen] = React.useState(false);
  const [notification, setNotification] = React.useState<{
    isOpen: boolean;
    title: string;
    message?: string;
    type: 'success' | 'info' | 'warning' | 'error';
  }>({ isOpen: false, title: '', type: 'success' });
  const commentCount = comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);
  const isVertical = orientation === 'vertical';
  const buttonClassName = (activeClass: string, inactiveClass: string) =>
    `flex items-center rounded-full p-1.5 transition-all duration-200 ${
      isVertical ? 'flex-col gap-0.5' : 'gap-1'
    } ${activeClass || inactiveClass}`;
  const countClassName = isVertical
    ? 'text-[11px] font-semibold leading-none'
    : 'pr-1 text-sm font-medium';

  return (
    <div
      className={
        isVertical ? 'flex flex-col items-center gap-3' : 'flex flex-wrap items-center gap-2 pt-2'
      }
    >
      <div className={isVertical ? 'flex flex-col items-center gap-3' : 'flex items-center gap-2'}>
        {/* Like Button */}
        <button
          type="button"
          onClick={onLike}
          disabled={likePending}
          aria-label={isProjectLiked ? 'Unlike project' : 'Like project'}
          aria-busy={likePending}
          className={`${buttonClassName(
            isProjectLiked || metrics.likes > 0 ? 'text-red-500' : '',
            'text-gray-400 hover:text-red-500'
          )} disabled:cursor-wait disabled:opacity-70`}
        >
          <svg
            className="h-5 w-5 sm:h-6 sm:w-6"
            fill={isProjectLiked ? 'currentColor' : 'none'}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
          {metrics.likes > 0 && <span className={countClassName}>{metrics.likes}</span>}
        </button>

        {/* Comment Button */}
        <button
          type="button"
          className={buttonClassName(
            commentCount > 0 ? 'text-green-600 dark:text-green-500' : '',
            'text-gray-400 hover:text-green-600 dark:hover:text-green-500'
          )}
          onClick={onScrollToComments}
          aria-label="View comments"
        >
          <svg
            className="h-5 w-5 sm:h-6 sm:w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          {commentCount > 0 && <span className={countClassName}>{commentCount}</span>}
        </button>

        {/* Share Button */}
        <button
          type="button"
          className={buttonClassName(
            metrics.shares > 0 ? 'text-blue-500' : '',
            'text-gray-400 hover:text-blue-500'
          )}
          onClick={() => {
            onShare();
            setIsShareOpen(true);
          }}
          aria-label="Share project"
        >
          <svg
            className="h-5 w-5 sm:h-6 sm:w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
          {metrics.shares > 0 && <span className={countClassName}>{metrics.shares}</span>}
        </button>

        {/* Translate Button */}
        <button
          type="button"
          onClick={onTranslate}
          disabled={translateLoading}
          className={`${isVertical ? 'flex-col gap-0.5' : 'gap-1'} flex items-center rounded-full p-1.5 transition-all duration-200 disabled:opacity-50 ${
            translations
              ? 'text-purple-600 hover:text-gray-400'
              : 'text-gray-400 hover:text-purple-600'
          }`}
          title={translations ? 'Restore original' : 'Translate with AI'}
        >
          {translateLoading ? (
            <Loader2 className="h-5 w-5 animate-spin sm:h-6 sm:w-6" />
          ) : translations ? (
            <RotateCcw className="h-5 w-5 sm:h-6 sm:w-6" />
          ) : (
            <Languages className="h-5 w-5 sm:h-6 sm:w-6" />
          )}
        </button>

        {/* Open Full Page Button (vertical/window mode only) */}
        {isVertical && projectSlug && (
          <a
            href={buildTenantProjectDetailHref(pathname, projectSlug)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center rounded-full p-1.5 text-gray-400 transition-all duration-200 hover:text-amber-500"
            aria-label="Open full page"
            title="Open full page"
          >
            <ExternalLink className="h-5 w-5 sm:h-6 sm:w-6" />
          </a>
        )}
      </div>

      {/* Custom Share Sheet */}
      <ShareSheet
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        url={typeof window !== 'undefined' ? window.location.href : ''}
        title={title}
        onCopyLink={() => {
          if (typeof window !== 'undefined') {
            navigator.clipboard.writeText(window.location.href);
            setNotification({
              isOpen: true,
              title: 'Link Copied',
              message: 'Project link copied to clipboard',
              type: 'success',
            });
          }
        }}
      />

      {/* System Notification */}
      <SystemNotification
        isOpen={notification.isOpen}
        onClose={() => setNotification((prev) => ({ ...prev, isOpen: false }))}
        title={notification.title}
        message={notification.message}
        type={notification.type}
      />
    </div>
  );
}
