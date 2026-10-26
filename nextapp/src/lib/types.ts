// Core types shared across the app

export type BizType =
  | 'restaurant' | 'supermarket' | 'retail' | 'pharmacy'
  | 'clinic' | 'salon' | 'tailor' | 'butcher' | 'grocery'
  | 'garage' | 'tyre';

export interface Settings {
  business: string;
  address?: string;
  trn?: string;
  currency: string;
  bizType: BizType;
  allowNegative: boolean;
  taxRate: number;
  taxLabel: string;
  roundCash: boolean;
}

export interface Product {
  id: string;
  name: string;
  nameAr?: string;
  sku?: string;
  barcode?: string;
  price: number;
  cost?: number;
  category?: string;
  unit?: string;
  stock: number;
  minStock?: number;
  taxable: boolean;
  active: boolean;
  hasSerial?: boolean;
  isWeighed?: boolean;
  hasExpiry?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  creditLimit?: number;
  balance?: number;
  registeredOn: string;
  status: 'active' | 'inactive';
}

export interface OrderLine {
  productId: string;
  name: string;
  qty: number;
  price: number;
  tax: number;
  disc?: number;
  serial?: string;
  note?: string;
}

export interface Order {
  id: string;
  no: string;
  lines: OrderLine[];
  subtotal: number;
  tax: number;
  disc: number;
  total: number;
  paid: number;
  change: number;
  method: string;
  customerId?: string;
  staffId?: string;
  counterId?: string;
  ts: string;
  status: 'open' | 'paid' | 'void' | 'refund';
}

export interface Job {
  id: string;
  no: string;
  title: string;
  customerId?: string;
  vehicleId?: string;
  status: 'open' | 'in_progress' | 'ready' | 'closed' | 'cancelled';
  advances: JobAdvance[];
  estimate?: number;
  ts: string;
  notes?: string;
  assignee?: string;
}

export interface JobAdvance {
  amount: number;
  method: string;
  ts: string;
  voucher?: string;
  staffId?: string;
}

export interface StockBatch {
  id: string;
  productId: string;
  productName: string;
  batchNo?: string;
  barcode?: string;
  totalQty: number;
  damagedQty: number;
  expiryDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Voucher {
  id: string;
  type: 'in' | 'out' | 'refund';
  amount: number;
  reason: string;
  userId?: string;
  ts: string;
}

export interface NavItem {
  label: string;
  labelAr?: string;
  href: string;
  icon: string;
  group?: string;
}
