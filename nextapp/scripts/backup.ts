/**
 * Harbinger backup script
 * Usage: npx ts-node --project tsconfig.seed.json scripts/backup.ts [tenantSlug]
 * Exports all tenant data to a timestamped JSON file.
 */

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const slug = process.argv[2];

  const tenants = slug
    ? await prisma.tenant.findMany({ where: { slug } })
    : await prisma.tenant.findMany();

  if (!tenants.length) {
    console.error('No tenants found', slug ? `with slug "${slug}"` : '');
    process.exit(1);
  }

  for (const tenant of tenants) {
    console.log(`Backing up tenant: ${tenant.name} (${tenant.slug})`);

    const [
      settings, staff, products, categories, customers,
      orders, shifts, employees, featureFlags, auditLogs,
    ] = await Promise.all([
      prisma.settings.findUnique({ where: { tenantId: tenant.id } }),
      prisma.staff.findMany({ where: { tenantId: tenant.id } }),
      prisma.product.findMany({ where: { tenantId: tenant.id } }),
      prisma.category.findMany({ where: { tenantId: tenant.id } }),
      prisma.customer.findMany({ where: { tenantId: tenant.id } }),
      prisma.order.findMany({ where: { tenantId: tenant.id }, include: { items: true } }),
      prisma.shift.findMany({ where: { tenantId: tenant.id } }),
      prisma.employee.findMany({ where: { tenantId: tenant.id } }),
      prisma.tenantFeatureFlag.findMany({ where: { tenantId: tenant.id } }),
      prisma.auditLog.findMany({ where: { tenantId: tenant.id }, orderBy: { createdAt: 'desc' }, take: 10000 }),
    ]);

    // Redact sensitive fields
    const safeStaff = staff.map(s => ({ ...s, passwordHash: '[REDACTED]' }));

    const backup = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      tenant,
      settings,
      staff: safeStaff,
      products,
      categories,
      customers,
      orders,
      shifts,
      employees,
      featureFlags,
      auditLogs,
    };

    const date = new Date().toISOString().slice(0, 10);
    const filename = `harbinger-backup-${tenant.slug}-${date}.json`;
    const outPath = path.join(process.cwd(), filename);

    fs.writeFileSync(outPath, JSON.stringify(backup, null, 2), 'utf8');
    console.log(`✓ Written to ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
