'use client';
import { useQuery } from '@tanstack/react-query';
import { Building2, Plus } from 'lucide-react';
import apiClient from '@/lib/api-client';

interface Dept { id: string; name: string; description?: string; createdAt: string; }

export default function DepartmentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => apiClient.get<never, { data: Dept[] }>('/v1/org/departments').then((r) => r.data),
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Departments</h2>
          <p className="text-xs text-slate-500">{data?.length ?? 0} departments</p>
        </div>
        <button className="btn-primary"><Plus size={15} /> Add department</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && <div className="card"><p className="text-xs text-slate-400">Loading…</p></div>}
        {data?.map((d) => (
          <div key={d.id} className="card hover:shadow-card-hover transition-shadow">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-brand-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Building2 size={16} className="text-brand-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">{d.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{d.description ?? 'No description'}</p>
                <p className="text-xs text-slate-400 mt-2">Created {new Date(d.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        ))}
        {!isLoading && !data?.length && (
          <div className="card col-span-3 text-center py-8">
            <Building2 size={24} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs text-slate-400">No departments yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
