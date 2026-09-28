'use client';

import { BarChart3 } from 'lucide-react';
import { AdminAuthGuard } from '../../components/AdminAuthGuard';
import { AdminHeader } from '../../components/components/AdminHeader';
import AnalyticsPanel from '../../desktop/panels/AnalyticsPanel';

function AnalyticsClientContent() {
  return (
    <>
      <AdminHeader
        title="Statistik Pengunjung"
        titleIcon={<BarChart3 className="h-5 w-5" aria-hidden />}
        titleAccent="bg-teal-50 text-teal-700"
      />

      <div className="flex-1 space-y-6 p-6">
        <AnalyticsPanel />
      </div>
    </>
  );
}

export default function AdminAnalyticsPage() {
  return (
    <AdminAuthGuard>
      <AnalyticsClientContent />
    </AdminAuthGuard>
  );
}
