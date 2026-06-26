export const PROJECT_COVER_TRANSITION_NAME = 'project-cover';
export const PROJECT_COVER_TRANSITION_ATTRIBUTE = 'data-project-cover-transition';
export const PROJECT_COVER_ORIGIN_ATTRIBUTE = 'data-project-cover-origin';
export const PROJECT_CARD_ACTIVE_ATTRIBUTE = 'data-project-card-transition-active';

const PROJECT_COVER_SELECTOR = `[${PROJECT_COVER_TRANSITION_ATTRIBUTE}]`;
const PROJECT_CARD_ACTIVE_SELECTOR = `[${PROJECT_CARD_ACTIVE_ATTRIBUTE}]`;
const MORPH_ACTIVE_ATTRIBUTE = 'data-vt-morph-active';
const CLEANUP_DELAY_MS = 1400;

export type ProjectCoverTransitionOrigin = 'grid' | 'canvas' | 'slug-related';

interface ProjectCoverTransitionOptions {
  origin?: ProjectCoverTransitionOrigin;
  sourceCard?: HTMLElement | null;
}

let cleanupTimer: ReturnType<typeof setTimeout> | null = null;

export function clearProjectCoverTransitionParticipants(): void {
  if (typeof document === 'undefined') return;

  document.querySelectorAll<HTMLElement>(PROJECT_COVER_SELECTOR).forEach((element) => {
    element.style.removeProperty('view-transition-name');
    element.removeAttribute(PROJECT_COVER_TRANSITION_ATTRIBUTE);
  });
}

export function cleanupProjectCoverTransitionState(): void {
  if (typeof document === 'undefined') return;

  document.documentElement.removeAttribute(MORPH_ACTIVE_ATTRIBUTE);
  document.documentElement.removeAttribute(PROJECT_COVER_ORIGIN_ATTRIBUTE);

  document.querySelectorAll<HTMLElement>(PROJECT_CARD_ACTIVE_SELECTOR).forEach((element) => {
    element.removeAttribute(PROJECT_CARD_ACTIVE_ATTRIBUTE);
  });

  if (cleanupTimer) {
    clearTimeout(cleanupTimer);
    cleanupTimer = null;
  }
}

export function cancelProjectCoverTransition(): void {
  cleanupProjectCoverTransitionState();
  clearProjectCoverTransitionParticipants();
}

/**
 * A view-transition-name must be unique within each captured DOM state.
 * Clear stale participants before assigning the clicked project cover.
 */
export function prepareProjectCoverTransition(
  target: HTMLElement,
  options: ProjectCoverTransitionOptions = {}
): void {
  if (typeof document === 'undefined') return;

  document.querySelectorAll<HTMLElement>(PROJECT_COVER_SELECTOR).forEach((element) => {
    if (element !== target) {
      element.style.removeProperty('view-transition-name');
      element.removeAttribute(PROJECT_COVER_TRANSITION_ATTRIBUTE);
    }
  });

  document.querySelectorAll<HTMLElement>(PROJECT_CARD_ACTIVE_SELECTOR).forEach((element) => {
    if (element !== options.sourceCard) {
      element.removeAttribute(PROJECT_CARD_ACTIVE_ATTRIBUTE);
    }
  });

  target.setAttribute(PROJECT_COVER_TRANSITION_ATTRIBUTE, '');
  target.style.setProperty('view-transition-name', PROJECT_COVER_TRANSITION_NAME);

  if (options.sourceCard) {
    options.sourceCard.setAttribute(PROJECT_CARD_ACTIVE_ATTRIBUTE, 'true');
  }

  // Set origin supaya CSS bisa membedakan grid, canvas, dan related card detail.
  document.documentElement.setAttribute(MORPH_ACTIVE_ATTRIBUTE, 'true');
  if (options.origin) {
    document.documentElement.setAttribute(PROJECT_COVER_ORIGIN_ATTRIBUTE, options.origin);
  } else {
    document.documentElement.removeAttribute(PROJECT_COVER_ORIGIN_ATTRIBUTE);
  }

  // Bersihkan attribute sebagai fallback fail-safe (misal navigasi dibatalkan).
  if (cleanupTimer) clearTimeout(cleanupTimer);
  cleanupTimer = setTimeout(cleanupProjectCoverTransitionState, CLEANUP_DELAY_MS);
}
