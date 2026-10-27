'use client';
import { useState } from 'react';
import { usePOS } from '@/lib/context';
import { FeatureKey, FeatureFlags, DEFAULT_FEATURE_FLAGS } from '@/lib/types';

type FeatureGroup = {
  label: string;
  items: { key: FeatureKey; label: string; description: string }[];
};

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    label: 'Restaurant',
    items: [
      { key: FeatureKey.RESTAURANT_MODULE, label: 'Restaurant module', description: 'Table management, KDS, waiter flow, and QR order verification.' },
      { key: FeatureKey.KOT_PRINTING, label: 'KOT thermal printing', description: 'Print kitchen order tickets directly to ESC/POS thermal printers via network IP.' },
    ],
  },
  {
    label: 'AI',
    items: [
      { key: FeatureKey.AI_IMAGE_GEN, label: 'AI product image generation', description: 'Auto-fetch product images from Unsplash based on product name. No API key required.' },
      { key: FeatureKey.AI_DEMAND_FORECAST, label: 'AI demand forecasting', description: 'Predict reorder points and stock demand using sales history.' },
    ],
  },
  {
    label: 'Hardware',
    items: [
      { key: FeatureKey.BARCODE_GENERATION, label: 'Barcode generation', description: 'Generate EAN-13 barcodes for products on the products page. Pure client-side.' },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { key: FeatureKey.E_INVOICING, label: 'e-Invoicing (ZATCA / VAT)', description: 'Generate compliant e-invoices with QR code and TRN for tax authority submission.' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { key: FeatureKey.SHIFT_MANAGEMENT, label: 'Shift management', description: 'Open and close counter shifts. Closing prints a Z-Report with cash/card breakdowns.' },
    ],
  },
];

export default function FeaturesPage() {
  const { db, save } = usePOS();
  const [flags, setFlags] = useState<FeatureFlags>({
    ...DEFAULT_FEATURE_FLAGS,
    ...(db.settings.features ?? {}),
  });
  const [saved, setSaved] = useState(false);

  const toggle = (key: FeatureKey) => {
    setFlags(f => ({ ...f, [key]: !f[key] }));
    setSaved(false);
  };

  const handleSave = () => {
    save(d => { d.settings = { ...d.settings, features: { ...flags } }; return d; });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ maxWidth: 680 }}>
      <h1 style={{ marginBottom: 4 }}>Feature flags</h1>
      <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 24 }}>
        Enable or disable modules for this installation. Changes take effect after save.
      </p>

      {FEATURE_GROUPS.map(group => (
        <div key={group.label} className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 14, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text2)' }}>
            {group.label}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {group.items.map(item => (
              <label key={item.key} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}>
                <div style={{ position: 'relative', flexShrink: 0, marginTop: 2 }}>
                  <input
                    type="checkbox"
                    checked={!!flags[item.key]}
                    onChange={() => toggle(item.key)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{item.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
        <button className="btn btn-primary" onClick={handleSave}>Save features</button>
        {saved && <span style={{ color: 'var(--green)', fontSize: 13 }}>✓ Saved</span>}
      </div>
    </div>
  );
}
