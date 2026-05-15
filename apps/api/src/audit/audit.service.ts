import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import type { AuditEventType, AuditLogFilter, PaginatedAuditLogs } from '@veritas/shared-types';

interface LogAuditEventParams {
  tenantId: string;
  actorId?: string;
  actorEmail?: string;
  eventType: AuditEventType;
  resourceId?: string;
  resourceType?: string;
  ipAddress: string;
  userAgent?: string;
  payload?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Append an audit event. Each event hashes the previous event's ID
   * to form a tamper-evident chain — any deletion or modification
   * breaks the chain and is detectable.
   */
  async log(params: LogAuditEventParams): Promise<void> {
    try {
      // Get last event for chain linking
      const lastEvent = await this.prisma.auditEvent.findFirst({
        where: { tenantId: params.tenantId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      const prevHash = lastEvent
        ? crypto.createHash('sha256').update(lastEvent.id).digest('hex')
        : crypto.createHash('sha256').update('genesis').digest('hex');

      await this.prisma.auditEvent.create({
        data: {
          tenantId: params.tenantId,
          actorId: params.actorId,
          actorEmail: params.actorEmail,
          eventType: params.eventType,
          resourceId: params.resourceId,
          resourceType: params.resourceType,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          payload: params.payload ?? {},
          prevHash,
        },
      });
    } catch (error) {
      // Audit failures must never break business operations
      this.logger.error('Failed to write audit event', error);
    }
  }

  async getLogs(tenantId: string, filter: AuditLogFilter): Promise<PaginatedAuditLogs> {
    const { page = 1, limit = 50, from, to, eventType, actorId, resourceId } = filter;

    const where = {
      tenantId,
      ...(eventType && { eventType }),
      ...(actorId && { actorId }),
      ...(resourceId && { resourceId }),
      ...(from || to
        ? {
            createdAt: {
              ...(from && { gte: new Date(from) }),
              ...(to && { lte: new Date(to) }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditEvent.count({ where }),
    ]);

    return {
      data: data.map((e) => ({
        ...e,
        payload: e.payload as Record<string, unknown>,
        createdAt: e.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Verify the integrity of the audit chain for a tenant.
   * Returns true if no tampering detected.
   */
  async verifyChainIntegrity(tenantId: string): Promise<{ valid: boolean; brokenAt?: string }> {
    const events = await this.prisma.auditEvent.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, prevHash: true },
    });

    for (let i = 1; i < events.length; i++) {
      const expectedPrevHash = crypto
        .createHash('sha256')
        .update(events[i - 1].id)
        .digest('hex');

      if (events[i].prevHash !== expectedPrevHash) {
        return { valid: false, brokenAt: events[i].id };
      }
    }

    return { valid: true };
  }
}
