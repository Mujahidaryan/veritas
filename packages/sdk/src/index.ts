/**
 * @veritas/sdk
 * Official TypeScript SDK for the Veritas Enterprise Integrity Platform.
 *
 * Usage:
 *   import { VeritasClient } from '@veritas/sdk';
 *   const client = new VeritasClient({ apiKey: process.env.VERITAS_API_KEY });
 *   const { documentId } = await client.documents.issue({ file, metadata, departmentId });
 */

import type {
  IssuedDocument, VerifyDocumentResponse, BatchIssueResponse,
  AuditLogFilter, PaginatedAuditLogs, AnalyticsSummary,
} from '@veritas/shared-types';

export interface VeritasClientConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

export interface IssueOptions {
  file: Buffer | Blob;
  fileName: string;
  mimeType: string;
  departmentId: string;
  metadata: {
    type: string;
    title: string;
    issuedTo?: string;
    tags?: string[];
    customFields?: Record<string, string>;
  };
  expiresAt?: string;
}

export interface VerifyOptions {
  file: Buffer | Blob;
  fileName: string;
  mimeType: string;
}

class DocumentsAPI {
  constructor(private client: VeritasClient) {}

  async issue(options: IssueOptions): Promise<IssuedDocument> {
    const form = new FormData();
    const blob = options.file instanceof Buffer
      ? new Blob([options.file], { type: options.mimeType })
      : options.file as Blob;

    form.append('file', blob, options.fileName);
    form.append('departmentId', options.departmentId);
    form.append('type', options.metadata.type);
    form.append('title', options.metadata.title);
    if (options.metadata.issuedTo) form.append('issuedTo', options.metadata.issuedTo);
    if (options.expiresAt) form.append('expiresAt', options.expiresAt);
    if (options.metadata.tags) form.append('tags', JSON.stringify(options.metadata.tags));
    if (options.metadata.customFields) {
      form.append('customFields', JSON.stringify(options.metadata.customFields));
    }

    return this.client.request<IssuedDocument>('POST', '/v1/documents/issue', form, true);
  }

  async verify(options: VerifyOptions): Promise<VerifyDocumentResponse> {
    const form = new FormData();
    const blob = options.file instanceof Buffer
      ? new Blob([options.file], { type: options.mimeType })
      : options.file as Blob;
    form.append('file', blob, options.fileName);
    return this.client.request<VerifyDocumentResponse>('POST', '/v1/documents/verify', form, true);
  }

  async get(documentId: string): Promise<IssuedDocument> {
    return this.client.request<IssuedDocument>('GET', `/v1/documents/${documentId}`);
  }

  async revoke(documentId: string, reason: string): Promise<IssuedDocument> {
    return this.client.request<IssuedDocument>('PUT', `/v1/documents/${documentId}/revoke`, { reason });
  }

  async list(params?: { page?: number; limit?: number; departmentId?: string }) {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return this.client.request<{ data: IssuedDocument[]; total: number }>('GET', `/v1/documents?${qs}`);
  }

  async getQrCode(documentId: string): Promise<string> {
    const res = await this.client.request<{ qrDataUrl: string }>('GET', `/v1/documents/${documentId}/qr`);
    return res.qrDataUrl;
  }
}

class AuditAPI {
  constructor(private client: VeritasClient) {}

  async getLogs(filter?: AuditLogFilter): Promise<PaginatedAuditLogs> {
    const qs = new URLSearchParams(filter as Record<string, string>).toString();
    return this.client.request<PaginatedAuditLogs>('GET', `/v1/audit/logs?${qs}`);
  }

  async verifyChainIntegrity(): Promise<{ valid: boolean; brokenAt?: string }> {
    return this.client.request('GET', '/v1/audit/chain-integrity');
  }
}

class AnalyticsAPI {
  constructor(private client: VeritasClient) {}

  async getSummary(): Promise<AnalyticsSummary> {
    return this.client.request<AnalyticsSummary>('GET', '/v1/analytics/summary');
  }
}

export class VeritasClient {
  private config: Required<VeritasClientConfig>;

  readonly documents: DocumentsAPI;
  readonly audit: AuditAPI;
  readonly analytics: AnalyticsAPI;

  constructor(config: VeritasClientConfig) {
    this.config = {
      baseUrl: 'https://api.veritas.io/api',
      timeout: 30000,
      ...config,
    };
    this.documents = new DocumentsAPI(this);
    this.audit = new AuditAPI(this);
    this.analytics = new AnalyticsAPI(this);
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    isFormData = false,
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'X-API-Key': this.config.apiKey,
    };

    if (!isFormData && body) {
      headers['Content-Type'] = 'application/json';
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: isFormData
          ? (body as FormData)
          : body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const json = await response.json() as { success: boolean; data: T; error?: { message: string } };

      if (!response.ok || !json.success) {
        throw new VeritasError(
          json.error?.message ?? `Request failed: ${response.status}`,
          response.status,
        );
      }

      return json.data;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class VeritasError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'VeritasError';
  }
}

export default VeritasClient;
