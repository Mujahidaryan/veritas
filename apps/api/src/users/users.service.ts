import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async createUser(tenantId: string, data: {
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    departmentId?: string;
  }) {
    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email: data.email },
    });
    if (existing) throw new ConflictException('User with this email already exists');

    // Generate temporary password
    const tempPassword = crypto.randomBytes(12).toString('base64url');
    const passwordHash = await argon2.hash(tempPassword);

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role as never,
        departmentId: data.departmentId,
        passwordHash,
        status: 'PENDING',
      },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, status: true, departmentId: true, createdAt: true,
      },
    });

    return { user, tempPassword }; // tempPassword sent via email in production
  }

  async listUsers(tenantId: string, page = 1, limit = 20) {
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { tenantId },
        select: {
          id: true, email: true, firstName: true, lastName: true,
          role: true, status: true, lastLoginAt: true,
          department: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where: { tenantId } }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async updateUserRole(userId: string, tenantId: string, role: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: { role: role as never },
      select: { id: true, email: true, role: true },
    });
  }

  async deactivateUser(userId: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: { status: 'INACTIVE' },
    });
  }
}
