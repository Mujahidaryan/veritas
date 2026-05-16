'use client';
import { useQuery } from '@tanstack/react-query';
import { Settings, Building2, Shield, Key } from 'lucide-react';
import apiClient from '@/lib/api-client';

export default function SettingsPage() {
  const { data } = useQuery({
    queryKey: ['tenant'],
    queryFn: () => apiClient.get<never, { data: { name: string; slug: string; plan: string; status: string; maxUsers: number; maxDocumentsPerMonth: number; documentsUsedThisMonth: number } }>('/v1/org').then((r) => r.data),
  });

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Settings</h2>
        <p className="text-xs text-slate-500">Manage your organization configuration</p>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Building2 size={16} className="text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">Organization</h3>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><p className="label">Name</p><p className="font-medium text-slate-800">{data?.name ?? '—'}</p></div>
          <div><p className="label">Slug</p><p className="font-mono text-slate-700">{data?.slug ?? '—'}</p></div>
          <div><p className="label">Plan</p><span className="badge-blue">{data?.plan ?? '—'}</span></div>
          <div><p className="label">Status</p><span className="badge-green">{data?.status ?? '—'}</span></div>
        </div>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={16} className="text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">Usage</h3>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-600">Documents this month</span>
            <span className="text-slate-400 font-mono">{data?.documentsUsedThisMonth ?? 0} / {data?.maxDocumentsPerMonth ?? 0}</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all"
              style={{ width: `${data ? (data.documentsUsedThisMonth / data.maxDocumentsPerMonth) * 100 : 0}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-600">Max users</span>
            <span className="text-slate-400 font-mono">{data?.maxUsers ?? 0} seats</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <Key size={16} className="text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">API Keys</h3>
        </div>
        <p className="text-xs text-slate-500 mb-3">Use API keys to integrate Veritas with your existing systems.</p>
        <button className="btn-secondary text-xs"><Key size={13} /> Generate API key</button>
      </div>
    </div>
  );
}
