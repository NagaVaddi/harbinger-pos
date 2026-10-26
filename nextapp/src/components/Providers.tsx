'use client';
import { POSProvider } from '@/lib/context';

export default function Providers({ children }: { children: React.ReactNode }) {
  return <POSProvider>{children}</POSProvider>;
}
