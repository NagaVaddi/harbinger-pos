'use server';

import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export type TemplateId =
  | 'restaurant' | 'grocery' | 'supermarket' | 'retail'
  | 'pharmacy'   | 'clinic'
  | 'salon'      | 'tailor'  | 'laundry'
  | 'garage'     | 'tyre'
  | 'wholesale'  | 'logistics' | 'ecommerce'
  | 'butcher';

interface TemplateResult {
  ok: boolean;
  message: string;
}

// ── helpers ──────────────────────────────────────────────────────
async function enableFlag(tenantId: string, key: string) {
  await prisma.tenantFeatureFlag.upsert({
    where: { tenantId_key: { tenantId, key } },
    update: { enabled: true },
    create: { tenantId, key, enabled: true },
  });
}

async function upsertCategory(tenantId: string, name: string) {
  await prisma.category.upsert({
    where: { tenantId_name: { tenantId, name } },
    update: {},
    create: { tenantId, name },
  });
}

async function upsertNote(tenantId: string, text: string) {
  const existing = await prisma.predefinedNote.findFirst({ where: { tenantId, text } });
  if (!existing) await prisma.predefinedNote.create({ data: { tenantId, text, active: true } });
}

async function upsertTable(tenantId: string, number: string, name: string) {
  await prisma.restaurantTable.upsert({
    where: { tenantId_number: { tenantId, number } },
    update: {},
    create: { tenantId, number, name, seats: 4 },
  });
}

async function setCustomFields(tenantId: string, fields: Record<string, string>) {
  await prisma.tenantConfig.upsert({
    where: { tenantId },
    update: { customFields: fields },
    create: { tenantId, customFields: fields },
  });
}

// ── template map ─────────────────────────────────────────────────
const TEMPLATE_CONFIGS: Record<TemplateId, {
  bizType: string;
  businessType: string;
  flags: string[];
  categories: string[];
  notes?: string[];
  tables?: number;
  customFields?: Record<string, string>;
}> = {
  restaurant: {
    bizType: 'restaurant',
    businessType: 'RESTAURANT',
    flags: ['restaurant_module', 'kot_printing', 'shift_management'],
    categories: ['Food', 'Drinks', 'Starters', 'Desserts', 'Sides'],
    tables: 10,
    notes: ['No onion', 'No cheese', 'Extra spicy', 'Well done', 'No ice', 'No sauce'],
  },
  grocery: {
    bizType: 'grocery',
    businessType: 'GROCERY',
    flags: ['barcode_generation', 'weighted_barcodes'],
    categories: ['Produce', 'Dairy', 'Snacks', 'Beverages', 'Bakery', 'Frozen'],
  },
  supermarket: {
    bizType: 'supermarket',
    businessType: 'GROCERY',
    flags: ['barcode_generation', 'weighted_barcodes'],
    categories: ['Produce', 'Dairy', 'Meat & Poultry', 'Snacks', 'Beverages', 'Bakery', 'Frozen'],
  },
  retail: {
    bizType: 'retail',
    businessType: 'RETAIL',
    flags: ['barcode_generation', 'shift_management'],
    categories: ['Clothing', 'Electronics', 'Accessories', 'Home & Living', 'Footwear'],
  },
  pharmacy: {
    bizType: 'pharmacy',
    businessType: 'PHARMACY',
    flags: ['batch_expiry_tracking', 'prescription_required', 'barcode_generation', 'e_invoicing'],
    categories: ['Prescription', 'OTC Medicines', 'Vitamins', 'Medical Devices', 'Cosmetics'],
    customFields: { 'Drug Schedule': '', 'Insurance Provider': '', 'Rx Number': '' },
  },
  clinic: {
    bizType: 'clinic',
    businessType: 'CLINIC',
    flags: ['hcm_module', 'appointments'],
    categories: ['Consultation', 'Lab Tests', 'Procedures', 'Medications'],
    customFields: { 'Doctor ID': '', 'Patient File': '', 'Appointment Date': '' },
  },
  salon: {
    bizType: 'salon',
    businessType: 'SALON',
    flags: ['hcm_module', 'staff_commission', 'shift_management'],
    categories: ['Haircut', 'Colouring', 'Treatment', 'Nails', 'Makeup', 'Waxing'],
    customFields: { 'Stylist': '', 'Next Appointment': '', 'Hair Type': '' },
  },
  tailor: {
    bizType: 'tailor',
    businessType: 'TAILOR',
    flags: ['jobs_module', 'shift_management'],
    categories: ['Alterations', 'Custom Suits', 'Dresses', 'Traditional Wear', 'Repairs'],
    customFields: { 'Measurements': '', 'Fabric Reference': '', 'Ready Date': '' },
    notes: ['Rush order', 'Customer approval needed', 'No changes after fitting'],
  },
  laundry: {
    bizType: 'laundry',
    businessType: 'LAUNDRY',
    flags: ['jobs_module', 'shift_management'],
    categories: ['Wash & Fold', 'Dry Clean', 'Ironing', 'Stain Removal', 'Alterations'],
    customFields: { 'Pickup Date': '', 'Delivery Date': '', 'Garment Tag': '' },
    notes: ['Handle with care', 'Cold wash only', 'No tumble dry', 'Stain treatment'],
  },
  garage: {
    bizType: 'garage',
    businessType: 'GARAGE',
    flags: ['jobs_module', 'vehicle_registry', 'shift_management'],
    categories: ['Labour', 'Parts', 'Tyres', 'Oils & Fluids', 'Accessories'],
    notes: ['Customer approval required', 'Warranty claim', 'Insurance job', 'Return old part'],
    customFields: { 'Plate Number': '', 'VIN': '', 'Mileage': '', 'Make/Model': '' },
  },
  tyre: {
    bizType: 'tyre',
    businessType: 'TYRE',
    flags: ['jobs_module', 'vehicle_registry', 'shift_management'],
    categories: ['Tyres', 'Rims', 'Alignment', 'Balancing', 'Labour'],
    customFields: { 'Plate Number': '', 'Tyre Size': '', 'Mileage': '' },
  },
  butcher: {
    bizType: 'butcher',
    businessType: 'BUTCHER',
    flags: ['barcode_generation', 'weighted_barcodes'],
    categories: ['Beef', 'Lamb', 'Chicken', 'Veal', 'Seafood', 'Offal'],
    customFields: { 'Cut Type': '', 'Weight (kg)': '' },
  },
  wholesale: {
    bizType: 'wholesale',
    businessType: 'WHOLESALE',
    flags: ['multi_warehouse', 'credit_limits', 'barcode_generation'],
    categories: ['Dry Goods', 'FMCG', 'Electronics', 'Industrial', 'Packaging'],
    customFields: { 'Pallet Size': '', 'Min Order Qty': '', 'Delivery Route': '' },
    notes: ['Bulk order discount', 'Credit approved', 'COD only'],
  },
  logistics: {
    bizType: 'logistics',
    businessType: 'LOGISTICS',
    flags: ['multi_warehouse', 'credit_limits'],
    categories: ['Same Day', 'Next Day', 'Freight', 'International', 'Cold Chain'],
    customFields: { 'Delivery Route': '', 'Driver Name': '', 'Vehicle Plate': '' },
    notes: ['COD collection', 'Signature required', 'Fragile', 'Do not stack'],
  },
  ecommerce: {
    bizType: 'retail',
    businessType: 'ECOMMERCE',
    flags: ['barcode_generation', 'multi_warehouse', 'e_invoicing'],
    categories: ['Electronics', 'Clothing', 'Home & Living', 'Beauty', 'Sports', 'Books'],
    customFields: { 'SKU': '', 'Warehouse Zone': '', 'Tracking Number': '' },
  },
};

// ── main action ──────────────────────────────────────────────────
export async function installTemplate(templateId: TemplateId): Promise<TemplateResult> {
  const { tenantId, staffId } = await getAuthContext();
  const cfg = TEMPLATE_CONFIGS[templateId];
  if (!cfg) return { ok: false, message: `Unknown template: ${templateId}` };

  // Update settings + businessType on tenant
  await prisma.$transaction([
    prisma.settings.upsert({
      where: { tenantId },
      update: { bizType: cfg.bizType },
      create: { tenantId, bizType: cfg.bizType },
    }),
    prisma.tenant.update({
      where: { id: tenantId },
      data: { businessType: cfg.businessType as any },
    }),
  ]);

  // Feature flags
  for (const key of cfg.flags) {
    await enableFlag(tenantId, key);
  }

  // Categories
  for (const cat of cfg.categories) {
    await upsertCategory(tenantId, cat);
  }

  // Notes
  for (const note of cfg.notes ?? []) {
    await upsertNote(tenantId, note);
  }

  // Tables (restaurant)
  if (cfg.tables) {
    for (let i = 1; i <= cfg.tables; i++) {
      await upsertTable(tenantId, String(i), `Table ${i}`);
    }
  }

  // Custom fields
  if (cfg.customFields) {
    await setCustomFields(tenantId, cfg.customFields);
  }

  await logAudit(tenantId, staffId, 'INSTALL_TEMPLATE',
    `Installed ${templateId} template`, 'Tenant', tenantId);

  return { ok: true, message: `${templateId} template installed successfully` };
}

// ── country defaults action ──────────────────────────────────────
export interface CountryDefaults {
  country: string;
  currency: string;
  taxRate: number;
  taxLabel: string;
  dialCode: string;
  receiptLang: string;
  eInvoicingEnabled: boolean;
}

export async function applyCountryDefaults(countryCode: string): Promise<{ ok: boolean; defaults: CountryDefaults }> {
  const { tenantId, staffId } = await getAuthContext();
  const { COUNTRY_CONFIGS } = await import('@/lib/locales');
  const defaults = COUNTRY_CONFIGS[countryCode] ?? COUNTRY_CONFIGS['GLOBAL'];

  await prisma.settings.upsert({
    where: { tenantId },
    update: {
      country:    countryCode,
      currency:   defaults.currency,
      taxRate:    defaults.taxRate,
      taxLabel:   defaults.taxLabel,
      dialCode:   defaults.dialCode,
      receiptLang: defaults.receiptLang,
    },
    create: {
      tenantId,
      country:    countryCode,
      currency:   defaults.currency,
      taxRate:    defaults.taxRate,
      taxLabel:   defaults.taxLabel,
      dialCode:   defaults.dialCode,
      receiptLang: defaults.receiptLang,
    },
  });

  if (defaults.eInvoicingEnabled) {
    await enableFlag(tenantId, 'e_invoicing');
  }

  await logAudit(tenantId, staffId, 'APPLY_COUNTRY_DEFAULTS',
    `Applied ${countryCode} defaults (${defaults.currency}, ${defaults.taxRate}% ${defaults.taxLabel})`);

  return { ok: true, defaults: { ...defaults, country: countryCode } };
}
