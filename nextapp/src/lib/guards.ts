// RBAC guards — run on the server inside Server Actions / API routes.
// Client-side helpers are also exported for instant UI feedback.

import { FeatureKey } from './types';

export type Role = 'admin' | 'manager' | 'waiter' | 'kitchen' | 'cashier';

export interface GuardResult {
  ok: boolean;
  code?: 'UNAUTHORIZED' | 'FEATURE_DISABLED';
  message?: string;
}

// ──────────────────────────────────────────────────────────────
// Server-side guards (call inside 'use server' actions)
// ──────────────────────────────────────────────────────────────

export function checkAdmin(role: Role | string | undefined | null): GuardResult {
  if (role !== 'admin') {
    return { ok: false, code: 'UNAUTHORIZED', message: 'Admin access required.' };
  }
  return { ok: true };
}

export function checkRole(
  role: Role | string | undefined | null,
  allowed: Role[],
): GuardResult {
  if (!role || !allowed.includes(role as Role)) {
    return { ok: false, code: 'UNAUTHORIZED', message: `Role '${role}' is not allowed.` };
  }
  return { ok: true };
}

export function checkFeature(
  flags: Record<string, boolean>,
  key: FeatureKey | string,
): GuardResult {
  if (!flags[key]) {
    return {
      ok: false,
      code: 'FEATURE_DISABLED',
      message: `Feature '${key}' is not enabled for this tenant.`,
    };
  }
  return { ok: true };
}

// Throws a redirect-ready error — use inside Server Actions
export function assertAdmin(role: Role | string | undefined | null): void {
  const g = checkAdmin(role);
  if (!g.ok) throw new Error(g.code);
}

export function assertFeature(
  flags: Record<string, boolean>,
  key: FeatureKey | string,
): void {
  const g = checkFeature(flags, key);
  if (!g.ok) throw new Error(g.code);
}

// ──────────────────────────────────────────────────────────────
// Business hours helper
// ──────────────────────────────────────────────────────────────

export const DEFAULT_BUSINESS_HOURS = [
  { day: 'Monday',    enabled: true, open: '08:00', close: '22:00' },
  { day: 'Tuesday',   enabled: true, open: '08:00', close: '22:00' },
  { day: 'Wednesday', enabled: true, open: '08:00', close: '22:00' },
  { day: 'Thursday',  enabled: true, open: '08:00', close: '22:00' },
  { day: 'Friday',    enabled: true, open: '08:00', close: '23:00' },
  { day: 'Saturday',  enabled: true, open: '09:00', close: '23:00' },
  { day: 'Sunday',    enabled: true, open: '09:00', close: '22:00' },
];

export function isWithinBusinessHours(
  hours: typeof DEFAULT_BUSINESS_HOURS,
): boolean {
  const d = new Date();
  const jsDay = d.getDay();
  const idx = [6, 0, 1, 2, 3, 4, 5][jsDay]; // Mon=0 … Sun=6
  const today = hours[idx];
  if (!today?.enabled) return false;
  const now = d.getHours() * 60 + d.getMinutes();
  const [oh, om] = today.open.split(':').map(Number);
  const [ch, cm] = today.close.split(':').map(Number);
  return now >= oh * 60 + om && now < ch * 60 + cm;
}
