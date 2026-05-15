'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Upload, FileCheck, MoreHorizontal, QrCode, XCircle } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { StatusBadge } from '@/components/ui/StatusBadge';

const issueSchema = z.object({
  departmentId: z.string().min(1, 'Select a department'),
  type: z.string().min(1),
  title: z.string().min(3),
  issuedTo: z.string().optional(),
  expiresAt: z.string().optional(),
});

type IssueFormData = z.infer<typeof issueSchema>;

export default function DocumentsPage() {
  const [showModal, setShowModal] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => apiClient.get<never, { data: { data: DocumentRow[]; total: number } }>('/v1/documents').then((r) => r.data),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => apiClient.get<never, { data: { id: string; name: string }[] }>('/v1/org/departments').then((r) => r.data),
  });

  const issueMutation = useMutation({
    mutationFn: async (formData: FormData) => apiClient.post('/v1/documents/issue', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    onSuccess: () => {
      toast.success('Document issued and anchored on-chain');
      qc.invalidateQueries({ queryKey: ['documents'] });
      setShowModal(false);
      setFile(null);
    },
    onError: (e: { message?: string }) => toast.error(e.message ?? 'Failed to issue document'),
  });

  const { register, handleSubmit, formState: { errors } } = useForm<IssueFormData>({
    resolver: zodResolver(issueSchema),
    defaultValues: { type: 'custom' },
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: useCallback((files: File[]) => setFile(files[0] ?? null), []),
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.jpg', '.jpeg', '.png'],
    },
    maxFiles: 1,
  });

  const onSubmit = (data: IssueFormData) => {
    if (!file) return toast.error('Please upload a document file');
    const fd = new FormData();
    fd.append('file', file);
    Object.entries(data).forEach(([k, v]) => v && fd.append(k, v));
    issueMutation.mutate(fd);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Documents</h2>
          <p className="text-xs text-slate-500">{data?.total ?? 0} total issued</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={15} /> Issue document
        </button>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100">
            <tr>
              {['Title', 'Type', 'Issued to', 'Department', 'Status', 'Issued at', ''].map((h) => (
                <th key={h} className="table-header px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-slate-400">Loading…</td></tr>
            )}
            {!isLoading && !data?.data?.length && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-slate-400">No documents issued yet</td></tr>
            )}
            {data?.data?.map((doc) => (
              <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-800">{doc.title}</td>
                <td className="px-4 py-3 text-slate-500 capitalize">{doc.documentType.replace(/-/g, ' ')}</td>
                <td className="px-4 py-3 text-slate-500">{doc.issuedTo ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{(doc as DocumentRow & { department?: { name: string } }).department?.name}</td>
                <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
                <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                  {new Date(doc.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button className="btn-ghost p-1.5" title="View QR"><QrCode size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Issue modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-modal w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-sm font-semibold">Issue new document</h3>
              <button onClick={() => setShowModal(false)} className="btn-ghost p-1.5 rounded-lg">
                <XCircle size={16} className="text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
              {/* File drop zone */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input {...getInputProps()} />
                <Upload size={20} className="mx-auto text-slate-400 mb-2" />
                {file
                  ? <p className="text-sm font-medium text-slate-700">{file.name}</p>
                  : <p className="text-xs text-slate-400">Drop PDF, JPG, or PNG here</p>}
              </div>

              <div>
                <label className="label">Department</label>
                <select {...register('departmentId')} className="input">
                  <option value="">Select…</option>
                  {departments?.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                {errors.departmentId && <p className="text-xs text-red-500 mt-1">{errors.departmentId.message}</p>}
              </div>

              <div>
                <label className="label">Document title</label>
                <input {...register('title')} className="input" placeholder="e.g. Blood Test Report" />
                {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Type</label>
                  <select {...register('type')} className="input">
                    <option value="medical-report">Medical report</option>
                    <option value="prescription">Prescription</option>
                    <option value="degree">Degree</option>
                    <option value="transcript">Transcript</option>
                    <option value="employment-letter">Employment letter</option>
                    <option value="legal-contract">Legal contract</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="label">Issued to</label>
                  <input {...register('issuedTo')} className="input" placeholder="Optional" />
                </div>
              </div>

              <div>
                <label className="label">Expiry date (optional)</label>
                <input {...register('expiresAt')} type="date" className="input" />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={issueMutation.isPending}>
                  {issueMutation.isPending ? 'Anchoring…' : (
                    <><FileCheck size={14} /> Issue document</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

interface DocumentRow {
  id: string;
  title: string;
  documentType: string;
  issuedTo: string | null;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  createdAt: string;
}
