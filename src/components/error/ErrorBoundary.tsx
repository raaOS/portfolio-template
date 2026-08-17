'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Generic Error Boundary Component
 *
 * Catches JavaScript errors in child components and renders fallback UI.
 * Prevents white screen crashes.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);

    this.props.onError?.(error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-900 p-8 text-white">
          <div className="max-w-md text-center">
            <h2 className="mb-4 text-2xl font-bold">Something went wrong</h2>
            <p className="mb-6 text-gray-400">
              We apologize for the inconvenience. Please refresh the page or try again later.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-blue-600 px-6 py-3 font-medium transition-colors hover:bg-blue-700"
            >
              Refresh Page
            </button>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 rounded bg-gray-800 p-4 text-left text-sm text-red-400">
                <summary>Error Details (Dev Only)</summary>
                <pre className="mt-2 overflow-auto">
                  {this.state.error.message}
                  {'\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * OS Desktop Specific Error Boundary
 * Provides macOS-style error dialog
 */
export class DesktopErrorBoundary extends Component<{ children: ReactNode }, State> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[DesktopErrorBoundary] OS crash:', error);
    console.error('[DesktopErrorBoundary] Stack:', errorInfo.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-black">
          <div className="mx-4 w-full max-w-md rounded-xl border border-gray-700 bg-gray-800 p-8 shadow-2xl">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-2xl text-white">
                ⚠️
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">System Error</h2>
                <p className="text-sm text-gray-400">Portfolio OS encountered a problem</p>
              </div>
            </div>

            <p className="mb-6 text-gray-300">
              The desktop environment crashed unexpectedly. Your data has been preserved.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
              >
                Restart System
              </button>
              <button
                onClick={() => (window.location.href = '/')}
                className="flex-1 rounded-lg bg-gray-700 px-4 py-2 font-medium text-white transition-colors hover:bg-gray-600"
              >
                Safe Mode
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Section-specific Error Boundary
 * Renders smaller fallback for non-critical sections
 */
export class SectionErrorBoundary extends Component<
  {
    children: ReactNode;
    sectionName: string;
    fallback?: ReactNode;
  },
  State
> {
  constructor(props: { children: ReactNode; sectionName: string; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo): void {
    console.error(`[SectionErrorBoundary:${this.props.sectionName}] Error:`, error);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <h3 className="mb-2 font-semibold text-red-800">
            ⚠️ {this.props.sectionName} failed to load
          </h3>
          <p className="text-sm text-red-600">
            This section encountered an error. Other parts of the application may still work.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 text-sm text-red-700 underline hover:text-red-800"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Async Error Handler Hook
 * For handling errors in async operations (not render errors)
 */
export function useAsyncErrorHandler() {
  const handleError = (error: unknown, context: string): void => {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`[AsyncError:${context}]`, err);

    // Could integrate with error tracking service here
    // Sentry.captureException(err);
  };

  const wrapAsync = async <T,>(promise: Promise<T>, context: string): Promise<T | null> => {
    try {
      return await promise;
    } catch (error) {
      handleError(error, context);
      return null;
    }
  };

  return { handleError, wrapAsync };
}
