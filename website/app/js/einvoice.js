'use strict';
/* Harbinger E-Invoicing
   KSA (ZATCA): Phase 1 QR (TLV tags 1-5, base64) on receipts + UBL 2.1 XML *draft* with ICV / PIH chain.
   UAE (FTA / Peppol PINT AE): tax-invoice data checks + UBL XML *draft* for hand-off to an Accredited Service Provider.
   NOT included (needs credentials / server-side secrets): ZATCA onboarding (CSID), XAdES signature, canonicalisation,
   clearance / reporting API calls, and ASP submission. Drafts are labelled UNSIGNED. */

const EINV_DEFAULT={region:'none',crn:'',building:'',street:'',district:'',city:'',postal:'',uaeCustId:'urn:peppol:pint:billing-1@ae-1',uaeProfile:'urn:peppol:bis:billing'};
const einv=()=>Object.assign({},EINV_DEFAULT,DB.settings.einv||{});
const utf8=s=>new TextEncoder().encode(String(s));
const b64=bytes=>{let s='';for(let i=0;i<bytes.length;i++)s+=String.fromCharCode(bytes[i]);return btoa(s)};
const sha256u=s=>sha256(unescape(encodeURIComponent(String(s))));
const hexToB64=hex=>{const a=[];for(let i=0;i<hex.length;i+=2)a.push(parseInt(hex.substr(i,2),16));return b64(a)};
const xe=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const uuid4=()=>{try{if(typeof crypto!=='undefined'&&crypto.randomUUID)return crypto.randomUUID()}catch(e){}return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16)})};

/* ---------- ZATCA QR (TLV) ---------- */
function tlv(tag,val){
  const b=utf8(val); if(b.length>255)throw new Error('QR field '+tag+' is longer than 255 bytes');
  const o=new Uint8Array(2+b.length); o[0]=tag; o[1]=b.length; o.set(b,2); return o;
}
function zatcaTs(ts){return new Date(ts).toISOString().replace(/\.\d+Z$/,'Z')}
function zatcaQrBase64(o){
  const s=DB.settings, parts=[tlv(1,s.business),tlv(2,s.trn),tlv(3,zatcaTs(o.ts)),tlv(4,Number(o.total).toFixed(2)),tlv(5,Number(o.vat).toFixed(2))];
  const n=parts.reduce((a,p)=>a+p.length,0), all=new Uint8Array(n); let i=0; parts.forEach(p=>{all.set(p,i);i+=p.length});
  return b64(all);
}
function zatcaDecode(base64){
  const bin=atob(base64), out={}, bytes=[]; for(let i=0;i<bin.length;i++)bytes.push(bin.charCodeAt(i));
  let i=0; while(i<bytes.length){const t=bytes[i],l=bytes[i+1],v=bytes.slice(i+2,i+2+l);out[t]=new TextDecoder().decode(new Uint8Array(v));i+=2+l}
  return out;
}
function qrSvg(text,opt){
  opt=opt||{}; const q=qrcode(0,opt.level||'M'); q.addData(String(text)); q.make();
  return q.createSvgTag({cellSize:opt.cell||3,margin:opt.margin!=null?opt.margin:6,scalable:true});
}
function eInvBlock(o){ // appended to every receipt
  const e=einv();
  if(e.region==='SA'){
    try{return '<div class="c small"><div>فاتورة ضريبية مبسطة</div><div>Simplified Tax Invoice</div><div class="qr" style="width:140px;margin:6px auto">'+qrSvg(zatcaQrBase64(o))+'</div></div>'}catch(x){return ''}
  }
  return '';
}

/* ---------- invoice maths shared by XML builders ---------- */
function saleBreakdown(o){
  const s=DB.settings, rate=s.vatPct/100, sub=o.subtotal;
  const taxable=o.lines.filter(l=>l.tax!==false).reduce((a,l)=>a+l.qty*l.price,0), tb=sub>0?taxable/sub:0;
  const subEx=s.taxInclusive?r2(sub-sub*tb*rate/(1+rate)):sub;
  const chT=o.chargeTotal||0, salesEx=r2(o.total-o.vat-chT), disc=Math.max(0,r2(subEx-salesEx)), exAll=r2(salesEx+chT);
  const taxableAmt=rate>0?r2(o.vat/rate):0;
  return {rate:rate,subEx:subEx,salesEx:salesEx,chT:chT,exAll:exAll,disc:disc,taxableAmt:Math.min(taxableAmt,exAll),zeroAmt:r2(exAll-Math.min(taxableAmt,exAll))};
}
const lineEx=(l)=>{const s=DB.settings,rate=s.vatPct/100;return s.taxInclusive&&l.tax!==false?l.price/(1+rate):l.price};
const payCode=o=>{const m=(o.payments[0]||{}).method;return m==='cash'?'10':m==='card'?'48':'30'};

function ublLines(o,cur,credit){
  const b=saleBreakdown(o), s=DB.settings;
  return o.lines.map((l,i)=>{
    const pex=lineEx(l), ext=r2(l.qty*pex), taxed=l.tax!==false, tax=taxed?r2(ext*b.rate):0;
    return '  <cac:InvoiceLine>\n    <cbc:ID>'+(i+1)+'</cbc:ID>\n    <cbc:'+(credit?'CreditedQuantity':'InvoicedQuantity')+' unitCode="PCE">'+l.qty+'</cbc:'+(credit?'CreditedQuantity':'InvoicedQuantity')+'>\n'+
      '    <cbc:LineExtensionAmount currencyID="'+cur+'">'+ext.toFixed(curDec())+'</cbc:LineExtensionAmount>\n'+
      '    <cac:TaxTotal><cbc:TaxAmount currencyID="'+cur+'">'+tax.toFixed(curDec())+'</cbc:TaxAmount><cbc:RoundingAmount currencyID="'+cur+'">'+r2(ext+tax).toFixed(curDec())+'</cbc:RoundingAmount></cac:TaxTotal>\n'+
      '    <cac:Item><cbc:Name>'+xe(l.name)+'</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>'+(taxed?'S':'Z')+'</cbc:ID><cbc:Percent>'+(taxed?s.vatPct:0)+'</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item>\n'+
      '    <cac:Price><cbc:PriceAmount currencyID="'+cur+'">'+pex.toFixed(4)+'</cbc:PriceAmount></cac:Price>\n  </cac:InvoiceLine>';
  }).join('\n');
}
function ublTotals(o,cur){
  const b=saleBreakdown(o), s=DB.settings;
  const sub=(b.taxableAmt>0?'<cac:TaxSubtotal><cbc:TaxableAmount currencyID="'+cur+'">'+b.taxableAmt.toFixed(curDec())+'</cbc:TaxableAmount><cbc:TaxAmount currencyID="'+cur+'">'+o.vat.toFixed(curDec())+'</cbc:TaxAmount><cac:TaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>'+s.vatPct+'</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>':'')+
    (b.zeroAmt>0.004?'<cac:TaxSubtotal><cbc:TaxableAmount currencyID="'+cur+'">'+b.zeroAmt.toFixed(curDec())+'</cbc:TaxableAmount><cbc:TaxAmount currencyID="'+cur+'">0.00</cbc:TaxAmount><cac:TaxCategory><cbc:ID>Z</cbc:ID><cbc:Percent>0</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>':'');
  const chg=(o.charges||[]).map(c=>'  <cac:AllowanceCharge><cbc:ChargeIndicator>true</cbc:ChargeIndicator><cbc:AllowanceChargeReason>'+xe(c.name)+'</cbc:AllowanceChargeReason><cbc:Amount currencyID="'+cur+'">'+c.amount.toFixed(curDec())+'</cbc:Amount><cac:TaxCategory><cbc:ID>'+(c.taxable?'S':'Z')+'</cbc:ID><cbc:Percent>'+(c.taxable?s.vatPct:0)+'</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:AllowanceCharge>\n').join('');
  return chg+(b.disc>0?'  <cac:AllowanceCharge><cbc:ChargeIndicator>false</cbc:ChargeIndicator><cbc:AllowanceChargeReason>discount</cbc:AllowanceChargeReason><cbc:Amount currencyID="'+cur+'">'+b.disc.toFixed(curDec())+'</cbc:Amount><cac:TaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>'+s.vatPct+'</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:AllowanceCharge>\n':'')+
    '  <cac:TaxTotal><cbc:TaxAmount currencyID="'+cur+'">'+o.vat.toFixed(curDec())+'</cbc:TaxAmount></cac:TaxTotal>\n  <cac:TaxTotal><cbc:TaxAmount currencyID="'+cur+'">'+o.vat.toFixed(curDec())+'</cbc:TaxAmount>'+sub+'</cac:TaxTotal>\n'+
    '  <cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="'+cur+'">'+b.subEx.toFixed(curDec())+'</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="'+cur+'">'+b.exAll.toFixed(curDec())+'</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="'+cur+'">'+o.total.toFixed(curDec())+'</cbc:TaxInclusiveAmount><cbc:ChargeTotalAmount currencyID="'+cur+'">'+b.chT.toFixed(curDec())+'</cbc:ChargeTotalAmount><cbc:AllowanceTotalAmount currencyID="'+cur+'">'+b.disc.toFixed(curDec())+'</cbc:AllowanceTotalAmount><cbc:PrepaidAmount currencyID="'+cur+'">0.00</cbc:PrepaidAmount><cbc:PayableAmount currencyID="'+cur+'">'+o.total.toFixed(curDec())+'</cbc:PayableAmount></cac:LegalMonetaryTotal>\n';
}
const NS='xmlns="urn:oasis:names:specification:ubl:schema:xsd:'+'Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"';
const NS_CN=NS.replace('Invoice-2" xmlns:cac','CreditNote-2" xmlns:cac');

/* doc = {kind:'invoice'|'credit', no, uuid, icv, pih, ts, ref (original order for credit)} */
function ublKsa(o,doc){
  const s=DB.settings,e=einv(),cur='SAR',credit=doc.kind==='credit',root=credit?'CreditNote':'Invoice';
  const d=new Date(doc.ts), date=d.toISOString().slice(0,10), time=d.toISOString().slice(11,19);
  const qr=credit?'':zatcaQrBase64(o);
  return '<?xml version="1.0" encoding="UTF-8"?>\n<!-- HARBINGER DRAFT: UNSIGNED. Not valid for ZATCA until signed (XAdES-BES), canonicalised, stamped with a CSID and cleared/reported via the FATOORA API. -->\n'+
    '<'+root+' '+(credit?NS_CN:NS)+'>\n  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>\n  <cbc:ID>'+xe(doc.no)+'</cbc:ID>\n  <cbc:UUID>'+xe(doc.uuid)+'</cbc:UUID>\n  <cbc:IssueDate>'+date+'</cbc:IssueDate>\n  <cbc:IssueTime>'+time+'</cbc:IssueTime>\n'+
    '  <cbc:'+(credit?'CreditNoteTypeCode':'InvoiceTypeCode')+' name="0200000">'+(credit?'381':'388')+'</cbc:'+(credit?'CreditNoteTypeCode':'InvoiceTypeCode')+'>\n  <cbc:DocumentCurrencyCode>'+cur+'</cbc:DocumentCurrencyCode>\n  <cbc:TaxCurrencyCode>'+cur+'</cbc:TaxCurrencyCode>\n'+
    (credit?'  <cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>'+xe(doc.ref)+'</cbc:ID></cac:InvoiceDocumentReference></cac:BillingReference>\n':'')+
    '  <cac:AdditionalDocumentReference><cbc:ID>ICV</cbc:ID><cbc:UUID>'+doc.icv+'</cbc:UUID></cac:AdditionalDocumentReference>\n'+
    '  <cac:AdditionalDocumentReference><cbc:ID>PIH</cbc:ID><cac:Attachment><cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">'+xe(doc.pih)+'</cbc:EmbeddedDocumentBinaryObject></cac:Attachment></cac:AdditionalDocumentReference>\n'+
    (qr?'  <cac:AdditionalDocumentReference><cbc:ID>QR</cbc:ID><cac:Attachment><cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">'+xe(qr)+'</cbc:EmbeddedDocumentBinaryObject></cac:Attachment></cac:AdditionalDocumentReference>\n':'')+
    '  <cac:AccountingSupplierParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="CRN">'+xe(e.crn)+'</cbc:ID></cac:PartyIdentification><cac:PostalAddress><cbc:StreetName>'+xe(e.street)+'</cbc:StreetName><cbc:BuildingNumber>'+xe(e.building)+'</cbc:BuildingNumber><cbc:CitySubdivisionName>'+xe(e.district)+'</cbc:CitySubdivisionName><cbc:CityName>'+xe(e.city)+'</cbc:CityName><cbc:PostalZone>'+xe(e.postal)+'</cbc:PostalZone><cac:Country><cbc:IdentificationCode>SA</cbc:IdentificationCode></cac:Country></cac:PostalAddress>'+
    '<cac:PartyTaxScheme><cbc:CompanyID>'+xe(s.trn)+'</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme><cac:PartyLegalEntity><cbc:RegistrationName>'+xe(s.business)+'</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty>\n'+
    '  <cac:AccountingCustomerParty><cac:Party/></cac:AccountingCustomerParty>\n  <cac:PaymentMeans><cbc:PaymentMeansCode>'+payCode(o)+'</cbc:PaymentMeansCode></cac:PaymentMeans>\n'+
    ublTotals(o,cur)+ublLines(o,cur,credit)+'\n</'+root+'>\n';
}
function ublUae(o,doc){
  const s=DB.settings,e=einv(),cur=s.currency||'AED',credit=doc.kind==='credit',root=credit?'CreditNote':'Invoice';
  const d=new Date(doc.ts), date=d.toISOString().slice(0,10);
  return '<?xml version="1.0" encoding="UTF-8"?>\n<!-- HARBINGER DRAFT for UAE e-invoicing (Peppol PINT AE style). Customisation/profile IDs, endpoint scheme and mandatory buyer data must be confirmed with your Accredited Service Provider before submission. -->\n'+
    '<'+root+' '+(credit?NS_CN:NS)+'>\n  <cbc:CustomizationID>'+xe(e.uaeCustId)+'</cbc:CustomizationID>\n  <cbc:ProfileID>'+xe(e.uaeProfile)+'</cbc:ProfileID>\n  <cbc:ID>'+xe(doc.no)+'</cbc:ID>\n  <cbc:UUID>'+xe(doc.uuid)+'</cbc:UUID>\n  <cbc:IssueDate>'+date+'</cbc:IssueDate>\n'+
    '  <cbc:'+(credit?'CreditNoteTypeCode':'InvoiceTypeCode')+'>'+(credit?'381':'380')+'</cbc:'+(credit?'CreditNoteTypeCode':'InvoiceTypeCode')+'>\n  <cbc:DocumentCurrencyCode>'+xe(cur)+'</cbc:DocumentCurrencyCode>\n'+
    (credit?'  <cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>'+xe(doc.ref)+'</cbc:ID></cac:InvoiceDocumentReference></cac:BillingReference>\n':'')+
    '  <cac:AccountingSupplierParty><cac:Party><cac:PartyName><cbc:Name>'+xe(s.business)+'</cbc:Name></cac:PartyName><cac:PostalAddress><cbc:StreetName>'+xe(e.street||s.address)+'</cbc:StreetName><cbc:CityName>'+xe(e.city)+'</cbc:CityName><cac:Country><cbc:IdentificationCode>'+(e.region==='OM'?'OM':'AE')+'</cbc:IdentificationCode></cac:Country></cac:PostalAddress>'+
    '<cac:PartyTaxScheme><cbc:CompanyID>'+xe(s.trn)+'</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme><cac:PartyLegalEntity><cbc:RegistrationName>'+xe(s.business)+'</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty>\n'+
    '  <cac:AccountingCustomerParty><cac:Party><cac:PartyName><cbc:Name>'+xe((byId(DB.customers,o.customerId)||{}).name||'Walk-in customer')+'</cbc:Name></cac:PartyName></cac:Party></cac:AccountingCustomerParty>\n  <cac:PaymentMeans><cbc:PaymentMeansCode>'+payCode(o)+'</cbc:PaymentMeansCode></cac:PaymentMeans>\n'+
    ublTotals(o,xe(cur))+ublLines(o,xe(cur),credit)+'\n</'+root+'>\n';
}

/* ---------- numbering, chain and stamping ---------- */
function ensureEinv(){
  if(!DB.einv)DB.einv={icv:0,pih:btoa(sha256('0'))};   // ZATCA seed for the first invoice: base64 of the HEX TEXT of SHA-256("0")
}
function buildXml(o,doc){return einv().region==='SA'?ublKsa(o,doc):ublUae(o,doc)}
function einvStamp(o,kind){
  const e=einv(); if(e.region!=='SA'&&e.region!=='AE'&&e.region!=='OM')return null;
  ensureEinv(); const credit=kind==='credit', key=credit?'einvCredit':'einv';
  if(o[key])return o[key];
  const seq=++DB.einv.icv, doc={kind:kind,no:(credit?'CN-':'INV-')+o.no,uuid:uuid4(),icv:seq,pih:DB.einv.pih,ts:credit&&o.refund?o.refund.ts:o.ts,ref:'INV-'+o.no};
  const xml=buildXml(o,doc), hash=hexToB64(sha256u(xml));   // indicative hash (not canonicalised)
  o[key]={region:e.region,no:doc.no,uuid:doc.uuid,icv:doc.icv,pih:doc.pih,hash:hash,ts:doc.ts,status:'draft'};
  DB.einv.pih=hash; return o[key];
}
function einvXml(o,kind){
  const k=kind==='credit'?'einvCredit':'einv', st=o[k]; if(!st)return '';
  const doc={kind:kind,no:st.no,uuid:st.uuid,icv:st.icv,pih:st.pih,ts:st.ts,ref:'INV-'+o.no};
  return buildXml(o,doc);
}
function validateTrn(region,v){
  v=String(v||'').trim();
  if(region==='SA')return /^3\d{13}3$/.test(v);        // 15 digits, starts and ends with 3
  if(region==='AE')return /^\d{15}$/.test(v);            // 15 digits
  return true;
}

/* ================= Console page ================= */
function vEinvoice(){
  const e=einv(), s=DB.settings, sa=e.region==='SA', ae=e.region==='AE';
  const checks=[];
  const chk=(ok,t)=>checks.push('<li class="'+(ok?'ok':'bad')+'">'+(ok?'✓ ':'✗ ')+esc(t)+'</li>');
  if(e.region==='none')checks.push('<li class="info">E-invoicing is switched off. Choose UAE or KSA below.</li>');
  else{
    chk(validateTrn(e.region,s.trn),(sa?'VAT registration number must be 15 digits starting and ending with 3':'TRN must be 15 digits')+' (currently '+(s.trn||'empty')+')');
    const want={SA:[15,'SAR','KSA'],AE:[5,'AED','UAE'],OM:[5,'OMR','Oman']}[e.region];
    chk(s.vatPct===want[0],want[2]+' standard VAT rate is '+want[0]+'% (Settings shows '+s.vatPct+'%)');
    if(sa)chk(!!(e.crn&&e.building&&e.street&&e.district&&e.city&&e.postal),'Seller address and commercial registration (CRN) are complete');
    chk(s.currency===want[1],'Currency should be '+want[1]+' (Settings shows '+s.currency+')');
  }
  const orders=DB.orders.filter(o=>o.einv).slice(-100).reverse();
  const guide=sa?'<p class="sm"><b>KSA status.</b> Phase 1 (generation): the receipt carries the ZATCA QR code with the five required fields. Phase 2 (integration): this app produces an <b>unsigned UBL 2.1 XML draft</b> with invoice counter (ICV) and previous-hash (PIH) chain. Still required before it is legally valid: onboarding to ZATCA (CSID), XAdES signing with your private key, canonicalisation, and clearance/reporting to the FATOORA API within the time limit — these need a secure server and ZATCA credentials, so they are done by the gateway/ASP, not in the browser.</p>':
    ae?'<p class="sm"><b>UAE status.</b> The Ministry of Finance has set a phased e-invoicing mandate based on the Peppol network and Accredited Service Providers: pilot from 1 July 2026; businesses with revenue of AED 50m or more by 1 January 2027; smaller businesses by 1 July 2027 (as reported from Ministerial Decisions 243 and 244 of 2025 — confirm with the FTA). B2C-only sales are currently outside the mandate. This app produces a <b>UBL XML draft</b> for hand-off to your ASP and checks the data a UAE tax invoice needs.</p>':'';
  return head('E-Invoicing','UAE and KSA tax-invoice compliance')+
    '<form id="einvForm" class="card narrow"><h2>Region & seller details</h2><div class="form2">'+select('E-invoicing region','region',[['none','Off'],['OM','Oman (draft, unverified)'],['AE','United Arab Emirates'],['SA','Saudi Arabia (ZATCA)']],e.region)+field('Tax registration no. (also in Settings)','trn',s.trn)+
    field('Commercial registration no. (CRN)','crn',e.crn)+field('Building number','building',e.building)+field('Street','street',e.street)+field('District','district',e.district)+field('City','city',e.city)+field('Postal code','postal',e.postal)+
    field('UAE customisation ID (confirm with ASP)','uaeCustId',e.uaeCustId)+field('UAE profile ID','uaeProfile',e.uaeProfile)+'</div><div class="bar"><button class="btn primary" type="submit">Save</button></div></form>'+
    '<section class="card narrow mt"><h2>Readiness checks</h2><ul class="brief">'+checks.join('')+'</ul>'+guide+'</section>'+
    '<section class="card mt"><h2>Invoices <span class="muted sm">numbered, hash-chained and stamped when created</span></h2>'+
    tbl([{h:'Invoice',r:r=>'<b>'+esc(r.einv.no)+'</b><br><span class="muted sm">ICV '+r.einv.icv+'</span>'},{h:'Date',r:r=>fmtDT(r.ts)},{h:'Total',cls:'r',r:r=>fmt(r.total)},{h:'VAT',cls:'r',r:r=>fmt(r.vat)},
      {h:'Status',r:r=>badge(r.einv.status==='draft'?'Draft (unsigned)':r.einv.status,'warn')+(r.einvCredit?' '+badge('Credit note','bad'):'')},
      {h:'',cls:'r',r:r=>(r.einv.region==='SA'?btn('QR','einv-qr',r.id)+' ':'')+btn('XML','einv-xml',r.id)+(r.einvCredit?' '+btn('Credit XML','einv-xml',r.id+'|credit'):'')}],orders,'No stamped invoices yet. Switch a region on and make a sale.')+'</section>';
}
function bindEinvoice(){
  const f=$('#einvForm'); if(!f)return;
  f.addEventListener('submit',ev=>{ev.preventDefault();const d=formData(f);
    DB.settings.trn=d.trn.trim();
    DB.settings.einv={region:d.region,crn:d.crn.trim(),building:d.building.trim(),street:d.street.trim(),district:d.district.trim(),city:d.city.trim(),postal:d.postal.trim(),uaeCustId:d.uaeCustId.trim(),uaeProfile:d.uaeProfile.trim()};
    if(d.region==='SA'&&DB.settings.currency==='AED')toast('Reminder: set currency to SAR and VAT to 15% in Settings for KSA','err');
    audit('einvoice.settings',d.region);save();toast('Saved');render();});
}
A['einv-qr']=d=>{
  const o=byId(DB.orders,d.id), t=zatcaQrBase64(o), dec=zatcaDecode(t);
  modal({title:'ZATCA QR — '+o.no,body:'<div style="width:220px;margin:0 auto">'+qrSvg(t)+'</div><p class="sm muted" style="word-break:break-all">'+esc(t)+'</p>'+
    tbl([{h:'Tag',r:r=>r[0]},{h:'Field',r:r=>esc(r[1])},{h:'Value',r:r=>esc(r[2])}],[[1,'Seller name',dec[1]],[2,'VAT registration',dec[2]],[3,'Timestamp (UTC)',dec[3]],[4,'Total incl. VAT',dec[4]],[5,'VAT amount',dec[5]]]),actions:[{label:'Close'}]});
};
A['einv-xml']=d=>{
  const p=d.id.split('|'), o=byId(DB.orders,p[0]), kind=p[1]==='credit'?'credit':'invoice', xml=einvXml(o,kind);
  if(!xml){toast('No e-invoice stamped for this order','err');return}
  const b=new Blob([xml],{type:'application/xml;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=(kind==='credit'?'credit-note-':'invoice-')+o.no+'.xml';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
};
