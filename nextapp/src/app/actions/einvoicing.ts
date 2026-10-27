'use server';

import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth';
import { checkFeature } from '@/lib/guards';

async function guardEInvoicing() {
  const ctx = await getAuthContext();
  const flags = await prisma.tenantFeatureFlag.findMany({ where: { tenantId: ctx.tenantId }, select: { key: true, enabled: true } });
  const flagMap = Object.fromEntries(flags.map(f => [f.key, f.enabled]));
  const g = checkFeature(flagMap, 'e_invoicing');
  if (!g.ok) throw new Error(g.message);
  return ctx;
}

export async function generatePeppolPayload(orderId: string): Promise<{ xml: string; invoiceId: string }> {
  const ctx = await guardEInvoicing();

  const order = await (prisma.order.findFirst as any)({
    where: { id: orderId, tenantId: ctx.tenantId },
    include: {
      items: true,
      customer: true,
      tenant: { include: { settings: true, invoiceSettings: true } },
    },
  }) as any;
  if (!order) throw new Error('Order not found');

  const s = order.tenant?.settings;
  const inv = order.tenant?.invoiceSettings;
  const invoiceId = `INV-${order.id.slice(0, 8).toUpperCase()}`;
  const issueDate = new Date(order.createdAt).toISOString().slice(0, 10);
  const dueDate = issueDate; // immediate payment for POS

  const linesXml = (order.items as any[]).map((l: any, i: number) => `
    <cac:InvoiceLine>
      <cbc:ID>${i + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="EA">${l.qty}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${s?.currency ?? 'AED'}">${(l.unitPrice * l.qty).toFixed(2)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Name>${escXml(l.productName ?? 'Item')}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>S</cbc:ID>
          <cbc:Percent>${s?.taxRate ?? 5}</cbc:Percent>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${s?.currency ?? 'AED'}">${l.unitPrice.toFixed(2)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`).join('');

  const subtotal = (order.items as any[]).reduce((sum: number, l: any) => sum + (l.price ?? 0) * l.qty, 0);
  const taxAmt = (subtotal * ((s?.taxRate ?? 5) / 100)).toFixed(2);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:ID>${invoiceId}</cbc:ID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:DueDate>${dueDate}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${s?.currency ?? 'AED'}</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>${s?.currency ?? 'AED'}</cbc:TaxCurrencyCode>
  <cbc:BuyerReference>${order.customer?.name ?? 'Walk-in'}</cbc:BuyerReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:EndpointID schemeID="0088">${inv?.peppolId ?? ''}</cbc:EndpointID>
      <cac:PartyName><cbc:Name>${escXml(s?.business ?? order.tenant.name)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${escXml(s?.address ?? '')}</cbc:StreetName>
        <cac:Country><cbc:IdentificationCode>${s?.country ?? 'AE'}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escXml(s?.trn ?? '')}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${escXml(order.customer?.name ?? 'Walk-in Customer')}</cbc:Name></cac:PartyName>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${s?.currency ?? 'AED'}">${taxAmt}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${s?.currency ?? 'AED'}">${subtotal.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${s?.currency ?? 'AED'}">${taxAmt}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${s?.taxRate ?? 5}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${s?.currency ?? 'AED'}">${subtotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${s?.currency ?? 'AED'}">${subtotal.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${s?.currency ?? 'AED'}">${order.total.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${s?.currency ?? 'AED'}">${order.total.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${linesXml}
</Invoice>`;

  // Mark order as sent in DB
  await prisma.order.update({
    where: { id: orderId },
    data: { peppolStatus: 'SENT' } as any,
  });

  return { xml, invoiceId };
}

export async function getEInvoicingOrders() {
  const ctx = await guardEInvoicing();
  return prisma.order.findMany({
    where: { tenantId: ctx.tenantId, status: 'paid' },
    include: { customer: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
