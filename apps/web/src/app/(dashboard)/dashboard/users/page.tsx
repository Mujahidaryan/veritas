'use client';
import { useQuery } from '@tanstack/react-query';
import { Users, UserPlus } from 'lucide-react';
import apiClient from '@/lib/api-client';

interface UserRow { id: string; email: string; firstName: string; lastName: string; role: string; status: string; lastLoginAt?: string; }

const ROLE_COLORS: Record<string, string> = {
  ENTERPRISE_ADMIN: 'badge-blue',
  DEPARTMENT_ADMIN: 'badge-blue',
  ISSUER: 'badge-green',
  VERIFIER: 'badge-amber',
  VIEWER: 'badge-slate',
};

export default function UsersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiClient.get<never, { data: { data: UserRow[]; total: number } }>('/v1/org/users').then((r) => r.data),
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Users</h2>
          <p className="text-xs text-slate-500">{data?.total ?? 0} members in your organization</p>
        </div>
        <button className="btn-primary"><UserPlus size={15} /> Invite user</button>
      </div>
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100">
            <tr>{['Name', 'Email', 'Role', 'Status', 'Last login'].map((h) => (
              <th key={h} className="table-header px-4 py-3 text-left font-medium">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-400">Loading…</td></tr>}
            {data?.data?.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{u.firstName} {u.lastName}</td>
                <td className="px-4 py-3 text-slate-500">{u.email}</td>
                <td className="px-4 py-3"><span className={ROLE_COLORS[u.role] ?? 'badge-slate'}>{u.role.toLowerCase().replace('_', ' ')}</span></td>
                <td className="px-4 py-3"><span className={u.status === 'ACTIVE' ? 'badge-green' : 'badge-slate'}>{u.status.toLowerCase()}</span></td>
                <td className="px-4 py-3 text-xs text-slate-400">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
