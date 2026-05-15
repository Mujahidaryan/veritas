export type DocumentStatus = 'active' | 'revoked' | 'expired';

export type DocumentType =
  | 'medical-report'
  | 'prescription'
  | 'degree'
  | 'transcript'
  | 'employment-letter'
  | 'legal-contract'
  | 'insurance-policy'
  | 'financial-statement'
  | 'custom';

export interface DocumentMetadata {
  type: DocumentType;
  title: string;
  issuedTo?: string;
  expiresAt?: string; // ISO date string
  tags?: string[];
  customFields?: Record<string, string>;
}

export interface IssuedDocument {
  id: string;
  tenantId: string;
  departmentId: string;
  hashSha256: string;
  issuerId: string;
  status: DocumentStatus;
  metadata: DocumentMetadata;
  blockchainTxId: string;
  qrToken: string;
  qrUrl: string;
  issuedAt: string;
  revokedAt?: string;
  revokedReason?: string;
  expiresAt?: string;
}

export interface IssueDocumentRequest {
  departmentId: string;
  metadata: DocumentMetadata;
  expiresAt?: string;
}

export interface VerifyDocumentResponse {
  status: 'authentic' | 'tampered' | 'revoked' | 'expired' | 'not_found';
  document?: Pick<IssuedDocument, 'id' | 'metadata' | 'issuedAt' | 'status' | 'qrUrl'>;
  issuer?: {
    name: string;
    department: string;
    organization: string;
    logoUrl?: string;
  };
  blockchainProof?: BlockchainProof;
  verifiedAt: string;
}

export interface RevokeDocumentRequest {
  reason: string;
}

export interface BatchIssueRequest {
  departmentId: string;
  documents: Array<{
    file: Buffer;
    metadata: DocumentMetadata;
    expiresAt?: string;
  }>;
}

export interface BatchIssueResponse {
  processed: number;
  failed: number;
  results: Array<{
    index: number;
    success: boolean;
    documentId?: string;
    error?: string;
  }>;
}

import type { BlockchainProof } from './blockchain';
