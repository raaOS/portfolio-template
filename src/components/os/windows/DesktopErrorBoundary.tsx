'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, Power, AlertTriangle } from 'lucide-react';
import { Z_LAYERS } from '../utils/zIndexLayers';

interface Props {
  children: ReactNode;
  /**
   * Only clear local/session storage saat user konfirmasi Safe Mode.
   * Admin yang punya buffer posisi lokal tidak kehilangan data
   * akibat error transient.
   */
  isAdmin?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  showSafeModeConfirm: boolean;
}

export default class DesktopErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    showSafeModeConfirm: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Desktop Environment Crashed:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  /**
   * Jangan langsung clear — kasih konfirmasi dulu.
   * Admin yang error sekali saja bisa kehilangan buffer posisi
   * kalau kita auto-clear. Sekarang harus klik 2x secara eksplisit.
   */
  private handleSafeModeRequest = () => {
    this.setState({ showSafeModeConfirm: true });
  };

  private handleSafeModeCancel = () => {
    this.setState({ showSafeModeConfirm: false });
  };

  private handleSafeModeConfirm = () => {
    try {
      localStorage.removeItem('portfolio-os-positions-v1');
      localStorage.removeItem('dock-config');
      sessionStorage.removeItem('portfolio-os-visitor-session-v1');
      sessionStorage.removeItem('portfolio-os-session-positions');
      sessionStorage.removeItem('portfolio_os_welcome_seen');
      sessionStorage.removeItem('portfolio_os_booted');
    } catch {
      console.error('Failed to clear local or session storage');
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const { showSafeModeConfirm } = this.state;
      const { isAdmin } = this.props;

      return (
        <div
          className="fixed inset-0 flex select-none flex-col items-center justify-center overflow-hidden bg-[#0078D7] p-8 text-center font-mono text-white"
          style={{ zIndex: Z_LAYERS.BACKDROP }}
        >
          <div className="flex w-full max-w-2xl flex-col items-start text-left">
            <span className="mb-8 text-8xl">:(</span>
            <h1 className="mb-8 text-3xl">Your PC ran into a problem and needs to restart.</h1>
            <p className="mb-8 text-xl">
              We&apos;re just collecting some error info, and then we&apos;ll restart for you.
            </p>

            <div className="mb-8 w-full rounded-lg bg-white/10 p-4 font-mono text-sm">
              <p className="mb-2 text-yellow-300">Error Code: CRITICAL_PROCESS_DIED</p>
              {this.state.error && (
                <p className="break-words opacity-80">{this.state.error.toString()}</p>
              )}
            </div>

            {showSafeModeConfirm ? (
              <div className="mb-4 w-full rounded-lg border border-yellow-300/60 bg-yellow-500/15 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={22} className="mt-1 flex-shrink-0 text-yellow-300" />
                  <div className="flex-1">
                    <p className="mb-2 font-bold text-yellow-100">Confirm Safe Mode Reset</p>
                    <p className="mb-4 text-sm text-yellow-50/90">
                      {isAdmin
                        ? 'Admin buffer (window positions, icon layout, dock config) akan dihapus dari browser ini. Posisi yang sudah di-flush ke server tetap aman.'
                        : 'Local desktop state akan dihapus. Lanjutkan?'}
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={this.handleSafeModeConfirm}
                        className="rounded bg-red-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-600"
                      >
                        Yes, Clear & Restart
                      </button>
                      <button
                        onClick={this.handleSafeModeCancel}
                        className="rounded border border-white/40 bg-transparent px-4 py-2 text-sm text-white transition-colors hover:bg-white/10"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex gap-4">
              <button
                onClick={this.handleReload}
                className="flex items-center gap-2 rounded bg-white px-6 py-3 font-bold text-[#0078D7] transition-colors hover:bg-white/90"
              >
                <RefreshCw size={20} />
                Restart PC
              </button>

              <button
                onClick={this.handleSafeModeRequest}
                disabled={showSafeModeConfirm}
                className="flex items-center gap-2 rounded border-2 border-white bg-transparent px-6 py-3 font-bold text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Power size={20} />
                Safe Mode (Reset Config)
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
