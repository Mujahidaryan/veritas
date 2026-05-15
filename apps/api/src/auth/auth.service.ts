import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { JwtPayload, AuthTokens } from '@veritas/shared-types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async validateUser(tenantSlug: string, email: string, password: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new UnauthorizedException('Invalid credentials');

    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email } },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Account lockout check
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account temporarily locked. Try again later.');
    }

    const valid = await argon2.verify(user.passwordHash, password);

    if (!valid) {
      // Increment failure counter
      const failures = user.loginFailures + 1;
      const lockedUntil = failures >= 5
        ? new Date(Date.now() + 15 * 60 * 1000) // 15 min lockout
        : null;

      await this.prisma.user.update({
        where: { id: user.id },
        data: { loginFailures: failures, lockedUntil },
      });

      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failure counter on success
    await this.prisma.user.update({
      where: { id: user.id },
      data: { loginFailures: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    return user;
  }

  async login(user: { id: string; tenantId: string; role: string; departmentId?: string | null }): Promise<AuthTokens> {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role as JwtPayload['role'],
      departmentId: user.departmentId ?? undefined,
    };

    const accessToken = this.jwt.sign(payload);
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenHash = await argon2.hash(refreshToken);

    const ttlStr = this.config.get<string>('jwt.refreshTokenTtl', '7d');
    const ttlMs = this.parseTtlToMs(ttlStr);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    // Find all non-revoked, non-expired refresh tokens and check against each
    const tokens = await this.prisma.refreshToken.findMany({
      where: { revoked: false, expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    let matched: (typeof tokens)[0] | null = null;

    for (const t of tokens) {
      try {
        const valid = await argon2.verify(t.tokenHash, refreshToken);
        if (valid) { matched = t; break; }
      } catch { continue; }
    }

    if (!matched) throw new UnauthorizedException('Invalid refresh token');

    // Rotate: revoke old, issue new
    await this.prisma.refreshToken.update({
      where: { id: matched.id },
      data: { revoked: true },
    });

    return this.login(matched.user);
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
  }

  async validateApiKey(rawKey: string) {
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { keyHash, revoked: false },
      include: { tenant: true },
    });

    if (!apiKey) return null;
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return apiKey;
  }

  private parseTtlToMs(ttl: string): number {
    const unit = ttl.slice(-1);
    const value = parseInt(ttl.slice(0, -1), 10);
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return value * (multipliers[unit] ?? 1000);
  }
}
