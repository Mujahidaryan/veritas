export type UserRole =
  | 'super_admin'
  | 'enterprise_admin'
  | 'department_admin'
  | 'issuer'
  | 'verifier'
  | 'viewer';

export type UserStatus = 'active' | 'inactive' | 'pending' | 'suspended';

export interface User {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  departmentId?: string;
  mfaEnabled: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'starter' | 'professional' | 'enterprise';
  logoUrl?: string;
  primaryDomain?: string;
  verificationDomain?: string;
  ssoEnabled: boolean;
  mfaRequired: boolean;
  maxUsers: number;
  maxDocumentsPerMonth: number;
  documentsUsedThisMonth: number;
  status: 'active' | 'suspended' | 'trial';
  createdAt: string;
}

export interface Department {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  adminId?: string;
  createdAt: string;
}

export interface JwtPayload {
  sub: string;           // userId
  tenantId: string;
  role: UserRole;
  departmentId?: string;
  iat: number;
  exp: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
  mfaCode?: string;
}

export interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  departmentId?: string;
  sendInvite?: boolean;
}
