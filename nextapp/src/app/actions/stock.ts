'use server';

import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth';

// ── Exported types ──────────────────────────────────────────────

export type SupplierRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  paymentTerms: string | null;
  createdAt: Date;
};

export type StockHistoryRow = {
  id: string;
  productId: string;
  productName: string;
  type: string;
  quantity: number;
  reference: string | null;
  staffName: string | null;
  createdAt: Date;
};

export type PurchaseOrderRow = {
  id: string;
  supplierName: string | null;
  status: string;
  totalAmount: number;
  createdAt: Date;
  itemCount: number;
};

export type StockCountRow = {
  id: string;
  status: string;
  staffName: string | null;
  createdAt: Date;
  completedAt: Date | null;
  itemCount: number;
};

export type StockCountItemRow = {
  id: string;
  stockCountId: string;
  productId: string;
  productName: string;
  expectedQty: number;
  countedQty: number | null;
};

export type BarcodeConfigData = {
  barcodePrefix: string;
  barcodeScanSku: boolean;
  barcodeQtyEntry: boolean;
  barcodeLabelsPerRow: number;
};

export type ProductStockRow = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  stock: number;
  minStock: number | null;
  cost: number | null;
  price: number;
  unit: string | null;
  lastActivity: Date | null;
};

// ── Suppliers ───────────────────────────────────────────────────

export async function getSuppliers(): Promise<SupplierRow[]> {
  const { tenantId } = await getAuthContext();
  return prisma.supplier.findMany({
    where: { tenantId },
    select: { id: true, name: true, phone: true, email: true, paymentTerms: true, createdAt: true },
    orderBy: { name: 'asc' },
  });
}

export async function createSupplier(data: {
  name: string;
  phone?: string;
  email?: string;
  paymentTerms?: string;
}) {
  const { tenantId } = await getAuthContext();
  return prisma.supplier.create({
    data: { tenantId, name: data.name, phone: data.phone, email: data.email, paymentTerms: data.paymentTerms },
    select: { id: true, name: true, phone: true, email: true, paymentTerms: true, createdAt: true },
  });
}

export async function updateSupplier(
  id: string,
  data: { name?: string; phone?: string; email?: string; paymentTerms?: string },
) {
  const { tenantId } = await getAuthContext();
  return prisma.supplier.update({
    where: { id, tenantId },
    data,
    select: { id: true, name: true, phone: true, email: true, paymentTerms: true, createdAt: true },
  });
}

export async function deleteSupplier(id: string) {
  const { tenantId } = await getAuthContext();
  return prisma.supplier.delete({ where: { id, tenantId } });
}

// ── Stock History ───────────────────────────────────────────────

export async function getStockHistory(productId?: string): Promise<StockHistoryRow[]> {
  const { tenantId } = await getAuthContext();
  return prisma.stockHistory.findMany({
    where: { tenantId, ...(productId ? { productId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: {
      id: true,
      productId: true,
      productName: true,
      type: true,
      quantity: true,
      reference: true,
      staffName: true,
      createdAt: true,
    },
  });
}

// ── Receive Stock (DB-backed) ───────────────────────────────────

export async function receiveStockDB(data: {
  productId: string;
  quantity: number;
  unitCost?: number;
  lotNumber?: string;
  expiryDate?: string;
  reference?: string;
  supplierId?: string;
}) {
  const { tenantId, staffId, name } = await getAuthContext();

  const product = await prisma.product.findFirst({
    where: { id: data.productId, tenantId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!product) throw new Error('Product not found');

  await prisma.$transaction([
    prisma.product.update({
      where: { id: data.productId },
      data: {
        stock: { increment: data.quantity },
        ...(data.unitCost != null ? { cost: data.unitCost } : {}),
      },
    }),
    prisma.stockBatch.create({
      data: {
        tenantId,
        productId: data.productId,
        productName: product.name,
        batchNo: data.lotNumber,
        totalQty: data.quantity,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      },
    }),
    prisma.stockHistory.create({
      data: {
        tenantId,
        productId: data.productId,
        productName: product.name,
        type: 'RECEIVE',
        quantity: data.quantity,
        reference: data.reference ?? 'Stock received',
        staffId,
        staffName: name,
      },
    }),
  ]);

  return { ok: true };
}

// ── Adjust Stock (DB-backed) ────────────────────────────────────

export async function adjustStockDB(productId: string, adjustment: number, reason: string) {
  const { tenantId, staffId, name } = await getAuthContext();

  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId, deletedAt: null },
    select: { id: true, name: true, stock: true },
  });
  if (!product) throw new Error('Product not found');

  await prisma.$transaction([
    prisma.product.update({
      where: { id: productId },
      data: { stock: { increment: adjustment } },
    }),
    prisma.stockHistory.create({
      data: {
        tenantId,
        productId,
        productName: product.name,
        type: 'ADJUST',
        quantity: adjustment,
        reference: reason,
        staffId,
        staffName: name,
      },
    }),
  ]);

  return { ok: true };
}

// ── Products with stock info (DB-backed manage tab) ─────────────

export async function getProductsWithStock(): Promise<ProductStockRow[]> {
  const { tenantId } = await getAuthContext();
  const products = await prisma.product.findMany({
    where: { tenantId, deletedAt: null, active: true },
    select: {
      id: true, name: true, sku: true, barcode: true,
      stock: true, minStock: true, cost: true, price: true, unit: true,
      updatedAt: true,
    },
    orderBy: { name: 'asc' },
  });
  return products.map(p => ({ ...p, lastActivity: p.updatedAt }));
}

// ── Purchase Orders ─────────────────────────────────────────────

export async function getPurchaseOrders(): Promise<PurchaseOrderRow[]> {
  const { tenantId } = await getAuthContext();
  const pos = await prisma.purchaseOrder.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      totalAmount: true,
      createdAt: true,
      supplier: { select: { name: true } },
      items: { select: { id: true } },
    },
  });
  return pos.map(po => ({
    id: po.id,
    supplierName: po.supplier?.name ?? null,
    status: po.status,
    totalAmount: po.totalAmount,
    createdAt: po.createdAt,
    itemCount: po.items.length,
  }));
}

export async function createPurchaseOrder(data: {
  supplierId?: string;
  notes?: string;
  items: { productId: string; productName: string; quantity: number; unitCost: number }[];
}) {
  const { tenantId } = await getAuthContext();
  const total = data.items.reduce((s, i) => s + i.quantity * i.unitCost, 0);
  return prisma.purchaseOrder.create({
    data: {
      tenantId,
      supplierId: data.supplierId,
      notes: data.notes,
      totalAmount: total,
      items: { createMany: { data: data.items } },
    },
    select: { id: true },
  });
}

export async function receivePurchaseOrder(poId: string) {
  const { tenantId, staffId, name } = await getAuthContext();

  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, tenantId },
    include: { items: true },
  });
  if (!po) throw new Error('Purchase order not found');
  if (po.status === 'RECEIVED') throw new Error('Already received');

  const ops = po.items.flatMap(item => [
    prisma.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    }),
    prisma.stockBatch.create({
      data: {
        tenantId,
        productId: item.productId,
        productName: item.productName,
        batchNo: `PO-${poId.slice(-6)}`,
        totalQty: item.quantity,
      },
    }),
    prisma.stockHistory.create({
      data: {
        tenantId,
        productId: item.productId,
        productName: item.productName,
        type: 'RECEIVE',
        quantity: item.quantity,
        reference: `PO-${poId.slice(-6)}`,
        staffId,
        staffName: name,
      },
    }),
  ]);

  await prisma.$transaction([
    ...ops,
    prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: 'RECEIVED' },
    }),
  ]);

  return { ok: true };
}

// ── Stock Count ─────────────────────────────────────────────────

export async function getStockCounts(): Promise<StockCountRow[]> {
  const { tenantId } = await getAuthContext();
  const counts = await prisma.stockCount.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, status: true, staffName: true, createdAt: true, completedAt: true,
      items: { select: { id: true } },
    },
  });
  return counts.map(c => ({
    id: c.id,
    status: c.status,
    staffName: c.staffName,
    createdAt: c.createdAt,
    completedAt: c.completedAt,
    itemCount: c.items.length,
  }));
}

export async function startStockCount(what: 'all' | 'low' | 'category', blind: boolean) {
  const { tenantId, staffId, name } = await getAuthContext();

  const products = await prisma.product.findMany({
    where: { tenantId, deletedAt: null, active: true },
    select: { id: true, name: true, stock: true, minStock: true },
  });

  const filtered = what === 'low'
    ? products.filter(p => p.minStock != null && p.stock <= p.minStock)
    : products;

  const count = await prisma.stockCount.create({
    data: {
      tenantId,
      staffId,
      staffName: name,
      items: {
        createMany: {
          data: filtered.map(p => ({
            productId: p.id,
            productName: p.name,
            expectedQty: p.stock,
          })),
        },
      },
    },
    select: { id: true },
  });

  return { countId: count.id, blind };
}

export async function getStockCountItems(countId: string): Promise<StockCountItemRow[]> {
  const { tenantId } = await getAuthContext();
  const count = await prisma.stockCount.findFirst({ where: { id: countId, tenantId } });
  if (!count) throw new Error('Count not found');
  return prisma.stockCountItem.findMany({
    where: { stockCountId: countId },
    orderBy: { productName: 'asc' },
  });
}

export async function submitStockCount(
  countId: string,
  items: { id: string; productId: string; productName: string; expectedQty: number; countedQty: number }[],
) {
  const { tenantId, staffId, name } = await getAuthContext();

  const count = await prisma.stockCount.findFirst({ where: { id: countId, tenantId, status: 'DRAFT' } });
  if (!count) throw new Error('Count not found or already completed');

  const historyOps = items
    .filter(i => i.countedQty !== i.expectedQty)
    .map(i =>
      prisma.stockHistory.create({
        data: {
          tenantId,
          productId: i.productId,
          productName: i.productName,
          type: 'ADJUST',
          quantity: i.countedQty - i.expectedQty,
          reference: `Stock count #${countId.slice(-6)}`,
          staffId,
          staffName: name,
        },
      }),
    );

  const updateOps = items.map(i =>
    prisma.product.update({
      where: { id: i.productId },
      data: { stock: i.countedQty },
    }),
  );

  const saveItemOps = items.map(i =>
    prisma.stockCountItem.update({
      where: { id: i.id },
      data: { countedQty: i.countedQty },
    }),
  );

  await prisma.$transaction([
    ...historyOps,
    ...updateOps,
    ...saveItemOps,
    prisma.stockCount.update({
      where: { id: countId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    }),
  ]);

  return { ok: true };
}

// ── Barcode Config ──────────────────────────────────────────────

export async function getBarcodeConfig(): Promise<BarcodeConfigData> {
  const { tenantId } = await getAuthContext();
  const settings = await prisma.settings.findUnique({
    where: { tenantId },
    select: { barcodePrefix: true, barcodeScanSku: true, barcodeQtyEntry: true, barcodeLabelsPerRow: true },
  });
  return {
    barcodePrefix: settings?.barcodePrefix ?? '99',
    barcodeScanSku: settings?.barcodeScanSku ?? true,
    barcodeQtyEntry: settings?.barcodeQtyEntry ?? true,
    barcodeLabelsPerRow: settings?.barcodeLabelsPerRow ?? 3,
  };
}

export async function saveBarcodeConfig(data: BarcodeConfigData) {
  const { tenantId } = await getAuthContext();
  await prisma.settings.upsert({
    where: { tenantId },
    update: data,
    create: { tenantId, ...data },
  });
  return { ok: true };
}

// ── Stock Batches (DB) ──────────────────────────────────────────

export async function getStockBatchesDB(productId?: string) {
  const { tenantId } = await getAuthContext();
  return prisma.stockBatch.findMany({
    where: { tenantId, ...(productId ? { productId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: {
      id: true,
      productId: true,
      productName: true,
      batchNo: true,
      barcode: true,
      totalQty: true,
      damagedQty: true,
      expiryDate: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}
