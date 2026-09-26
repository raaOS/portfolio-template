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

// jsdom 28 + vitest 4: window.localStorage tidak ter-expose di environment
// worker (sessionStorage ya, localStorage tidak — getter mengembalikan
// undefined). Test seperti positionSync memanggil localStorage.clear()
// langsung -> TypeError. Polyfill in-memory minimal bila belum ada.
if (typeof window !== 'undefined' && typeof window.localStorage === 'undefined') {
  const makeStorage = (): Storage => {
    const map = new Map<string, string>();
    return {
      get length() { return map.size; },
      clear: () => map.clear(),
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => { map.set(k, String(v)); },
      removeItem: (k: string) => { map.delete(k); },
      key: (i: number) => Array.from(map.keys())[i] ?? null,
    } as Storage;
  };
  Object.defineProperty(window, 'localStorage', { writable: true, value: makeStorage() });
  Object.defineProperty(globalThis, 'localStorage', { writable: true, value: window.localStorage });
}

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
