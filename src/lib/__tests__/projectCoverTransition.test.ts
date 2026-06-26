import { afterEach, describe, expect, it } from 'vitest';
import {
  cancelProjectCoverTransition,
  cleanupProjectCoverTransitionState,
  prepareProjectCoverTransition,
  PROJECT_CARD_ACTIVE_ATTRIBUTE,
  PROJECT_COVER_ORIGIN_ATTRIBUTE,
  PROJECT_COVER_TRANSITION_ATTRIBUTE,
  PROJECT_COVER_TRANSITION_NAME,
} from '../projectCoverTransition';

afterEach(() => {
  cleanupProjectCoverTransitionState();
  document.body.replaceChildren();
});

describe('prepareProjectCoverTransition', () => {
  it('keeps the project cover transition name on exactly one participant', () => {
    const previousTarget = document.createElement('div');
    const nextTarget = document.createElement('div');

    previousTarget.setAttribute(PROJECT_COVER_TRANSITION_ATTRIBUTE, '');
    nextTarget.setAttribute(PROJECT_COVER_TRANSITION_ATTRIBUTE, '');
    previousTarget.style.setProperty('view-transition-name', PROJECT_COVER_TRANSITION_NAME);
    document.body.append(previousTarget, nextTarget);

    prepareProjectCoverTransition(nextTarget);

    expect(previousTarget.style.getPropertyValue('view-transition-name')).toBe('');
    expect(previousTarget.hasAttribute(PROJECT_COVER_TRANSITION_ATTRIBUTE)).toBe(false);
    expect(nextTarget.style.getPropertyValue('view-transition-name')).toBe(
      PROJECT_COVER_TRANSITION_NAME
    );
    expect(nextTarget.hasAttribute(PROJECT_COVER_TRANSITION_ATTRIBUTE)).toBe(true);
  });

  it('does not alter elements outside the project cover transition', () => {
    const unrelated = document.createElement('div');
    const target = document.createElement('div');

    unrelated.style.setProperty('view-transition-name', 'site-header');
    target.setAttribute(PROJECT_COVER_TRANSITION_ATTRIBUTE, '');
    document.body.append(unrelated, target);

    prepareProjectCoverTransition(target);

    expect(unrelated.style.getPropertyValue('view-transition-name')).toBe('site-header');
  });

  it('marks grid origin and active source card for deck shuffle', () => {
    const sourceCard = document.createElement('a');
    const target = document.createElement('div');
    sourceCard.append(target);
    document.body.append(sourceCard);

    prepareProjectCoverTransition(target, { origin: 'grid', sourceCard });

    expect(document.documentElement.getAttribute(PROJECT_COVER_ORIGIN_ATTRIBUTE)).toBe('grid');
    expect(document.documentElement.getAttribute('data-vt-morph-active')).toBe('true');
    expect(sourceCard.getAttribute(PROJECT_CARD_ACTIVE_ATTRIBUTE)).toBe('true');
  });

  it('cleans temporary morph and deck shuffle attributes', () => {
    const sourceCard = document.createElement('a');
    const target = document.createElement('div');
    sourceCard.append(target);
    document.body.append(sourceCard);

    prepareProjectCoverTransition(target, { origin: 'grid', sourceCard });
    cleanupProjectCoverTransitionState();

    expect(document.documentElement.hasAttribute(PROJECT_COVER_ORIGIN_ATTRIBUTE)).toBe(false);
    expect(document.documentElement.hasAttribute('data-vt-morph-active')).toBe(false);
    expect(sourceCard.hasAttribute(PROJECT_CARD_ACTIVE_ATTRIBUTE)).toBe(false);
  });

  it('cancels project cover participants before grid back navigation', () => {
    const target = document.createElement('div');
    document.body.append(target);

    prepareProjectCoverTransition(target, { origin: 'grid' });
    cancelProjectCoverTransition();

    expect(target.style.getPropertyValue('view-transition-name')).toBe('');
    expect(target.hasAttribute(PROJECT_COVER_TRANSITION_ATTRIBUTE)).toBe(false);
    expect(document.documentElement.hasAttribute(PROJECT_COVER_ORIGIN_ATTRIBUTE)).toBe(false);
    expect(document.documentElement.hasAttribute('data-vt-morph-active')).toBe(false);
  });
});
