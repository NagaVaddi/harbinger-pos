const fs=require('fs');
const dir=require('path').join(__dirname,'..','website','app','js')+'/';
global.localStorage={_d:{},getItem(k){return this._d[k]||null},setItem(k,v){this._d[k]=v}};global.sessionStorage=global.localStorage;
global.document={addEventListener(){},querySelector(){return null},querySelectorAll(){return[]},documentElement:{setAttribute(k,v){this[k]=v}}};
global.window={addEventListener(){},open(){}};global.location={hash:'',protocol:'file:',origin:'null'};global.matchMedia=()=>({matches:false});global.render=()=>{};
const {DOMParser}=require('@xmldom/xmldom');
const src=['vendor/qrcode','core','ui','regions','business','vertical','business_trades','trades','partners','reports_hub','stock_config','console','accounts','einvoice','insights','online','register'].map(f=>fs.readFileSync(dir+f+'.js','utf8').replace(/^'use strict';/,'')).join('\n');
const names='load,A,computeTotals,finalizeOrder,balMap,LID,applyCountry,COUNTRIES,receiptHtml,einvStamp,einvXml,curDec,r2,fmt,money,tr,rt,dn,applyLang,vApps,vSettings,ticketMargin,sessionStats,countryList,CHANNELS,setupWizard,menuSnapshot'.split(',');
const run=new Function(src+';modal=function(){return null};toast=function(){};return {'+names.join(',')+',get DB(){return DB},setME(u){ME=u},setLang(l){LANG=l}};');
const m=run();m.load();const DB=m.DB;m.setME(DB.users[0]);
let pass=0,fail=0;const ok=(l,c,x)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+l+(x?' — '+x:''))};
const bal=()=>{const b=m.balMap(null);let s=0;Object.values(b).forEach(x=>s+=x.close);return Math.round(s*1000)/1000};
const sess={id:'s1',counterId:'k1',openedBy:DB.users[0].id,openedAt:Date.now(),float:0,closedAt:null};DB.sessions.push(sess);
const sale=(items,type,pays)=>{const S={cart:items.map((x,i)=>({key:'k'+i+Math.random(),itemId:DB.items[x[0]].id,qty:x[1],note:''})),customerId:null,code:null,manual:null,redeem:0,type:type||'takeaway',table:type==='dine-in'?'T1':''};const T=m.computeTotals(S);return m.finalizeOrder(S,sess,pays||[{method:'cash',amount:T.total,tendered:T.total}],0)};

// ---- profiles ----
ok('every GCC country has a profile',['AE','SA','BH','OM','KW','QA'].every(c=>m.COUNTRIES[c]));
ok('profile values: AE 5% / SA 15% / BH 10% / OM 5% / KW,QA 0%',m.COUNTRIES.AE.vat===5&&m.COUNTRIES.SA.vat===15&&m.COUNTRIES.BH.vat===10&&m.COUNTRIES.OM.vat===5&&m.COUNTRIES.KW.vat===0&&m.COUNTRIES.QA.vat===0);
ok('3-decimal currencies: BHD, OMR, KWD',[m.COUNTRIES.BH,m.COUNTRIES.OM,m.COUNTRIES.KW].every(c=>c.dec===3));
ok('custom + other-country options exist',m.COUNTRIES.XX&&m.COUNTRIES.GB&&m.COUNTRIES.IN);
ok('settings page renders with country + charges',m.vSettings().includes('Apply country defaults')&&m.vSettings().includes('Charge 1 name'));

// ---- Oman: 3 decimals, 5% VAT ----
m.applyCountry('OM');
ok('applyCountry sets currency/decimals/VAT/dial/e-invoice region',DB.settings.currency==='OMR'&&m.curDec()===3&&DB.settings.vatPct===5&&DB.settings.countryCode==='968'&&DB.settings.einv.region==='OM');
ok('rounding to 3 decimals',m.r2(1.23456)===1.235&&m.fmt(1.5)==='1.500'&&m.money(2)==='OMR 2.000');
DB.items[0].price=2.345;DB.items[0].cost=0.8;
const o1=sale([[0,3]]);
ok('OMR sale total keeps baisa (3 dp)',Math.abs(o1.total-7.035)<1e-9,String(o1.total));
ok('OMR books balance (3 dp)',bal()===0,String(bal()));
ok('Oman e-invoice stamps with OM region and UBL draft is well-formed',(()=>{const x=m.einvXml(o1,'invoice'),e=[];new DOMParser({onError:(l,msg)=>e.push(msg)}).parseFromString(x,'text/xml');return o1.einv&&e.length===0&&x.includes('>OM<')&&x.includes('7.035')})());

// ---- Kuwait: no VAT, no tax lines ----
m.applyCountry('KW');DB.items[0].price=1.5;
const k1=sale([[0,2]]);
ok('Kuwait: zero VAT, total = items',k1.vat===0&&Math.abs(k1.total-3)<1e-9,JSON.stringify([k1.vat,k1.total]));
const rk=m.receiptHtml(k1);ok('Kuwait receipt has no tax lines and is a RECEIPT, not a tax invoice',!/VAT/.test(rk)&&/RECEIPT/.test(rk)&&!/TAX INVOICE/.test(rk));
ok('Kuwait books balance',bal()===0);

// ---- UAE with service charge + municipality fee ----
m.applyCountry('AE');DB.items[0].price=100;DB.items[0].cost=30;
DB.settings.charges=[{id:'ch0',name:'Service charge',pct:10,taxable:true,types:['dine-in'],payable:false},{id:'ch1',name:'Municipality fee',pct:5,taxable:false,types:['dine-in'],payable:true}];
const d1=sale([[0,1]],'dine-in');
// ex-VAT sales = 100/1.05 = 95.238; svc 10% = 9.524 (+VAT 0.476); muni 5% = 4.762
ok('dine-in carries both charges',d1.charges.length===2&&d1.charges[0].name==='Service charge',JSON.stringify(d1.charges));
ok('service charge is taxable, municipality fee is not',d1.charges[0].vat>0&&d1.charges[1].vat===0);
ok('total = items + charges + VAT on charges',Math.abs(d1.total-(100+d1.chargeTotal+d1.charges[0].vat))<0.011,String(d1.total));
const t1=sale([[0,1]],'takeaway');ok('takeaway has no charges (dine-in only)',t1.charges.length===0&&t1.total===100);
ok('books balance with charges',bal()===0,String(bal()));
const b=m.balMap(null);
ok('service charge income ledger credited',Math.abs(-b[m.LID('svc')].close-d1.charges[0].amount)<0.011,String(-b[m.LID('svc')].close));
ok('municipality fee credited to government payable (liability)',Math.abs(-b[m.LID('govfee')].close-d1.charges[1].amount)<0.011);
ok('VAT output includes VAT on service charge',Math.abs(-b[m.LID('vat_out')].close-DB.orders.reduce((a,o)=>a+o.vat,0))<0.011,String(-b[m.LID('vat_out')].close));
ok('receipt lists the charges',m.receiptHtml(d1).includes('Municipality fee 5%')&&m.receiptHtml(d1).includes('Service charge 10%'));
ok('profit guard excludes charge income from margin',(()=>{const S={cart:[{key:'a',itemId:DB.items[0].id,qty:1,note:''}],type:'dine-in'};const T=m.computeTotals(S);const mg=m.ticketMargin(T);return mg.ex<T.total&&mg.ex===r(T.total-T.vat-T.chargeTotal)})());
function r(x){return Math.round(x*100)/100}
DB.settings.einv.region='AE';const d2=sale([[0,1]],'dine-in');
const xml=m.einvXml(d2,'invoice'),errs=[];new DOMParser({onError:(l,msg)=>errs.push(msg)}).parseFromString(xml,'text/xml');
ok('e-invoice XML with charges is well-formed and lists them as charges',errs.length===0&&xml.includes('<cbc:ChargeIndicator>true</cbc:ChargeIndicator>')&&xml.includes('Municipality fee'));
ok('XML payable amount equals order total',xml.includes('<cbc:PayableAmount currencyID="AED">'+d2.total.toFixed(2)+'</cbc:PayableAmount>'));
// refund reverses charges too
d1.status='refunded';
// ---- languages ----
m.setLang('ar');ok('Arabic UI strings',m.tr('Pay')==='ادفع'&&m.tr('Total')==='الإجمالي'&&m.tr('Sign in')==='تسجيل الدخول');
ok('Arabic item names',m.dn(DB.items[0])==='برجر كلاسيك');
m.setLang('en');ok('English default',m.tr('Pay')==='Pay'&&m.dn(DB.items[0])==='Classic Burger');
DB.settings.receiptLang='both';const rb=m.receiptHtml(d1);ok('bilingual receipt: Arabic title + Arabic item names',rb.includes('فاتورة ضريبية')&&rb.includes('برجر كلاسيك'));
DB.settings.receiptLang='ar';const ra=m.receiptHtml(d1);ok('Arabic receipt is right-to-left',ra.includes('dir="rtl"')&&ra.includes('الإجمالي'));
DB.settings.receiptLang='en';ok('English receipt has no Arabic',!/[\u0600-\u06FF]/.test(m.receiptHtml(d1)));
// ---- delivery apps by country ----
m.applyCountry('SA');ok('apps page ranks KSA apps first',(()=>{const h=m.vApps();return h.indexOf('<b>HungerStation</b>')>0&&h.indexOf('<b>HungerStation</b>')<h.indexOf('<b>Talabat</b>')})());
m.applyCountry('QA');ok('Qatar highlights Snoonu',/Snoonu<\/b>[^<]*<span class="badge ok">Common in Qatar/.test(m.vApps()));
ok('menu snapshot carries decimals and tax label',(m.applyCountry('BH'),m.menuSnapshot().decimals===3&&m.menuSnapshot().currency==='BHD'));
// ---- global / custom ----
m.applyCountry('XX');DB.settings.currency='CHF';DB.settings.vatPct=8.1;DB.settings.taxLabel='MWST';
const g=sale([[0,1]]);ok('custom country works with its own tax label and rate',m.receiptHtml(g).includes('MWST 8.1%')&&bal()===0);
console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);
