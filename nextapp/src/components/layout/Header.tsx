'use client';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { usePOS } from '@/lib/context';
import { fmtDateTime } from '@/lib/fmt';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/register': 'Register',
  '/products': 'Products',
  '/customers': 'Customers',
  '/jobs': 'Jobs & Orders',
  '/stock': 'Stock',
  '/reports': 'Reports',
  '/delivery': 'Online & Delivery',
  '/outlets': 'Outlets & Registers',
  '/accounts': 'Accounts',
  '/promotions': 'Promotions',
  '/settings': 'Settings',
};

export default function Header() {
  const pathname = usePathname();
  const { settings } = usePOS();
  const [now, setNow] = useState<string>('');

  useEffect(() => {
    setNow(fmtDateTime(new Date()));
    const t = setInterval(() => setNow(fmtDateTime(new Date())), 60_000);
    return () => clearInterval(t);
  }, []);

  const title = Object.entries(PAGE_TITLES).find(([k]) => pathname.startsWith(k))?.[1] ?? 'Harbinger POS';

  return (
    <header style={{
      height: 56,
      background: 'var(--bg2)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      flexShrink: 0,
    }}>
      <h1 style={{ fontSize: 16, fontWeight: 600 }}>{title}</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>
          {now}
        </span>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, color: '#fff',
          cursor: 'pointer',
        }}>
          {settings.business.charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  );
}
