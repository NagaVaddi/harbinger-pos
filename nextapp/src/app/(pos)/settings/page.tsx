'use client';
import { useState, useTransition } from 'react';
import { usePOS } from '@/lib/context';
import { Settings, BizType, BusinessHoursDay } from '@/lib/types';
import { installTemplate, TemplateId, applyCountryDefaults } from '@/app/actions/templates';
import { updateSettings, updateBusinessHours } from '@/app/actions/settings';
import { COUNTRY_LIST } from '@/lib/locales';

// ── Business Hours helpers ───────────────────────────────────────
const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const defaultHours = (): BusinessHoursDay[] =>
  WEEK_DAYS.map(day => ({ day, enabled: true, open: '08:00', close: '22:00' }));

// ── Business type dropdown ───────────────────────────────────────
const BIZ_TYPES: { value: BizType; label: string }[] = [
  { value: 'retail',      label: 'Retail' },
  { value: 'supermarket', label: 'Supermarket' },
  { value: 'grocery',     label: 'Grocery' },
  { value: 'restaurant',  label: 'Restaurant / Café' },
  { value: 'pharmacy',    label: 'Pharmacy' },
  { value: 'clinic',      label: 'Clinic' },
  { value: 'salon',       label: 'Salon / Spa' },
  { value: 'tailor',      label: 'Tailor / Alteration' },
  { value: 'butcher',     label: 'Butcher' },
  { value: 'garage',      label: 'Garage / Auto workshop' },
  { value: 'tyre',        label: 'Tyre shop' },
  { value: 'wholesale',   label: 'Wholesale / B2B' },
  { value: 'logistics',   label: 'Logistics / Delivery' },
  { value: 'laundry',     label: 'Laundry / Services' },
];

// ── Industry template cards ──────────────────────────────────────
const TEMPLATES: {
  id: TemplateId; label: string; icon: string; desc: string;
  color: string; badge?: string; features: string[];
}[] = [
  {
    id: 'restaurant', label: 'Restaurant / Café', icon: '🍔', color: '#f97316',
    features: ['Tables & KOT', 'Kitchen routing', 'Menu categories'],
    desc: 'Tables, KOT printing, kitchen routing, menu categories',
  },
  {
    id: 'grocery', label: 'Grocery / Supermarket', icon: '🛒', color: '#0ea5e9',
    features: ['Barcode scanning', 'Weighted items', 'Loyalty points'],
    desc: 'Barcode scanning, shelf categories, weigh-scale UI',
  },
  {
    id: 'pharmacy', label: 'Pharmacy', icon: '💊', color: '#10b981',
    features: ['Rx tracking', 'Batch & expiry', 'Drug schedule fields'],
    desc: 'Prescription tracking, e-invoicing, expiry management',
  },
  {
    id: 'clinic', label: 'Clinic / Medical', icon: '🏥', color: '#06b6d4',
    features: ['Appointments', 'HCM module', 'Patient file fields'],
    desc: 'Doctor & patient management, appointment scheduling',
  },
  {
    id: 'garage', label: 'Garage / Workshop', icon: '🔧', color: '#6366f1',
    features: ['Job cards', 'Vehicle registry', 'Plate & VIN fields'],
    desc: 'Job cards, vehicle tracking, service categories',
  },
  {
    id: 'tyre', label: 'Tyre Shop', icon: '🚗', color: '#8b5cf6',
    features: ['Tyre sizing', 'Vehicle registry', 'Alignment & balancing'],
    desc: 'Tyre sizing, vehicle registry, balancing & alignment',
  },
  {
    id: 'salon', label: 'Salon / Spa', icon: '💇', color: '#ec4899',
    features: ['Staff commission', 'Appointments', 'Stylist fields'],
    desc: 'Service categories, appointments, staff commissions',
  },
  {
    id: 'tailor', label: 'Tailor / Alteration', icon: '🪡', color: '#f59e0b',
    features: ['Job tracking', 'Measurement fields', 'Ready date'],
    desc: 'Custom garment jobs, measurement records, ready dates',
  },
  {
    id: 'laundry', label: 'Laundry / Services', icon: '👕', color: '#64748b',
    badge: 'New',
    features: ['Pickup/dropoff', 'Garment tagging', 'Delivery scheduling'],
    desc: 'Pickup & dropoff scheduling, garment tagging, delivery',
  },
  {
    id: 'butcher', label: 'Butcher / Meat', icon: '🥩', color: '#dc2626',
    features: ['Weighted barcodes', 'Cut type fields', 'Per-kg pricing'],
    desc: 'Weighted barcodes, cut types, per-kg pricing',
  },
  {
    id: 'wholesale', label: 'Wholesale / B2B', icon: '📦', color: '#0284c7',
    badge: 'Pro',
    features: ['Credit limits', 'Bulk pricing', 'Purchase orders'],
    desc: 'Bulk pricing, credit limits, multi-warehouse',
  },
  {
    id: 'logistics', label: 'Logistics / Delivery', icon: '🚚', color: '#16a34a',
    badge: 'Pro',
    features: ['Driver app', 'Route fields', 'COD tracking'],
    desc: 'Driver assignments, route optimization, COD management',
  },
  {
    id: 'ecommerce', label: 'E-Commerce / Online', icon: '🌐', color: '#7c3aed',
    badge: 'New',
    features: ['Warehouse sync', 'Online payments', 'Delivery dispatch'],
    desc: 'Delivery dispatch, warehouse sync, online payment',
  },
];

const CURRENCIES = ['AED', 'SAR', 'QAR', 'BHD', 'OMR', 'KWD', 'USD', 'EUR', 'GBP', 'INR', 'EGP'];
const LANGUAGES  = [
  { value: 'en',   label: 'English' },
  { value: 'ar',   label: 'Arabic' },
  { value: 'both', label: 'Bilingual' },
];
const THEMES = [
  { value: 'blue',   label: 'Ocean Blue' },
  { value: 'green',  label: 'Emerald' },
  { value: 'purple', label: 'Violet' },
  { value: 'dark',   label: 'Dark' },
];
const SIZES = [
  { value: 'compact', label: 'Compact' },
  { value: 'normal',  label: 'Normal' },
  { value: 'large',   label: 'Large' },
];

interface ExtSettings extends Settings {
  dialCode?: string;
  taxInclusive?: boolean;
  serviceCharge?: number;
  minTicketMargin?: number;
  maxDiscountPct?: number;
  loyaltyEnabled?: boolean;
  loyaltyRate?: number;
  receiptFooter?: string;
  receiptLang?: string;
  brandTheme?: string;
  displaySize?: string;
  country?: string;
}

export default function SettingsPage() {
  const { db, save } = usePOS();
  const [form, setForm] = useState<ExtSettings>({ ...db.settings });
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [loadingTpl, setLoadingTpl] = useState<TemplateId | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>('AE');
  const [applyingCountry, setApplyingCountry] = useState(false);

  // Business hours state
  const [hours, setHours] = useState<BusinessHoursDay[]>(
    db.settings.businessHours?.length ? db.settings.businessHours : defaultHours()
  );
  const [autoClose, setAutoClose] = useState<boolean>(db.settings.autoCloseShift ?? false);
  const [savingHours, setSavingHours] = useState(false);

  const set = <K extends keyof ExtSettings>(k: K, v: ExtSettings[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setToast(null);
  };

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSave = () => {
    startTransition(async () => {
      save(d => { d.settings = { ...d.settings, ...form }; return d; });
      try {
        await updateSettings({
          business:       form.business,
          address:        form.address,
          trn:            form.trn,
          country:        form.country,
          dialCode:       form.dialCode,
          currency:       form.currency,
          bizType:        form.bizType,
          allowNegative:  form.allowNegative,
          taxRate:        form.taxRate,
          taxLabel:       form.taxLabel,
          taxInclusive:   form.taxInclusive,
          serviceCharge:  form.serviceCharge,
          roundCash:      form.roundCash,
          maxDiscountPct: form.maxDiscountPct,
          loyaltyEnabled: form.loyaltyEnabled,
          loyaltyRate:    form.loyaltyRate,
          receiptFooter:  form.receiptFooter,
          receiptLang:    form.receiptLang,
          brandTheme:     form.brandTheme,
          displaySize:    form.displaySize,
        });
        showToast('Settings saved');
      } catch {
        showToast('Saved locally (DB unavailable)', true);
      }
    });
  };

  const handleInstall = (tplId: TemplateId) => {
    setLoadingTpl(tplId);
    startTransition(async () => {
      try {
        const res = await installTemplate(tplId);
        if (res.ok) {
          set('bizType', tplId as unknown as BizType);
          save(d => { d.settings.bizType = tplId as unknown as BizType; return d; });
          showToast(`✓ ${TEMPLATES.find(t => t.id === tplId)?.label ?? tplId} template installed`);
        } else {
          showToast(res.message, false);
        }
      } catch {
        set('bizType', tplId as unknown as BizType);
        save(d => { d.settings.bizType = tplId as unknown as BizType; return d; });
        showToast(`${tplId} type set (local mode)`, true);
      } finally {
        setLoadingTpl(null);
      }
    });
  };

  const handleApplyCountry = async () => {
    setApplyingCountry(true);
    try {
      const res = await applyCountryDefaults(selectedCountry);
      if (res.ok) {
        const d = res.defaults;
        setForm(f => ({
          ...f,
          country:    selectedCountry,
          currency:   d.currency,
          taxRate:    d.taxRate,
          taxLabel:   d.taxLabel,
          dialCode:   d.dialCode,
          receiptLang: d.receiptLang,
        }));
        save(st => {
          st.settings.currency = d.currency;
          st.settings.taxRate  = d.taxRate;
          return st;
        });
        const cfg = COUNTRY_LIST.find(c => c.code === selectedCountry);
        showToast(`✓ ${cfg?.label ?? selectedCountry} defaults applied`);
      }
    } catch {
      // fallback: apply locally from the static config
      const cfg = COUNTRY_LIST.find(c => c.code === selectedCountry);
      if (cfg) {
        setForm(f => ({
          ...f, country: selectedCountry,
          currency: cfg.currency, taxRate: cfg.taxRate,
          taxLabel: cfg.taxLabel, dialCode: cfg.dialCode,
          receiptLang: cfg.receiptLang,
        }));
        showToast(`${cfg.label} defaults applied (local mode)`, true);
      }
    } finally {
      setApplyingCountry(false);
    }
  };

  const handleSaveHours = async () => {
    setSavingHours(true);
    // Persist to local store immediately
    save(d => {
      d.settings.businessHours = hours;
      d.settings.autoCloseShift = autoClose;
      return d;
    });
    try {
      await updateBusinessHours(hours, autoClose);
      showToast('Business hours saved');
    } catch {
      showToast('Saved locally (DB unavailable)', true);
    } finally {
      setSavingHours(false);
    }
  };

  const setDayField = (idx: number, field: keyof BusinessHoursDay, value: string | boolean) => {
    setHours(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  };

  const Field = ({ label, children, span }: { label: string; children: React.ReactNode; span?: boolean }) => (
    <div style={span ? { gridColumn: '1 / -1' } : {}}>
      <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );

  const Toggle = ({ label, desc, value, onChange }: {
    label: string; desc?: string; value: boolean; onChange: (v: boolean) => void;
  }) => (
    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
      <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} style={{ marginTop: 3, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{desc}</div>}
      </div>
    </label>
  );

  return (
    <div style={{ maxWidth: 1120 }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.ok ? 'var(--green)' : 'var(--red)',
          color: '#fff', padding: '10px 18px', borderRadius: 8,
          fontSize: 13, fontWeight: 500, boxShadow: '0 4px 16px rgba(0,0,0,.2)',
          animation: 'fadeInDown .2s ease',
        }}>{toast.msg}</div>
      )}

      {/* ── Two-column: Industry Templates + Business Hours ───── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 360px',
        gap: 20,
        marginBottom: 24,
        alignItems: 'start',
      }}>
        {/* Left: Industry Templates */}
        <div className="card">
          <h2 style={{ marginBottom: 6 }}>Industry templates</h2>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
            Load a preset that configures categories, feature flags, and custom fields for your business type.
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 10,
          }}>
            {TEMPLATES.map(tpl => {
              const active = form.bizType === tpl.id;
              return (
                <div key={tpl.id} style={{
                  border: `1.5px solid ${active ? tpl.color : 'var(--border)'}`,
                  borderRadius: 10, padding: '12px 12px 10px',
                  background: active ? `${tpl.color}18` : 'var(--bg2)',
                  transition: 'all .15s',
                  position: 'relative',
                }}>
                  {tpl.badge && (
                    <span style={{
                      position: 'absolute', top: 8, right: 8,
                      background: tpl.badge === 'Pro' ? '#f59e0b' : '#6366f1',
                      color: '#fff', fontSize: 9, fontWeight: 700,
                      padding: '2px 5px', borderRadius: 4, letterSpacing: '0.5px',
                    }}>{tpl.badge}</span>
                  )}
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{tpl.icon}</div>
                  <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>{tpl.label}</div>
                  <ul style={{ margin: '0 0 10px', paddingLeft: 14, listStyle: 'disc' }}>
                    {tpl.features.map(f => (
                      <li key={f} style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.6 }}>{f}</li>
                    ))}
                  </ul>
                  <button
                    className="btn"
                    disabled={loadingTpl === tpl.id || isPending}
                    onClick={() => handleInstall(tpl.id)}
                    style={{
                      width: '100%', justifyContent: 'center', fontSize: 11, padding: '5px 0',
                      background: active ? tpl.color : 'var(--bg3)',
                      color: active ? '#fff' : 'var(--text)',
                      opacity: loadingTpl === tpl.id ? .6 : 1,
                    }}
                  >
                    {loadingTpl === tpl.id ? 'Installing…' : active ? '✓ Active' : 'Load template'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Business Hours */}
        <div className="card" style={{ position: 'sticky', top: 24 }}>
          <h2 style={{ marginBottom: 4, fontSize: 15 }}>Operating Hours & Shift Control</h2>
          <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 16 }}>
            Set daily hours. The system can auto-prompt shift close at closing time.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {hours.map((day, idx) => (
              <div key={day.day} style={{
                display: 'grid',
                gridTemplateColumns: '90px 1fr 1fr',
                gap: 8,
                alignItems: 'center',
                padding: '6px 8px',
                borderRadius: 8,
                background: day.enabled ? 'var(--bg3)' : 'transparent',
                opacity: day.enabled ? 1 : 0.5,
              }}>
                {/* Day toggle */}
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={day.enabled}
                    onChange={e => setDayField(idx, 'enabled', e.target.checked)}
                  />
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{day.day.slice(0, 3)}</span>
                </label>
                {/* Open time */}
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 2 }}>Open</div>
                  <input
                    className="inp"
                    type="time"
                    value={day.open}
                    disabled={!day.enabled}
                    onChange={e => setDayField(idx, 'open', e.target.value)}
                    style={{ padding: '4px 6px', fontSize: 12 }}
                  />
                </div>
                {/* Close time */}
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 2 }}>
                    Close {day.close < day.open ? <span style={{ color: 'var(--accent)', fontSize: 9 }}>+1d</span> : ''}
                  </div>
                  <input
                    className="inp"
                    type="time"
                    value={day.close}
                    disabled={!day.enabled}
                    onChange={e => setDayField(idx, 'close', e.target.value)}
                    style={{ padding: '4px 6px', fontSize: 12 }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer', marginBottom: 14 }}>
              <input
                type="checkbox"
                checked={autoClose}
                onChange={e => setAutoClose(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Auto-prompt shift close at closing time</div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
                  Locks the POS with a Z-report when business hours end
                </div>
              </div>
            </label>
            <button
              className="btn btn-primary"
              onClick={handleSaveHours}
              disabled={savingHours}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {savingHours ? 'Saving…' : '💾 Save Business Hours'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Country / Region Defaults ─────────────────────────── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 6 }}>Country & region defaults</h2>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
          Instantly apply currency, VAT rate, dial code, and e-invoicing defaults for your region.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Select country</label>
            <select
              className="inp"
              value={selectedCountry}
              onChange={e => setSelectedCountry(e.target.value)}
            >
              {COUNTRY_LIST.map(c => (
                <option key={c.code} value={c.code}>{c.flag} {c.label}</option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-primary"
            disabled={applyingCountry}
            onClick={handleApplyCountry}
            style={{ flexShrink: 0, fontSize: 13, padding: '8px 16px' }}
          >
            {applyingCountry ? 'Applying…' : 'Apply country defaults'}
          </button>
        </div>
        {/* Preview strip */}
        {(() => {
          const cfg = COUNTRY_LIST.find(c => c.code === selectedCountry);
          if (!cfg) return null;
          return (
            <div style={{
              marginTop: 12, padding: '10px 14px', borderRadius: 8,
              background: 'var(--bg2)', fontSize: 12, color: 'var(--text2)',
              display: 'flex', gap: 16, flexWrap: 'wrap',
            }}>
              <span>💰 {cfg.currency}</span>
              <span>📊 {cfg.taxRate}% {cfg.taxLabel}</span>
              <span>📞 {cfg.dialCode}</span>
              <span>🕐 {cfg.timezone}</span>
              {cfg.eInvoicingEnabled && (
                <span style={{ color: 'var(--green)', fontWeight: 600 }}>
                  📄 {cfg.eInvoicingStandard} e-invoicing
                </span>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── Business Details ──────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginBottom: 20 }}>Business details</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Business name" span>
            <input className="inp" value={form.business} onChange={e => set('business', e.target.value)} />
          </Field>
          <Field label="Address" span>
            <input className="inp" value={form.address ?? ''} onChange={e => set('address', e.target.value)} />
          </Field>
          <Field label="Tax Registration Number (TRN)">
            <input className="inp" value={form.trn ?? ''} onChange={e => set('trn', e.target.value)} />
          </Field>
          <Field label="Country dialing code">
            <select className="inp" value={form.dialCode ?? '+971'} onChange={e => set('dialCode', e.target.value)}>
              {COUNTRY_LIST.filter(c => c.code !== 'GLOBAL' && c.code !== 'EU').map(c => (
                <option key={c.code} value={c.dialCode}>{c.flag} {c.dialCode} ({c.label})</option>
              ))}
            </select>
          </Field>
          <Field label="Currency">
            <select className="inp" value={form.currency} onChange={e => set('currency', e.target.value)}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Business type">
            <select className="inp" value={form.bizType} onChange={e => set('bizType', e.target.value as BizType)}>
              {BIZ_TYPES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </Field>
        </div>
      </div>

      {/* ── Tax & Pricing ─────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginBottom: 20 }}>Tax & pricing</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Tax rate (%)">
            <input className="inp" type="number" min={0} max={100} step={0.5}
              value={form.taxRate} onChange={e => set('taxRate', parseFloat(e.target.value) || 0)} />
          </Field>
          <Field label="Tax label (e.g. VAT, GST)">
            <input className="inp" value={form.taxLabel} onChange={e => set('taxLabel', e.target.value)} />
          </Field>
          <Field label="Service charge (%)">
            <input className="inp" type="number" min={0} max={100} step={0.5}
              value={form.serviceCharge ?? 0} onChange={e => set('serviceCharge', parseFloat(e.target.value) || 0)} />
          </Field>
          <Field label="Min ticket margin (%)">
            <input className="inp" type="number" min={0} max={100} step={1} placeholder="e.g. 20"
              value={form.minTicketMargin ?? ''} onChange={e => set('minTicketMargin' as keyof ExtSettings, parseFloat(e.target.value) || undefined as any)} />
          </Field>
          <Field label="Max discount (%)">
            <input className="inp" type="number" min={0} max={100} step={1}
              value={(form as any).maxDiscountPct ?? 100} onChange={e => set('maxDiscountPct', parseFloat(e.target.value) || 100)} />
          </Field>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          <Toggle label="Tax inclusive pricing" desc="Prices displayed include tax"
            value={form.taxInclusive ?? false} onChange={v => set('taxInclusive', v)} />
          <Toggle label="Allow invoicing below stock" desc="POS can sell when stock is zero"
            value={form.allowNegative} onChange={v => set('allowNegative', v)} />
          <Toggle label="Round cash totals" desc="Round to nearest 0.25"
            value={form.roundCash} onChange={v => set('roundCash', v)} />
        </div>
      </div>

      {/* ── Loyalty ───────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginBottom: 16 }}>Loyalty points</h2>
        <Toggle label="Enable loyalty points" desc="Earn points per transaction"
          value={form.loyaltyEnabled ?? false} onChange={v => set('loyaltyEnabled', v)} />
        {form.loyaltyEnabled && (
          <div style={{ marginTop: 14 }}>
            <Field label={`Points per ${form.currency} spent`}>
              <input className="inp" style={{ maxWidth: 160 }} type="number" min={0.1} step={0.1}
                value={form.loyaltyRate ?? 1} onChange={e => set('loyaltyRate', parseFloat(e.target.value) || 1)} />
            </Field>
          </div>
        )}
      </div>

      {/* ── Receipt & Display ─────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginBottom: 20 }}>Receipt & display</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Receipt language">
            <select className="inp" value={form.receiptLang ?? 'en'} onChange={e => set('receiptLang', e.target.value)}>
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </Field>
          <Field label="Brand theme">
            <select className="inp" value={form.brandTheme ?? 'blue'} onChange={e => set('brandTheme', e.target.value)}>
              {THEMES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Display size">
            <select className="inp" value={form.displaySize ?? 'normal'} onChange={e => set('displaySize', e.target.value)}>
              {SIZES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Receipt footer text" span>
            <input className="inp" placeholder="Thank you for your visit!"
              value={form.receiptFooter ?? ''} onChange={e => set('receiptFooter', e.target.value)} />
          </Field>
        </div>
      </div>

      {/* ── Dynamic POS fields notice ─────────────────────────── */}
      {['garage', 'tyre', 'pharmacy', 'grocery', 'butcher', 'laundry', 'clinic', 'salon', 'tailor'].includes(form.bizType) && (
        <div style={{
          marginBottom: 20, padding: '12px 16px', borderRadius: 10,
          background: 'var(--blue-bg, #eff6ff)', border: '1px solid #bfdbfe',
          fontSize: 13, color: '#1e40af',
        }}>
          <strong>Dynamic POS fields active</strong> — the New Item and New Order modals will show{' '}
          {form.bizType === 'garage' || form.bizType === 'tyre'
            ? 'Vehicle Details (Plate, VIN, Mileage)'
            : form.bizType === 'pharmacy'
            ? 'Batch Number, Expiry Date, and Rx fields'
            : form.bizType === 'grocery' || form.bizType === 'butcher'
            ? 'Weight (kg) input and barcode fields'
            : form.bizType === 'clinic'
            ? 'Doctor ID, Patient File, Appointment Date'
            : form.bizType === 'salon'
            ? 'Stylist, Hair Type, Next Appointment'
            : form.bizType === 'laundry'
            ? 'Garment Tag, Pickup Date, Delivery Date'
            : 'Measurement and Ready Date fields'}{' '}
          for this business type.
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving…' : 'Save settings'}
        </button>
        <a href="/settings/audit" className="btn" style={{ textDecoration: 'none' }}>
          🔍 Audit log
        </a>
        <button className="btn" onClick={async () => {
          try {
            const { exportTenantData } = await import('@/app/actions/settings');
            const data = await exportTenantData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `harbinger-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
          } catch {
            alert('Backup requires DATABASE_URL to be configured.');
          }
        }}>
          💾 Download backup
        </button>
      </div>
    </div>
  );
}
