'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePOS } from '@/lib/context';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { session } = usePOS();
  const router = useRouter();

  useEffect(() => {
    if (!session || session.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [session, router]);

  if (!session || session.role !== 'admin') return null;

  return <>{children}</>;
}
