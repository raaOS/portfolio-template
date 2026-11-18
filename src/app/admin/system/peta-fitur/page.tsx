'use client';

import { Map as MapIcon } from 'lucide-react';
import { AdminAuthGuard } from '../../components/AdminAuthGuard';
import { AdminHeader } from '../../components/components/AdminHeader';
import PetaFiturPanel from '../../desktop/panels/PetaFiturPanel';

function PetaFiturClientContent() {
  return (
    <>
      <AdminHeader
        title="Peta Fitur & Template"
        titleIcon={<MapIcon className="h-5 w-5" aria-hidden />}
        titleAccent="bg-slate-100 text-slate-700"
      />

      <div className="flex min-h-0 flex-1 flex-col p-6">
        <PetaFiturPanel />
      </div>
    </>
  );
}

export default function PetaFiturPage() {
  return (
    <AdminAuthGuard>
      <PetaFiturClientContent />
    </AdminAuthGuard>
  );
}
