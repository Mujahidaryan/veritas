export interface BlockchainProof {
  txId: string;
  blockNumber: number;
  channelId: string;
  chaincodeName: string;
  timestamp: string;
  endorsers: string[];
  hashOnChain: string;
  proofUrl?: string;
}

export interface ChainDocumentRecord {
  documentId: string;
  tenantId: string;
  hashSha256: string;
  issuerMspId: string;
  issuedAt: string;
  status: 'active' | 'revoked';
  revokedAt?: string;
  revokedReason?: string;
  metadataHash: string;   // hash of metadata JSON (not metadata itself)
}

export interface AnchorProofRequest {
  documentId: string;
  tenantId: string;
  hashSha256: string;
  metadataHash: string;
  issuedAt: string;
}

export interface RevokeProofRequest {
  documentId: string;
  tenantId: string;
  revokedAt: string;
  reason: string;
}
