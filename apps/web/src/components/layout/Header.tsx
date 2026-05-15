'use client';

import { Bell } from 'lucide-react';
import { usePathname } from 'next/navigation';

const pageLabels: Record<string, string> = {
  '/dashboard': 'Overview',
  '/dashboard/documents': 'Documents',
  '/dashboard/verify': 'Verify Document',
  '/dashboard/audit': 'Audit Log',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/users': 'User Management',
  '/dashboard/departments': 'Departments',
  '/dashboard/webhooks': 'Webhooks',
  '/dashboard/settings': 'Settings',
};

export function Header() {
  const pathname = usePathname();
  const label = pageLabels[pathname] ?? 'Veritas';

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
      <h1 className="text-sm font-semibold text-slate-900">{label}</h1>
      <div className="flex items-center gap-2">
        <button className="btn-ghost p-2 rounded-lg relative">
          <Bell size={16} className="text-slate-500" />
        </button>
      </div>
    </header>
  );
}
