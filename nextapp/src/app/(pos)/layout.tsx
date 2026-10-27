// Server Component — fetches initial data from Prisma and passes to client providers.
// Falls back gracefully when DATABASE_URL is not set (demo/localStorage mode).
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Providers from '@/components/Providers';
import { DB } from '@/lib/store';

async function fetchInitialData(): Promise<Partial<DB> | undefined> {
  if (!process.env.DATABASE_URL) return undefined;
  try {
    const { getSettings } = await import('@/app/actions/settings');
    const { getProducts } = await import('@/app/actions/products');
    const { getOrders } = await import('@/app/actions/orders');

    const [{ settings, flags }, products, orders] = await Promise.all([
      getSettings(),
      getProducts(),
      getOrders('open'),
    ]);

    if (!settings) return undefined;

    // Map Prisma rows to the localStorage DB shape so both modes stay compatible
    return {
      settings: {
        business:       settings.business,
        address:        settings.address ?? '',
        trn:            settings.trn ?? '',
        currency:       settings.currency,
        bizType:        settings.bizType as any,
        allowNegative:  settings.allowNegative,
        taxRate:        settings.taxRate,
        taxLabel:       settings.taxLabel,
        roundCash:      settings.roundCash,
        businessHours:  (settings.businessHours as any) ?? undefined,
        features:       flags as any,
      },
      products: products.map(p => ({
        id:         p.id,
        name:       p.name,
        nameAr:     p.nameAr ?? undefined,
        sku:        p.sku ?? undefined,
        barcode:    p.barcode ?? undefined,
        price:      p.price,
        cost:       p.cost ?? undefined,
        category:   p.category?.name ?? '',
        unit:       p.unit ?? undefined,
        stock:      p.stock,
        minStock:   p.minStock ?? undefined,
        taxable:    p.taxable,
        active:     p.active,
        kotPrinter: (p.kotPrinter ?? undefined) as 1 | 2 | 3 | 4 | undefined,
        image:      p.image ?? undefined,
      })),
      orders: orders.map(o => ({
        id:         o.id,
        no:         o.no,
        lines:      o.items.map(i => ({
          productId: i.productId ?? '',
          name:      i.name,
          qty:       i.qty,
          price:     i.price,
          tax:       i.tax,
          disc:      i.disc,
          note:      i.note ?? undefined,
        })),
        subtotal:   o.subtotal,
        tax:        o.tax,
        disc:       o.disc,
        total:      o.total,
        paid:       o.paid,
        change:     o.change,
        method:     o.method,
        status:     o.status as any,
        customerId: o.customerId ?? undefined,
        tableId:    o.tableId ?? undefined,
        ts:         o.createdAt.toISOString(),
      })),
    };
  } catch {
    // DB unavailable — fall through to localStorage
    return undefined;
  }
}

export default async function POSLayout({ children }: { children: React.ReactNode }) {
  const initialData = await fetchInitialData();

  return (
    <Providers initialData={initialData}>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Header />
          <main style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
            {children}
          </main>
        </div>
      </div>
    </Providers>
  );
}
