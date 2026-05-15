/**
 * Veritas — Database Seed
 * Creates a demo tenant, admin user, and sample department for local development.
 * Usage: npm run db:seed
 */

import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Veritas database...');

  // ─── Create demo tenant ──────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-hospital' },
    update: {},
    create: {
      name: 'Demo Hospital & Diagnostics',
      slug: 'demo-hospital',
      plan: 'PROFESSIONAL',
      status: 'ACTIVE',
      mfaRequired: false,
      maxUsers: 25,
      maxDocumentsPerMonth: 5000,
      webhookSigningSecret: crypto.randomBytes(32).toString('hex'),
    },
  });
  console.log(`✅ Tenant: ${tenant.name} (${tenant.slug})`);

  // ─── Create departments ──────────────────────────────────────────
  const depts = await Promise.all([
    prisma.department.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Cardiology' } },
      update: {},
      create: { tenantId: tenant.id, name: 'Cardiology', description: 'Cardiology department' },
    }),
    prisma.department.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Radiology' } },
      update: {},
      create: { tenantId: tenant.id, name: 'Radiology', description: 'Radiology and imaging' },
    }),
    prisma.department.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'HR' } },
      update: {},
      create: { tenantId: tenant.id, name: 'HR', description: 'Human Resources' },
    }),
  ]);
  console.log(`✅ Departments: ${depts.map((d) => d.name).join(', ')}`);

  // ─── Create admin user ───────────────────────────────────────────
  const adminPassword = 'Admin@Veritas123!';
  const adminHash = await argon2.hash(adminPassword);

  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@demo-hospital.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@demo-hospital.com',
      firstName: 'Ahmad',
      lastName: 'Karimi',
      role: 'ENTERPRISE_ADMIN',
      status: 'ACTIVE',
      passwordHash: adminHash,
      mfaEnabled: false,
    },
  });
  console.log(`✅ Admin user: ${admin.email}`);

  // ─── Create issuer user ──────────────────────────────────────────
  const issuerPassword = 'Issuer@Veritas123!';
  const issuerHash = await argon2.hash(issuerPassword);

  const issuer = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'dr.ali@demo-hospital.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'dr.ali@demo-hospital.com',
      firstName: 'Dr. Ali',
      lastName: 'Hassan',
      role: 'ISSUER',
      status: 'ACTIVE',
      passwordHash: issuerHash,
      departmentId: depts[0].id,
      mfaEnabled: false,
    },
  });
  console.log(`✅ Issuer user: ${issuer.email}`);

  // ─── Create API key ──────────────────────────────────────────────
  const rawKey = `vrt_live_${crypto.randomBytes(24).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  await prisma.apiKey.upsert({
    where: { keyHash },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Default Integration Key',
      keyHash,
      keyPrefix: rawKey.slice(0, 12),
      scopes: ['documents:issue', 'documents:verify', 'audit:read'],
    },
  });
  console.log(`✅ API Key created (prefix: ${rawKey.slice(0, 12)}...)`);

  console.log('\n─────────────────────────────────────────────');
  console.log('🚀 Seed complete! Development credentials:');
  console.log(`   Tenant slug  : demo-hospital`);
  console.log(`   Admin email  : admin@demo-hospital.com`);
  console.log(`   Admin pass   : ${adminPassword}`);
  console.log(`   Issuer email : dr.ali@demo-hospital.com`);
  console.log(`   Issuer pass  : ${issuerPassword}`);
  console.log(`   API key      : ${rawKey}`);
  console.log('─────────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
