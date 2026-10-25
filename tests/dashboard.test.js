const fs=require('fs');
const dir=require('path').join(__dirname,'..','website','app','js')+'/';
global.localStorage={_d:{},getItem(k){return this._d[k]||null},setItem(k,v){this._d[k]=v}};global.sessionStorage=global.localStorage;
global.document={addEventListener(){},querySelector(){return null},querySelectorAll(){return[]},documentElement:{setAttribute(k,v){this[k]=v}}};
global.window={addEventListener(){},open(){}};global.location={hash:'',protocol:'file:',origin:'null'};global.matchMedia=()=>({matches:false});global.render=()=>{};
const src=['vendor/qrcode','core','ui','regions','console','accounts','einvoice','insights','dashboard','online','register'].map(f=>fs.readFileSync(dir+f+'.js','utf8').replace(/^'use strict';/,'')).join('\n');
const names='load,A,genDemoData,vDashboard,balMap,LID,applyCountry,vAccounts,riskAlerts,vReports,briefing,sessionStats,groupLedgers,plData,stockOf,reorderRows,menuEng,guestStats,UIS,agg,dRange,vSetup'.split(',');
const run=new Function(src+';modal=function(){return null};toast=function(){};return {'+names.join(',')+',get DB(){return DB},setME(u){ME=u}};');
const m=run();m.load();const DB=m.DB;m.setME(DB.users[0]);
let pass=0,fail=0;const ok=(l,c,x)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+l+(x?' — '+x:''))};
const bal=()=>{const b=m.balMap(null);let s=0;Object.values(b).forEach(x=>s+=x.close);return Math.round(s*1000)/1000};
// empty dashboard
const empty=m.vDashboard();ok('empty dashboard offers sample data and does not crash',empty.includes('No sales yet')&&empty.includes('Load sample sales'));
// KSA with e-invoicing on, to exercise the whole chain
m.applyCountry('SA');DB.settings.trn='300000000000003';DB.settings.einv.crn='1010';
DB.settings.charges=[{id:'ch0',name:'Service charge',pct:10,taxable:true,types:['dine-in'],payable:false}];
const t0=Date.now();const n=m.genDemoData(14);const ms=Date.now()-t0;
ok('sample data generated',n>200,n+' orders in '+ms+' ms');
ok('orders spread across the period',new Set(DB.orders.map(o=>new Date(o.ts).toDateString())).size>=13);
ok('some refunds and some discounts exist',DB.orders.some(o=>o.status==='refunded')&&DB.orders.some(o=>o.discounts.length));
ok('books balance after sample data (to the halala)',bal()===0,String(bal()));
const b=m.balMap(null);
const stockInv=Math.round(DB.lots.reduce((s,l)=>s+l.qty*l.cost,0)*100)/100;
ok('stock ledger equals inventory valuation',Math.abs(b[m.LID('stock')].close-stockInv)<0.02,b[m.LID('stock')].close.toFixed(2)+' vs '+stockInv.toFixed(2));
const vatOrders=DB.orders.filter(o=>o.status==='completed').reduce((s,o)=>s+o.vat,0);
ok('VAT output ledger equals order VAT',Math.abs(-b[m.LID('vat_out')].close-vatOrders)<0.05,(-b[m.LID('vat_out')].close).toFixed(2)+' vs '+vatOrders.toFixed(2));
ok('every order is stamped with a hash-chained e-invoice',DB.orders.every(o=>o.einv)&&DB.einv.icv>=DB.orders.length);
const icvs=DB.orders.map(o=>o.einv.icv).sort((a,b)=>a-b);ok('invoice counters are unique',new Set(icvs).size===icvs.length);
ok('past days closed, today open',DB.sessions.filter(s=>!s.closedAt).length===1&&DB.sessions.filter(s=>s.closedAt).length>=13);
ok('storage size is reasonable (<2.5 MB)',JSON.stringify(DB).length<2.5e6,(JSON.stringify(DB).length/1e6).toFixed(2)+' MB');
// dashboard for each period
['today','yesterday','7d','30d'].forEach(r=>{m.UIS.dr=r;let h='';try{h=m.vDashboard()}catch(e){ok('dashboard '+r+' renders',false,e.message);return}
  ok('dashboard '+r+' renders with KPIs, charts and tables',h.includes('Sales trend')&&h.includes('Busy hours')&&h.includes('Top items')&&h.includes('Team leaderboard')&&h.includes('Operations right now')&&h.includes('Money')&&h.length>6000,String(h.length))});
m.UIS.dr='7d';const h7=m.vDashboard();
ok('no NaN / undefined / Infinity leaks into the dashboard',!/NaN|undefined|Infinity/.test(h7));
ok('7-day view has a trend line with 7 points',(h7.match(/<circle /g)||[]).length===7);
ok('previous-period comparison shown',/▲|▼/.test(h7)&&h7.includes('vs the previous 7 days'));
ok('mix panels show channels and payment methods',h7.includes('Dine-in')&&h7.includes('Card')&&h7.includes('Cash'));
ok('daily briefing included',h7.includes('Daily briefing'));
// KPI maths cross-check
const R=m.dRange('7d'),cur=m.agg(DB.orders.filter(o=>o.ts>=R.from&&o.ts<=R.to));
const manual=Math.round(DB.orders.filter(o=>o.ts>=R.from&&o.ts<=R.to&&o.status==='completed').reduce((a,o)=>a+(o.total-o.vat),0)*100)/100;
ok('KPI net sales equals manual ex-VAT sum',Math.abs(cur.sales-manual)<0.02,cur.sales+' vs '+manual);
ok('gross margin is sane (0–100%)',cur.margin>0&&cur.margin<100,cur.margin.toFixed(1)+'%');
// downstream features with realistic data
ok('risk alerts compute',Array.isArray(m.riskAlerts(30)));
ok('menu engineering classifies many items',m.menuEng(30).rows.length>=10);
ok('guest segments computed',m.guestStats().some(g=>g.seg!=='Never visited'));
ok('reorder forecast works on real velocity',Array.isArray(m.reorderRows(7)));
ok('accounts pages render with data',['daybook','tb','pl','bs','vat','outstanding','setup'].every(t=>m.vAccounts(t).length>200));
ok('books health shows no failed auto-postings',!/postErrors/.test('')&&!(DB.acc.postErrors&&DB.acc.postErrors.length),JSON.stringify(DB.acc.postErrors||[]).slice(0,120));
['sales','items','category','payments','staff','vat','margin','valuation','expiry','menu','risk','hourly'].forEach(t=>{try{ok('report '+t+' renders',m.vReports(t).length>100)}catch(e){ok('report '+t+' renders',false,e.message)}});
console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);
