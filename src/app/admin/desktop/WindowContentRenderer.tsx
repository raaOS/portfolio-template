'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import AdminLoading from '@/components/admin/AdminLoading';
import { ADMIN_ZONES } from './registry';
import type { AdminDesktopActions } from './types';

// ─── Lazy-loaded CRUD client components ───
// Each component is the actual CRUD panel rendered inside an admin window.
// They are lazy-loaded so opening a folder doesn't pull in all CRUD bundles.

const ProjectsPanel = dynamic(() => import('@/app/admin/projects/AdminProjectsClient'), {
  ssr: false,
  loading: () => <AdminLoading size="page" />,
});

const ClientDashboardPanel = dynamic(
  () => import('@/app/admin/client-dashboard/ClientDashboardPanel'),
  {
    ssr: false,
    loading: () => <AdminLoading size="page" />,
  }
);

const ProfilePanel = dynamic(() => import('./panels/ProfilePanel'), {
  ssr: false,
  loading: () => <AdminLoading size="page" />,
});

const ExperiencePanel = dynamic(
  () => import('@/app/admin/content/experience/AdminExperienceClient'),
  { ssr: false, loading: () => <AdminLoading size="page" /> }
);

const SkillsPanel = dynamic(() => import('./panels/SkillsPanel'), {
  ssr: false,
  loading: () => <AdminLoading size="page" />,
});

const ArchivePanel = dynamic(() => import('./panels/ArchivePanel'), {
  ssr: false,
  loading: () => <AdminLoading size="page" />,
});

const LabelsPanel = dynamic(() => import('./panels/LabelsPanel'), {
  ssr: false,
  loading: () => <AdminLoading size="page" />,
});

const ExplorerPanel = dynamic(() => import('@/app/admin/projects/explorer/AdminExplorerClient'), {
  ssr: false,
  loading: () => <AdminLoading size="page" />,
});

const EventPagesPanel = dynamic(
  () => import('@/app/admin/projects/event-pages/AdminEventPagesClient'),
  { ssr: false, loading: () => <AdminLoading size="page" /> }
);

const AppearancePanel = dynamic(() => import('./panels/AppearancePanel'), {
  ssr: false,
  loading: () => <AdminLoading size="page" />,
});

const DockPanel = dynamic(() => import('./panels/DockPanel'), {
  ssr: false,
  loading: () => <AdminLoading size="page" />,
});

const WidgetsPanel = dynamic(() => import('./panels/WidgetsPanel'), {
  ssr: false,
  loading: () => <AdminLoading size="page" />,
});

const SoundsPanel = dynamic(() => import('./panels/SoundsPanel'), {
  ssr: false,
  loading: () => <AdminLoading size="page" />,
});

const AnalyticsPanel = dynamic(() => import('./panels/AnalyticsPanel'), {
  ssr: false,
  loading: () => <AdminLoading size="page" />,
});

const NotificationsPanel = dynamic(() => import('./panels/NotificationsPanel'), {
  ssr: false,
  loading: () => <AdminLoading size="page" />,
});

const MessagesPanel = dynamic(
  () => import('@/app/admin/communications/messages/AdminLeadsClient'),
  { ssr: false, loading: () => <AdminLoading size="page" /> }
);

const FeedbackPanel = dynamic(
  () => import('@/app/admin/communications/feedback/AdminFeedbackClient'),
  { ssr: false, loading: () => <AdminLoading size="page" /> }
);

const ContactsPanel = dynamic(
  () => import('@/app/admin/communications/contacts/AdminContactClient'),
  { ssr: false, loading: () => <AdminLoading size="page" /> }
);

const PaymentConfigPanel = dynamic(
  () => import('./panels/PaymentConfigPanel'),
  { ssr: false, loading: () => <AdminLoading size="page" /> }
);

const OrdersPanel = dynamic(
  () => import('./panels/OrdersPanel'),
  { ssr: false, loading: () => <AdminLoading size="page" /> }
);

const PANEL_MAP: Record<string, React.ComponentType> = {
  clientDashboard: ClientDashboardPanel,
  projects: ProjectsPanel,
  profile: ProfilePanel,
  experience: ExperiencePanel,
  skills: SkillsPanel,
  archive: ArchivePanel,
  labels: LabelsPanel,
  explorer: ExplorerPanel,
  eventPages: EventPagesPanel,
  appearance: AppearancePanel,
  dock: DockPanel,
  widgets: WidgetsPanel,
  sounds: SoundsPanel,
  analytics: AnalyticsPanel,
  notifications: NotificationsPanel,
  messages: MessagesPanel,
  feedback: FeedbackPanel,
  contacts: ContactsPanel,
  paymentConfig: PaymentConfigPanel,
  orders: OrdersPanel,
};

interface WindowContentRendererProps {
  appId: string;
  actions: AdminDesktopActions;
}

export default function WindowContentRenderer({
  appId,
  actions,
}: WindowContentRendererProps) {
  if (appId.startsWith('folder-')) {
    const zoneId = appId.replace('folder-', '');
    const zone = ADMIN_ZONES.find((z) => z.id === zoneId);
    if (!zone) {
      return (
        <div className="flex h-full items-center justify-center text-gray-400">
          Folder &quot;{zoneId}&quot; tidak ditemukan
        </div>
      );
    }

    return (
      <div className="admin-folder-grid h-full overflow-y-auto items-start">
        {zone.apps.map((app) => (
          <button
            key={app.id}
            className="admin-folder-app"
            onClick={() => {
              actions.openApp(zone.id, app.id);
            }}
          >
            <div className={`admin-folder-app-icon ${app.iconBg}`}>
              <app.icon className={`h-7 w-7 ${app.iconColor}`} />
            </div>
            <span className="admin-folder-app-label">{app.label}</span>
          </button>
        ))}
      </div>
    );
  }

  const Panel = PANEL_MAP[appId];

  if (!Panel) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        Panel &quot;{appId}&quot; belum tersedia
      </div>
    );
  }

  return (
    <Suspense fallback={<AdminLoading size="page" />}>
      <div className="admin-window-panel-scroll" data-lenis-prevent>
        <Panel />
      </div>
    </Suspense>
  );
}
