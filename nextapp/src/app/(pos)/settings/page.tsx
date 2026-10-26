'use client';
import { useState } from 'react';
import { usePOS } from '@/lib/context';
import { Settings, BizType } from '@/lib/types';

const BIZ_TYPES: { value: BizType; label: string }[] = [
  { value: 'retail', label: 'Retail' },
  { value: 'supermarket', label: 'Supermarket' },
  { value: 'grocery', label: 'Grocery' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'salon', label: 'Salon' },
  { value: 'tailor', label: 'Tailor' },
  { value: 'butcher', label: 'Butcher' },
  { value: 'garage', label: 'Garage' },
  { value: 'tyre', label: 'Tyre shop' },
];

export default function SettingsPage() {
  const { db, save } = usePOS();
  const [form, setForm] = useState<Settings>({ ...db.settings });
  const [saved, setSaved] = useState(false);

  const set = (k: keyof Settings, v: unknown) => { setForm(f => ({ ...f, [k]: v })); setSaved(false); };

  const handleSave = () => {
    save(d => { d.settings = { ...form }; return d; });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="card">
        <h2 style={{ marginBottom: 20 }}>Business details</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Business name">
              <input className="inp" value={form.business} onChange={e => set('business', e.target.value)} />
            </Field>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Address">
              <input className="inp" value={form.address ?? ''} onChange={e => set('address', e.target.value)} />
            </Field>
          </div>
          <Field label="Tax Registration Number (TRN)">
            <input className="inp" value={form.trn ?? ''} onChange={e => set('trn', e.target.value)} />
          </Field>
          <Field label="Currency">
            <input className="inp" value={form.currency} onChange={e => set('currency', e.target.value)} />
          </Field>
          <Field label="Business type">
            <select className="inp" value={form.bizType} onChange={e => set('bizType', e.target.value as BizType)}>
              {BIZ_TYPES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </Field>
          <Field label={`Tax rate (%)`}>
            <input className="inp" type="number" min={0} max={100} step={0.5} value={form.taxRate} onChange={e => set('taxRate', parseFloat(e.target.value) || 0)} />
          </Field>
          <Field label="Tax label (e.g. VAT, GST)">
            <input className="inp" value={form.taxLabel} onChange={e => set('taxLabel', e.target.value)} />
          </Field>
        </div>

        <h2 style={{ margin: '28px 0 16px' }}>POS options</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { key: 'allowNegative' as keyof Settings, label: 'Allow invoicing when stock is zero or short' },
            { key: 'roundCash' as keyof Settings, label: 'Round cash totals to nearest 0.25' },
          ].map(opt => (
            <label key={opt.key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!form[opt.key]} onChange={e => set(opt.key, e.target.checked)} style={{ marginTop: 2 }} />
              <span style={{ fontSize: 13 }}>{opt.label}</span>
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 28, alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={handleSave}>Save settings</button>
          {saved && <span style={{ color: 'var(--green)', fontSize: 13 }}>✓ Saved</span>}
        </div>
      </div>
    </div>
  );
}
