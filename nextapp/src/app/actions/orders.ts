'use server';

import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth';

export async function getOrders(status?: string) {
  const { tenantId } = await getAuthContext();
  return prisma.order.findMany({
    where: { tenantId, ...(status ? { status: status as any } : {}) },
    include: { items: true, customer: true, table: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

export async function createOrder(data: {
  no: string;
  subtotal: number;
  tax: number;
  disc: number;
  total: number;
  paid: number;
  change: number;
  method: string;
  customerId?: string;
  tableId?: string;
  items: {
    name: string;
    qty: number;
    price: number;
    tax?: number;
    disc?: number;
    note?: string;
    productId?: string;
  }[];
}) {
  const { tenantId, staffDbId } = await getAuthContext();
  const { items, ...orderData } = data;
  return prisma.order.create({
    data: {
      tenantId,
      ...(staffDbId ? { staffId: staffDbId } : {}),
      ...orderData,
      items: {
        create: items.map(i => ({ tenantId, ...i })),
      },
    },
    include: { items: true },
  });
}

export async function updateOrderStatus(id: string, status: string) {
  const { tenantId } = await getAuthContext();
  return prisma.order.update({
    where: { id, tenantId },
    data: { status: status as any },
  });
}

export async function verifyOrderPIN(orderId: string, pin: string) {
  const { tenantId } = await getAuthContext();
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      tenantId,
      verificationPin: pin,
      pinExpiry: { gt: new Date() },
    },
  });
  if (!order) return { ok: false, error: 'Invalid or expired PIN' };
  await prisma.order.update({
    where: { id: orderId },
    data: { restaurantStatus: 'verified' as any },
  });
  return { ok: true };
}
