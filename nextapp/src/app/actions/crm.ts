'use server';

import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth';
import { checkFeature } from '@/lib/guards';

async function guardCRM() {
  const ctx = await getAuthContext();
  const flags = await prisma.tenantFeatureFlag.findMany({ where: { tenantId: ctx.tenantId }, select: { key: true, enabled: true } });
  const flagMap = Object.fromEntries(flags.map(f => [f.key, f.enabled]));
  const g = checkFeature(flagMap, 'crm_module');
  if (!g.ok) throw new Error(g.message);
  return ctx;
}

export async function getCustomers() {
  const ctx = await getAuthContext();
  return prisma.customer.findMany({
    where: { tenantId: ctx.tenantId },
    include: { interactions: { orderBy: { createdAt: 'desc' }, take: 10 } },
    orderBy: { registeredOn: 'desc' },
  });
}

export async function updateCustomerStage(customerId: string, stage: string) {
  const ctx = await guardCRM();
  return prisma.customer.update({
    where: { id: customerId, tenantId: ctx.tenantId },
    data: { pipelineStage: stage as any },
  });
}

export async function logCustomerInteraction(data: {
  customerId: string;
  type: 'call' | 'email' | 'visit' | 'note';
  note: string;
}) {
  const ctx = await guardCRM();
  const interaction = await prisma.customerInteraction.create({
    data: {
      customerId: data.customerId,
      type: data.type,
      note: data.note,
      staffId: ctx.staffId,
    },
  });

  // Update lifetimeValue based on paid orders
  const orders = await prisma.order.findMany({
    where: { tenantId: ctx.tenantId, customerId: data.customerId, status: 'paid' },
    select: { total: true },
  });
  const ltv = orders.reduce((s, o) => s + o.total, 0);
  await prisma.customer.update({
    where: { id: data.customerId },
    data: { lifetimeValue: ltv },
  });

  return interaction;
}

export async function createCustomer(data: {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  creditLimit?: number;
  pipelineStage?: string;
}) {
  const ctx = await getAuthContext();
  return prisma.customer.create({
    data: { tenantId: ctx.tenantId, ...data, pipelineStage: (data.pipelineStage ?? 'Lead') as any },
  });
}

export async function updateCustomer(id: string, data: Partial<Parameters<typeof createCustomer>[0]>) {
  const ctx = await getAuthContext();
  return prisma.customer.update({
    where: { id, tenantId: ctx.tenantId },
    data: data as any,
  });
}
