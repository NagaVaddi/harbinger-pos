import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { verifyToken } from '@/app/actions/auth';

export type UserRole = 'admin' | 'manager' | 'waiter' | 'kitchen' | 'cashier';

export interface AuthContext {
  tenantId: string;
  staffId: string | null;
  staffDbId: string | null;
  role: UserRole;
  name?: string;
}

const COOKIE_NAME = 'harbinger_token';
const DEMO_TENANT_SLUG = 'harbinger-demo';

// ── getTenantId ────────────────────────────────────────────────
export async function getTenantId(): Promise<string> {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (token) {
      const payload = await verifyToken(token);
      if (payload?.tenantId) return payload.tenantId;
    }
  } catch {
    // cookie() may throw outside request context
  }

  // Demo fallback — upsert so the tenant always exists
  try {
    const tenant = await prisma.tenant.upsert({
      where:  { slug: DEMO_TENANT_SLUG },
      update: {},
      create: { name: 'Harbinger Demo', slug: DEMO_TENANT_SLUG, plan: 'starter' },
      select: { id: true },
    });
    return tenant.id;
  } catch {
    return 'demo';
  }
}

// ── getAuthContext ─────────────────────────────────────────────
export async function getAuthContext(): Promise<AuthContext> {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (token) {
      const payload = await verifyToken(token);
      if (payload) {
        return {
          tenantId: payload.tenantId,
          staffId: payload.staffId,
          staffDbId: payload.staffDbId || null,
          role: payload.role as UserRole,
          name: payload.name,
        };
      }
    }
  } catch {
    // cookie() may throw outside request context
  }

  // Demo fallback — treat as admin
  const tenantId = await getTenantId();
  return { tenantId, staffId: 'ADMIN001', staffDbId: null, role: 'admin', name: 'Demo Admin' };
}

// ── getTenantFeatureFlags ──────────────────────────────────────
export async function getTenantFeatureFlags(
  tenantId: string,
): Promise<Record<string, boolean>> {
  try {
    const flags = await prisma.tenantFeatureFlag.findMany({
      where: { tenantId },
      select: { key: true, enabled: true },
    });
    return Object.fromEntries(flags.map(f => [f.key, f.enabled]));
  } catch {
    return {};
  }
}
