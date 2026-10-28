// Core types shared across the app

// ──────────────────────────────────────────────────────────────
// Feature entitlement system
// ──────────────────────────────────────────────────────────────
export enum FeatureKey {
  RESTAURANT_MODULE    = 'restaurant_module',
  KOT_PRINTING         = 'kot_printing',
  AI_IMAGE_GEN         = 'ai_image_gen',
  AI_DEMAND_FORECAST   = 'ai_demand_forecasting',
  BARCODE_GENERATION   = 'barcode_generation',
  E_INVOICING          = 'e_invoicing',
  SHIFT_MANAGEMENT     = 'shift_management',
  CRM_MODULE           = 'crm_module',
  HCM_MODULE           = 'hcm_module',
  CUSTOM_REPORTS       = 'custom_reports',
  JOBS_MODULE          = 'jobs_module',
}

export type FeatureFlags = {
  [K in FeatureKey]: boolean;
};

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  [FeatureKey.RESTAURANT_MODULE]:  false,
  [FeatureKey.KOT_PRINTING]:       false,
  [FeatureKey.AI_IMAGE_GEN]:       true,
  [FeatureKey.AI_DEMAND_FORECAST]: false,
  [FeatureKey.BARCODE_GENERATION]: true,
  [FeatureKey.E_INVOICING]:        false,
  [FeatureKey.SHIFT_MANAGEMENT]:   false,
  [FeatureKey.CRM_MODULE]:         false,
  [FeatureKey.HCM_MODULE]:         false,
  [FeatureKey.CUSTOM_REPORTS]:     false,
  [FeatureKey.JOBS_MODULE]:        false,
};

export type BizType =
  | 'restaurant' | 'supermarket' | 'grocery' | 'retail'
  | 'pharmacy'   | 'clinic'
  | 'salon'      | 'tailor'  | 'laundry'
  | 'butcher'
  | 'garage'     | 'tyre'
  | 'wholesale'  | 'logistics' | 'ecommerce';

export interface BusinessHoursDay {
  day: string;
  enabled: boolean;
  open: string;   // "HH:MM"
  close: string;  // "HH:MM"
}

export interface PredefinedNote {
  id: string;
  text: string;
  active: boolean;
}

export interface Shift {
  id: string;
  openedAt: string;
  closedAt?: string;
  openingBalance: number;
  closingBalance?: number;
  cashSales: number;
  cardSales: number;
  totalSales: number;
  expenses: number;
  status: 'open' | 'closed';
  staffId?: string;
  staffName?: string;
}

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
  features: FeatureFlags;
  businessHours?: BusinessHoursDay[];
  autoCloseShift?: boolean;
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
  kitchenId?: string;
  kotPrinter?: 1 | 2 | 3 | 4;
  image?: string;
  metadata?: Record<string, unknown>;
}

export interface Staff {
  id: string;
  name: string;
  staffId: string;
  password: string;
  role: 'admin' | 'manager' | 'waiter' | 'kitchen' | 'cashier';
  kitchenId?: string;
  active: boolean;
}

export interface Session {
  staffId: string;
  staffName: string;
  role: 'admin' | 'manager' | 'waiter' | 'kitchen' | 'cashier';
  kitchenId?: string;
  kitchenName?: string;
}

export type PipelineStage = 'Lead' | 'Qualified' | 'Proposal' | 'Won' | 'Lost';

export interface CustomerInteraction {
  id: string;
  type: 'call' | 'email' | 'visit' | 'note';
  note: string;
  staffId?: string;
  createdAt: string;
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
  // CRM fields (gated by crm_module)
  pipelineStage?: PipelineStage;
  lifetimeValue?: number;
  interactions?: CustomerInteraction[];
}

export type EmployeeRole = 'manager' | 'cashier' | 'waiter' | 'kitchen' | 'driver' | 'other';

export interface ClockEntry {
  type: 'in' | 'out';
  ts: string;
}

export interface Employee {
  id: string;
  name: string;
  role: EmployeeRole;
  phone?: string;
  email?: string;
  hourlyRate: number;
  active: boolean;
  clockLog?: ClockEntry[];
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
  // Restaurant extensions
  tableId?: string;
  tableName?: string;
  restaurantStatus?: 'draft' | 'pending_verification' | 'verified' | 'in_kitchen' | 'ready' | 'served';
  verificationPin?: string;
  pinExpiry?: number;
  // Industry-specific order fields (vehicle details, patient info, delivery address, etc.)
  metadata?: Record<string, unknown>;
}

export interface Table {
  id: string;
  number: string;
  name?: string;
  seats: number;
  status: 'available' | 'occupied' | 'bill_requested' | 'reserved';
  currentOrderId?: string;
  section?: string;
}

export interface Kitchen {
  id: string;
  name: string;
  color: string;
  categories: string[];
  printerIp?: string;
  printerPort?: number;
  printerNo?: number;
  active: boolean;
}

export interface KOTItem {
  productId: string;
  name: string;
  qty: number;
  note?: string;
}

export interface KOT {
  id: string;
  orderId: string;
  orderNo: string;
  tableId?: string;
  tableName?: string;
  kitchenId: string;
  kitchenName: string;
  kitchenColor: string;
  items: KOTItem[];
  status: 'new' | 'accepted' | 'preparing' | 'ready' | 'served';
  createdAt: string;
  updatedAt: string;
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

// ── Extended types for new pages ─────────────────────────────
export interface AccountVoucher {
  id: string;
  type: 'payment' | 'receipt' | 'contra' | 'journal' | 'purchase';
  no: string;
  date: string;
  narration: string;
  amount: number;
  ledger: string;
  createdAt: string;
}

export interface Register {
  id: string;
  name: string;
  username: string;
  staff: string;
  status: 'open' | 'closed';
  currentShift?: string;
  createdAt: string;
}

export interface CashVoucher {
  id: string;
  amount: number;
  note: string;
  createdAt: string;
}

export interface DeliveryDriver {
  id: string;
  name: string;
  phone?: string;
  vehicle?: string;
  active: boolean;
  createdAt: string;
}

export type OfferDiscountType = 'percentage' | 'fixed' | 'bogo' | 'combo';

export interface Offer {
  id: string;
  title: string;
  product: string;
  discountType: OfferDiscountType;
  discountValue: number;
  validFrom: string;
  validUntil: string;
  status: 'active' | 'inactive' | 'expired';
  createdAt: string;
}

export interface PromoCode {
  id: string;
  code: string;
  discountType: OfferDiscountType;
  discountValue: number;
  minOrder: number;
  maxUses: number;
  usedCount: number;
  validFrom: string;
  validUntil: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface HeldTicket {
  id: string;
  label: string;
  lines: OrderLine[];
  customerId?: string;
  discount: number;
  method: string;
  orderMeta: Record<string, string>;
  createdAt: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  description: string;
  debitLedger: string;
  creditLedger: string;
  amount: number;
  orderId?: string;
  reference?: string;
  createdAt: string;
}
