'use client';

import { DatabaseBackup } from 'lucide-react';
import { AdminAuthGuard } from '../../components/AdminAuthGuard';
import { AdminHeader } from '../../components/components/AdminHeader';
import BackupPanel from '../../desktop/panels/BackupPanel';

function BackupClientContent() {
  return (
    <>
      <AdminHeader
        title="Backup Database"
        titleIcon={<DatabaseBackup className="h-5 w-5" aria-hidden />}
        titleAccent="bg-emerald-100 text-emerald-700"
      />

      <div className="flex min-h-0 flex-1 flex-col p-6">
        <BackupPanel />
      </div>
    </>
  );
}

export default function AdminBackupPage() {
  return (
    <AdminAuthGuard>
      <BackupClientContent />
    </AdminAuthGuard>
  );
}
