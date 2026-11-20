'use client';

import { TicketPercent } from 'lucide-react';
import { AdminAuthGuard } from '../../components/AdminAuthGuard';
import { AdminHeader } from '../../components/components/AdminHeader';
import CouponsPanel from '../../desktop/panels/CouponsPanel';

export default function AdminCouponsPage() {
  return (
    <AdminAuthGuard>
      <AdminHeader
        title="Kupon Diskon"
        titleIcon={<TicketPercent className="h-5 w-5" aria-hidden />}
        titleAccent="bg-rose-100 text-rose-700"
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <CouponsPanel />
      </div>
    </AdminAuthGuard>
  );
}
