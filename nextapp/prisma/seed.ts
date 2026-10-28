import { PrismaClient, StaffRole, PrinterType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_FEATURE_FLAGS = [
  { key: 'restaurant_module',     enabled: false }, // off unless bizType=restaurant
  { key: 'kot_printing',          enabled: true  },
  { key: 'ai_image_gen',          enabled: true  },
  { key: 'ai_demand_forecasting', enabled: true  },
  { key: 'barcode_generation',    enabled: true  },
  { key: 'e_invoicing',           enabled: true  },
  { key: 'shift_management',      enabled: true  },
  { key: 'crm_module',            enabled: true  },
  { key: 'hcm_module',            enabled: true  },
  { key: 'custom_reports',        enabled: true  },
  { key: 'jobs_module',           enabled: true  },
];

const DEFAULT_PREDEFINED_NOTES = [
  'No onion', 'No cheese', 'No sauce',
  'Extra spicy', 'Well done', 'Medium',
  'No ice', 'Extra portion',
];

const DEFAULT_BUSINESS_HOURS = [
  { day: 'Monday',    enabled: true, open: '08:00', close: '22:00' },
  { day: 'Tuesday',   enabled: true, open: '08:00', close: '22:00' },
  { day: 'Wednesday', enabled: true, open: '08:00', close: '22:00' },
  { day: 'Thursday',  enabled: true, open: '08:00', close: '22:00' },
  { day: 'Friday',    enabled: true, open: '08:00', close: '23:00' },
  { day: 'Saturday',  enabled: true, open: '09:00', close: '23:00' },
  { day: 'Sunday',    enabled: true, open: '09:00', close: '22:00' },
];

async function main() {
  console.log('🌱 Seeding Harbinger POS...');

  // ── Tenant ──────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'harbinger-demo' },
    update: {},
    create: {
      name: 'Harbinger Demo',
      slug: 'harbinger-demo',
      plan: 'pro',
    },
  });
  console.log(`  Tenant: ${tenant.name} (${tenant.id})`);

  // ── Settings ─────────────────────────────────────────────────
  await prisma.settings.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      business: 'Harbinger Demo Store',
      address: 'Dubai, UAE',
      country: 'AE',
      dialCode: '+971',
      currency: 'AED',
      bizType: 'retail',
      taxRate: 5,
      taxLabel: 'VAT',
      taxInclusive: false,
      serviceCharge: 0,
      maxDiscountPct: 50,
      loyaltyEnabled: false,
      loyaltyRate: 1,
      receiptLang: 'en',
      brandTheme: 'blue',
      displaySize: 'normal',
      businessHours: DEFAULT_BUSINESS_HOURS,
    },
  });

  // ── Feature Flags ─────────────────────────────────────────────
  for (const flag of DEFAULT_FEATURE_FLAGS) {
    await prisma.tenantFeatureFlag.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: flag.key } },
      update: { enabled: flag.enabled },
      create: { tenantId: tenant.id, key: flag.key, enabled: flag.enabled },
    });
  }
  console.log(`  Feature flags: ${DEFAULT_FEATURE_FLAGS.length} seeded`);

  // ── Admin Staff ───────────────────────────────────────────────
  const adminHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.staff.upsert({
    where: { tenantId_staffId: { tenantId: tenant.id, staffId: 'ADMIN001' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Admin',
      staffId: 'ADMIN001',
      passwordHash: adminHash,
      role: StaffRole.admin,
      active: true,
    },
  });
  console.log(`  Admin staff: ${admin.name} (staffId: ${admin.staffId}, password: admin123)`);

  // ── Waiter Staff ──────────────────────────────────────────────
  const waiterHash = await bcrypt.hash('waiter123', 10);
  await prisma.staff.upsert({
    where: { tenantId_staffId: { tenantId: tenant.id, staffId: 'W001' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Waiter One',
      staffId: 'W001',
      passwordHash: waiterHash,
      role: StaffRole.waiter,
      active: true,
    },
  });

  // ── Predefined Notes ──────────────────────────────────────────
  for (const text of DEFAULT_PREDEFINED_NOTES) {
    const existing = await prisma.predefinedNote.findFirst({
      where: { tenantId: tenant.id, text },
    });
    if (!existing) {
      await prisma.predefinedNote.create({
        data: { tenantId: tenant.id, text, active: true },
      });
    }
  }
  console.log(`  Predefined notes: ${DEFAULT_PREDEFINED_NOTES.length} seeded`);

  // ── Demo Printer ──────────────────────────────────────────────
  const existingPrinter = await prisma.printer.findFirst({ where: { tenantId: tenant.id } });
  let printer = existingPrinter;
  if (!printer) {
    printer = await prisma.printer.create({
      data: {
        tenantId: tenant.id,
        name: 'KOT Printer 1',
        ipAddress: '192.168.1.100',
        port: 9100,
        type: PrinterType.KOT,
      },
    });
    console.log(`  Demo printer: ${printer.name} @ ${printer.ipAddress}`);
  }

  // ── Demo Categories ───────────────────────────────────────────
  const categoryNames = ['Burgers', 'Drinks', 'Desserts', 'Sides', 'Retail'];
  for (const name of categoryNames) {
    const existing = await prisma.category.findUnique({
      where: { tenantId_name: { tenantId: tenant.id, name } },
    });
    if (!existing) {
      await prisma.category.create({
        data: { tenantId: tenant.id, name },
      });
    }
  }
  console.log(`  Categories: ${categoryNames.length} seeded`);

  // ── Demo Products ─────────────────────────────────────────────
  const burgerCat = await prisma.category.findUnique({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Burgers' } },
  });
  const drinksCat = await prisma.category.findUnique({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Drinks' } },
  });

  const sampleProducts = [
    { name: 'Classic Burger',  price: 35, cost: 12, categoryId: burgerCat?.id, taxable: true  },
    { name: 'Cheese Burger',   price: 40, cost: 14, categoryId: burgerCat?.id, taxable: true  },
    { name: 'Cola 330ml',      price: 8,  cost: 2,  categoryId: drinksCat?.id, taxable: true  },
    { name: 'Water 500ml',     price: 3,  cost: 0.5,categoryId: drinksCat?.id, taxable: false },
  ];

  for (const prod of sampleProducts) {
    const existing = await prisma.product.findFirst({
      where: { tenantId: tenant.id, name: prod.name },
    });
    if (!existing) {
      await prisma.product.create({
        data: { tenantId: tenant.id, stock: 100, active: true, ...prod },
      });
    }
  }
  console.log(`  Products: ${sampleProducts.length} seeded`);

  // ── Restaurant Tables (1–10) ──────────────────────────────────
  for (let i = 1; i <= 10; i++) {
    const num = String(i);
    const existing = await prisma.restaurantTable.findUnique({
      where: { tenantId_number: { tenantId: tenant.id, number: num } },
    });
    if (!existing) {
      await prisma.restaurantTable.create({
        data: { tenantId: tenant.id, number: num, name: `Table ${i}`, seats: 4 },
      });
    }
  }
  console.log(`  Restaurant tables: 1–10 seeded`);

  console.log('\n✅ Seed complete.');
  console.log('   Login: staffId=ADMIN001, password=admin123');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
