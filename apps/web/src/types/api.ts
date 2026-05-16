export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  requestId: string;
  timestamp: string;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface WebhookEvent {
  id: string;
  tenantId: string;
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
  signature: string;
}

export interface WebhookConfig {
  id: string;
  tenantId: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  tenantId: string;
  name: string;
  keyPrefix: string;    // first 8 chars only, for display
  scopes: string[];
  lastUsedAt?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface AnalyticsSummary {
  totalDocuments: number;
  documentsThisMonth: number;
  totalVerifications: number;
  verificationsThisMonth: number;
  tamperedDetections: number;
  activeUsers: number;
  topDocumentTypes: Array<{ type: string; count: number }>;
  verificationTrend: Array<{ date: string; count: number }>;
}
