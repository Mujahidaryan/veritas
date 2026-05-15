'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Shield, CheckCircle2, XCircle, AlertTriangle, Upload, ExternalLink } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import type { VerifyDocumentResponse } from '@veritas/shared-types';

export default function VerifyPage() {
  const [result, setResult] = useState<VerifyDocumentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setLoading(true);
    setResult(null);

    try {
      const fd = new FormData();
      fd.append('file', file);

      const res = await apiClient.post<never, { data: VerifyDocumentResponse }>(
        '/v1/documents/verify',
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      setResult(res.data);
    } catch {
      setResult({ status: 'not_found', verifiedAt: new Date().toISOString() });
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.jpg', '.jpeg', '.png'] },
  });

  const statusConfig = {
    authentic: {
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 border-emerald-200',
      label: 'Document is authentic',
      desc: 'This document has been verified against the immutable proof stored on the integrity ledger.',
    },
    tampered: {
      icon: XCircle,
      color: 'text-red-600',
      bg: 'bg-red-50 border-red-200',
      label: 'Tamper detected',
      desc: 'This document has been modified after issuance. The file content does not match the anchored proof.',
    },
    revoked: {
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50 border-amber-200',
      label: 'Document revoked',
      desc: 'This document has been revoked by the issuing organization.',
    },
    expired: {
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50 border-amber-200',
      label: 'Document expired',
      desc: 'This document has passed its expiry date.',
    },
    not_found: {
      icon: Shield,
      color: 'text-slate-500',
      bg: 'bg-slate-50 border-slate-200',
      label: 'Document not found',
      desc: 'No matching proof was found in the integrity ledger for this organization.',
    },
  };

  const config = result ? statusConfig[result.status] : null;

  return (
    <div className="max-w-2xl space-y-5 animate-fade-in">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Verify document</h2>
        <p className="text-xs text-slate-500">Upload a file to verify its integrity against the anchored proof</p>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ${
          isDragActive
            ? 'border-brand-400 bg-brand-50'
            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
        }`}
      >
        <input {...getInputProps()} />
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Computing hash and verifying…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
              <Upload size={22} className="text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">
                {isDragActive ? 'Drop to verify' : 'Drop document here or click to upload'}
              </p>
              <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG — up to 50MB</p>
            </div>
          </div>
        )}
      </div>

      {/* Result */}
      {result && config && (
        <div className={`border rounded-xl p-5 ${config.bg} animate-slide-up`}>
          <div className="flex items-start gap-3">
            <config.icon size={22} className={`${config.color} flex-shrink-0 mt-0.5`} />
            <div className="flex-1">
              <p className={`text-sm font-semibold ${config.color}`}>{config.label}</p>
              <p className="text-xs text-slate-600 mt-1">{config.desc}</p>

              {result.document && (
                <div className="mt-4 space-y-2">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div>
                      <span className="text-slate-500">Title</span>
                      <p className="font-medium text-slate-800">{result.document.metadata.title}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Type</span>
                      <p className="font-medium text-slate-800 capitalize">
                        {result.document.metadata.type.replace(/-/g, ' ')}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Issued</span>
                      <p className="font-medium text-slate-800">
                        {new Date(result.document.issuedAt).toLocaleDateString()}
                      </p>
                    </div>
                    {result.issuer && (
                      <div>
                        <span className="text-slate-500">Issued by</span>
                        <p className="font-medium text-slate-800">
                          {result.issuer.name} · {result.issuer.department}
                        </p>
                      </div>
                    )}
                  </div>

                  {result.blockchainProof && (
                    <div className="mt-3 p-3 bg-white/60 rounded-lg">
                      <p className="text-xs font-medium text-slate-700 mb-1">Blockchain proof</p>
                      <p className="font-mono text-xs text-slate-500 break-all">
                        {result.blockchainProof.txId}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Block #{result.blockchainProof.blockNumber} · {result.blockchainProof.channelId}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-slate-400 mt-3">
                Verified at {new Date(result.verifiedAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
