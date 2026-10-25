const fs=require('fs');
const dir=require('path').join(__dirname,'..','website','app','js')+'/';
global.localStorage={_d:{},getItem(k){return this._d[k]||null},setItem(k,v){this._d[k]=v}};global.sessionStorage=global.localStorage;
global.document={addEventListener(){},querySelector(){return null},querySelectorAll(){return[]}};
global.window={addEventListener(){},open(){}};global.location={hash:'',protocol:'file:',origin:'null'};global.matchMedia=()=>({matches:false});global.render=()=>{};
const jsQR=require('jsqr');
const {DOMParser}=require('@xmldom/xmldom');
const srcFiles=['vendor/qrcode','core','ui','regions','business','vertical','console','accounts','einvoice','insights','online','register'];
const src=srcFiles.map(f=>fs.readFileSync(dir+f+'.js','utf8').replace(/^'use strict';/,'')).join('\n');
const names='load,A,R,computeTotals,finalizeOrder,balMap,LID,zatcaQrBase64,zatcaDecode,qrSvg,einvStamp,einvXml,validateTrn,vEinvoice,vOnline,vInbox,vApps,vQrCodes,vOnlineSetup,menuSnapshot,receiptHtml,resolveItem,postAggrSettlement,newOnlineCount,onKdsChange,sessionStats,hexToB64,sha256,qrcode,eInvBlock,briefing,setK,kdsTickets'.split(',');
const run=new Function(src+';modal=function(){return null};toast=function(){};return {'+names.join(',')+',get DB(){return DB},setME(u){ME=u}};');
const m=run();m.load();const DB=m.DB;m.setME(DB.users[0]);
let pass=0,fail=0;const ok=(l,c,x)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+l+(x?' — '+x:''))};
const bal=()=>{const b=m.balMap(null);let s=0;Object.values(b).forEach(x=>s+=x.close);return Math.round(s*100)/100};

// ---- QR round trip with an independent decoder ----
function decodeQr(text){
  const q=m.qrcode(0,'M');q.addData(text);q.make();const n=q.getModuleCount(),cell=6,quiet=4,size=(n+quiet*2)*cell,px=new Uint8ClampedArray(size*size*4).fill(255);
  for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(q.isDark(r,c))for(let y=0;y<cell;y++)for(let x=0;x<cell;x++){const i=(((r+quiet)*cell+y)*size+(c+quiet)*cell+x)*4;px[i]=px[i+1]=px[i+2]=0}
  const res=jsQR(px,size,size);return res&&res.data;
}
DB.settings.business='Café Harbinger — مقهى';DB.settings.trn='300000000000003';DB.settings.vatPct=15;DB.settings.currency='SAR';
DB.settings.einv={region:'SA',crn:'1010000000',building:'1234',street:'King Fahd Rd',district:'Olaya',city:'Riyadh',postal:'12211'};
const fakeOrder={ts:Date.UTC(2026,9,25,12,30,45),total:115,vat:15};
const b64=m.zatcaQrBase64(fakeOrder);const dec=m.zatcaDecode(b64);
ok('TLV tags decode (name keeps Arabic UTF-8)',dec[1]===DB.settings.business&&dec[2]==='300000000000003'&&dec[3]==='2026-10-25T12:30:45Z'&&dec[4]==='115.00'&&dec[5]==='15.00',JSON.stringify(dec));
ok('QR image decodes back to the same base64 (independent decoder)',decodeQr(b64)===b64);
ok('KSA VAT number validation',m.validateTrn('SA','300000000000003')&&!m.validateTrn('SA','100000000000001')&&!m.validateTrn('SA','3000'));
ok('UAE TRN validation',m.validateTrn('AE','100000000000003')&&!m.validateTrn('AE','12345'));
const svg=m.qrSvg(b64);ok('QR svg produced',svg.startsWith('<svg')&&svg.includes('viewBox'));

// ---- sale -> stamped e-invoice, UBL XML well-formed ----
const sess={id:'s1',counterId:'k1',openedBy:DB.users[0].id,openedAt:Date.now(),float:0,closedAt:null};DB.sessions.push(sess);
const mk=(items,pays)=>{const S={cart:items.map((x,i)=>({key:'k'+i+Math.random(),itemId:DB.items[x[0]].id,qty:x[1],note:x[2]||''})),customerId:null,code:null,manual:null,redeem:0,type:'takeaway',table:''};const T=m.computeTotals(S);return m.finalizeOrder(S,sess,pays||[{method:'cash',amount:T.total,tendered:T.total}],0)};
const o1=mk([[0,2,'no <onion> & "extra"'],[6,1]]);
ok('order has e-invoice stamp (ICV 1)',o1.einv&&o1.einv.icv===1&&o1.einv.status==='draft');
ok('first invoice PIH is the ZATCA seed (base64 of hex text of SHA-256("0"))',o1.einv.pih==='NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==');
const o2=mk([[3,1]]);ok('second invoice chains: ICV 2, PIH = previous hash',o2.einv.icv===2&&o2.einv.pih===o1.einv.hash);
const xml=m.einvXml(o1,'invoice');
const errs=[];const doc=new DOMParser({onError:(lvl,msg)=>errs.push(msg)}).parseFromString(xml,'text/xml');
ok('KSA invoice XML is well-formed',errs.length===0&&doc.documentElement.nodeName==='Invoice',errs.join('; '));
ok('XML escapes special characters from item notes/names',!/<onion>/.test(xml)&&xml.includes('Classic Burger'));
const tag=(t)=>{const e=doc.getElementsByTagName(t);return e.length?e[0].textContent:null};
ok('XML totals match order',Math.abs(parseFloat(doc.getElementsByTagName('cbc:PayableAmount')[0].textContent)-o1.total)<0.005&&tag('cbc:DocumentCurrencyCode')==='SAR'&&tag('cbc:InvoiceTypeCode')==='388');
ok('XML QR reference equals receipt QR',xml.includes(m.zatcaQrBase64(o1)));
ok('receipt carries QR + bilingual title for KSA',m.receiptHtml(o1).includes('فاتورة ضريبية مبسطة')&&m.receiptHtml(o1).includes('<svg'));
// credit note on refund
o1.status='refunded';o1.refund={ts:Date.now(),reason:'x'};const cn=m.einvStamp(o1,'credit');
const cxml=m.einvXml(o1,'credit');const e2=[];const cdoc=new DOMParser({onError:(l,msg)=>e2.push(msg)}).parseFromString(cxml,'text/xml');
ok('credit note XML well-formed, type 381, references invoice',e2.length===0&&cdoc.documentElement.nodeName==='CreditNote'&&cxml.includes('>381<')&&cxml.includes('INV-'+o1.no));
// UAE draft
DB.settings.einv.region='AE';DB.settings.currency='AED';DB.settings.vatPct=5;const o3=mk([[1,1]]);
const uxml=m.einvXml(o3,'invoice');const e3=[];new DOMParser({onError:(l,msg)=>e3.push(msg)}).parseFromString(uxml,'text/xml');
ok('UAE UBL draft well-formed with customization id',e3.length===0&&uxml.includes('urn:peppol:pint:billing-1@ae-1')&&uxml.includes('>380<'));
ok('UAE receipt has no ZATCA QR image',!m.receiptHtml(o3).includes('<svg'));
ok('e-invoice page renders',m.vEinvoice().includes('Readiness checks'));
DB.settings.einv.region='none';const o4=mk([[2,1]]);ok('no stamp when region is off',!o4.einv);

// ---- online order -> POS order (storefront, cash on delivery) ----
const stamp=Date.now();
DB.online.push({id:'ON-1',track:'ABC123',ts:stamp,channel:'storefront',source:'web',type:'delivery',table:'',customer:{name:'Sara <script>',phone:'0501112222',address:'Marina 5'},
  lines:[{itemId:DB.items[0].id,name:'Classic Burger',qty:2,price:24,note:'well done'}],note:'',deliveryFee:5,total:53,payment:'cod',status:'new',orderId:null,dirty:false,history:[{ts:stamp,status:'new'}]});
const before=m.balMap(null)[m.LID('cod')].close, stockBefore=DB.lots.filter(l=>l.itemId===DB.items[0].id).reduce((a,l)=>a+l.qty,0);
m.A['on-accept']({id:'ON-1'});const r1=DB.online.find(x=>x.id==='ON-1'),po1=DB.orders.find(o=>o.id===r1.orderId);
ok('accepting creates a POS order with delivery fee line',po1&&po1.lines.some(l=>l.name==='Delivery fee'&&l.price===5)&&Math.abs(po1.total-53)<0.01,po1&&String(po1.total));
ok('online order is in kitchen queue',po1.kds&&po1.kds.status==='new'&&po1.type==='delivery');
ok('stock deducted',DB.lots.filter(l=>l.itemId===DB.items[0].id).reduce((a,l)=>a+l.qty,0)===stockBefore-2);
ok('guest created from phone',DB.customers.some(c=>c.phone==='0501112222'));
ok('COD receivable debited',Math.abs(m.balMap(null)[m.LID('cod')].close-before-53)<0.01);
ok('books balance after online order',bal()===0,String(bal()));
ok('delivery-fee item is hidden from the register grid',DB.items.find(i=>i.sku==='DELIVERY').active===false);
m.A['on-settle']({id:'ON-1'});
// settle uses modal (stubbed) -> simulate the action body directly
const o=po1;o.settlement={ts:Date.now(),method:'cash'};
// kitchen status flows back to online record
m.onKdsChange(po1,'preparing');ok('kitchen status updates online order',r1.status==='preparing'&&r1.dirty===true);
m.A['on-set']({id:'ON-1|ready'});m.A['on-set']({id:'ON-1|out'});m.A['on-set']({id:'ON-1|delivered'});ok('status progression to delivered',r1.status==='delivered'&&po1.kds.status==='done');

// ---- delivery app order with unmapped items ----
DB.online.push({id:'AG-1',track:'#98765',ts:Date.now(),channel:'talabat',source:'aggregator',type:'delivery',table:'',customer:{name:'Ali',phone:'0500000001',address:'JLT'},
  lines:[{ext:{id:'P-77',name:'Chkn Wrap (Talabat)'},name:'Chkn Wrap (Talabat)',qty:2,price:20,note:''}],note:'',deliveryFee:0,total:40,payment:'prepaid',status:'new',orderId:null,dirty:false,history:[{ts:Date.now(),status:'new'}]});
const ordersBefore=DB.orders.length;m.A['on-accept']({id:'AG-1'});
ok('unmapped app item blocks accept (opens mapping)',DB.orders.length===ordersBefore&&DB.online.find(x=>x.id==='AG-1').status==='new');
DB.itemMap['talabat:P-77']=DB.items[3].id; m.A['on-accept']({id:'AG-1'});
const ag=DB.online.find(x=>x.id==='AG-1'),ao=DB.orders.find(x=>x.id===ag.orderId);
ok('after mapping, order accepted at the app price',ao&&ao.lines[0].price===20&&ao.payments[0].method==='aggregator'&&Math.abs(ao.total-40)<0.01,ao&&JSON.stringify(ao.payments));
const recv=m.balMap(null)[m.LID('aggr')].close;ok('Aggregator Receivable debited by sale',Math.abs(recv-40)<0.01,String(recv));
ok('books balance after app order',bal()===0);
// payout with 20% commission + VAT on commission
const v=m.postAggrSettlement('Talabat',40,8,0.4);
const b2=m.balMap(null);ok('payout clears receivable',Math.abs(b2[m.LID('aggr')].close)<0.005);
ok('bank receives gross - commission - VAT',Math.abs(b2[m.LID('bank')].close-31.6)<0.005,String(b2[m.LID('bank')].close));
ok('commission expense recorded',Math.abs(b2[m.LID('commission')].close-8)<0.005);
ok('books balance after payout',bal()===0);
// mapping resolution helpers
ok('resolveItem by saved mapping',m.resolveItem({channel:'talabat'},{ext:{id:'P-77'},name:'zzz'}).id===DB.items[3].id);
ok('resolveItem by exact name',m.resolveItem({channel:'x'},{name:'classic burger'}).id===DB.items[0].id);
// views
ok('online pages render',m.vOnline('inbox').includes('Accept')||m.vOnline('inbox').length>100);
ok('apps page renders with receivable',m.vApps().includes('Owed by delivery apps'));
ok('QR codes page renders',m.vQrCodes().includes('Table T1'));
ok('setup page renders',m.vOnlineSetup().includes('Gateway'));
const snap=m.menuSnapshot();ok('menu snapshot hides cost and the delivery item',!JSON.stringify(snap).includes('"cost"')&&!snap.items.some(i=>i.name==='Delivery fee'));
const hostile={id:'ON-X',track:'T',ts:Date.now(),channel:'storefront',source:'web',type:'pickup',table:'',customer:{name:'<img src=x onerror=alert(1)>',phone:'1',address:'<b>'},lines:[{itemId:DB.items[0].id,name:'<svg onload=1>',qty:1,price:1}],total:1,payment:'cod',status:'new',orderId:null,history:[{ts:Date.now(),status:'new'}]};
DB.online.push(hostile);const html=m.vInbox();ok('hostile storefront data cannot inject HTML in inbox',!/<img src=x|<svg onload|<b>(?!\w)/.test(html.replace(/<b>[^<]*<\/b>/g,'')) && html.includes('&lt;img'));
ok('new online count',m.newOnlineCount()>=1);
console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);
