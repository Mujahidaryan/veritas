export type AuditEventType =
  | 'document.issued'
  | 'document.verified'
  | 'document.revoked'
  | 'document.expired'
  | 'document.batch_issued'
  | 'verification.success'
  | 'verification.failed'
  | 'verification.tampered'
  | 'user.created'
  | 'user.updated'
  | 'user.deactivated'
  | 'user.login'
  | 'user.logout'
  | 'user.login_failed'
  | 'user.mfa_enabled'
  | 'user.password_changed'
  | 'api_key.created'
  | 'api_key.revoked'
  | 'api_key.used'
  | 'webhook.triggered'
  | 'webhook.failed'
  | 'tenant.plan_changed'
  | 'tenant.settings_updated'
  | 'export.audit_report'
  | 'export.document_list';

export interface AuditEvent {
  id: string;
  tenantId: string;
  actorId?: string;        // null for system/public events
  actorEmail?: string;
  eventType: AuditEventType;
  resourceId?: string;
  resourceType?: string;
  ipAddress: string;
  userAgent?: string;
  payload: Record<string, unknown>;
  prevHash: string;        // chain link for tamper-evidence
  createdAt: string;
}

export interface AuditLogFilter {
  eventType?: AuditEventType;
  actorId?: string;
  resourceId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedAuditLogs {
  data: AuditEvent[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
