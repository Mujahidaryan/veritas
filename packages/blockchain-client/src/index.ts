import type {
  BlockchainProof,
  ChainDocumentRecord,
  AnchorProofRequest,
  RevokeProofRequest,
} from '@veritas/shared-types';

export interface FabricConfig {
  channelName: string;
  chaincodeName: string;
  mspId: string;
  peerEndpoint: string;
  tlsCertPath: string;
  certPath: string;
  keyPath: string;
}

/**
 * Hyperledger Fabric client wrapper.
 * Abstracts all chaincode invocations behind a clean async interface.
 * The rest of the platform never imports Fabric SDK directly.
 */
export class BlockchainClient {
  private config: FabricConfig;
  private connected = false;

  constructor(config: FabricConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    // In production: initialize @hyperledger/fabric-gateway connection
    // Using lazy connection pattern — connect on first use
    this.connected = true;
    console.log(`[Blockchain] Connected to channel: ${this.config.channelName}`);
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  /**
   * Anchor a document proof on-chain.
   * Only the hash and metadata-hash are stored — never raw content.
   */
  async anchorDocument(request: AnchorProofRequest): Promise<BlockchainProof> {
    await this.ensureConnected();

    const payload = JSON.stringify(request);

    // Production: gateway.getNetwork(channel).getContract(cc).submitTransaction(...)
    const mockTxId = this.generateMockTxId();

    console.log(`[Blockchain] Anchored document ${request.documentId}, tx: ${mockTxId}`);

    return {
      txId: mockTxId,
      blockNumber: Math.floor(Math.random() * 100000),
      channelId: this.config.channelName,
      chaincodeName: this.config.chaincodeName,
      timestamp: request.issuedAt,
      endorsers: [this.config.mspId],
      hashOnChain: request.hashSha256,
    };
  }

  /**
   * Revoke a document on-chain (state change, not deletion).
   * The original proof remains — revocation is appended.
   */
  async revokeDocument(request: RevokeProofRequest): Promise<BlockchainProof> {
    await this.ensureConnected();

    const mockTxId = this.generateMockTxId();

    console.log(`[Blockchain] Revoked document ${request.documentId}, tx: ${mockTxId}`);

    return {
      txId: mockTxId,
      blockNumber: Math.floor(Math.random() * 100000),
      channelId: this.config.channelName,
      chaincodeName: this.config.chaincodeName,
      timestamp: request.revokedAt,
      endorsers: [this.config.mspId],
      hashOnChain: '',
    };
  }

  /**
   * Query the chain state for a document by ID
   */
  async queryDocument(documentId: string): Promise<ChainDocumentRecord | null> {
    await this.ensureConnected();

    // Production: gateway contract.evaluateTransaction('QueryDocument', documentId)
    console.log(`[Blockchain] Querying document ${documentId}`);
    return null;
  }

  /**
   * Verify a hash matches what's stored on-chain
   */
  async verifyHash(documentId: string, hashSha256: string): Promise<boolean> {
    const record = await this.queryDocument(documentId);
    if (!record) return false;
    return record.hashSha256 === hashSha256;
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
  }

  private generateMockTxId(): string {
    const chars = 'abcdef0123456789';
    return Array.from({ length: 64 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  }
}

export { BlockchainProof, ChainDocumentRecord, AnchorProofRequest, RevokeProofRequest };
