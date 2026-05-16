'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, FileCheck, Shield, Users,
  Settings, BarChart2, Webhook,
  Building2, Activity, LogOut,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '@/store/auth.store';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { href: '/dashboard/documents', icon: FileCheck, label: 'Documents' },
  { href: '/dashboard/verify', icon: Shield, label: 'Verify' },
  { href: '/dashboard/audit', icon: Activity, label: 'Audit log' },
  { href: '/dashboard/analytics', icon: BarChart2, label: 'Analytics' },
  { href: '/dashboard/users', icon: Users, label: 'Users' },
  { href: '/dashboard/departments', icon: Building2, label: 'Departments' },
  { href: '/dashboard/webhooks', icon: Webhook, label: 'Webhooks' },
  { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <aside className="w-[var(--sidebar-width)] flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
      {/* Brand */}
      <div className="px-5 py-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-brand-600 rounded-md flex items-center justify-center flex-shrink-0">
            <Shield size={14} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-slate-900 tracking-tight">Veritas</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx('sidebar-link', active && 'active')}
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-slate-200">
        <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
          <div className="w-7 h-7 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 text-xs font-semibold flex-shrink-0">
            {user?.firstName?.[0]?.toUpperCase() ??
              user?.email?.[0]?.toUpperCase() ??
              'U'}
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-medium text-slate-900 truncate">
              {user?.firstName
                ? `${user.firstName} ${user.lastName ?? ''}`
                : user?.email ?? 'User'}
            </p>
            <p className="text-xs text-slate-500 capitalize truncate">
              {user?.role?.toLowerCase().replace('_', ' ') ?? 'Member'}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="sidebar-link w-full text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
