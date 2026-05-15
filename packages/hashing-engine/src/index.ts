import crypto from 'crypto';
import { Readable } from 'stream';

export interface HashResult {
  sha256: string;
  size: number;
  normalizedAt: string;
}

export interface DocumentHashOptions {
  tenantSalt?: string;
  stripPdfMetadata?: boolean;
}

/**
 * Deterministic hashing pipeline for enterprise documents.
 * Produces identical hashes for identical content regardless
 * of upload time, filename, or HTTP metadata.
 */
export class HashingEngine {
  private readonly SUPPORTED_TYPES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]);

  /**
   * Hash a file buffer with normalization
   */
  async hashBuffer(
    buffer: Buffer,
    mimeType: string,
    options: DocumentHashOptions = {}
  ): Promise<HashResult> {
    const normalized = await this.normalize(buffer, mimeType, options);
    const sha256 = this.computeSha256(normalized, options.tenantSalt);

    return {
      sha256,
      size: buffer.length,
      normalizedAt: new Date().toISOString(),
    };
  }

  /**
   * Hash a readable stream (for large files)
   */
  async hashStream(
    stream: Readable,
    mimeType: string,
    options: DocumentHashOptions = {}
  ): Promise<HashResult> {
    const buffer = await this.streamToBuffer(stream);
    return this.hashBuffer(buffer, mimeType, options);
  }

  /**
   * Verify a file against a stored hash
   */
  async verify(
    buffer: Buffer,
    mimeType: string,
    storedHash: string,
    options: DocumentHashOptions = {}
  ): Promise<boolean> {
    const result = await this.hashBuffer(buffer, mimeType, options);
    return this.timingSafeCompare(result.sha256, storedHash);
  }

  /**
   * Hash metadata object deterministically (key-sorted JSON)
   */
  hashMetadata(metadata: Record<string, unknown>): string {
    const sorted = this.sortObjectKeys(metadata);
    const json = JSON.stringify(sorted);
    return crypto.createHash('sha256').update(json, 'utf8').digest('hex');
  }

  /**
   * Generate HMAC token for QR verification URLs
   */
  generateQrToken(documentId: string, tenantId: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(`${documentId}:${tenantId}`)
      .digest('hex');
  }

  /**
   * Verify a QR token
   */
  verifyQrToken(
    token: string,
    documentId: string,
    tenantId: string,
    secret: string
  ): boolean {
    const expected = this.generateQrToken(documentId, tenantId, secret);
    return this.timingSafeCompare(token, expected);
  }

  // ─── Private helpers ──────────────────────────────────────────────

  private async normalize(
    buffer: Buffer,
    mimeType: string,
    options: DocumentHashOptions
  ): Promise<Buffer> {
    // For PDFs: strip variable metadata (CreationDate, ModDate, Producer)
    // to ensure deterministic hashing of document content only
    if (mimeType === 'application/pdf' && options.stripPdfMetadata !== false) {
      return this.normalizePdf(buffer);
    }
    // For other types: return as-is (content is authoritative)
    return buffer;
  }

  private normalizePdf(buffer: Buffer): Buffer {
    // Strip PDF metadata fields that change on every save
    // Pattern: /CreationDate (D:...) and /ModDate (D:...)
    let str = buffer.toString('binary');
    str = str.replace(/\/CreationDate\s*\(D:[^)]+\)/g, '/CreationDate (D:00000000000000)');
    str = str.replace(/\/ModDate\s*\(D:[^)]+\)/g, '/ModDate (D:00000000000000)');
    str = str.replace(/\/Producer\s*\([^)]*\)/g, '/Producer ()');
    str = str.replace(/\/Creator\s*\([^)]*\)/g, '/Creator ()');
    return Buffer.from(str, 'binary');
  }

  private computeSha256(buffer: Buffer, tenantSalt?: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(buffer);
    if (tenantSalt) {
      // HMAC with tenant salt for additional integrity binding
      return crypto
        .createHmac('sha256', tenantSalt)
        .update(hash.digest())
        .digest('hex');
    }
    return hash.digest('hex');
  }

  private timingSafeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch {
      return false;
    }
  }

  private sortObjectKeys(obj: Record<string, unknown>): Record<string, unknown> {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map((v) => this.sortObjectKeys(v as Record<string, unknown>));
    return Object.keys(obj)
      .sort()
      .reduce((sorted: Record<string, unknown>, key) => {
        sorted[key] = this.sortObjectKeys(obj[key] as Record<string, unknown>);
        return sorted;
      }, {});
  }

  private streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }
}

export const hashingEngine = new HashingEngine();
export default hashingEngine;
