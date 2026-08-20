import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';

type MockLinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string | { toString(): string };
  children?: React.ReactNode;
};

vi.mock('next-view-transitions', () => ({
  ViewTransitions: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  Link: ({ href, children, ...props }: MockLinkProps) =>
    React.createElement(
      'a',
      { href: typeof href === 'string' ? href : href.toString(), ...props },
      children
    ),
  useTransitionRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock('server-only', () => ({}));

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}
