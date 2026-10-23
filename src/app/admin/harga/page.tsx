'use client';

import { Banknote } from 'lucide-react';
import { AdminAuthGuard } from '../components/AdminAuthGuard';
import { AdminHeader } from '../components/components/AdminHeader';
import HargaPanel from '../desktop/panels/HargaPanel';

export default function AdminHargaPage() {
  return (
    <AdminAuthGuard>
      <AdminHeader
        title="Harga Jual"
        titleIcon={<Banknote className="h-5 w-5" aria-hidden />}
        titleAccent="bg-amber-100 text-amber-700"
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <HargaPanel />
      </div>
    </AdminAuthGuard>
  );
}
