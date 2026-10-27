'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { usePOS } from '@/lib/context';
import { Product, FeatureKey } from '@/lib/types';
import { fmtCurrency, uid } from '@/lib/fmt';
import { useFeature } from '@/components/providers/FeatureProvider';

// Generate a simple EAN-13 barcode string from a product ID
function genEAN13(productId: string): string {
  // Hash the id into a 12-digit numeric string, then compute check digit
  let hash = 0;
  for (let i = 0; i < productId.length; i++) {
    hash = (hash * 31 + productId.charCodeAt(i)) >>> 0;
  }
  const base = String(hash).padStart(12, '0').slice(-12);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(base[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return base + check;
}

// Fetch a relevant image from Unsplash for a product name.
// Appends category hint for better relevance (food, retail, etc).
async function fetchProductImage(name: string, category?: string): Promise<string> {
  const query = encodeURIComponent([name, category, 'product'].filter(Boolean).join(' '));
  // Unsplash source redirects to a consistent photo for the same query
  const sourceUrl = `https://source.unsplash.com/featured/400x300?${query}`;
  try {
    // Follow redirect to pin the actual CDN URL so it stays stable
    const res = await fetch(sourceUrl, { redirect: 'follow', mode: 'no-cors' });
    // In no-cors mode res.url is opaque (''), so just store the source URL
    // The browser will resolve it consistently for the same query
    return res.url || sourceUrl;
  } catch {
    return sourceUrl;
  }
}

function ImageSection({ form, set }: {
  form: Partial<Product>;
  set: (field: keyof Product, value: unknown) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(form.image || '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-fetch when name changes (debounced 900ms)
  useEffect(() => {
    if (!form.name || form.name.length < 3) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const query = encodeURIComponent([form.name, form.category, 'food product'].filter(Boolean).join(' '));
      const url = `https://source.unsplash.com/featured/400x300?${query}`;
      setPreview(url);
      set('image', url);
      setLoading(false);
    }, 900);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.name, form.category]);

  const handleRefresh = () => {
    if (!form.name) return;
    setLoading(true);
    // Add a timestamp cache-bust so Unsplash returns a different photo
    const query = encodeURIComponent([form.name, form.category, 'food product'].filter(Boolean).join(' '));
    const url = `https://source.unsplash.com/featured/400x300?${query}&_=${Date.now()}`;
    setPreview(url);
    set('image', url);
    setLoading(false);
  };

  const handleCustomUrl = (url: string) => {
    setPreview(url);
    set('image', url || undefined);
  };

  const handleImageError = () => {
    setPreview('');
    set('image', undefined);
  };

  return (
    <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <label style={{ fontSize: 12, color: 'var(--text2)' }}>Product Image</label>
        <span style={{ fontSize: 11, color: 'var(--accent)' }}>✨ Auto-fetched from Unsplash</span>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {/* Preview */}
        <div style={{
          width: 120, height: 90, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
          background: 'var(--bg3)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
        }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
              <div style={{ fontSize: 20 }}>⏳</div>
            </div>
          )}
          {preview ? (
            <img
              src={preview}
              alt="Product"
              onError={handleImageError}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 11 }}>
              <div style={{ fontSize: 28 }}>📷</div>
              <div>Type name</div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleRefresh}
            disabled={!form.name || loading}
            style={{ fontSize: 12, justifyContent: 'center' }}
          >
            🔄 Get different image
          </button>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 3 }}>Or paste image URL</label>
            <input
              className="inp"
              style={{ fontSize: 12 }}
              placeholder="https://..."
              value={preview.startsWith('https://source.unsplash.com') ? '' : preview}
              onChange={e => handleCustomUrl(e.target.value)}
            />
          </div>
          {preview && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: 11, color: 'var(--red)', justifyContent: 'center', padding: '4px 8px' }}
              onClick={() => { setPreview(''); set('image', undefined); }}
            >
              Remove image
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Dynamic product fields per industry ──────────────────────────
type ProductMeta = Record<string, string | boolean>;

function DynamicProductFields({
  bizType,
  meta,
  setMeta,
}: {
  bizType: string;
  meta: ProductMeta;
  setMeta: (fn: (m: ProductMeta) => ProductMeta) => void;
}) {
  const str = (key: string) => (meta[key] as string) ?? '';
  const bool = (key: string) => (meta[key] as boolean) ?? false;
  const setStr = (key: string, v: string) => setMeta(m => ({ ...m, [key]: v }));
  const setBool = (key: string, v: boolean) => setMeta(m => ({ ...m, [key]: v }));

  if (bizType === 'pharmacy') {
    return (
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
        padding: '12px 14px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border)' }}>
        <div style={{ gridColumn: '1 / -1', fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 2 }}>
          💊 Pharmacy fields
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Drug Schedule</label>
          <select className="inp" value={str('drugSchedule')} onChange={e => setStr('drugSchedule', e.target.value)}>
            <option value="">— Select —</option>
            <option value="OTC">OTC (Over the Counter)</option>
            <option value="S1">Schedule 1</option>
            <option value="S2">Schedule 2</option>
            <option value="S3">Schedule 3</option>
            <option value="S4">Schedule 4 (Prescription)</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Generic Name</label>
          <input className="inp" value={str('genericName')} onChange={e => setStr('genericName', e.target.value)} placeholder="Active ingredient" />
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 13 }}>
          <input type="checkbox" checked={bool('requiresPrescription')} onChange={e => setBool('requiresPrescription', e.target.checked)} />
          Requires Prescription
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 13 }}>
          <input type="checkbox" checked={bool('coldChain')} onChange={e => setBool('coldChain', e.target.checked)} />
          Cold Chain / Refrigerated
        </label>
      </div>
    );
  }

  if (bizType === 'grocery' || bizType === 'supermarket' || bizType === 'butcher') {
    return (
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
        padding: '12px 14px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border)' }}>
        <div style={{ gridColumn: '1 / -1', fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 2 }}>
          🥦 Grocery / weight fields
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Unit of Measure</label>
          <select className="inp" value={str('uom')} onChange={e => setStr('uom', e.target.value)}>
            <option value="piece">Piece / Unit</option>
            <option value="kg">Kilogram (kg)</option>
            <option value="g">Gram (g)</option>
            <option value="lb">Pound (lb)</option>
            <option value="ltr">Litre (ltr)</option>
            <option value="ml">Millilitre (ml)</option>
            <option value="pack">Pack</option>
            <option value="box">Box</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Price per unit label</label>
          <input className="inp" value={str('pricePerUnit')} onChange={e => setStr('pricePerUnit', e.target.value)} placeholder="e.g. per kg, per 100g" />
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 13 }}>
          <input type="checkbox" checked={bool('isWeighedItem')} onChange={e => setBool('isWeighedItem', e.target.checked)} />
          Weigh at POS (variable weight)
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 13 }}>
          <input type="checkbox" checked={bool('organicCertified')} onChange={e => setBool('organicCertified', e.target.checked)} />
          Organic / Certified
        </label>
      </div>
    );
  }

  if (bizType === 'garage' || bizType === 'tyre') {
    return (
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
        padding: '12px 14px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border)' }}>
        <div style={{ gridColumn: '1 / -1', fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 2 }}>
          🔧 Garage / parts fields
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Part Number / OEM</label>
          <input className="inp" value={str('partNumber')} onChange={e => setStr('partNumber', e.target.value)} placeholder="e.g. OEM-12345" />
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Vehicle Compatibility</label>
          <input className="inp" value={str('vehicleCompat')} onChange={e => setStr('vehicleCompat', e.target.value)} placeholder="e.g. Toyota Camry 2018–2022" />
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Supplier / Brand</label>
          <input className="inp" value={str('supplier')} onChange={e => setStr('supplier', e.target.value)} placeholder="e.g. Bosch, NGK" />
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 13 }}>
          <input type="checkbox" checked={bool('warrantyAvailable')} onChange={e => setBool('warrantyAvailable', e.target.checked)} />
          Warranty available
        </label>
      </div>
    );
  }

  if (bizType === 'clinic') {
    return (
      <div style={{ gridColumn: '1 / -1', padding: '12px 14px', borderRadius: 8,
        background: 'var(--bg3)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>🏥 Clinic fields</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Service Code</label>
            <input className="inp" value={str('serviceCode')} onChange={e => setStr('serviceCode', e.target.value)} placeholder="e.g. CONS-001" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Department</label>
            <input className="inp" value={str('department')} onChange={e => setStr('department', e.target.value)} placeholder="e.g. Cardiology" />
          </div>
        </div>
      </div>
    );
  }

  if (bizType === 'salon' || bizType === 'tailor' || bizType === 'laundry') {
    return (
      <div style={{ gridColumn: '1 / -1', padding: '12px 14px', borderRadius: 8,
        background: 'var(--bg3)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>
          {bizType === 'salon' ? '💇' : bizType === 'tailor' ? '🪡' : '👕'} Service fields
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Duration (minutes)</label>
            <input className="inp" type="number" min={5} step={5} value={str('durationMin')} onChange={e => setStr('durationMin', e.target.value)} placeholder="e.g. 30" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Commission %</label>
            <input className="inp" type="number" min={0} max={100} step={1} value={str('commissionPct')} onChange={e => setStr('commissionPct', e.target.value)} placeholder="e.g. 20" />
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function ProductModal({
  product,
  onSave,
  onClose,
}: {
  product: Partial<Product> | null;
  onSave: (p: Product) => void;
  onClose: () => void;
}) {
  const { settings, db } = usePOS();
  const activeKitchens = db.kitchens.filter(k => k.active);
  // Distinct printer numbers configured across active kitchens, sorted
  const availablePrinters = [...new Set(
    activeKitchens.filter(k => k.printerNo).map(k => k.printerNo as number)
  )].sort((a, b) => a - b);
  const isNew = !product?.id;
  const [form, setForm] = useState<Partial<Product>>(product ?? { active: true, taxable: true, stock: 0, price: 0 });
  const [productMeta, setProductMeta] = useState<ProductMeta>((product?.metadata as ProductMeta) ?? {});

  const set = useCallback((field: keyof Product, value: unknown) => setForm(f => ({ ...f, [field]: value })), []);

  const autoAr = (en: string) => en;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card" style={{ width: 560, maxHeight: '92vh', overflowY: 'auto' }}>
        <h2 style={{ marginBottom: 20 }}>{isNew ? 'New product' : 'Edit product'}</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Name (English)</label>
            <input className="inp" value={form.name ?? ''} onChange={e => {
              set('name', e.target.value);
              if (!form.nameAr || form.nameAr === autoAr(form.name ?? '')) set('nameAr', autoAr(e.target.value));
            }} placeholder="Product name" autoFocus />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Arabic name <span style={{ color: 'var(--text2)' }}>(optional)</span></label>
            <input className="inp" value={form.nameAr ?? ''} onChange={e => set('nameAr', e.target.value)}
              placeholder="يُملأ تلقائياً — يمكنك تعديله" dir="rtl" />
          </div>

          {/* Auto image section */}
          <ImageSection form={form} set={set} />

          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Price ({settings.currency})</label>
            <input className="inp" type="number" min={0} step={0.01} value={form.price ?? ''} onChange={e => set('price', parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Cost <span style={{ color: 'var(--text2)' }}>(optional)</span></label>
            <input className="inp" type="number" min={0} step={0.01} value={form.cost ?? ''} onChange={e => set('cost', parseFloat(e.target.value) || undefined)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>SKU</label>
            <input className="inp" value={form.sku ?? ''} onChange={e => set('sku', e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Barcode</label>
            <input className="inp" value={form.barcode ?? ''} onChange={e => set('barcode', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Stock</label>
            <input className="inp" type="number" min={0} value={form.stock ?? 0} onChange={e => set('stock', parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Min stock (reorder point)</label>
            <input className="inp" type="number" min={0} value={form.minStock ?? ''} onChange={e => set('minStock', parseFloat(e.target.value) || undefined)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Category</label>
            <input className="inp" value={form.category ?? ''} onChange={e => set('category', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Unit</label>
            <input className="inp" value={form.unit ?? ''} onChange={e => set('unit', e.target.value)} placeholder="pcs, kg, ltr…" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          {([['taxable', 'Taxable'], ['active', 'Active'], ['isWeighed', 'By weight'], ['hasExpiry', 'Has expiry']] as const).map(([field, label]) => (
            <label key={field} style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox"
                checked={(form[field as keyof Product] as boolean) ?? (field === 'taxable' || field === 'active')}
                onChange={e => set(field as keyof Product, e.target.checked)} />
              {label}
            </label>
          ))}
        </div>

        {/* ── Dynamic industry fields ── */}
        <div style={{ marginTop: 16 }}>
          <DynamicProductFields
            bizType={settings.bizType}
            meta={productMeta}
            setMeta={setProductMeta}
          />
        </div>

        {settings.bizType === 'restaurant' && activeKitchens.length > 0 && (
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Kitchen Section (KOT routing)</label>
              <select className="inp" value={form.kitchenId ?? ''} onChange={e => set('kitchenId', e.target.value || undefined)}>
                <option value="">— Use category routing —</option>
                {activeKitchens.map(k => (
                  <option key={k.id} value={k.id}>{k.name}</option>
                ))}
              </select>
            </div>
            {availablePrinters.length > 0 && (
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>KOT Printer</label>
                <select className="inp" value={form.kotPrinter ?? ''} onChange={e => set('kotPrinter', e.target.value ? +e.target.value as 1|2|3|4 : undefined)}>
                  <option value="">— Kitchen default —</option>
                  {availablePrinters.map(n => (
                    <option key={n} value={n}>Printer {n}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => {
            if (!form.name?.trim()) return alert('Name required');
            onSave({
              id: form.id ?? uid(),
              name: form.name!, nameAr: form.nameAr, sku: form.sku, barcode: form.barcode,
              price: form.price ?? 0, cost: form.cost, category: form.category, unit: form.unit,
              stock: form.stock ?? 0, minStock: form.minStock,
              taxable: form.taxable ?? true, active: form.active ?? true,
              isWeighed: form.isWeighed, hasExpiry: form.hasExpiry,
              kitchenId: form.kitchenId, kotPrinter: form.kotPrinter, image: form.image,
              metadata: Object.keys(productMeta).length > 0 ? productMeta : undefined,
            });
          }}>
            {isNew ? 'Add product' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const { db, save, settings } = usePOS();
  const { isEnabled } = useFeature();
  const barcodeEnabled = isEnabled(FeatureKey.BARCODE_GENERATION);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Partial<Product> | null | false>(false);
  const [view, setView] = useState<'table' | 'grid'>('table');

  const products = db.products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search) || p.sku?.includes(search)
  );

  const handleSave = (p: Product) => {
    save(d => {
      const idx = d.products.findIndex(x => x.id === p.id);
      if (idx >= 0) d.products[idx] = p;
      else d.products.push(p);
    });
    setEditing(false);
  };

  const handleToggle = (id: string) => {
    save(d => { const p = d.products.find(x => x.id === id); if (p) p.active = !p.active; });
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <input className="inp" style={{ maxWidth: 320 }} placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ display: 'flex', gap: 4 }}>
          <button className={`btn ${view === 'table' ? 'btn-primary' : 'btn-ghost'}`} style={{ padding: '7px 10px' }} onClick={() => setView('table')}>≡</button>
          <button className={`btn ${view === 'grid' ? 'btn-primary' : 'btn-ghost'}`} style={{ padding: '7px 10px' }} onClick={() => setView('grid')}>⊞</button>
        </div>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setEditing({})}>+ New product</button>
      </div>

      {/* Grid view */}
      {view === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
          {products.map(p => (
            <div key={p.id} className="card" style={{ padding: 0, overflow: 'hidden', opacity: p.active ? 1 : 0.5 }}>
              <div style={{ position: 'relative', height: 130, background: 'var(--bg3)' }}>
                {p.image ? (
                  <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, color: 'var(--text2)' }}>
                    📦
                  </div>
                )}
                {!p.active && (
                  <div style={{ position: 'absolute', top: 6, right: 6, background: 'var(--red)', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 10, fontWeight: 700 }}>OFF</div>
                )}
                {p.stock <= 0 && (
                  <div style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,0.7)', color: '#ef4444', fontSize: 10, padding: '2px 6px', borderRadius: 10, fontWeight: 700 }}>OUT</div>
                )}
              </div>
              <div style={{ padding: '10px 12px' }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{p.name}</div>
                {p.category && <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>{p.category}</div>}
                <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 14, marginBottom: 8 }}>{fmtCurrency(p.price, settings.currency)}</div>
                <button className="btn btn-ghost" style={{ fontSize: 11, width: '100%', justifyContent: 'center' }} onClick={() => setEditing(p)}>Edit</button>
              </div>
            </div>
          ))}
          {products.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 60, color: 'var(--text2)' }}>
              {db.products.length === 0 ? 'No products yet — add your first product' : 'No results'}
            </div>
          )}
        </div>
      )}

      {/* Table view */}
      {view === 'table' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 56 }}></th>
                <th>Product</th>
                <th>SKU / Barcode</th>
                <th style={{ textAlign: 'right' }}>Price</th>
                <th style={{ textAlign: 'right' }}>Stock</th>
                <th>Category</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', background: 'var(--bg3)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {p.image ? (
                        <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <span style={{ fontSize: 20 }}>📦</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{p.name}</div>
                    {p.nameAr && <div style={{ fontSize: 12, color: 'var(--text2)', direction: 'rtl', textAlign: 'left' }}>{p.nameAr}</div>}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text2)' }}>
                    {p.sku && <div>{p.sku}</div>}
                    {p.barcode && <div>{p.barcode}</div>}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCurrency(p.price, settings.currency)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{ color: p.stock <= 0 ? 'var(--red)' : p.minStock && p.stock <= p.minStock ? 'var(--yellow)' : 'inherit' }}>
                      {p.stock} {p.unit ?? ''}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text2)' }}>{p.category ?? '—'}</td>
                  <td>
                    <span className={`badge ${p.active ? 'badge-green' : 'badge-red'}`}>{p.active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setEditing(p)}>Edit</button>
                      {barcodeEnabled && !p.barcode && (
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          title="Generate EAN-13 barcode"
                          onClick={() => save(d => {
                            const prod = d.products.find(x => x.id === p.id);
                            if (prod && !prod.barcode) prod.barcode = genEAN13(prod.id);
                          })}
                        >
                          📊 Barcode
                        </button>
                      )}
                      <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleToggle(p.id)}>
                        {p.active ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text2)', padding: 40 }}>
                  {db.products.length === 0 ? 'No products yet — add your first product' : 'No results'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing !== false && (
        <ProductModal product={editing} onSave={handleSave} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}
