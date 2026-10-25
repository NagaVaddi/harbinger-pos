const fs=require('fs');
const dir=require('path').join(__dirname,'..','website','app','js')+'/';
global.localStorage={_d:{},getItem(k){return this._d[k]||null},setItem(k,v){this._d[k]=v}};global.sessionStorage=global.localStorage;
global.document={addEventListener(){},querySelector(){return null},querySelectorAll(){return[]}};
global.window={addEventListener(){},open(){}};global.location={hash:''};global.matchMedia=()=>({matches:false});global.render=()=>{};
// ROUTES lives in main.js (needs DOM at load) — stub minimal
const src=['vendor/qrcode','core','ui','regions','console','accounts','einvoice','insights','dashboard','online','register'].map(f=>fs.readFileSync(dir+f+'.js','utf8').replace(/^'use strict';/,'')).join('\n');
const names='load,R,completeSale,computeTotals,reorderRows,expiryRisk,riskAlerts,menuEng,guestStats,briefing,vKitchen,vReorder,vRisk,vMenuEng,vHourly,vSegments,vAccounts,vDashboard,vGuests,vStock,vReports,vSettings,palItems,waLink,receiptText,ticketMargin,minMargin,marginLine,kdsTickets,sessionStats,postRefund,returnStock,balMap,LID,A,regReset,itemForm,vTeam'.split(',');
const run=new Function(src+';modal=function(){return null};toast=function(){};ROUTES={dashboard:{perm:"dashboard",label:"Command Center"},catalog:{perm:"catalog",label:"Catalog"},accounts:{perm:"accounts",label:"Accounts"}};return {'+names.join(',')+',get DB(){return DB},setME(u){ME=u}};');
const m=run();m.load();const DB=m.DB;m.setME(DB.users[0]);
const ok=(l,c,x)=>console.log((c?'PASS ':'FAIL ')+l+(x?' — '+x:''));
const sess={id:'s1',counterId:'k1',openedBy:DB.users[0].id,openedAt:Date.now(),float:200,closedAt:null};DB.sessions.push(sess);m.R.sessionId='s1';
const sell=(items,cust,pays)=>{m.regReset();m.R.cart=items.map((x,i)=>({key:'k'+i+Math.random(),itemId:DB.items[x[0]].id,qty:x[1],note:''}));m.R.customerId=cust||null;const T=m.computeTotals(m.R);m.completeSale(pays||[{method:'cash',amount:T.total,tendered:T.total}],0);return DB.orders[DB.orders.length-1]};
// create history spread over 20 days
for(let i=0;i<30;i++){const o=sell([[0,2],[6,1]],i%3===0?'g2':null);o.ts=Date.now()-(i%20)*864e5-3600e3*(i%5)}
for(let i=0;i<6;i++){const o=sell([[4,3]],'g3');o.ts=Date.now()-(i*2)*864e5}
const lowItem=DB.items[0];DB.lots.filter(l=>l.itemId===lowItem.id).forEach(l=>l.qty=3);
const rr=m.reorderRows(7);ok('reorder flags fast-selling low stock',rr.some(r=>r.item.id===lowItem.id&&r.suggest>0),JSON.stringify(rr.slice(0,2).map(r=>[r.item.name,r.stock,r.suggest,r.urgency])));
ok('expiry risk list builds',Array.isArray(m.expiryRisk()));
ok('reorder view renders',m.vReorder().includes('Create draft purchase orders'));
// refunds by one cashier to trigger risk
const ords=DB.orders.slice(0,5);ords.forEach(o=>{o.status='refunded';o.refund={ts:o.ts+60000,reason:'x',by:DB.users[0].id}});
const ra=m.riskAlerts(30);ok('risk alerts detect refund pattern',ra.some(a=>/refund/i.test(a.rule)),ra.map(a=>a.rule).join(' | '));
ok('risk view renders',m.vRisk().length>50);
const me=m.menuEng(30);ok('menu engineering classifies',me.rows.length>0&&me.rows.every(r=>['Star','Plowhorse','Puzzle','Dog'].includes(r.cls)),me.rows.map(r=>r.item.name+':'+r.cls).join(', '));
ok('menu + hourly views render',m.vMenuEng().length>50&&m.vHourly().length>50);
const gs=m.guestStats();ok('segments computed',gs.some(g=>g.seg!=='Never visited'),gs.map(g=>g.c.name+':'+g.seg).join(', '));
ok('segments view renders',m.vSegments().includes('wa.me')||m.vSegments().length>100);
ok('whatsapp link formats UAE number',m.waLink('0501234567','hi').startsWith('https://wa.me/971501234567?text='));
ok('receipt text',m.receiptText(DB.orders[10]).includes('Total:'));
const b=m.briefing();ok('briefing produces items',b.length>0,b.map(x=>x.k).join(','));
ok('dashboard renders with briefing',m.vDashboard().includes('Daily briefing'));
ok('kitchen view lists open tickets',m.kdsTickets().length>0&&m.vKitchen().includes('Harbinger Kitchen'));
ok('guests tabs',m.vGuests('segments').includes('Segments')&&m.vGuests().includes('Directory'));
ok('stock reorder tab',m.vStock('reorder').includes('Expiry risk'));
ok('reports new tabs',m.vReports('menu').includes('Star')&&m.vReports('risk').length>50&&m.vReports('hourly').length>50);
ok('palette search',m.palItems('burger').some(x=>/Classic Burger/.test(x.label))&&m.palItems('').length>3);
ok('item form has supplier fields',m.itemForm(null).includes('leadDays'));
// profit guard
m.regReset();m.R.cart=[{key:'a',itemId:DB.items[0].id,qty:1,note:''}];let T=m.computeTotals(m.R);let mg=m.ticketMargin(T);ok('healthy margin above minimum',mg.pct>m.minMargin(),Math.round(mg.pct)+'%');
m.R.manual={kind:'pct',value:70};T=m.computeTotals(m.R);mg=m.ticketMargin(T);ok('70% discount trips profit guard',mg.pct<m.minMargin(),Math.round(mg.pct)+'%');
ok('margin line shows for owner',m.marginLine(T).includes('below'));
m.setME(DB.users[2]);ok('cashier sees warning without numbers',m.marginLine(T).includes('Low margin')&&!/Profit AED/.test(m.marginLine(T)));
m.setME(DB.users[0]);
// accounts still balance after all sales/refunds? (refund vouchers posted only via postRefund — do one)
const o=DB.orders.find(x=>x.status==='refunded');m.returnStock(o.lines[0].allocs,o.lines[0].itemId,'t');m.postRefund(o,true);
const bm=m.balMap(null);let s=0;Object.values(bm).forEach(x=>s+=x.close);ok('books still balance',Math.round(s*100)/100===0,'sum '+s);
ok('team view renders',m.vTeam().length>50);
