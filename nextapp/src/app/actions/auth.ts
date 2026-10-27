'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

// ── JWT helpers ────────────────────────────────────────────────
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'harbinger-dev-secret-change-in-prod',
);
const COOKIE_NAME = 'harbinger_token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

export interface JwtPayload {
  staffId: string;
  staffDbId: string;
  tenantId: string;
  role: string;
  name: string;
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

// ── In-memory rate limiting ────────────────────────────────────
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function checkRateLimit(key: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry) return { allowed: true };
  if (entry.lockedUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((entry.lockedUntil - now) / 1000) };
  }
  if (entry.count >= MAX_ATTEMPTS) {
    const newEntry = { count: entry.count, lockedUntil: now + LOCKOUT_MS };
    loginAttempts.set(key, newEntry);
    return { allowed: false, retryAfter: Math.ceil(LOCKOUT_MS / 1000) };
  }
  return { allowed: true };
}

function recordFailure(key: string) {
  const entry = loginAttempts.get(key) ?? { count: 0, lockedUntil: 0 };
  loginAttempts.set(key, { count: entry.count + 1, lockedUntil: entry.lockedUntil });
}

function clearAttempts(key: string) {
  loginAttempts.delete(key);
}

// ── Zod schemas ────────────────────────────────────────────────
const LoginSchema = z.object({
  tenantSlug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  staffId: z.string().min(1).max(50).trim(),
  password: z.string().min(1).max(200),
});

const RegisterSchema = z.object({
  businessName: z.string().min(2).max(100).trim(),
  adminName: z.string().min(2).max(80).trim(),
  adminId: z.string().min(2).max(20).regex(/^[A-Z0-9]+$/, 'Staff ID must be uppercase letters and numbers only').trim(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  currency: z.string().length(3).default('AED'),
});

// ── loginAction ────────────────────────────────────────────────
export async function loginAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const raw = {
    tenantSlug: formData.get('tenantSlug'),
    staffId: formData.get('staffId'),
    password: formData.get('password'),
  };

  const parsed = LoginSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Invalid input.' };

  const { tenantSlug, staffId, password } = parsed.data;
  const rlKey = `${staffId}@${tenantSlug}`;
  const rl = checkRateLimit(rlKey);
  if (!rl.allowed) {
    return { ok: false, error: `Too many attempts. Try again in ${Math.ceil((rl.retryAfter ?? 900) / 60)} min.` };
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });
    if (!tenant) {
      recordFailure(rlKey);
      return { ok: false, error: 'Invalid credentials.' };
    }

    const staff = await prisma.staff.findFirst({
      where: { tenantId: tenant.id, staffId, active: true },
      select: { id: true, name: true, role: true, passwordHash: true },
    });
    if (!staff) {
      recordFailure(rlKey);
      return { ok: false, error: 'Invalid credentials.' };
    }

    const match = await bcrypt.compare(password, staff.passwordHash);
    if (!match) {
      recordFailure(rlKey);
      await logAudit(tenant.id, staffId, 'LOGIN_FAILED', `Failed login attempt for ${staffId}`);
      return { ok: false, error: 'Invalid credentials.' };
    }

    clearAttempts(rlKey);

    const token = await signToken({
      staffId,
      staffDbId: staff.id,
      tenantId: tenant.id,
      role: staff.role,
      name: staff.name,
    });

    const jar = await cookies();
    jar.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });

    await logAudit(tenant.id, staffId, 'LOGIN', `Staff ${staffId} (${staff.name}) logged in`);
    return { ok: true, session: { staffId, staffName: staff.name, role: staff.role as 'admin' | 'waiter' | 'kitchen' } };
  } catch (err) {
    console.error('loginAction:', err);
    return { ok: false, error: 'Server error. Please try again.' };
  }
}

// ── logoutAction ───────────────────────────────────────────────
export async function logoutAction(): Promise<void> {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (token) {
      const payload = await verifyToken(token);
      if (payload) {
        await logAudit(payload.tenantId, payload.staffId, 'LOGOUT', `Staff ${payload.staffId} logged out`).catch(() => {});
      }
    }
    jar.delete(COOKIE_NAME);
  } catch {
    // ignore
  }
  redirect('/login');
}

// ── registerTenant ─────────────────────────────────────────────
export async function registerTenant(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const raw = {
    businessName: formData.get('businessName'),
    adminName: formData.get('adminName'),
    adminId: formData.get('adminId'),
    password: formData.get('password'),
    currency: formData.get('currency') ?? 'AED',
  };

  const parsed = RegisterSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Validation error.' };
  }
  const { businessName, adminName, adminId, password, currency } = parsed.data;

  const slug = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

  try {
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) return { ok: false, error: 'Business name already taken. Try a slightly different name.' };

    const passwordHash = await bcrypt.hash(password, 12);

    const tenant = await prisma.$transaction(async tx => {
      return tx.tenant.create({
        data: {
          name: businessName,
          slug,
          plan: 'starter',
          settings: { create: { business: businessName, currency } },
          staff: { create: { name: adminName, staffId: adminId, passwordHash, role: 'admin' } },
          featureFlags: {
            createMany: {
              data: [
                { key: 'restaurant_module', enabled: false },
                { key: 'crm_module',        enabled: false },
                { key: 'hcm_module',        enabled: false },
                { key: 'e_invoicing',       enabled: false },
                { key: 'ai_demand_forecasting', enabled: false },
                { key: 'custom_reports',    enabled: false },
              ],
            },
          },
        },
      });
    });

    const staffRow = await prisma.staff.findFirst({
      where: { tenantId: tenant.id, staffId: adminId },
      select: { id: true },
    });

    const token = await signToken({
      staffId: adminId,
      staffDbId: staffRow?.id ?? '',
      tenantId: tenant.id,
      role: 'admin',
      name: adminName,
    });

    const jar = await cookies();
    jar.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });

    await logAudit(tenant.id, adminId, 'TENANT_REGISTERED', `New tenant created: ${businessName} (slug: ${slug})`);
  } catch (err) {
    console.error('registerTenant:', err);
    return { ok: false, error: 'Failed to create account. Please try again.' };
  }

  redirect('/dashboard');
}
