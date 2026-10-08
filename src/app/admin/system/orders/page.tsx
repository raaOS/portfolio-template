'use client';

import { Receipt } from 'lucide-react';
import { AdminAuthGuard } from '../../components/AdminAuthGuard';
import { AdminHeader } from '../../components/components/AdminHeader';
import OrdersPanel from '../../desktop/panels/OrdersPanel';

function OrdersClientContent() {
  return (
    <>
      <AdminHeader
        title="Order & Pembayaran"
        titleIcon={<Receipt className="h-5 w-5" aria-hidden />}
        titleAccent="bg-blue-100 text-blue-700"
      />

      <div className="flex min-h-0 flex-1 flex-col p-6">
        <OrdersPanel />
      </div>
    </>
  );
}

export default function AdminOrdersPage() {
  return (
    <AdminAuthGuard>
      <OrdersClientContent />
    </AdminAuthGuard>
  );
}
