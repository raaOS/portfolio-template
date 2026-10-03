'use client';

import { ScrollText } from 'lucide-react';
import { AdminAuthGuard } from '../../components/AdminAuthGuard';
import { AdminHeader } from '../../components/components/AdminHeader';
import ActivityLogPanel from '../../desktop/panels/ActivityLogPanel';

function ActivityLogClientContent() {
  return (
    <>
      <AdminHeader
        title="Log Aktivitas"
        titleIcon={<ScrollText className="h-5 w-5" aria-hidden />}
        titleAccent="bg-slate-100 text-slate-700"
      />

      <div className="flex min-h-0 flex-1 flex-col p-6">
        <ActivityLogPanel />
      </div>
    </>
  );
}

export default function AdminActivityLogPage() {
  return (
    <AdminAuthGuard>
      <ActivityLogClientContent />
    </AdminAuthGuard>
  );
}
