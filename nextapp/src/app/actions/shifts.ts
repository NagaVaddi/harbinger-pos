'use server';

import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function getShifts() {
  const { tenantId } = await getAuthContext();
  return prisma.shift.findMany({
    where: { tenantId },
    include: { staff: true },
    orderBy: { openedAt: 'desc' },
    take: 50,
  });
}

export async function openShift(openingBalance: number) {
  const { tenantId, staffDbId } = await getAuthContext();

  // Close any existing open shift first
  await prisma.shift.updateMany({
    where: { tenantId, status: 'open' },
    data: { status: 'closed', closedAt: new Date() },
  });

  return prisma.shift.create({
    data: {
      tenantId,
      openingBalance,
      status: 'open',
      ...(staffDbId ? { staffId: staffDbId } : {}),
    },
  });
}

export async function closeShift(shiftId: string) {
  const { tenantId } = await getAuthContext();

  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, tenantId },
  });
  if (!shift) throw new Error('Shift not found');

  // Tally paid orders during this shift
  const orders = await prisma.order.findMany({
    where: {
      tenantId,
      status: 'paid',
      createdAt: { gte: shift.openedAt },
    },
    select: { total: true, method: true },
  });

  const cashSales = orders
    .filter(o => o.method === 'cash')
    .reduce((s, o) => s + o.total, 0);
  const cardSales = orders
    .filter(o => o.method !== 'cash')
    .reduce((s, o) => s + o.total, 0);
  const totalSales = cashSales + cardSales;

  // Tally cash-out vouchers during shift
  const vouchers = await prisma.voucher.findMany({
    where: {
      tenantId,
      type: 'out',
      createdAt: { gte: shift.openedAt },
    },
    select: { amount: true },
  });
  const expenses = vouchers.reduce((s, v) => s + v.amount, 0);
  const closingBalance = shift.openingBalance + cashSales - expenses;

  const result = await prisma.shift.update({
    where: { id: shiftId },
    data: {
      status: 'closed',
      closedAt: new Date(),
      cashSales,
      cardSales,
      totalSales,
      expenses,
      closingBalance,
    },
  });

  const { staffId } = await getAuthContext();
  await logAudit(tenantId, staffId, 'CLOSE_SHIFT',
    `Shift closed — cash: ${cashSales.toFixed(2)}, card: ${cardSales.toFixed(2)}, total: ${totalSales.toFixed(2)}`,
    'Shift', shiftId,
  );
  return result;
}
