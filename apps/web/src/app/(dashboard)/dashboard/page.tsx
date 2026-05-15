'use client';

import { useQuery } from '@tanstack/react-query';
import {
  FileCheck, Shield, AlertTriangle, Users,
  TrendingUp, ArrowUpRight,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import apiClient from '@/lib/api-client';
import type { AnalyticsSummary } from '@veritas/shared-types';

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'summary'],
    queryFn: () => apiClient.get<never, { data: AnalyticsSummary }>('/v1/analytics/summary').then((r) => r.data),
  });

  const stats = [
    {
      label: 'Total documents',
      value: data?.totalDocuments?.toLocaleString() ?? '—',
      sub: `${data?.documentsThisMonth ?? 0} this month`,
      icon: FileCheck,
      color: 'text-brand-600',
      bg: 'bg-brand-50',
    },
    {
      label: 'Verifications',
      value: data?.totalVerifications?.toLocaleString() ?? '—',
      sub: `${data?.verificationsThisMonth ?? 0} this month`,
      icon: Shield,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Tamper alerts',
      value: data?.tamperedDetections?.toString() ?? '—',
      sub: 'All time',
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Active users',
      value: data?.activeUsers?.toString() ?? '—',
      sub: 'In your organization',
      icon: Users,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-500 mb-1">{stat.label}</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {isLoading ? <span className="animate-pulse">···</span> : stat.value}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{stat.sub}</p>
              </div>
              <div className={`${stat.bg} ${stat.color} p-2 rounded-lg`}>
                <stat.icon size={18} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Verification trend chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Verification activity</h2>
            <p className="text-xs text-slate-500">Last 30 days</p>
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
            <TrendingUp size={13} />
            <span>Live</span>
          </div>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.verificationTrend ?? []}>
              <defs>
                <linearGradient id="verifyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2952f5" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2952f5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: '#1e293b',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                  fontSize: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#2952f5"
                strokeWidth={2}
                fill="url(#verifyGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Document types breakdown */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Document types</h2>
        <div className="space-y-2">
          {(data?.topDocumentTypes ?? []).map((item) => {
            const pct = data?.totalDocuments
              ? Math.round((item.count / data.totalDocuments) * 100)
              : 0;
            return (
              <div key={item.type}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 capitalize">{item.type.replace(/-/g, ' ')}</span>
                  <span className="text-slate-400 font-mono">{item.count}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-500 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          {!data?.topDocumentTypes?.length && !isLoading && (
            <p className="text-xs text-slate-400 text-center py-4">No documents issued yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
