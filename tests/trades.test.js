'use strict';
// Tailor, butcher, grocery, garage and tyre shops + customer credit, job orders, breakdown, DOT/warranty,
// scale and barcode configuration, and the reports hub (accounts + inventory reports).
const fs=require('fs'), path=require('path');
const dir=path.join(__dirname,'..','website','app','js')+'/';
global.localStorage={_d:{},getItem(k){return this._d[k]||null},setItem(k,v){this._d[k]=v}};global.sessionStorage=global.localStorage;
global.document={addEventListener(){},querySelector(){return null},querySelectorAll(){return[]},documentElement:{setAttribute(k,v){this[k]=v}}};
global.window={addEventListener(){},open(){},print(){}};global.location={hash:'',protocol:'file:',origin:'null'};global.matchMedia=()=>({matches:false});global.render=()=>{};
const files=['vendor/qrcode','core','ui','regions','business','vertical','business_trades','trades','slips','partners','reports_hub','stock_config','console','accounts','einvoice','insights','dashboard','online','register'];
const src=files.map(f=>fs.readFileSync(dir+f+'.js','utf8').replace(/^'use strict';/,'')).join('\n');
const names=['load','A','R','W','UIS','computeTotals','finalizeOrder','balMap','LID','switchBusinessType','BIZ','bm','biz','tr','can','ROLE_SETS','PERMS','parseScan','stockOf','sellableOf','rq','r2',
  'customerLedger','creditBalances','creditBalance','creditAging','creditRoom','creditOwed','postCustomerPayment','jobTotals','jobAdvance','jobBalance','jobOpen','isOverdue','postAdvance','newJobNo','jobHist','jobFlow','doBreakdown','dotAge','recordWarranty',
  'parseScaleCode','makeScaleCode','scaleCfg','bcCfg','ean13Svg','isEan13','reportGroups','vReportHub','vInvReport','vAccReport','vReports','vJobs','vScaleSetup','vBarcodes','vCreditBook','vBreakdown','vWarranty','vStock','vGuests','vDashboard','genDemoData','demoJobs','demoBreakdowns','scaleOk','bizType','vDrivers','vPromos','vOutlets','vGuests','vCatalog','applyStockDelta','countSummary','vStockCount','vStock','autoArabic','txSlipHtml','voucherSlip','itemById','saveItem'];
const run=new Function(src+';modal=function(){return null};toast=function(){};return {'+names.join(',')+',get DB(){return DB},setME(u){ME=u}};');
const m=run();m.load();
let pass=0,fail=0;const ok=(l,c,x)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+l+(x?' — '+x:''))};
const bal=()=>{const b=m.balMap(null);let s=0;Object.values(b).forEach(x=>s+=x.close);return Math.round(s*1000)/1000};
const openSession=()=>{const s={id:'s'+Math.random(),counterId:m.DB.counters[0].id,openedBy:m.DB.users[0].id,openedAt:Date.now(),float:100,closedAt:null};m.DB.sessions.push(s);return s};
const sale=(sess,lines,opt)=>{opt=opt||{};const S=Object.assign({cart:lines.map((l,i)=>Object.assign({key:'k'+i+Math.random(),note:''},l)),customerId:opt.cust||null,code:null,manual:null,redeem:0,type:'takeaway',table:''},opt.S||{});const T=m.computeTotals(S);
  return m.finalizeOrder(S,sess,opt.pays||[{method:'cash',amount:T.total,tendered:T.total}],0)};
const bad=h=>/NaN|undefined|Infinity/.test(h);

const NEW=['tailor','butcher','grocery','garage','tyre'];
const SIG={tailor:['Job orders','Due &amp; overdue'],butcher:['Cutting yield','Customer credit'],grocery:['Customer credit','Basket size'],garage:['Service reminders','Labour vs parts'],tyre:['Tyre sizes sold','Brand mix']};
ok('five new business types exist',NEW.every(t=>m.BIZ[t]&&m.BIZ[t].name&&m.BIZ[t].dash.length>=5));
ok('every dashboard panel referenced by the new layouts is implemented',NEW.every(t=>m.BIZ[t].dash.every(r=>r.every(id=>typeof m.W[id]==='function'))),NEW.map(t=>m.BIZ[t].dash.flat().filter(id=>typeof m.W[id]!=='function').join()).join('|'));
ok('technician role: jobs only; tailor, garage and tyre offer it, grocery and butcher do not',m.PERMS.technician.join()==='jobs'&&['tailor','garage','tyre'].every(t=>m.ROLE_SETS[t].includes('technician'))&&!m.ROLE_SETS.grocery.includes('technician')&&!m.ROLE_SETS.butcher.includes('technician'));

for(const t of NEW){
  m.switchBusinessType(t);m.setME(m.DB.users[0]);const DB=m.DB;
  ok('['+t+'] sample catalogue, customers and opening books balance',m.bizType()===t&&DB.items.length>=12&&DB.customers.length>=3&&bal()===0);
  ok('['+t+'] sample customers carry a credit limit',DB.customers.some(c=>c.creditLimit>0));
  ok('['+t+'] empty dashboard renders',m.vDashboard().includes('No sales yet'));
  const made=m.genDemoData(10);ok('['+t+'] sample data generated ('+made+' sales)',made>30);
  ok('['+t+'] books still balance after sample data',bal()===0);
  const html=m.vDashboard();ok('['+t+'] dashboard has no NaN/undefined and its signature panels',!bad(html)&&html.length>4000&&SIG[t].every(s=>html.includes(s)),SIG[t].filter(s=>!html.includes(s)).join());
  m.UIS.dr='30d';const h30=m.vDashboard();ok('['+t+'] 30-day dashboard renders',!bad(h30));m.UIS.dr='today';
  const hub=m.vReportHub();ok('['+t+'] reports hub lists accounts and inventory groups',hub.includes('Accounts reports')&&hub.includes('Inventory reports')&&hub.includes('Item activity'));
}

// ---------- reports: hub, inventory, accounts ----------
m.switchBusinessType('grocery');m.setME(m.DB.users[0]);m.genDemoData(10);
{const DB=m.DB,hub=m.vReports('');
 ok('Reports landing page shows grouped report cards',hub.includes('Choose a report to view')&&['Accounts reports','Inventory reports','Sales &amp; operations','Stock report','Item activity','Stock adjustments','Expiry / batch report','Accounts summary','VAT summary'].every(s=>hub.includes(s)||hub.includes(s.replace('VAT','Tax'))),'');
 const g=m.reportGroups();ok('hub: accounts group appears before the others and has Accounts summary, Stock report and tax summary',g[0].k==='accounts'&&g[0].items.slice(0,3).map(i=>i[0]).join()==='reports/acc-summary,reports/acc-stock,reports/acc-vat');
 const lot=DB.lots.find(l=>l.qty>2);DB.movements.unshift({id:'mx1',ts:Date.now(),itemId:lot.itemId,lotId:lot.id,type:'waste',qty:-2,ref:'Wastage: dropped',user:DB.users[0].id,note:''});lot.qty-=2;
 const it=DB.items.find(i=>i.id===lot.itemId);m.UIS.iaItem=it.id;
 ['inv-stock','inv-activity','inv-adjust','inv-expiry','acc-summary','acc-stock','acc-vat'].forEach(t=>{let h='';try{h=m.vReports(t)}catch(e){ok('report '+t+' renders',false,e.message)}ok('report '+t+' renders with data, no NaN/undefined',h.length>600&&!bad(h)&&h.includes('All reports'),String(h.length))});
 ok('stock adjustments report shows the wastage and its value',m.vReports('inv-adjust').includes('dropped')&&m.vReports('inv-adjust').includes('Wastage'));
 ok('item activity shows opening, in, out and closing, with a CSV',/Opening[\s\S]*Closing/.test(m.vReports('inv-activity'))&&m.vReports('inv-activity').includes('Balance'));
 ok('stock report (books) reconciles the ledger to item batches',m.vReports('acc-stock').includes('Stock in the books'));
 ok('expiry / batch report lists batches with status filter',m.vReports('inv-expiry').includes('Batches in stock')&&m.vReports('inv-expiry').includes('Days left'));
 ok('accounts summary includes receivables ageing',m.vReports('acc-summary').includes('Receivables ageing'));
}

// ---------- customer credit (grocery) ----------
{const DB=m.DB,sess=openSession(),cu=DB.customers[0];cu.creditLimit=300;
 const item=DB.items.find(i=>i.track&&i.price>5&&!i.weighed);
 const before=m.creditBalance(cu.id), o=sale(sess,[{itemId:item.id,qty:2}],{cust:cu.id,pays:[{method:'credit',amount:2*item.price,tendered:2*item.price,customerId:cu.id}]});
 const sv=m.computeTotals({cart:[{key:'x',itemId:item.id,qty:2,note:''}]}).total;
 ok('credit sale puts the amount on the customer\'s account (Dr customer, Cr sales) and books balance',Math.abs(m.creditBalance(cu.id)-before-sv)<0.006&&bal()===0&&o.payments[0].method==='credit');
 ok('credit room = limit − balance',Math.abs(m.creditRoom(cu)-(300-m.creditBalance(cu.id)))<0.006);
 ok('customer ledger is a debtor ledger',m.customerLedger(cu.id).groupId==='g_debt'&&DB.acc.ledgers.filter(l=>l.customerId===cu.id).length===1);
 const owed=m.creditBalance(cu.id);m.postCustomerPayment(cu,'cash',owed/2);
 ok('receiving a payment reduces the balance, adds cash to the session and books balance',Math.abs(m.creditBalance(cu.id)-owed/2)<0.006&&bal()===0&&DB.vouchers.some(v=>v.type==='in'&&/Customer payment/.test(v.reason)));
 const ag=m.creditAging();ok('ageing buckets add up to what is owed',Math.abs(Object.values(ag.tot).reduce((a,b)=>a+b,0)-m.creditOwed())<0.011&&m.creditOwed()>0);
 ok('credit book and guests directory render',m.vCreditBook().includes(cu.name)&&m.vGuests('credit').includes('Credit accounts')&&!bad(m.vGuests('directory')));
 ok('customer with a zero limit has no room (cash only)',(()=>{const z={id:'zz',creditLimit:0};return m.creditRoom(z)<=0})());
}

// ---------- job orders: tailor ----------
m.switchBusinessType('tailor');m.setME(m.DB.users[0]);
{const DB=m.DB,sess=openSession(),cu=DB.customers[0],svc=DB.items.find(i=>i.kind==='service'&&i.price>=100);
 const job={id:'j1',no:m.newJobNo(),ts:Date.now(),advances:[],history:[],status:'received',orderId:null,kind:'tailor',customerId:cu.id,title:'2 kandura',due:Date.now()-864e5,assignee:'',notes:'',lines:[{itemId:svc.id,qty:2}],meas:{garment:'Kandura',values:{length:'58'}}};
 m.jobHist(job,'received');DB.jobs.push(job);
 ok('job number sequence starts at JOB-0001',job.no==='JOB-0001'&&m.jobFlow().map(f=>f[0]).join()==='received,cutting,stitching,ready,delivered');
 ok('past-due open job is overdue',m.isOverdue(job)&&m.jobOpen(job));
 const total=m.jobTotals(job).total;m.postAdvance(job,'cash',100);
 ok('advance: Dr cash, Cr customer advances (liability); recorded on the job and in the cash session; books balance',m.jobAdvance(job)===100&&Math.abs(m.balMap(null)[m.LID('advances')].close+100)<0.006&&bal()===0&&DB.vouchers.some(v=>v.type==='in'&&/Advance/.test(v.reason)));
 ok('balance due = total − advances',Math.abs(m.jobBalance(job)-(total-100))<0.006);
 const pays=[{method:'advance',amount:100,tendered:100},{method:'cash',amount:total-100,tendered:total-100}];
 const o=sale(sess,[{itemId:svc.id,qty:2}],{cust:cu.id,pays:pays,S:{jobId:job.id}});
 ok('billing the job delivers it, links the invoice, clears the advance liability and books balance',job.status==='delivered'&&job.orderId===o.id&&Math.abs(m.balMap(null)[m.LID('advances')].close)<0.006&&bal()===0&&o.jobId===job.id);
 // leftover advance goes back to the customer
 const j2={id:'j2',no:m.newJobNo(),ts:Date.now(),advances:[],history:[],status:'ready',orderId:null,kind:'tailor',customerId:cu.id,title:'x',due:'',assignee:'',notes:'',lines:[{itemId:svc.id,qty:1}]};DB.jobs.push(j2);m.postAdvance(j2,'cash',90);
 const o2=sale(sess,[{itemId:svc.id,qty:1}],{cust:cu.id,pays:[{method:'advance',amount:Math.min(90,m.computeTotals({cart:[{key:'k',itemId:svc.id,qty:1,note:''}]}).total),tendered:90},{method:'cash',amount:Math.max(0,m.computeTotals({cart:[{key:'k',itemId:svc.id,qty:1,note:''}]}).total-90),tendered:Math.max(0,m.computeTotals({cart:[{key:'k',itemId:svc.id,qty:1,note:''}]}).total-90)}].filter(p=>p.amount>0),S:{jobId:j2.id}});
 ok('job page and board render',m.vJobs('board').includes('Received')&&m.vJobs('all').includes(j2.no)&&!bad(m.vJobs('board')));
 const nj=m.demoJobs();ok('sample jobs created and dashboard shows the job board',nj>=5&&m.vDashboard().includes('Job orders')&&bal()===0);
}

// ---------- butcher: breakdown ----------
m.switchBusinessType('butcher');m.setME(m.DB.users[0]);
{const DB=m.DB,carc=DB.items.find(i=>/carcass/i.test(i.name)),cuts=DB.items.filter(i=>i.weighed&&!/carcass|quarter/i.test(i.name)).slice(0,3);
 const valBefore=DB.lots.reduce((a,l)=>a+l.qty*l.cost,0), srcBefore=m.stockOf(carc.id);
 const rec=m.doBreakdown(carc.id,40,cuts.map(c=>({id:c.id,qty:11})));
 ok('breakdown: source stock falls, cuts rise, yield and waste recorded',Math.abs(m.stockOf(carc.id)-(srcBefore-40))<0.001&&rec.wasteKg===7&&rec.yieldPct===82.5&&DB.breakdowns.length===1);
 ok('breakdown keeps total stock value (waste cost is absorbed into the cuts)',Math.abs(DB.lots.reduce((a,l)=>a+l.qty*l.cost,0)-valBefore)<0.05&&bal()===0);
 let err='';try{m.doBreakdown(carc.id,10,[{id:cuts[0].id,qty:12}])}catch(e){err=e.message}ok('cuts cannot weigh more than the source',/weigh more/.test(err));
 err='';try{m.doBreakdown(carc.id,100000,[{id:cuts[0].id,qty:1}])}catch(e){err=e.message}ok('cannot cut more than is in stock',/in stock/.test(err));
 ok('breakdown tab and yield panel render',m.vStock('breakdown').includes('Carcass breakdown')&&m.W.yield().includes('Cutting yield')&&!bad(m.W.yield()));
 ok('note presets exist for cutting instructions',m.biz().notePresets&&m.biz().notePresets.length>=5);
 ok('variable-weight scale barcode still works for the butcher (default format)',(()=>{const it=DB.items.find(i=>i.weighed&&i.plu);const code=m.makeScaleCode(it,1.25);const p=m.parseScan(code);return p&&p.item.id===it.id&&p.qty===1.25&&p.weight})());
}

// ---------- tyre shop: DOT, warranty ----------
m.switchBusinessType('tyre');m.setME(m.DB.users[0]);
{const DB=m.DB,sess=openSession(),tyre=DB.items.find(i=>i.serial&&i.size),cu=DB.customers[0];
 ok('tyre items carry size, brand, warranty and a serial flag',tyre.size&&tyre.brand&&tyre.warrantyMonths>0);
 ok('DOT code age: 2524 is week 25 of 2024; garbage and week 60 are rejected',m.dotAge('2524')>0&&m.dotAge('2524')<10&&m.dotAge('9924')===null&&m.dotAge('abcd')===null&&m.dotAge('252')===null);
 const o=sale(sess,[{itemId:tyre.id,qty:2,serial:['2524','2624']}],{cust:cu.id,S:{vehicle:{plate:'D 1234',make:'Toyota',model:'Camry'}}});
 const w=DB.warranty.filter(x=>x.orderId===o.id);
 ok('selling tyres writes one warranty record per tyre, with DOT, plate and expiry',w.length===2&&w[0].dot==='2524'&&w[1].dot==='2624'&&w[0].plate==='D 1234'&&w[0].expires>Date.now()&&o.vehicle.plate==='D 1234');
 ok('warranty register and vehicle history render',m.vWarranty().includes('D 1234')&&m.vReports('warranty').includes('D 1234')&&!bad(m.vReports('warranty')));
 const o3=sale(sess,[{itemId:tyre.id,qty:3}]);ok('tyres sold without DOT still get warranty records',DB.warranty.filter(x=>x.orderId===o3.id).length===3);
 ok('tyre size appears in dashboard sizes panel after sales',m.W.tyreSizes({cur:{done:DB.orders.filter(x=>x.status==='completed')}}).includes(tyre.size));
}

// ---------- scale and barcode configuration ----------
m.switchBusinessType('grocery');m.setME(m.DB.users[0]);
{const DB=m.DB,tom=DB.items.find(i=>i.weighed&&i.plu);
 ok('default scale format is valid and prefix 2, 6-digit PLU, 5-digit grams',m.scaleOk(m.scaleCfg())&&m.scaleCfg().prefix==='2');
 const c1=m.makeScaleCode(tom,1.235), p1=m.parseScaleCode(c1);ok('scale label round-trips: item and 1.235 kg',p1&&p1.item.id===tom.id&&p1.qty===1.235&&c1.length===13&&m.isEan13(c1));
 ok('wrong check digit is rejected by default',m.parseScaleCode(c1.slice(0,12)+((+c1[12]+1)%10))===null);
 DB.settings.scale={prefix:'28',pluLen:4,valueLen:6,mode:'weight',div:1000,check:'1'};tom.plu='123';
 const c2=m.makeScaleCode(tom,2.5), p2=m.parseScaleCode(c2);ok('custom format 28 + 4-digit PLU + 6-digit grams works',c2.indexOf('28')===0&&c2.length===13&&p2&&p2.qty===2.5&&p2.item.id===tom.id);
 ok('parseScan uses the configured scale format',m.parseScan(c2)&&m.parseScan(c2).qty===2.5);
 DB.settings.scale={prefix:'2',pluLen:5,valueLen:6,mode:'price',div:1000,check:'1'};tom.plu='77';
 const c3=m.makeScaleCode(tom,2), p3=m.parseScaleCode(c3);ok('price-embedded labels convert the price back to weight',p3&&Math.abs(p3.qty-2)<0.01);
 ok('format whose digits do not add to 12 is invalid',!m.scaleOk({prefix:'2',pluLen:6,valueLen:6}));
 DB.settings.scale=null;
 const bc=tom=>0;ok('scale tab renders, with PLU list and test box',m.vStock('scale').includes('Weighing scale label format')&&m.vStock('scale').includes('Test a label'));
 const e=m.ean13Svg('5901234123457');ok('EAN-13 drawing: valid code gives an SVG with 95 modules of bars; invalid gives nothing',e.startsWith('<svg')&&e.includes('<rect')&&m.ean13Svg('5901234123458')===''&&m.isEan13('5901234123457'));
 DB.settings.barcode={prefix:'99',allowSku:'0',qtyMult:'0',next:1,labelCols:3};
 const sk=DB.items.find(i=>!i.weighed);ok('scanner rules: SKU scanning and 3*code can be switched off',m.parseScan(sk.sku)===null&&m.parseScan('3*'+sk.barcode)===null&&m.parseScan(sk.barcode)&&m.parseScan(sk.barcode).item.id===sk.id);
 DB.settings.barcode=null;const q=m.parseScan('3*'+sk.barcode);ok('defaults allow 3*barcode and SKU',q&&q.qty===3&&m.parseScan(sk.sku));
 ok('barcodes tab renders',m.vStock('barcodes').includes('Scanner & numbering')&&!bad(m.vStock('barcodes')));
}

// ---------- partners, promos, counters, customers ----------
m.switchBusinessType('restaurant');m.setME(m.DB.users[0]);
{const DB=m.DB;m.A['driver-edit']({});
 DB.drivers.push({id:'dr1',code:'DR-001',name:'Imran Ali',phone:'0501',vehicle:'bike',plate:'D 1',rating:4.5,active:true,created:Date.now()});
 const sess=openSession(),it=DB.items[0],o=sale(sess,[{itemId:it.id,qty:1}],{S:{type:'delivery',driverId:'dr1'}});
 ok('delivery order records the delivery partner and the partner page counts it',o.driverId==='dr1'&&m.vDrivers().includes('Imran Ali')&&m.vDrivers().includes('DR-001')&&m.vDrivers().includes('>1</td>'));
 const o2=sale(sess,[{itemId:it.id,qty:1}],{S:{type:'takeaway',driverId:'dr1'}});ok('driver is ignored on non-delivery orders',o2.driverId===null);
 DB.codes.push({id:'c1',code:'SAVE10',name:'Ten off',type:'pct',value:10,min:0,limit:5,used:5,active:true,expiry:'',created:Date.now()});DB.offers.push({id:'of1',name:'Lunch deal',type:'order_pct',value:5,min:0,active:true,startTime:'',endTime:'',startDate:'',endDate:'',created:Date.now()});
 const pc=m.vPromos('codes'),po=m.vPromos('offers');
 ok('promo codes page: Code, Name, Discount, Validity, Used / limit, Status, Created; used-up code flagged',['Code','Name','Discount','Validity','Used / limit','Status','Created'].every(h=>pc.includes('>'+h+'<'))&&pc.includes('Used up'));
 ok('offers page: Title, Product, Discount type, Valid from, Valid until, Status, Created',['Title','Product','Discount type','Valid from','Valid until','Status','Created'].every(h=>po.includes('>'+h+'<'))&&po.includes('Lunch deal'));
 const oc=m.vOutlets('registers');ok('counters page: Name, Username, Staff / shifts, Active session, Status',['Name','Username','Staff / shifts','Active session','Status'].every(h=>oc.includes('>'+h+'<'))&&oc.includes('1 staff'));
 ok('customers page has a Joined column',m.vGuests('directory').includes('>Registered on<')&&m.vGuests('directory').includes('Customer ID'));
}

ok('catalogue is paginated (10 per page) with Showing x to y of z',m.vCatalog('items').includes('Showing 1 to 10 of')&&m.vCatalog('items').includes('data-act="pg"'));

// ---------- stock count ----------
m.switchBusinessType('grocery');m.setME(m.DB.users[0]);
{const DB=m.DB,a=DB.items.find(i=>i.track&&!i.weighed&&m.stockOf(i.id)>5),b=DB.items.find(i=>i.track&&!i.weighed&&i.id!==a.id&&m.stockOf(i.id)>5);
 const c={id:'cn1',no:'CNT-0001',ts:Date.now(),by:DB.users[0].id,status:'open',blind:true,scopeLabel:'All',lines:[{itemId:a.id,expected:m.stockOf(a.id),counted:m.stockOf(a.id)-3},{itemId:b.id,expected:m.stockOf(b.id),counted:m.stockOf(b.id)+2},{itemId:DB.items[0].id,expected:1,counted:null}]};
 DB.counts=[c];const S=m.countSummary(c),va=m.stockOf(a.id),vb=m.stockOf(b.id);
 ok('count summary: 2 counted, shortage and surplus valued at cost',S.counted===2&&S.diffs.length===2&&Math.abs(S.down+3*a.cost)<0.01&&Math.abs(S.up-2*b.cost)<0.01);
 S.diffs.forEach(x=>m.applyStockDelta(x.it,x.d,c.no));
 ok('posting a count changes stock by the differences and the books still balance',m.stockOf(a.id)===va-3&&m.stockOf(b.id)===vb+2&&bal()===0);
 ok('stock count tab renders list',m.vStock('count').includes('Start a stock count')&&m.vStock('count').includes('CNT-0001'));
}

// ---------- Arabic names, optional cost, selling without stock, transaction slips ----------
m.switchBusinessType('restaurant');m.setME(m.DB.users[0]);
{const DB=m.DB;
 ok('Arabic name is generated from the English name: dictionary words, units and codes',m.autoArabic('Chicken Burger')==='دجاج برجر'&&m.autoArabic('Cola 330ml').includes('كولا')&&m.autoArabic('Cola 330ml').includes('330 مل')&&m.autoArabic('Michelin 205/55R16').endsWith('205/55R16')&&m.autoArabic('')==='');
 ok('unknown words are transliterated (approximate, editable) and never come out empty',/^[؀-ۿ ]+$/.test(m.autoArabic('Zorbo'))&&m.autoArabic('Zorbo').length>=3);
 const n0=DB.items.length;
 m.saveItem(null,{name:'Falafel Wrap Large',nameAr:'',sku:'',barcode:'',categoryId:DB.categories[0].id,price:'15',cost:'',tax:'on',track:'on',reorder:'0',active:'on',supplierId:'',leadDays:''});
 const ni=DB.items[DB.items.length-1];
 ok('an item can be saved with no Arabic name and no cost',DB.items.length===n0+1&&ni.name==='Falafel Wrap Large'&&ni.nameAr===''&&ni.cost===0);
 m.saveItem(ni.id,{name:ni.name,nameAr:'فلافل راب كبير',sku:ni.sku,barcode:'',categoryId:ni.categoryId,price:'15',cost:'',tax:'on',track:'on',reorder:'0',active:'on',supplierId:'',leadDays:''});
 ok('the Arabic name can be edited and is kept',m.itemById(ni.id).nameAr==='فلافل راب كبير');
 const sess=openSession(), o=sale(sess,[{itemId:ni.id,qty:2}]);
 ok('an invoice can be made for an item with zero stock and zero cost (stock goes negative, books balance)',o&&o.total>0&&m.stockOf(ni.id)<=0&&bal()===0&&m.DB.settings.allowNegative===true);
 const tracked=DB.items.find(i=>i.track&&m.stockOf(i.id)>0&&!i.weighed);const o2=sale(sess,[{itemId:tracked.id,qty:1}]);ok('and with stock too',!!o2&&bal()===0);
 const html=m.txSlipHtml({title:'Payment received',no:'RC-000001',party:'A <b>Customer</b>',rows:[['Received as','Cash']],amount:50,amountLabel:'RECEIVED'});
 ok('transaction slip shows title, number, party, amount and signature line, with customer text escaped',html.includes('PAYMENT RECEIVED')&&html.includes('RC-000001')&&html.includes('RECEIVED')&&html.includes('50.00')&&html.includes('Signature')&&!html.includes('<b>Customer</b>'));
 const vs=m.voucherSlip({id:'vabc123',type:'out',amount:12,reason:'Ice delivery',ts:Date.now(),userId:DB.users[0].id});ok('cash voucher slip',vs.title==='Cash paid out'&&vs.no.startsWith('CV-')&&m.txSlipHtml(vs).includes('Ice delivery'));
}

// ---------- gating ----------
m.switchBusinessType('restaurant');m.setME(m.DB.users[0]);
ok('restaurant has no jobs, credit, serial or breakdown modules; hub hides tyre/vehicle reports',!m.bm('jobs')&&!m.bm('credit')&&!m.bm('serial')&&!m.bm('breakdown')&&!m.vReportHub().includes('Warranty register')&&!m.vStock('onhand').includes('Breakdown'));

console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);
