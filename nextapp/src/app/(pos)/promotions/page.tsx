'use client';
import { useState } from 'react';
import { usePOS } from '@/lib/context';
import { fmtCurrency, uid, now } from '@/lib/fmt';

type Tab = 'offers' | 'promocodes';
type DiscountType = 'percentage' | 'fixed' | 'bogo' | 'combo';

interface Offer {
  id: string;
  title: string;
  product: string;
  discountType: DiscountType;
  discountValue: number;
  validFrom: string;
  validUntil: string;
  status: 'active' | 'inactive' | 'expired';
  createdAt: string;
}

interface PromoCode {
  id: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minOrder: number;
  maxUses: number;
  usedCount: number;
  validFrom: string;
  validUntil: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

const TYPE_LABELS: Record<DiscountType, string> = {
  percentage: '% off',
  fixed: 'Fixed off',
  bogo: 'Buy 1 Get 1',
  combo: 'Combo deal',
};

export default function PromotionsPage() {
  const { db, settings, save } = usePOS();
  const cur = settings.currency;
  const fmt = (v: number) => fmtCurrency(v, cur);

  const [tab, setTab] = useState<Tab>('offers');
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [showCodeForm, setShowCodeForm] = useState(false);
  const [editOfferId, setEditOfferId] = useState<string | null>(null);
  const [editCodeId, setEditCodeId] = useState<string | null>(null);

  const [offerForm, setOfferForm] = useState<Partial<Offer>>({ title: '', product: '', discountType: 'percentage', discountValue: 0, validFrom: new Date().toISOString().slice(0, 10), validUntil: '', status: 'active' });
  const [codeForm, setCodeForm] = useState<Partial<PromoCode>>({ code: '', discountType: 'percentage', discountValue: 0, minOrder: 0, maxUses: 0, validFrom: new Date().toISOString().slice(0, 10), validUntil: '', status: 'active' });

  const offers = db.offers ?? [];
  const promoCodes = db.promoCodes ?? [];

  const saveOffer = () => {
    if (!offerForm.title?.trim()) return alert('Title required');
    if (editOfferId) {
      save((d: any) => {
        const o = (d.offers ?? []).find((x: any) => x.id === editOfferId);
        if (o) Object.assign(o, offerForm);
        return d;
      });
    } else {
      save((d: any) => {
        d.offers = [...(d.offers ?? []), { id: uid(), ...offerForm, usedCount: 0, createdAt: now() }];
        return d;
      });
    }
    setShowOfferForm(false);
    setEditOfferId(null);
  };

  const saveCode = () => {
    if (!codeForm.code?.trim()) return alert('Code required');
    if (editCodeId) {
      save((d: any) => {
        const c = (d.promoCodes ?? []).find((x: any) => x.id === editCodeId);
        if (c) Object.assign(c, codeForm);
        return d;
      });
    } else {
      save((d: any) => {
        d.promoCodes = [...(d.promoCodes ?? []), { id: uid(), ...codeForm, usedCount: 0, createdAt: now() }];
        return d;
      });
    }
    setShowCodeForm(false);
    setEditCodeId(null);
  };

  const toggleOfferStatus = (id: string) => {
    save((d: any) => {
      const o = (d.offers ?? []).find((x: any) => x.id === id);
      if (o) o.status = o.status === 'active' ? 'inactive' : 'active';
      return d;
    });
  };

  const deleteOffer = (id: string) => {
    if (!confirm('Delete this offer?')) return;
    save((d: any) => { d.offers = (d.offers ?? []).filter((x: any) => x.id !== id); return d; });
  };

  const deleteCode = (id: string) => {
    if (!confirm('Delete this promo code?')) return;
    save((d: any) => { d.promoCodes = (d.promoCodes ?? []).filter((x: any) => x.id !== id); return d; });
  };

  const OfferFormFields = () => (
    <div style={{ display: 'grid', gap: 12 }}>
      {[
        { label: 'Title *', key: 'title', type: 'text', placeholder: 'e.g. Weekend Special' },
        { label: 'Product / Category', key: 'product', type: 'text', placeholder: 'Leave blank for all products' },
        { label: 'Discount value', key: 'discountValue', type: 'number', placeholder: '0' },
        { label: 'Valid from', key: 'validFrom', type: 'date' },
        { label: 'Valid until', key: 'validUntil', type: 'date' },
      ].map(f => (
        <div key={f.key}>
          <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{f.label}</label>
          <input className="inp" type={f.type} value={(offerForm as any)[f.key] ?? ''} onChange={e => setOfferForm(p => ({ ...p, [f.key]: f.type === 'number' ? parseFloat(e.target.value) : e.target.value }))} placeholder={f.placeholder} />
        </div>
      ))}
      <div>
        <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Discount type</label>
        <select className="inp" value={offerForm.discountType} onChange={e => setOfferForm(p => ({ ...p, discountType: e.target.value as DiscountType }))}>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
    </div>
  );

  const CodeFormFields = () => (
    <div style={{ display: 'grid', gap: 12 }}>
      {[
        { label: 'Promo code *', key: 'code', type: 'text', placeholder: 'e.g. SAVE20' },
        { label: 'Discount value', key: 'discountValue', type: 'number', placeholder: '0' },
        { label: 'Min order amount', key: 'minOrder', type: 'number', placeholder: '0' },
        { label: 'Max uses (0 = unlimited)', key: 'maxUses', type: 'number', placeholder: '0' },
        { label: 'Valid from', key: 'validFrom', type: 'date' },
        { label: 'Valid until', key: 'validUntil', type: 'date' },
      ].map(f => (
        <div key={f.key}>
          <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{f.label}</label>
          <input className="inp" type={f.type} value={(codeForm as any)[f.key] ?? ''} onChange={e => setCodeForm(p => ({ ...p, [f.key]: f.type === 'number' ? parseFloat(e.target.value) : e.target.value }))} placeholder={f.placeholder} />
        </div>
      ))}
      <div>
        <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Discount type</label>
        <select className="inp" value={codeForm.discountType} onChange={e => setCodeForm(p => ({ ...p, discountType: e.target.value as DiscountType }))}>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
    </div>
  );

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Promotions</h1>
      <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 16 }}>Manage offers, discounts and promo codes</p>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {[{ id: 'offers', label: 'Offers' }, { id: 'promocodes', label: 'Promo codes' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as Tab)} style={{
            padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 700 : 400,
            background: 'transparent', color: tab === t.id ? 'var(--accent)' : 'var(--text2)',
            borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── OFFERS ────────────────────────────────────────────────── */}
      {tab === 'offers' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => { setOfferForm({ title: '', product: '', discountType: 'percentage', discountValue: 0, validFrom: new Date().toISOString().slice(0, 10), validUntil: '', status: 'active' }); setEditOfferId(null); setShowOfferForm(true); }}>+ Add offer</button>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="tbl">
              <thead><tr><th>Title</th><th>Product</th><th>Discount</th><th>Valid from</th><th>Valid until</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {offers.map(o => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600 }}>{o.title}</td>
                    <td style={{ color: 'var(--text2)', fontSize: 13 }}>{o.product || 'All products'}</td>
                    <td style={{ fontWeight: 500 }}>
                      {o.discountType === 'percentage' ? `${o.discountValue}%` : o.discountType === 'fixed' ? fmt(o.discountValue) : TYPE_LABELS[o.discountType]}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{o.validFrom}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{o.validUntil || '—'}</td>
                    <td><span className={`badge badge-${o.status === 'active' ? 'green' : 'red'}`} style={{ textTransform: 'capitalize' }}>{o.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn" style={{ fontSize: 12, padding: '3px 10px' }} onClick={() => { setOfferForm({ ...o }); setEditOfferId(o.id); setShowOfferForm(true); }}>Edit</button>
                        <button className="btn" style={{ fontSize: 12, padding: '3px 10px' }} onClick={() => toggleOfferStatus(o.id)}>{o.status === 'active' ? 'Pause' : 'Activate'}</button>
                        <button className="btn" style={{ fontSize: 12, padding: '3px 10px', color: 'var(--red)', borderColor: 'var(--red)' }} onClick={() => deleteOffer(o.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {offers.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text2)', padding: 40 }}>No offers yet. Create one to start promoting.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PROMO CODES ───────────────────────────────────────────── */}
      {tab === 'promocodes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => { setCodeForm({ code: '', discountType: 'percentage', discountValue: 0, minOrder: 0, maxUses: 0, validFrom: new Date().toISOString().slice(0, 10), validUntil: '', status: 'active' }); setEditCodeId(null); setShowCodeForm(true); }}>+ Add promo code</button>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="tbl">
              <thead><tr><th>Code</th><th>Discount</th><th>Min order</th><th>Uses</th><th>Valid until</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {promoCodes.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>{c.code}</td>
                    <td>
                      {c.discountType === 'percentage' ? `${c.discountValue}%` : c.discountType === 'fixed' ? fmt(c.discountValue) : TYPE_LABELS[c.discountType]}
                    </td>
                    <td style={{ color: 'var(--text2)', fontSize: 13 }}>{c.minOrder > 0 ? fmt(c.minOrder) : '—'}</td>
                    <td style={{ fontSize: 13 }}>{c.usedCount ?? 0} {c.maxUses > 0 ? `/ ${c.maxUses}` : ''}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{c.validUntil || '—'}</td>
                    <td><span className={`badge badge-${c.status === 'active' ? 'green' : 'red'}`} style={{ textTransform: 'capitalize' }}>{c.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn" style={{ fontSize: 12, padding: '3px 10px' }} onClick={() => { setCodeForm({ ...c }); setEditCodeId(c.id); setShowCodeForm(true); }}>Edit</button>
                        <button className="btn" style={{ fontSize: 12, padding: '3px 10px', color: 'var(--red)', borderColor: 'var(--red)' }} onClick={() => deleteCode(c.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {promoCodes.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text2)', padding: 40 }}>No promo codes yet. Create one to offer discounts.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Offer form modal */}
      {showOfferForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={e => e.target === e.currentTarget && setShowOfferForm(false)}>
          <div className="card" style={{ width: 440, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontWeight: 700, marginBottom: 16 }}>{editOfferId ? 'Edit offer' : 'Add offer'}</h3>
            <OfferFormFields />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn" onClick={() => setShowOfferForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveOffer}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Promo code form modal */}
      {showCodeForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={e => e.target === e.currentTarget && setShowCodeForm(false)}>
          <div className="card" style={{ width: 440, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontWeight: 700, marginBottom: 16 }}>{editCodeId ? 'Edit promo code' : 'Add promo code'}</h3>
            <CodeFormFields />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn" onClick={() => setShowCodeForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveCode}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
