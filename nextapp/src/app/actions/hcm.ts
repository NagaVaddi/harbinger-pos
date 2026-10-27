'use server';

import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth';

export async function getEmployees() {
  const { tenantId } = await getAuthContext();
  return prisma.employee.findMany({
    where: { tenantId, active: true },
    orderBy: { name: 'asc' },
  });
}

export async function createEmployee(data: {
  name: string;
  role: string;
  phone?: string;
  email?: string;
  hourlyRate: number;
}) {
  const { tenantId } = await getAuthContext();
  return prisma.employee.create({
    data: { tenantId, active: true, ...data },
  });
}

export async function updateEmployee(id: string, data: Partial<Parameters<typeof createEmployee>[0] & { active?: boolean }>) {
  const { tenantId } = await getAuthContext();
  return prisma.employee.update({
    where: { id, tenantId },
    data,
  });
}

export async function clockInOut(employeeId: string) {
  const { tenantId } = await getAuthContext();
  const emp = await prisma.employee.findFirst({ where: { id: employeeId, tenantId } });
  if (!emp) throw new Error('Employee not found');

  const log: { type: 'in' | 'out'; ts: string }[] = (emp.clockLog as any[]) ?? [];
  const lastEntry = log[log.length - 1];
  const newType: 'in' | 'out' = (!lastEntry || lastEntry.type === 'out') ? 'in' : 'out';
  log.push({ type: newType, ts: new Date().toISOString() });

  return prisma.employee.update({
    where: { id: employeeId },
    data: { clockLog: log as any },
  });
}

export async function getHoursWorked(employeeId: string, fromDate: string, toDate: string) {
  const { tenantId } = await getAuthContext();
  const emp = await prisma.employee.findFirst({ where: { id: employeeId, tenantId } });
  if (!emp) return { hours: 0, sessions: [] };

  const log: { type: 'in' | 'out'; ts: string }[] = (emp.clockLog as any[]) ?? [];
  const from = new Date(fromDate).getTime();
  const to = new Date(toDate + 'T23:59:59').getTime();

  const sessions: { in: string; out: string; hours: number }[] = [];
  let totalMs = 0;

  for (let i = 0; i < log.length; i++) {
    if (log[i].type === 'in' && log[i + 1]?.type === 'out') {
      const start = new Date(log[i].ts).getTime();
      const end   = new Date(log[i + 1].ts).getTime();
      if (start >= from && end <= to) {
        const ms = end - start;
        totalMs += ms;
        sessions.push({ in: log[i].ts, out: log[i + 1].ts, hours: +(ms / 3_600_000).toFixed(2) });
      }
      i++;
    }
  }

  return { hours: +(totalMs / 3_600_000).toFixed(2), sessions };
}
