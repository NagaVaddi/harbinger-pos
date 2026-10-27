import { prisma } from './prisma';

export async function logAudit(
  tenantId: string,
  staffId: string | null | undefined,
  action: string,
  detail?: string,
  entity?: string,
  entityId?: string,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId,
        staffId: staffId ?? null,
        action,
        entity: entity ?? null,
        entityId: entityId ?? null,
        payload: detail ? { detail } : undefined,
      },
    });
  } catch {
    // Never throw from audit — it's a side effect
  }
}
