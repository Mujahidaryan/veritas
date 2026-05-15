import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async createTenant(data: {
    name: string;
    slug: string;
    plan?: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  }) {
    const existing = await this.prisma.tenant.findUnique({ where: { slug: data.slug } });
    if (existing) throw new ConflictException('Tenant slug already taken');

    return this.prisma.tenant.create({
      data: {
        name: data.name,
        slug: data.slug,
        plan: data.plan ?? 'TRIAL',
        webhookSigningSecret: crypto.randomBytes(32).toString('hex'),
        maxUsers: data.plan === 'STARTER' ? 3 : data.plan === 'PROFESSIONAL' ? 25 : 999,
        maxDocumentsPerMonth: data.plan === 'STARTER' ? 500 : data.plan === 'PROFESSIONAL' ? 5000 : 999999,
      } as never,
    });
  }

  async getTenant(id: string) {
    return this.prisma.tenant.findUniqueOrThrow({ where: { id } });
  }

  async updateTenantSettings(id: string, data: {
    logoUrl?: string;
    mfaRequired?: boolean;
    verificationDomain?: string;
  }) {
    return this.prisma.tenant.update({ where: { id }, data });
  }

  async getDepartments(tenantId: string) {
    return this.prisma.department.findMany({ where: { tenantId } });
  }

  async createDepartment(tenantId: string, name: string, description?: string) {
    return this.prisma.department.create({
      data: { tenantId, name, description },
    });
  }
}
