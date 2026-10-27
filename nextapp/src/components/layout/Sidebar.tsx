'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { usePOS } from '@/lib/context';
import { useFeature } from '@/components/providers/FeatureProvider';
import { FeatureKey } from '@/lib/types';

const BASE_NAV = [
  { group: 'Main', items: [
    { label: 'Dashboard',   href: '/dashboard',  icon: '⬛' },
    { label: 'Register',    href: '/register',   icon: '🛒' },
    { label: 'Products',    href: '/products',   icon: '📦' },
    { label: 'Customers',   href: '/customers',  icon: '👥' },
  ]},
  { group: 'Operations', items: [
    { label: 'Jobs',        href: '/jobs',       icon: '🔧' },
    { label: 'Stock',       href: '/stock',      icon: '🏪' },
    { label: 'Reports',     href: '/reports',    icon: '📊' },
    { label: 'Delivery',    href: '/delivery',   icon: '🚗' },
  ]},
];

const RESTAURANT_NAV = { group: 'Restaurant', items: [
  { label: 'Tables',        href: '/restaurant',         icon: '🍽️' },
  { label: 'Kitchen Display', href: '/restaurant/kds',   icon: '👨‍🍳' },
  { label: 'Kitchen Setup', href: '/restaurant/kitchen', icon: '⚙️' },
]};

const SETUP_NAV = { group: 'Setup', items: [
  { label: 'Settings',       href: '/settings',           icon: '⚙️' },
  { label: 'Business Hours', href: '/settings/business',  icon: '🕐' },
  { label: 'Shifts',         href: '/settings/shifts',    icon: '💼' },
  { label: 'Note Presets',   href: '/settings/notes',     icon: '📝' },
  { label: 'Features',       href: '/settings/features',  icon: '🧩' },
]};

const HCM_NAV_ITEM = { label: 'Team (HCM)', href: '/hcm', icon: '👤' };
const EINVOICING_NAV_ITEM = { label: 'E-Invoicing', href: '/einvoicing', icon: '🧾' };

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { db, settings, session, setSession } = usePOS();
  const { isEnabled } = useFeature();

  const showRestaurant = settings.bizType === 'restaurant' || isEnabled(FeatureKey.RESTAURANT_MODULE);
  const showHCM = isEnabled(FeatureKey.HCM_MODULE);
  const showEInvoicing = isEnabled(FeatureKey.E_INVOICING);
  const readyKOTs = db.kots.filter(k => k.status === 'ready').length;

  // Inject feature-gated items into Operations group
  const opsItems = BASE_NAV[1].items.filter(Boolean);
  if (showHCM) opsItems.push(HCM_NAV_ITEM);
  if (showEInvoicing) opsItems.push(EINVOICING_NAV_ITEM);

  const nav = [
    BASE_NAV[0],
    { ...BASE_NAV[1], items: opsItems },
    ...(showRestaurant ? [RESTAURANT_NAV] : []),
    SETUP_NAV,
  ];

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
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>⚡ Harbinger</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {settings.business}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        {nav.map(group => (
          <div key={group.group} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 8px 6px' }}>
              {group.group}
            </div>
            {group.items.map(item => {
              const active = pathname === item.href || (item.href !== '/restaurant' && pathname.startsWith(item.href));
              const isRestaurantRoot = item.href === '/restaurant' && (pathname === '/restaurant' || pathname.startsWith('/restaurant/order'));
              const isActive = active || isRestaurantRoot;
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
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--text)' : 'var(--text2)',
                  background: isActive ? 'var(--bg3)' : 'transparent',
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
