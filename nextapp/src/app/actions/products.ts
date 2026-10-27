'use server';

import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function getProducts() {
  const { tenantId } = await getAuthContext();
  return prisma.product.findMany({
    where: { tenantId, active: true, deletedAt: null },
    include: { category: true },
    orderBy: { name: 'asc' },
  });
}

export async function createProduct(data: {
  name: string;
  nameAr?: string;
  sku?: string;
  barcode?: string;
  price: number;
  cost?: number;
  categoryId?: string;
  unit?: string;
  stock?: number;
  minStock?: number;
  taxable?: boolean;
  kotPrinter?: number;
  image?: string;
}) {
  const { tenantId } = await getAuthContext();
  return prisma.product.create({
    data: { tenantId, active: true, stock: 0, ...data },
  });
}

export async function updateProduct(
  id: string,
  data: Partial<Parameters<typeof createProduct>[0]>,
) {
  const { tenantId } = await getAuthContext();
  return prisma.product.update({
    where: { id, tenantId },
    data,
  });
}

export async function deleteProduct(id: string) {
  const { tenantId, staffId } = await getAuthContext();
  const result = await prisma.product.update({
    where: { id, tenantId },
    data: { active: false, deletedAt: new Date() },
  });
  await logAudit(tenantId, staffId, 'DELETE_PRODUCT', `Product "${result.name}" soft-deleted`, 'Product', id);
  return result;
}

export async function getCategories() {
  const { tenantId } = await getAuthContext();
  return prisma.category.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
  });
}
