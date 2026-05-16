'use client';
import { useQuery } from '@tanstack/react-query';
import { Webhook, Plus, CheckCircle2, XCircle } from 'lucide-react';
import apiClient from '@/lib/api-client';

interface WebhookRow { id: string; url: string; events: string[]; active: boolean; failCount: number; createdAt: string; }

export default function WebhooksPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => apiClient.get<never, { data: WebhookRow[] }>('/v1/webhooks').then((r) => r.data),
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Webhooks</h2>
          <p className="text-xs text-slate-500">Push events to your systems in real time</p>
        </div>
        <button className="btn-primary"><Plus size={15} /> Add webhook</button>
      </div>
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100">
            <tr>{['Endpoint', 'Events', 'Status', 'Failures', 'Created'].map((h) => (
              <th key={h} className="table-header px-4 py-3 text-left font-medium">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-400">Loading…</td></tr>}
            {!isLoading && !data?.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-400">No webhooks configured</td></tr>}
            {data?.map((w) => (
              <tr key={w.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs text-slate-700 max-w-xs truncate">{w.url}</td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{w.events.map((e) => <span key={e} className="badge-slate text-xs">{e}</span>)}</div></td>
                <td className="px-4 py-3">{w.active ? <span className="badge-green"><CheckCircle2 size={10} /> Active</span> : <span className="badge-red"><XCircle size={10} /> Disabled</span>}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{w.failCount}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{new Date(w.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
