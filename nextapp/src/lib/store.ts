'use client';
// Lightweight in-browser store backed by localStorage (demo mode).
// In Cloud mode this will be replaced by API calls to server/cloud/.

import { Settings, Product, Customer, Order, Job, Voucher, StockBatch, Table, Kitchen, KOT } from './types';

export interface DB {
  settings: Settings;
  products: Product[];
  customers: Customer[];
  orders: Order[];
  jobs: Job[];
  vouchers: Voucher[];
  batches: StockBatch[];
  tables: Table[];
  kitchens: Kitchen[];
  kots: KOT[];
  _version: number;
}

const KEY = 'harbinger_pos';

export const defaultSettings: Settings = {
  business: 'My Business',
  address: '',
  trn: '',
  currency: 'AED',
  bizType: 'retail',
  allowNegative: true,
  taxRate: 5,
  taxLabel: 'VAT',
  roundCash: false,
};

function defaultDB(): DB {
  return {
    settings: { ...defaultSettings },
    products: [],
    customers: [],
    orders: [],
    jobs: [],
    vouchers: [],
    batches: [],
    tables: [],
    kitchens: [],
    kots: [],
    _version: 1,
  };
}

export function loadDB(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaultDB(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaultDB();
}

export function saveDB(db: DB): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch { /* ignore */ }
}

export function clearDB(): void {
  localStorage.removeItem(KEY);
}
