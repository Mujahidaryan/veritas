/**
 * Public verification page — no login required.
 * Accessible to employers, auditors, courts, regulators.
 * URL format: /verify/[tenantSlug]/[documentId]/[token]
 */

import type { Metadata } from 'next';
import { Shield, CheckCircle2, XCircle, AlertTriangle, Clock, ExternalLink } from 'lucide-react';
import type { VerifyDocumentResponse } from '@veritas/shared-types';

interface PageProps {
  params: { tenantSlug: string; documentId: string; token: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return {
    title: `Document Verification — Veritas`,
    description: `Verify document authenticity via Veritas integrity infrastructure`,
    robots: { index: false },
  };
}

async function verifyDocument(
  tenantSlug: string,
  documentId: string,
  token: string,
): Promise<VerifyDocumentResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
  try {
    const res = await fetch(
      `${apiUrl}/pub/verify/${tenantSlug}/${documentId}/${token}`,
      { cache: 'no-store' },
    );
    const json = await res.json() as { data: VerifyDocumentResponse };
    return json.data;
  } catch {
    return { status: 'not_found', verifiedAt: new Date().toISOString() };
  }
}

const STATUS_CONFIG = {
  authentic: {
    Icon: CheckCircle2,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    title: 'Document is authentic',
    subtitle: 'This document has been verified against the immutable cryptographic proof stored on the integrity ledger.',
  },
  tampered: {
    Icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    title: 'Tampering detected',
    subtitle: 'This document has been modified after issuance. The file content does not match the anchored proof.',
  },
  revoked: {
    Icon: AlertTriangle,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    title: 'Document revoked',
    subtitle: 'This document has been revoked by the issuing organization.',
  },
  expired: {
    Icon: Clock,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    title: 'Document expired',
    subtitle: 'This document has passed its validity period.',
  },
  not_found: {
    Icon: Shield,
    color: 'text-slate-400',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    title: 'Not found',
    subtitle: 'No matching proof was found for this document. It may not have been issued through Veritas.',
  },
};

export default async function VerifyPage({ params }: PageProps) {
  const result = await verifyDocument(params.tenantSlug, params.documentId, params.token);
  const config = STATUS_CONFIG[result.status];

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center">
            <Shield size={16} className="text-white" />
          </div>
          <span className="text-base font-semibold text-slate-800">Veritas</span>
        </div>

        {/* Result card */}
        <div className={`border rounded-2xl overflow-hidden ${config.border}`}>
          {/* Status banner */}
          <div className={`${config.bg} px-6 py-5 border-b ${config.border}`}>
            <div className="flex items-start gap-3">
              <config.Icon size={24} className={`${config.color} flex-shrink-0 mt-0.5`} />
              <div>
                <p className={`text-base font-semibold ${config.color}`}>{config.title}</p>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">{config.subtitle}</p>
              </div>
            </div>
          </div>

          {/* Document details */}
          {result.document && (
            <div className="bg-white px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Document</p>
                  <p className="font-medium text-slate-800">{result.document.metadata.title}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Type</p>
                  <p className="font-medium text-slate-800 capitalize">
                    {result.document.metadata.type.replace(/-/g, ' ')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Issued on</p>
                  <p className="font-medium text-slate-800">
                    {new Date(result.document.issuedAt).toLocaleDateString('en-PK', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </p>
                </div>
                {result.document.metadata.issuedTo && (
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Issued to</p>
                    <p className="font-medium text-slate-800">{result.document.metadata.issuedTo}</p>
                  </div>
                )}
              </div>

              {/* Issuer */}
              {result.issuer && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400 mb-2">Issuing organization</p>
                  <div className="flex items-center gap-2.5">
                    {result.issuer.logoUrl ? (
                      <img src={result.issuer.logoUrl} alt="" className="w-8 h-8 rounded object-contain" />
                    ) : (
                      <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center">
                        <Shield size={14} className="text-slate-400" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-slate-800">{result.issuer.organization}</p>
                      <p className="text-xs text-slate-500">{result.issuer.department} · {result.issuer.name}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Blockchain proof */}
              {result.blockchainProof && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400 mb-2">Blockchain proof</p>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="font-mono text-xs text-slate-500 break-all">
                      {result.blockchainProof.txId}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Block #{result.blockchainProof.blockNumber} ·{' '}
                      {result.blockchainProof.channelId} ·{' '}
                      {new Date(result.blockchainProof.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="bg-slate-50 border-t border-slate-100 px-6 py-3">
            <p className="text-xs text-slate-400">
              Verified at {new Date(result.verifiedAt).toLocaleString('en-PK')}
              {' · '}
              <a
                href="https://veritas.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
              >
                Powered by Veritas <ExternalLink size={10} />
              </a>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          This verification is cryptographically secured and tamper-evident.
        </p>
      </div>
    </main>
  );
}
