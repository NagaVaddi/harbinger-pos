'use client';
import { POSProvider } from '@/lib/context';
import { FeatureProvider } from './providers/FeatureProvider';
import { DB } from '@/lib/store';
import { useAutoCloseShift } from '@/lib/useAutoCloseShift';
import ShiftCloseModal from './ShiftCloseModal';

// Inner guard: must be inside POSProvider to use usePOS()
function ShiftAutoCloseGuard({ children }: { children: React.ReactNode }) {
  const { shouldClose, openShift } = useAutoCloseShift();
  return (
    <>
      {children}
      {shouldClose && openShift && <ShiftCloseModal shift={openShift} />}
    </>
  );
}

export default function Providers({
  children,
  initialData,
}: {
  children: React.ReactNode;
  initialData?: Partial<DB>;
}) {
  return (
    <POSProvider initialData={initialData}>
      <FeatureProvider>
        <ShiftAutoCloseGuard>{children}</ShiftAutoCloseGuard>
      </FeatureProvider>
    </POSProvider>
  );
}
