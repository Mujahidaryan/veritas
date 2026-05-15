import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole, JwtPayload } from '@veritas/shared-types';

// Role hierarchy — higher index = more permissions
const ROLE_HIERARCHY: Record<string, number> = {
  SUPER_ADMIN: 100,
  ENTERPRISE_ADMIN: 80,
  DEPARTMENT_ADMIN: 60,
  ISSUER: 40,
  VERIFIER: 20,
  VIEWER: 10,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    const user = request.user;

    if (!user) throw new ForbiddenException('Authentication required');

    const userLevel = ROLE_HIERARCHY[user.role.toUpperCase()] ?? 0;
    const hasRole = requiredRoles.some(
      (role) => userLevel >= (ROLE_HIERARCHY[role.toUpperCase()] ?? 0)
    );

    if (!hasRole) {
      throw new ForbiddenException(
        `Insufficient permissions. Required: ${requiredRoles.join(' or ')}`
      );
    }

    return true;
  }
}
