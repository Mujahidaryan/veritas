'use client';
import { useQuery } from '@tanstack/react-query';
import { BarChart2, TrendingUp, Shield, FileCheck } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import apiClient from '@/lib/api-client';

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => apiClient.get<never, { data: {
      totalDocuments: number;
      totalVerifications: number;
      tamperedDetections: number;
      verificationTrend: { date: string; count: number }[];
      topDocumentTypes: { type: string; count: number }[];
    } }>('/v1/analytics/summary').then((r) => r.data),
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Analytics</h2>
        <p className="text-xs text-slate-500">Verification and document activity overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total documents', value: data?.totalDocuments, icon: FileCheck, color: 'text-brand-600', bg: 'bg-brand-50' },
          { label: 'Total verifications', value: data?.totalVerifications, icon: Shield, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Tamper alerts', value: data?.tamperedDetections, icon: TrendingUp, color: 'text-red-600', bg: 'bg-red-50' },
        ].map((s) => (
          <div key={s.label} className="card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {isLoading ? '—' : s.value?.toLocaleString() ?? '0'}
                </p>
              </div>
              <div className={`${s.bg} ${s.color} p-2 rounded-lg`}>
                <s.icon size={18} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Verification trend (30 days)</h3>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.verificationTrend ?? []}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2952f5" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2952f5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: '#f1f5f9', fontSize: '12px' }} />
              <Area type="monotone" dataKey="count" stroke="#2952f5" strokeWidth={2} fill="url(#grad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Documents by type</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.topDocumentTypes ?? []} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis dataKey="type" type="category" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={120} tickFormatter={(v: string) => v.replace(/-/g, ' ')} />
              <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: '#f1f5f9', fontSize: '12px' }} />
              <Bar dataKey="count" fill="#2952f5" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
