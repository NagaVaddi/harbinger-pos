'use client';
import { useState, useTransition } from 'react';
import { usePOS } from '@/lib/context';
import { useFeature } from '@/components/providers/FeatureProvider';
import { FeatureKey } from '@/lib/types';
import { fmtCurrency, fmtDateTime } from '@/lib/fmt';

type PeppolStatus = 'PENDING' | 'SENT' | 'FAILED' | undefined;

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pending',   color: '#f59e0b' },
  SENT:    { label: 'Sent',      color: '#10b981' },
  FAILED:  { label: 'Failed',    color: '#ef4444' },
};

function XmlModal({ xml, onClose }: { xml: string; onClose: () => void }) {
  const copy = () => { navigator.clipboard.writeText(xml).catch(() => {}); };
  const download = () => {
    const blob = new Blob([xml], { type: 'application/xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'peppol-invoice.xml';
    a.click();
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card" style={{ width: '90vw', maxWidth: 800, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 8 }}>
          <h2 style={{ flex: 1 }}>UBL 2.1 XML (Peppol)</h2>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={copy}>Copy</button>
          <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={download}>Download</button>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={onClose}>Close</button>
        </div>
        <pre style={{
          flex: 1, overflowY: 'auto', background: 'var(--bg3)', borderRadius: 8, padding: 16,
          fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          border: '1px solid var(--border)',
        }}>{xml}</pre>
      </div>
    </div>
  );
}

export default function EInvoicingPage() {
  const { db, settings } = usePOS();
  const { isEnabled } = useFeature();
  const eInvEnabled = isEnabled(FeatureKey.E_INVOICING);

  const [xmlView, setXmlView] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  if (!eInvEnabled) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 80, color: 'var(--text2)' }}>
        <div style={{ fontSize: 40 }}>🧾</div>
        <h2>E-Invoicing is not enabled</h2>
        <p style={{ fontSize: 14 }}>Enable the <strong>E-Invoicing</strong> feature in Settings → Features to use Peppol submission.</p>
      </div>
    );
  }

  const paidOrders = db.orders.filter(o => o.status === 'paid');

  const handleGenerate = (orderId: string) => {
    setSending(orderId);
    startTransition(async () => {
      try {
        const { generatePeppolPayload } = await import('@/app/actions/einvoicing');
        const { xml } = await generatePeppolPayload(orderId);
        setSentIds(prev => new Set([...prev, orderId]));
        setXmlView(xml);
      } catch {
        // DB unavailable — generate client-side preview XML
        const order = db.orders.find(o => o.id === orderId);
        if (!order) return;
        const invoiceId = `INV-${orderId.slice(0, 8).toUpperCase()}`;
        const xml = generateLocalXml(order, settings, invoiceId);
        setXmlView(xml);
      } finally {
        setSending(null);
      }
    });
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>E-Invoicing (Peppol / UBL 2.1)</h1>
        <p style={{ color: 'var(--text2)', fontSize: 14 }}>Generate and submit invoices in PEPPOL BIS Billing 3.0 format for completed orders.</p>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Paid orders', value: paidOrders.length },
          { label: 'Submitted', value: sentIds.size },
          { label: 'Pending', value: paidOrders.length - sentIds.size },
        ].map(s => (
          <div key={s.label} className="card" style={{ flex: 1, minWidth: 120, padding: '14px 18px' }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {paidOrders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--text2)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <div>No completed orders yet. Paid orders will appear here for Peppol submission.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Date</th>
                <th>Customer</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paidOrders.map(o => {
                const isSent = sentIds.has(o.id);
                const st = isSent ? STATUS_LABEL.SENT : STATUS_LABEL.PENDING;
                const customer = db.customers.find(c => c.id === o.customerId);
                return (
                  <tr key={o.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{o.id.slice(0, 12)}…</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtDateTime(o.ts)}</td>
                    <td style={{ color: 'var(--text2)' }}>{customer?.name ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCurrency(o.total, settings.currency)}</td>
                    <td>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600,
                        background: `${st.color}20`, color: st.color,
                      }}>{st.label}</span>
                    </td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: 12, padding: '4px 10px', opacity: sending === o.id ? 0.6 : 1 }}
                        disabled={sending === o.id}
                        onClick={() => handleGenerate(o.id)}
                      >
                        {sending === o.id ? '…' : isSent ? 'Re-send' : 'Send to Peppol'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {xmlView && <XmlModal xml={xmlView} onClose={() => setXmlView(null)} />}
    </div>
  );
}

// Client-side fallback XML generation (demo mode, no DB)
function generateLocalXml(order: any, settings: any, invoiceId: string): string {
  const issueDate = new Date(order.ts).toISOString().slice(0, 10);
  const currency = settings.currency ?? 'AED';
  const taxRate = settings.taxRate ?? 5;
  const subtotal = order.lines?.reduce((s: number, l: any) => s + (l.unitPrice ?? l.price ?? 0) * l.qty, 0) ?? order.total;
  const taxAmt = (subtotal * taxRate / 100).toFixed(2);

  const linesXml = (order.lines ?? []).map((l: any, i: number) => `
  <cac:InvoiceLine>
    <cbc:ID>${i + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="EA">${l.qty}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${currency}">${((l.unitPrice ?? l.price ?? 0) * l.qty).toFixed(2)}</cbc:LineExtensionAmount>
    <cac:Item><cbc:Name>${l.productName ?? l.name ?? 'Item'}</cbc:Name></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="${currency}">${(l.unitPrice ?? l.price ?? 0).toFixed(2)}</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:ID>${invoiceId}</cbc:ID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${settings.business ?? 'Harbinger'}</cbc:Name></cac:PartyName>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>Walk-in Customer</cbc:Name></cac:PartyName>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${currency}">${taxAmt}</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${currency}">${subtotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount currencyID="${currency}">${order.total.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${currency}">${order.total.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${linesXml}
</Invoice>`;
}
