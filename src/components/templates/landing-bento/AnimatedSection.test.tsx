import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { AnimatedSection } from './AnimatedSection';

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: number[] = [];
  callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    instances.push(this);
  }

  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

let instances: MockIntersectionObserver[] = [];

describe('AnimatedSection', () => {
  beforeEach(() => {
    instances = [];
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    );
  });

  it('renders children immediately for animation=none', () => {
    render(
      <AnimatedSection animation="none">
        <p>No animation content</p>
      </AnimatedSection>
    );

    expect(screen.getByText('No animation content')).toBeInTheDocument();
    expect(instances).toHaveLength(0);
  });

  it('renders without animation styles when prefers-reduced-motion is enabled', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    );

    render(
      <AnimatedSection animation="fade-up">
        <p>Reduced motion content</p>
      </AnimatedSection>
    );

    const wrapper = screen.getByText('Reduced motion content').parentElement as HTMLElement;
    expect(wrapper.style.opacity).toBe('');
    expect(instances).toHaveLength(0);
  });

  it('starts hidden and becomes visible on intersection', () => {
    render(
      <AnimatedSection animation="fade-up">
        <p>Animated content</p>
      </AnimatedSection>
    );

    const wrapper = screen.getByText('Animated content').parentElement as HTMLElement;
    expect(wrapper.style.opacity).toBe('0');

    act(() => {
      instances[0].callback(
        [{ isIntersecting: true } as unknown as IntersectionObserverEntry],
        instances[0] as unknown as IntersectionObserver
      );
    });

    expect(wrapper.style.opacity).toBe('1');
    expect(wrapper.style.transform).toBe('none');
  });

  it('applies stagger transition delays to direct children', () => {
    render(
      <AnimatedSection animation="stagger" stagger>
        <div>Child A</div>
        <div>Child B</div>
      </AnimatedSection>
    );

    act(() => {
      instances[0].callback(
        [{ isIntersecting: true } as unknown as IntersectionObserverEntry],
        instances[0] as unknown as IntersectionObserver
      );
    });

    const innerWrapper = screen.getByText('Child A').parentElement as HTMLElement;
    const children = innerWrapper.children;
    expect((children[0] as HTMLElement).style.transitionDelay).toBe('0ms');
    expect((children[1] as HTMLElement).style.transitionDelay).toBe('80ms');
  });

  it('wraps content in parallax layer when parallax enabled', () => {
    render(
      <AnimatedSection animation="fade-up" parallax>
        <p>Parallax content</p>
      </AnimatedSection>
    );

    expect(screen.getByTestId('bento-parallax-layer')).toBeInTheDocument();
  });
});