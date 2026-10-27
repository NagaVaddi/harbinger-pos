'use server';

import { prisma } from '@/lib/prisma';
import { getAuthContext, getTenantFeatureFlags } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function getSettings() {
  const { tenantId } = await getAuthContext();
  const [settings, flags] = await Promise.all([
    prisma.settings.findUnique({ where: { tenantId } }),
    getTenantFeatureFlags(tenantId),
  ]);
  return { settings, flags };
}

export async function updateSettings(data: {
  business?: string;
  address?: string;
  trn?: string;
  country?: string;
  dialCode?: string;
  currency?: string;
  bizType?: string;
  allowNegative?: boolean;
  taxRate?: number;
  taxLabel?: string;
  taxInclusive?: boolean;
  serviceCharge?: number;
  roundCash?: boolean;
  minTicketMargin?: number;
  maxDiscountPct?: number;
  loyaltyEnabled?: boolean;
  loyaltyRate?: number;
  receiptFooter?: string;
  receiptLang?: string;
  brandTheme?: string;
  displaySize?: string;
  businessHours?: object;
}) {
  const { tenantId, staffId } = await getAuthContext();
  const result = await prisma.settings.upsert({
    where: { tenantId },
    update: data,
    create: { tenantId, ...data },
  });

  // Audit trail
  await prisma.auditLog.create({
    data: {
      tenantId,
      action: 'UPDATE_SETTINGS',
      entity: 'Settings',
      entityId: result.id,
      staffId,
      payload: data as any,
    },
  });

  return result;
}

export async function updateBusinessHours(
  days: { day: string; enabled: boolean; open: string; close: string }[],
  autoCloseShift: boolean,
) {
  const { tenantId, staffId } = await getAuthContext();
  const result = await prisma.settings.upsert({
    where: { tenantId },
    update: { businessHours: days as any },
    create: { tenantId, businessHours: days as any },
  });
  await prisma.auditLog.create({
    data: {
      tenantId,
      action: 'UPDATE_BUSINESS_HOURS',
      entity: 'Settings',
      entityId: result.id,
      staffId,
      payload: { autoCloseShift, daysCount: days.length } as any,
    },
  });
  return { ok: true };
}

export async function updateFeatureFlag(key: string, enabled: boolean) {
  const { tenantId } = await getAuthContext();
  return prisma.tenantFeatureFlag.upsert({
    where: { tenantId_key: { tenantId, key } },
    update: { enabled },
    create: { tenantId, key, enabled },
  });
}

export async function getPredefinedNotes() {
  const { tenantId } = await getAuthContext();
  return prisma.predefinedNote.findMany({
    where: { tenantId },
    orderBy: { text: 'asc' },
  });
}

export async function createPredefinedNote(text: string) {
  const { tenantId } = await getAuthContext();
  return prisma.predefinedNote.create({
    data: { tenantId, text, active: true },
  });
}

export async function updatePredefinedNote(id: string, data: { text?: string; active?: boolean }) {
  const { tenantId } = await getAuthContext();
  return prisma.predefinedNote.update({
    where: { id, tenantId },
    data,
  });
}

export async function deletePredefinedNote(id: string) {
  const { tenantId } = await getAuthContext();
  return prisma.predefinedNote.delete({ where: { id, tenantId } });
}

export async function exportTenantData() {
  const { tenantId, role } = await getAuthContext();
  if (role !== 'admin') throw new Error('Admin access required');

  const [tenant, settings, staff, products, customers, orders, employees, featureFlags] =
    await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId } }),
      prisma.settings.findUnique({ where: { tenantId } }),
      prisma.staff.findMany({ where: { tenantId }, select: { id: true, name: true, staffId: true, role: true, active: true, createdAt: true } }),
      prisma.product.findMany({ where: { tenantId, deletedAt: null } }),
      prisma.customer.findMany({ where: { tenantId, deletedAt: null } }),
      prisma.order.findMany({ where: { tenantId, deletedAt: null }, include: { items: true }, take: 5000, orderBy: { createdAt: 'desc' } }),
      prisma.employee.findMany({ where: { tenantId, deletedAt: null } }),
      prisma.tenantFeatureFlag.findMany({ where: { tenantId } }),
    ]);

  return {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    tenant, settings, staff, products, customers, orders, employees, featureFlags,
  };
}

export async function getAuditLogs(page = 0) {
  const { tenantId, role } = await getAuthContext();
  if (role !== 'admin' && role !== 'manager') throw new Error('Admin access required');
  return prisma.auditLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 200,
    skip: page * 200,
    select: {
      id: true, action: true, entity: true, entityId: true,
      staffId: true, payload: true, ip: true, createdAt: true,
    },
  });
}

// ── Staff Management ──────────────────────────────────────────────────────────

export async function getStaffList() {
  const { tenantId, role } = await getAuthContext();
  if (role !== 'admin') throw new Error('Admin access required');
  return prisma.staff.findMany({
    where: { tenantId },
    select: { id: true, staffId: true, name: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
}

export async function createStaff(data: { staffId: string; name: string; role: string; password: string }) {
  const { tenantId, role } = await getAuthContext();
  if (role !== 'admin') throw new Error('Admin access required');
  const passwordHash = await bcrypt.hash(data.password, 10);
  return prisma.staff.create({
    data: { tenantId, staffId: data.staffId, name: data.name, role: data.role as any, passwordHash, active: true },
    select: { id: true, staffId: true, name: true, role: true, active: true, createdAt: true },
  });
}

export async function updateStaff(id: string, data: { name?: string; role?: string; password?: string }) {
  const { tenantId, role } = await getAuthContext();
  if (role !== 'admin') throw new Error('Admin access required');
  const update: Record<string, unknown> = {};
  if (data.name) update.name = data.name;
  if (data.role) update.role = data.role as any;
  if (data.password) update.passwordHash = await bcrypt.hash(data.password, 10);
  return prisma.staff.update({
    where: { id, tenantId },
    data: update,
    select: { id: true, staffId: true, name: true, role: true, active: true, createdAt: true },
  });
}

export async function toggleStaffActive(id: string, active: boolean) {
  const { tenantId, role } = await getAuthContext();
  if (role !== 'admin') throw new Error('Admin access required');
  return prisma.staff.update({
    where: { id, tenantId },
    data: { active },
    select: { id: true, staffId: true, name: true, role: true, active: true, createdAt: true },
  });
}

export async function deleteStaff(id: string) {
  const { tenantId, role, staffDbId } = await getAuthContext();
  if (role !== 'admin') throw new Error('Admin access required');
  if (id === staffDbId) throw new Error('Cannot delete your own account');
  return prisma.staff.delete({ where: { id, tenantId } });
}
