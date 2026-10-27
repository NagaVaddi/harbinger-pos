'use server';

import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth';
import { checkFeature } from '@/lib/guards';

export interface ForecastItem {
  productId: string;
  productName: string;
  currentStock: number;
  avgDailySales: number;
  forecastedDemand: number; // next 7 days
  suggestedReorder: number;
  daysUntilStockout: number | null;
  trend: 'up' | 'flat' | 'down';
}

export async function forecastDemand(): Promise<ForecastItem[]> {
  const ctx = await getAuthContext();

  // Guard feature flag
  const flags = await prisma.tenantFeatureFlag.findMany({ where: { tenantId: ctx.tenantId }, select: { key: true, enabled: true } });
  const flagMap = Object.fromEntries(flags.map(f => [f.key, f.enabled]));
  const g = checkFeature(flagMap, 'ai_demand_forecasting');
  if (!g.ok) throw new Error(g.message);

  const since = new Date();
  since.setDate(since.getDate() - 30);

  // Fetch order items from the last 30 days
  const items = await prisma.orderItem.findMany({
    where: {
      order: {
        tenantId: ctx.tenantId,
        status: 'paid',
        createdAt: { gte: since },
      },
    },
    include: { order: { select: { createdAt: true } } },
  });

  // Aggregate daily sales per product
  const salesMap = new Map<string, { name: string; dayBuckets: Map<string, number> }>();
  for (const item of items) {
    if (!item.productId) continue;
    const day = new Date(item.order.createdAt).toISOString().slice(0, 10);
    if (!salesMap.has(item.productId)) {
      salesMap.set(item.productId, { name: item.name, dayBuckets: new Map() });
    }
    const entry = salesMap.get(item.productId)!;
    entry.dayBuckets.set(day, (entry.dayBuckets.get(day) ?? 0) + item.qty);
  }

  const products = await prisma.product.findMany({
    where: { tenantId: ctx.tenantId, active: true },
    select: { id: true, name: true, stock: true, minStock: true },
  });

  const results: ForecastItem[] = [];

  for (const product of products) {
    const entry = salesMap.get(product.id);
    if (!entry) continue;

    const dailyValues = [...entry.dayBuckets.values()];
    if (dailyValues.length === 0) continue;

    // 7-day simple moving average
    const recent7 = dailyValues.slice(-7);
    const older7 = dailyValues.slice(-14, -7);
    const avgRecent = recent7.reduce((s, v) => s + v, 0) / Math.max(recent7.length, 1);
    const avgOlder = older7.length ? older7.reduce((s, v) => s + v, 0) / older7.length : avgRecent;

    const trend: 'up' | 'flat' | 'down' =
      avgRecent > avgOlder * 1.1 ? 'up' :
      avgRecent < avgOlder * 0.9 ? 'down' : 'flat';

    const forecastedDemand = Math.ceil(avgRecent * 7);
    const currentStock = product.stock ?? 0;
    const daysUntilStockout = avgRecent > 0 ? Math.floor(currentStock / avgRecent) : null;
    const buffer = product.minStock ?? Math.ceil(avgRecent * 3); // 3-day safety buffer
    const suggestedReorder = Math.max(0, forecastedDemand + buffer - currentStock);

    results.push({
      productId: product.id,
      productName: product.name,
      currentStock,
      avgDailySales: Math.round(avgRecent * 10) / 10,
      forecastedDemand,
      suggestedReorder,
      daysUntilStockout,
      trend,
    });
  }

  // Sort by urgency (days until stockout, lowest first; null at end)
  results.sort((a, b) => {
    if (a.daysUntilStockout === null && b.daysUntilStockout === null) return 0;
    if (a.daysUntilStockout === null) return 1;
    if (b.daysUntilStockout === null) return -1;
    return a.daysUntilStockout - b.daysUntilStockout;
  });

  return results;
}
