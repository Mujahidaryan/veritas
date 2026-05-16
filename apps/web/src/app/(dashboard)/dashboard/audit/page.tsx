'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import apiClient from '@/lib/api-client';
import type { PaginatedAuditLogs, AuditEvent } from '@/types';

const EVENT_COLORS: Record<string, string> = {
  'document.issued':      'badge-blue',
  'document.revoked':     'badge-red',
  'verification.success': 'badge-green',
  'verification.failed':  'badge-amber',
  'verification.tampered':'badge-red',
  'user.login':           'badge-slate',
  'user.created':         'badge-blue',
  'api_key.used':         'badge-slate',
};

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [eventType, setEventType] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['audit', page, eventType],
    queryFn: () => apiClient.get<never, { data: PaginatedAuditLogs }>(
      `/v1/audit/logs?page=${page}&limit=25${eventType ? `&eventType=${eventType}` : ''}`
    ).then((r) => r.data),
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Audit log</h2>
          <p className="text-xs text-slate-500">Tamper-evident, append-only event chain</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={eventType}
            onChange={(e) => { setEventType(e.target.value); setPage(1); }}
            className="input text-xs py-1.5 w-48"
          >
            <option value="">All events</option>
            <option value="document.issued">Document issued</option>
            <option value="document.revoked">Document revoked</option>
            <option value="verification.success">Verification success</option>
            <option value="verification.tampered">Tamper detected</option>
            <option value="user.login">User login</option>
          </select>
          <button onClick={() => refetch()} className="btn-secondary py-1.5 px-3">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100">
            <tr>
              {['Event', 'Actor', 'Resource', 'IP Address', 'Timestamp'].map((h) => (
                <th key={h} className="table-header px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-400">Loading…</td></tr>
            )}
            {data?.data?.map((event: AuditEvent) => (
              <tr key={event.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2.5">
                  <span className={EVENT_COLORS[event.eventType] ?? 'badge-slate'}>
                    {event.eventType}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-500">
                  {event.actorEmail ?? <span className="text-slate-300">System</span>}
                </td>
                <td className="px-4 py-2.5 text-xs font-mono text-slate-400">
                  {event.resourceId?.slice(0, 8) ?? '—'}
                </td>
                <td className="px-4 py-2.5 text-xs font-mono text-slate-400">{event.ipAddress}</td>
                <td className="px-4 py-2.5 text-xs text-slate-400">
                  {new Date(event.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{data.total} total events</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary py-1 px-3 text-xs disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-2 py-1">Page {page} of {data.totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages}
              className="btn-secondary py-1 px-3 text-xs disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
