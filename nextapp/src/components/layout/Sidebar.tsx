'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { usePOS } from '@/lib/context';
import { useFeature } from '@/components/providers/FeatureProvider';
import { FeatureKey } from '@/lib/types';

// Nav structure matching legacy Harbinger layout
const NAV_STRUCTURE = [
  {
    group: 'OPERATE',
    items: [
      { label: 'Dashboard',          href: '/dashboard',  icon: '⬛' },
      { label: 'Products',           href: '/products',   icon: '📦' },
      { label: 'Stock Room',         href: '/stock',      icon: '🏪' },
      { label: 'Online & Delivery',  href: '/delivery',   icon: '🛵' },
      { label: 'Delivery Partners',  href: '/delivery#drivers', icon: '🚗' },
    ],
  },
  {
    group: 'GROW',
    items: [
      { label: 'Customers',  href: '/customers',   icon: '👥' },
      { label: 'Promotions', href: '/promotions',  icon: '🎁' },
    ],
  },
  {
    group: 'MONEY',
    items: [
      { label: 'Orders',             href: '/register',   icon: '🛒' },
      { label: 'Outlets & Registers',href: '/outlets',    icon: '🏷️' },
      { label: 'Accounts',           href: '/accounts',   icon: '📒' },
    ],
  },
  {
    group: 'ADMIN',
    items: [
      { label: 'Team',          href: '/settings/staff',    icon: '👤' },
      { label: 'Control Panel', href: '/settings',          icon: '⚙️' },
    ],
  },
];

const RESTAURANT_ITEMS = [
  { label: 'Tables',          href: '/restaurant',         icon: '🍽️' },
  { label: 'Kitchen Display', href: '/restaurant/kds',     icon: '👨‍🍳' },
  { label: 'Kitchen Setup',   href: '/restaurant/kitchen', icon: '⚙️' },
];

// Feature-gated items that go in MONEY group
const EINVOICING_ITEM = { label: 'E-Invoicing', href: '/einvoicing', icon: '🧾' };
const REPORTS_ITEM    = { label: 'Reports',     href: '/reports',    icon: '📊' };

// Feature-gated items that go in ADMIN group
const HCM_ITEM      = { label: 'Team (HCM)', href: '/hcm',              icon: '👤' };
const JOBS_ITEM     = { label: 'Jobs',        href: '/jobs',             icon: '🔧' };
const BIZ_HOURS     = { label: 'Business Hours', href: '/settings/business', icon: '🕐' };
const SHIFTS_ITEM   = { label: 'Shifts',      href: '/settings/shifts',  icon: '💼' };
const NOTES_ITEM    = { label: 'Note Presets', href: '/settings/notes',  icon: '📝' };
const FEATURES_ITEM = { label: 'Features',    href: '/settings/features', icon: '🧩' };

// Which hrefs each role can access (admin gets everything)
const ROLE_ALLOWED: Record<string, string[]> = {
  manager:  ['/dashboard', '/register', '/products', '/customers', '/jobs', '/stock', '/reports', '/delivery', '/restaurant', '/restaurant/kds', '/hcm', '/einvoicing', '/outlets', '/accounts', '/promotions'],
  waiter:   ['/register', '/customers', '/restaurant', '/restaurant/kds'],
  kitchen:  ['/restaurant/kds'],
  cashier:  ['/dashboard', '/register', '/customers', '/outlets'],
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { db, settings, session, setSession } = usePOS();
  const { isEnabled } = useFeature();

  const role = session?.role ?? null;
  const isAdmin = role === 'admin';

  const canSee = (href: string) => {
    if (isAdmin || !role) return true;
    const base = href.split('#')[0];
    return (ROLE_ALLOWED[role] ?? []).some(allowed => base === allowed || base.startsWith(allowed + '/'));
  };

  const showRestaurant = settings.bizType === 'restaurant' || isEnabled(FeatureKey.RESTAURANT_MODULE);
  const showHCM = isEnabled(FeatureKey.HCM_MODULE);
  const showEInvoicing = isEnabled(FeatureKey.E_INVOICING);
  const readyKOTs = db.kots.filter(k => k.status === 'ready').length;

  // Build full nav structure
  const groups = NAV_STRUCTURE.map(g => {
    let items = [...g.items];

    if (g.group === 'MONEY') {
      items.push(REPORTS_ITEM);
      if (showEInvoicing) items.push(EINVOICING_ITEM);
    }

    if (g.group === 'ADMIN') {
      if (showHCM) items = [HCM_ITEM, ...items.filter(i => i.href !== '/settings/staff')];
      items.push(BIZ_HOURS, SHIFTS_ITEM, NOTES_ITEM, FEATURES_ITEM);
      // Jobs always visible to admins
      items = [JOBS_ITEM, ...items];
    }

    return { ...g, items };
  });

  // Insert restaurant group after OPERATE if applicable
  const fullGroups = showRestaurant
    ? [groups[0], { group: 'RESTAURANT', items: RESTAURANT_ITEMS }, ...groups.slice(1)]
    : groups;

  // Filter by role
  const nav = fullGroups
    .map(g => ({ ...g, items: g.items.filter(i => canSee(i.href)) }))
    .filter(g => g.items.length > 0);

  const isActive = (href: string) => {
    const base = href.split('#')[0];
    if (base === '/restaurant') return pathname === '/restaurant' || pathname.startsWith('/restaurant/order');
    if (base === '/settings') return pathname === '/settings'; // exact only — sub-pages handled by their own entries
    return pathname === base || pathname.startsWith(base + '/');
  };

  return (
    <aside style={{
      width: 'var(--sidebar-w)',
      minHeight: '100vh',
      background: 'var(--bg2)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* Brand */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/logo.png" alt="Harbinger" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>Harbinger</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {settings.business}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        {nav.map(group => (
          <div key={group.group} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 8px 6px' }}>
              {group.group}
            </div>
            {group.items.map(item => {
              const active = isActive(item.href);
              const badge = item.href === '/restaurant/kds' && readyKOTs > 0 ? readyKOTs : 0;
              return (
                <Link key={item.href} href={item.href} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 10px',
                  borderRadius: 8,
                  marginBottom: 2,
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                  color: active ? 'var(--text)' : 'var(--text2)',
                  background: active ? 'var(--bg3)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                  justifyContent: 'space-between',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>{item.icon}</span>
                    {item.label}
                  </span>
                  {badge > 0 && (
                    <span style={{ background: 'var(--red)', color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '1px 6px' }}>
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom — session info */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', fontSize: 12 }}>
        {session ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 15 }}>
                {session.role === 'admin' ? '🔐' : session.role === 'waiter' ? '🍽️' : '👨‍🍳'}
              </span>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.staffName}</div>
                <div style={{ color: 'var(--text2)', textTransform: 'capitalize' }}>
                  {session.role}{session.kitchenName ? ` · ${session.kitchenName}` : ''}
                </div>
              </div>
            </div>
            <button onClick={() => { setSession(null); router.push('/login'); }} style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text2)',
              fontSize: 11, padding: '4px 8px', cursor: 'pointer', width: '100%', textAlign: 'left',
            }}>
              Sign out
            </button>
          </div>
        ) : (
          <div style={{ color: 'var(--text2)' }}>
            {settings.currency} · {settings.bizType}
            <div style={{ marginTop: 4 }}>
              <Link href="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 11 }}>Sign in →</Link>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
