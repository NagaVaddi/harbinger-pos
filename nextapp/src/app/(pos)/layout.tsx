import { POSProvider } from '@/lib/context';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

export default function POSLayout({ children }: { children: React.ReactNode }) {
  return (
    <POSProvider>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Header />
          <main style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
            {children}
          </main>
        </div>
      </div>
    </POSProvider>
  );
}
