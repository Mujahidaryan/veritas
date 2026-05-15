import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getSummary(tenantId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalDocuments,
      documentsThisMonth,
      totalVerifications,
      verificationsThisMonth,
      tamperedDetections,
      activeUsers,
      topDocumentTypes,
    ] = await Promise.all([
      this.prisma.document.count({ where: { tenantId } }),
      this.prisma.document.count({ where: { tenantId, createdAt: { gte: startOfMonth } } }),
      this.prisma.auditEvent.count({ where: { tenantId, eventType: { in: ['verification.success', 'verification.failed'] } } }),
      this.prisma.auditEvent.count({ where: { tenantId, eventType: { in: ['verification.success', 'verification.failed'] }, createdAt: { gte: startOfMonth } } }),
      this.prisma.auditEvent.count({ where: { tenantId, eventType: 'verification.tampered' } }),
      this.prisma.user.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.document.groupBy({
        by: ['documentType'],
        where: { tenantId },
        _count: true,
        orderBy: { _count: { documentType: 'desc' } },
        take: 5,
      }),
    ]);

    // Verification trend — last 30 days by day
    const trend = await this.prisma.auditEvent.findMany({
      where: {
        tenantId,
        eventType: 'verification.success',
        createdAt: { gte: last30Days },
      },
      select: { createdAt: true },
    });

    const trendMap: Record<string, number> = {};
    trend.forEach((e) => {
      const day = e.createdAt.toISOString().slice(0, 10);
      trendMap[day] = (trendMap[day] ?? 0) + 1;
    });

    const verificationTrend = Object.entries(trendMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalDocuments,
      documentsThisMonth,
      totalVerifications,
      verificationsThisMonth,
      tamperedDetections,
      activeUsers,
      topDocumentTypes: topDocumentTypes.map((t) => ({
        type: t.documentType,
        count: t._count,
      })),
      verificationTrend,
    };
  }
}
