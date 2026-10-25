'use strict';
const fs=require('fs'), path=require('path');
const dir=path.join(__dirname,'..','website','app','js')+'/';
global.localStorage={_d:{},getItem(k){return this._d[k]||null},setItem(k,v){this._d[k]=v}};global.sessionStorage=global.localStorage;
global.document={addEventListener(){},querySelector(){return null},querySelectorAll(){return[]},documentElement:{setAttribute(k,v){this[k]=v}}};
global.window={addEventListener(){},open(){}};global.location={hash:'',protocol:'file:',origin:'null'};global.matchMedia=()=>({matches:false});global.render=()=>{};
const files=['vendor/qrcode','core','ui','regions','business','vertical','business_trades','trades','slips','partners','reports_hub','stock_config','console','accounts','einvoice','insights','dashboard','online','register'];
const src=files.map(f=>fs.readFileSync(dir+f+'.js','utf8').replace(/^'use strict';/,'')).join('\n');
const names='load,A,R,regReset,computeTotals,finalizeOrder,balMap,LID,switchBusinessType,BIZ,bizType,bm,biz,tr,typeLabel,rolesForType,roleLabel,ROLE_SETS,PERMS,can,parseScan,pushLine,tilesHtml,sellableOf,stockOf,rq,vDashboard,vSettings,vReports,vAccounts,vTeam,itemForm,guestForm,genDemoData,logRx,vRxRegister,vProviderReport,providerRevenue,insurerLedger,vClaims,claimsOutstanding,expiryBuckets,applyCountry,stockLeft,postVoucher,postStockRevaluation,bizBriefing,briefing,buildCatalog,sessionStats'.split(',');
const run=new Function(src+';modal=function(){return null};toast=function(){};return {'+names.join(',')+',get DB(){return DB},setME(u){ME=u}};');
const m=run();m.load();
let pass=0,fail=0;const ok=(l,c,x)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+l+(x?' — '+x:''))};
const bal=()=>{const b=m.balMap(null);let s=0;Object.values(b).forEach(x=>s+=x.close);return Math.round(s*1000)/1000};
const openSession=()=>{const DB=m.DB;const s={id:'s'+Math.random(),counterId:DB.counters[0].id,openedBy:DB.users[0].id,openedAt:Date.now(),float:100,closedAt:null};DB.sessions.push(s);return s};
const sale=(sess,lines,opt)=>{opt=opt||{};const S={cart:lines.map((l,i)=>Object.assign({key:'k'+i+Math.random(),note:''},l)),customerId:opt.cust||null,code:null,manual:null,redeem:0,type:opt.type||'takeaway',table:''};const T=m.computeTotals(S);
  return m.finalizeOrder(S,sess,opt.pays||[{method:'cash',amount:T.total,tendered:T.total}],0)};

const TYPES=['restaurant','supermarket','retail','pharmacy','clinic','salon'];
ok('six business types exist with names, modules and dashboard layouts',TYPES.every(t=>m.BIZ[t]&&m.BIZ[t].name&&m.BIZ[t].dash.length>=5&&m.BIZ[t].types.length>=2));
ok('every dashboard panel referenced by a layout is implemented',(()=>{const w=['brief','trend','heat','mixCh','mixPay','mixCat','dept','top','leaders','recent','ops','money','basket','fastslow','expiry','stockout','catmargin','sellthru','rxsplit','providers','payer','svcmix'];return TYPES.every(t=>m.BIZ[t].dash.every(r=>r.every(id=>w.indexOf(id)>=0)))})());

// ---- roles by type ----
ok('each type only offers its own staff roles',m.ROLE_SETS.pharmacy.includes('pharmacist')&&!m.ROLE_SETS.pharmacy.includes('waiter')&&m.ROLE_SETS.restaurant.includes('waiter')&&m.ROLE_SETS.restaurant.includes('kitchen')&&!m.ROLE_SETS.supermarket.includes('kitchen')&&m.ROLE_SETS.clinic.includes('billing')&&!m.ROLE_SETS.salon.includes('stock_keeper'));
ok('new roles have permissions: store keeper = stock only, waiter cannot refund, pharmacist can approve controlled drugs',(()=>{const P=m.PERMS;return P.stock_keeper.join()==='stock'&&!P.waiter.includes('refund')&&P.pharmacist.includes('controlled')&&P.manager.includes('controlled')&&!P.cashier.includes('controlled')&&P.billing.includes('register')})());

const results={};
for(const t of TYPES){
  m.switchBusinessType(t); const DB=m.DB; m.setME(DB.users[0]); const B=m.BIZ[t];
  ok('['+t+'] switching loads the sample catalogue and keeps logins',m.bizType()===t&&DB.items.length>=15&&DB.users.length>=3&&DB.categories.length>=5,DB.items.length+' items');
  ok('['+t+'] opening books balance and stock ledger equals inventory',bal()===0&&Math.abs(m.balMap(null)[m.LID('stock')].close-DB.lots.reduce((a,l)=>a+l.qty*l.cost,0))<0.01);
  ok('['+t+'] every item has a price, category and barcode',DB.items.every(i=>i.price>=0&&DB.categories.some(c=>c.id===i.categoryId)&&i.barcode));
  const emptyDash=m.vDashboard();ok('['+t+'] empty dashboard renders with the right sample offer',emptyDash.includes('No sales yet')&&emptyDash.includes(B.name));
  const made=m.genDemoData(10);ok('['+t+'] sample data generated ('+made+' sales)',made>40);
  {const inv=DB.lots.reduce((a,l)=>a+l.qty*l.cost,0),led=m.balMap(null)[m.LID('stock')].close;ok('['+t+'] books balance; stock ledger within 0.2% of inventory (fractional-quantity rounding)',bal()===0&&Math.abs(inv-led)<=Math.max(0.05,inv*0.002),'diff '+(inv-led).toFixed(3)+' of '+inv.toFixed(0));
  if(Math.abs(inv-led)>=0.01){m.postStockRevaluation();const led2=m.balMap(null)[m.LID('stock')].close;ok('['+t+'] stock valuation adjustment makes the ledger exactly equal the inventory and books still balance',Math.abs(inv-led2)<0.006&&bal()===0)}}
  const vatL=-m.balMap(null)[m.LID('vat_out')].close, vatO=DB.orders.filter(o=>o.status==='completed').reduce((a,o)=>a+o.vat,0);ok('['+t+'] tax ledger equals order tax',Math.abs(vatL-vatO)<0.1);
  ['today','7d','30d'].forEach(r=>{m.UIS||0});
  let html='';try{html=m.vDashboard()}catch(e){ok('['+t+'] dashboard renders',false,e.message)}
  ok('['+t+'] dashboard renders with data, no NaN/undefined',html.length>5000&&!/NaN|undefined|Infinity/.test(html),String(html.length));
  results[t]={html:html,DB:DB};
  ok('['+t+'] settings shows the business-type switcher',m.vSettings().includes('Business type')&&m.vSettings().includes(B.name));
  ok('['+t+'] team page lists only this type\'s roles',(()=>{const r=m.rolesForType();return r.every(x=>m.ROLE_SETS[t].includes(x))&&m.vTeam().length>100})());
}

// ---- terminology ----
m.switchBusinessType('clinic');ok('clinic wording: Patients / Outpatient / Bills / Billing',m.tr('Guests')==='Patients'&&m.tr('Takeaway')==='Outpatient'&&m.tr('Orders')==='Bills'&&m.tr('Harbinger Register')==='Harbinger Billing');
m.switchBusinessType('supermarket');ok('supermarket wording: Customers / In-store / Inventory',m.tr('Guests')==='Customers'&&m.tr('Takeaway')==='In-store'&&m.tr('Stock Room')==='Inventory');
m.switchBusinessType('salon');ok('salon wording: Clients / Walk-in / Appointment',m.tr('Guests')==='Clients'&&m.tr('Takeaway')==='Walk-in'&&m.tr('Dine-in')==='Appointment');
m.switchBusinessType('restaurant');ok('restaurant uses Customers and keeps Dine-in',m.tr('Guests')==='Customers'&&m.tr('Dine-in')==='Dine-in');

// ---- dashboards are genuinely different per business type ----
ok('each dashboard has its own signature panel',results.supermarket.html.includes('Basket size')&&results.supermarket.html.includes('Expiry watch')&&results.pharmacy.html.includes('Prescription vs over-the-counter')&&results.clinic.html.includes('Doctors &amp; departments')&&results.clinic.html.includes('Payer mix')&&results.salon.html.includes('Stylists &amp; therapists')&&results.retail.html.includes('Sell-through')&&results.restaurant.html.includes('Where sales come from'));
ok('and they do NOT show other industries\' panels',!results.restaurant.html.includes('Basket size')&&!results.supermarket.html.includes('Prescription')&&!results.retail.html.includes('Payer mix')&&!results.salon.html.includes('Expiry watch')&&!results.clinic.html.includes('Where sales come from'));
ok('KPI tiles differ: supermarket "Items per basket", retail "Return rate", pharmacy "Prescriptions dispensed", clinic "Claims outstanding", salon "Commission payable"',results.supermarket.html.includes('Items per basket')&&results.retail.html.includes('Return rate')&&results.pharmacy.html.includes('Prescriptions dispensed')&&results.clinic.html.includes('Claims outstanding')&&results.salon.html.includes('Commission payable'));

// ---- supermarket: weighed items, scale barcodes, decimals, multiplier ----
m.switchBusinessType('supermarket');let DB=m.DB;m.setME(DB.users[0]);let sess=openSession();
const tom=DB.items.find(i=>i.name==='Tomatoes'), before=m.stockOf(tom.id);
ok('weighed item is flagged with unit and PLU',tom.weighed&&tom.unit==='kg'&&tom.plu==='10001');
const ean=d12=>{let s=0;for(let i=0;i<12;i++)s+=(+d12[i])*(i%2?3:1);return d12+((10-(s%10))%10)};const code=ean('2'+'010001'+'01235'),sc=m.parseScan(code);ok('EAN-13 weight barcode → Tomatoes 1.235 kg',sc&&sc.item.id===tom.id&&sc.qty===1.235&&sc.weight===true,JSON.stringify(sc&&{n:sc.item.name,q:sc.qty}));
ok('a weight barcode with a wrong check digit is rejected',m.parseScan(code.slice(0,12)+((+code[12]+1)%10))===null);
const milk=DB.items.find(i=>i.name==='Fresh milk 1L');const mm=m.parseScan('3*'+milk.barcode);ok('"3*barcode" multiplier',mm&&mm.item.id===milk.id&&mm.qty===3);
ok('plain barcode and SKU lookups',m.parseScan(milk.barcode).item.id===milk.id&&m.parseScan(milk.sku).item.id===milk.id&&m.parseScan('0000')===null);
const o=sale(sess,[{itemId:tom.id,qty:1.235},{itemId:milk.id,qty:3}]);
ok('weighed sale: line total = 1.235 × price per kg',Math.abs(o.lines[0].qty*o.lines[0].price-1.235*tom.price)<0.01&&o.lines[0].unit==='kg');
ok('stock is deducted in exact kilograms (3 decimals)',m.stockOf(tom.id)===m.rq(before-1.235),String(before)+' → '+m.stockOf(tom.id));
ok('supermarket books still balance with fractional quantities',bal()===0);
ok('supermarket register starts in scan mode',m.bm('scanFirst')&&!m.bm('kitchen')&&!m.bm('tables')&&!o.kds,'no kitchen ticket created');

// ---- expiry: expired stock can never be sold ----
m.switchBusinessType('pharmacy');DB=m.DB;m.setME(DB.users[0]);sess=openSession();
const anti=DB.items.find(i=>i.name==='Antacid tablets'), lotsA=DB.lots.filter(l=>l.itemId===anti.id), exp=lotsA.find(l=>l.expiry<Date.now());
ok('pharmacy sample includes an expired batch',!!exp&&exp.qty===6);
ok('sellable stock excludes the expired batch',m.sellableOf(anti.id)===m.stockOf(anti.id)-6);
lotsA.filter(l=>l!==exp).forEach(l=>l.qty=0);
ok('with only expired stock left, nothing is sellable',m.sellableOf(anti.id)===0);
const blocked=sale(sess,[{itemId:anti.id,qty:1}]);ok('a sale of expired-only stock is refused',blocked===null);
ok('expired quantity was not touched',exp.qty===6);
DB.settings.blockExpired=false;ok('manager can switch the block off (not recommended)',m.sellableOf(anti.id)===6);DB.settings.blockExpired=true;
const bk=m.expiryBuckets();ok('expiry watch totals the expired value',bk.expired.n===6&&bk.expired.v>0&&bk.d30.n>0);
ok('briefing warns about expired stock still on the shelf',m.bizBriefing().some(b=>/expired stock/.test(b.t)));

// ---- pharmacy: prescriptions, controlled drugs, insurance ----
m.switchBusinessType('pharmacy');DB=m.DB;m.setME(DB.users[0]);sess=openSession();
const amox=DB.items.find(i=>i.name==='Amoxicillin 500mg caps'), tram=DB.items.find(i=>i.controlled);
ok('Rx and controlled flags in the catalogue',amox.rx&&!amox.controlled&&tram.rx&&tram.controlled);
const cust=DB.customers.find(c=>c.insurer);
const rxo=sale(sess,[{itemId:amox.id,qty:2,rx:{no:'RX123456',doctor:'Dr. Test',patient:'Mariam',idNo:'',controlled:false,approvedBy:null}},{itemId:tram.id,qty:1,rx:{no:'RX777',doctor:'Dr. Test',patient:'Mariam',idNo:'784-1111-1234567',controlled:true,approvedBy:DB.users[1].id}}],{cust:cust.id,
  pays:null});
// insurance split: insurer pays (100-copay)% , patient the rest
const T=m.computeTotals({cart:[{key:'a',itemId:amox.id,qty:2,note:''}],customerId:cust.id,code:null,manual:null,redeem:0,type:'takeaway'}), ins=Math.round(T.total*(100-cust.copay)/100*100)/100, rest=Math.round((T.total-ins)*100)/100;
const o2=sale(sess,[{itemId:amox.id,qty:2,rx:{no:'RX900',doctor:'Dr. A',patient:'Mariam',idNo:'',controlled:false}}],{cust:cust.id,pays:[{method:'insurance',amount:ins,tendered:ins,insurer:cust.insurer},{method:'cash',amount:rest,tendered:rest}]});
ok('prescription register has an entry per Rx line with batch and doctor',DB.rxLog.length===3&&DB.rxLog.every(r=>r.batch&&r.doctor&&r.rxNo)&&DB.rxLog.filter(r=>r.controlled).length===1);
ok('controlled medicine entry keeps ID and approver',(()=>{const c=DB.rxLog.find(r=>r.controlled);return c.idNo&&c.approvedBy===DB.users[1].id})());
ok('prescription register page renders and exports',m.vRxRegister().includes('Prescription')||m.vRxRegister().length>200);
ok('insurance sale creates a receivable on the insurer\'s own ledger',Math.abs(m.balMap(null)[m.insurerLedger(cust.insurer).id].close-ins)<0.011,String(m.balMap(null)[m.insurerLedger(cust.insurer).id].close));
ok('patient paid only the co-pay in cash',o2.payments.find(p=>p.method==='cash').amount===rest&&o2.insurer===cust.insurer);
ok('claims outstanding total matches',Math.abs(m.claimsOutstanding()-ins)<0.011&&m.vClaims().includes(cust.insurer));
ok('books balance with insurance tender',bal()===0);
const ledger=m.insurerLedger(cust.insurer);
m.postVoucher({type:'Receipt',entries:[{ledgerId:m.LID('bank'),dr:ins-1,cr:0},{ledgerId:m.LID('insrej'),dr:1,cr:0},{ledgerId:ledger.id,dr:0,cr:ins}],narration:'claim settlement'});
ok('settling a claim with a rejection clears the receivable and books the rejection',Math.abs(m.balMap(null)[ledger.id].close)<0.011&&m.balMap(null)[m.LID('insrej')].close===1&&bal()===0);

// ---- retail: variants grouped into one tile ----
m.switchBusinessType('retail');DB=m.DB;m.setME(DB.users[0]);
const th=m.tilesHtml(DB.items.filter(i=>i.active));
ok('size variants collapse to one tile per product',(th.match(/class="tn">Basic T-Shirt/g)||[]).length===1&&/4 options/.test(th)&&(th.match(/data-act="r-variants"/g)||[]).length>=4);
ok('retail has no kitchen/tables but has returns KPI',!m.bm('kitchen')&&m.bm('variants'));
ok('retail item form shows group/variant fields',m.itemForm(null).includes('name="group"')&&m.itemForm(null).includes('name="variant"')&&!m.itemForm(null).includes('name="rx"'));
m.switchBusinessType('supermarket');ok('supermarket item form shows unit/PLU/weighed',m.itemForm(null).includes('name="plu"')&&m.itemForm(null).includes('name="weighed"'));
m.switchBusinessType('pharmacy');ok('pharmacy item form shows Rx / controlled; patient form shows insurance fields',m.itemForm(null).includes('name="rx"')&&m.itemForm(null).includes('name="controlled"')&&m.guestForm(null).includes('name="insurer"'));
m.switchBusinessType('restaurant');ok('restaurant forms stay simple (no Rx, no PLU, no insurance)',!m.itemForm(null).includes('name="rx"')&&!m.itemForm(null).includes('name="plu"')&&!m.guestForm(null).includes('name="insurer"'));

// ---- clinic & salon: providers, commission ----
m.switchBusinessType('clinic');DB=m.DB;m.setME(DB.users[0]);sess=openSession();
ok('clinic catalogue: services untracked, departments as categories, providers loaded',DB.items.filter(i=>i.kind==='service').length>=14&&DB.items.filter(i=>i.kind==='service').every(i=>!i.track)&&DB.providers.length>=4&&DB.customers.some(c=>c.mrn&&c.insurer));
const gp=DB.items.find(i=>i.name==='GP consultation'), doc=DB.providers[0];
const bill=sale(sess,[{itemId:gp.id,qty:1,provider:doc.id}]);
ok('service line carries the provider and needs no stock',bill.lines[0].provider===doc.id&&bill.lines[0].kind==='service'&&bill.lines[0].allocs.length===0);
const pr=m.providerRevenue(0,Date.now()+1e6).find(p=>p.id===doc.id);ok('provider revenue and commission computed',pr&&pr.rev===150&&Math.abs(pr.comm-150*doc.commissionPct/100)<0.01,JSON.stringify(pr));
ok('provider earnings report renders',m.vProviderReport().includes(doc.name));
ok('healthcare services are zero-rated in the sample (tax-exempt flag)',gp.tax===false&&bill.vat===0);
m.switchBusinessType('salon');DB=m.DB;m.setME(DB.users[0]);sess=openSession();
const cut=DB.items.find(i=>i.name==='Women\'s haircut'), maya=DB.providers[0];
const sb=sale(sess,[{itemId:cut.id,qty:1,provider:maya.id}]);const sr=m.providerRevenue(0,Date.now()+1e6)[0];
ok('salon: stylist commission = revenue ex-tax × %',sr.name===maya.name&&Math.abs(sr.comm-sr.rev*maya.commissionPct/100)<0.011&&bal()===0);

// ---- switching keeps your identity and country ----
m.switchBusinessType('restaurant');DB=m.DB;DB.settings.setupDone=true;m.applyCountry('OM',true);const users0=DB.users.map(u=>u.username).join();DB.settings.business='My Own Cafe';
m.switchBusinessType('pharmacy');ok('switching type keeps logins, business name, currency and decimals',m.DB.users.map(u=>u.username).join()===users0&&m.DB.settings.business==='My Own Cafe'&&m.DB.settings.currency==='OMR'&&m.DB.settings.businessType==='pharmacy');
ok('switching resets sample stock and orders for the new type',m.DB.orders.length===0&&m.DB.items.some(i=>i.rx));

console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);
