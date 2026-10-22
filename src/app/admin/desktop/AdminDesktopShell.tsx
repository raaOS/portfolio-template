'use client';

import React from 'react';
import type { AdminDesktopActions, AdminWindowState } from './types';
import AdminMenuBar from './AdminMenuBar';
import AdminWindowFrame from './AdminWindowFrame';
import WindowContentRenderer from './WindowContentRenderer';
import AdminTaskbar from './AdminTaskbar';
import './admin-desktop.css';

interface AdminDesktopShellProps {
  windows: AdminWindowState[];
  actions: AdminDesktopActions;
  onLogout: () => Promise<void>;
}

export default function AdminDesktopShell({
  windows,
  actions,
  onLogout,
}: AdminDesktopShellProps) {
  return (
    <div className="admin-desktop">
      <div className="admin-desktop-wallpaper" />

      {/* Top Menu Bar */}
      <AdminMenuBar onLogout={onLogout} />

      {/* Active CRUD Windows */}
      {windows.map((win) => (
        <AdminWindowFrame key={win.id} state={win} actions={actions}>
          <WindowContentRenderer appId={win.appId} actions={actions} />
        </AdminWindowFrame>
      ))}

      {/* Bottom Taskbar */}
      <AdminTaskbar windows={windows} actions={actions} />
    </div>
  );
}
