'use strict';
/* Harbinger POS — core: data store, helpers, auth, stock, totals.
   Demo-grade client-side app: data lives in this browser's localStorage. */

/* ---------- sha256 (pure JS, works on file://) ---------- */
function sha256(ascii){
  function rr(v,a){return (v>>>a)|(v<<(32-a));}
  var mp=Math.pow,mw=mp(2,32),i,j,result='';
  var words=[],abl=ascii.length*8,hash=sha256.h=sha256.h||[],k=sha256.k=sha256.k||[],pc=k.length,ic={};
  for(var c=2;pc<64;c++){ if(!ic[c]){ for(i=0;i<313;i+=c)ic[i]=c; hash[pc]=(mp(c,.5)*mw)|0; k[pc++]=(mp(c,1/3)*mw)|0; } }
  ascii+='\x80'; while(ascii.length%64-56)ascii+='\x00';
  for(i=0;i<ascii.length;i++){ j=ascii.charCodeAt(i); if(j>>8)return ''; words[i>>2]|=j<<((3-i)%4)*8; }
  words[words.length]=((abl/mw)|0); words[words.length]=(abl);
  for(j=0;j<words.length;){
    var w=words.slice(j,j+=16),oldHash=hash; hash=hash.slice(0,8);
    for(i=0;i<64;i++){
      var w15=w[i-15],w2=w[i-2],a=hash[0],e=hash[4];
      var t1=hash[7]+(rr(e,6)^rr(e,11)^rr(e,25))+((e&hash[5])^((~e)&hash[6]))+k[i]+(w[i]=(i<16)?w[i]:(w[i-16]+(rr(w15,7)^rr(w15,18)^(w15>>>3))+w[i-7]+(rr(w2,17)^rr(w2,19)^(w2>>>10)))|0);
      var t2=(rr(a,2)^rr(a,13)^rr(a,22))+((a&hash[1])^(a&hash[2])^(hash[1]&hash[2]));
      hash=[(t1+t2)|0].concat(hash); hash[4]=(hash[4]+t1)|0;
    }
    for(i=0;i<8;i++)hash[i]=(hash[i]+oldHash[i])|0;
  }
  for(i=0;i<8;i++)for(j=3;j+1;j--){var b=(hash[i]>>(j*8))&255;result+=((b<16)?0:'')+b.toString(16);}
  return result;
}
const hashPw=(user,pw)=>sha256(unescape(encodeURIComponent('hb|'+String(user).toLowerCase()+'|'+pw)));

/* ---------- helpers ---------- */
const KEY='harbinger_pos_v1';
let DB=null, ME=null;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.prototype.slice.call(r.querySelectorAll(s));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DEC_BY_CUR={BHD:3,KWD:3,OMR:3,JOD:3,TND:3,IQD:3,LYD:3};
const curDec=()=>{const s=typeof DB!=='undefined'&&DB&&DB.settings;if(!s)return 2;if(s.decimals!=null&&s.decimals!=='')return Math.min(3,Math.max(0,+s.decimals));return DEC_BY_CUR[s.currency]||2};
const r2=n=>{const p=Math.pow(10,curDec());return Math.round((Number(n)+Number.EPSILON)*p)/p};
const num=v=>{const n=parseFloat(v);return isFinite(n)?n:0};
const fmt=n=>{const d=curDec();return Number(n||0).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d})};
const money=n=>(DB?DB.settings.currency:'AED')+' '+fmt(n);
const uid=p=>p+'_'+Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-3);
const now=()=>Date.now();
const pad=n=>String(n).padStart(2,'0');
const dayKey=ts=>{const d=new Date(ts);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
const fmtDT=ts=>ts?new Date(ts).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'—';
const fmtDate=ts=>ts?new Date(ts).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—';
const daysFromNow=d=>now()+d*864e5;
const byId=(arr,id)=>arr.find(x=>x.id===id);
const itemById=id=>byId(DB.items,id);
const catName=id=>{const c=byId(DB.categories,id);return c?c.name:'—'};
const userName=id=>{const u=byId(DB.users,id);return u?u.name:'—'};

/* ---------- storage ---------- */
function load(){
  try{DB=JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){DB=null}
  if(!DB||!DB.settings){DB=seed();save()}
  migrate();
}
function save(){
  try{localStorage.setItem(KEY,JSON.stringify(DB))}
  catch(e){ if(typeof toast==='function')toast('Could not save: browser storage is full or blocked.','err') }
}
function migrate(){ if(DB.settings&&!DB.settings.sellAlways){DB.settings.allowNegative=true;DB.settings.sellAlways=1} DB.counts=DB.counts||[]; DB.drivers=DB.drivers||[]; DB.jobs=DB.jobs||[]; DB.warranty=DB.warranty||[]; DB.breakdowns=DB.breakdowns||[]; DB.providers=DB.providers||[]; DB.rxLog=DB.rxLog||[]; DB.suppliers=DB.suppliers||[]; DB.pos=DB.pos||[]; DB.held=DB.held||[]; DB.audit=DB.audit||[]; DB.vouchers=DB.vouchers||[]; DB.seq=DB.seq||{order:0,po:0}; if(DB.seq.job==null)DB.seq.job=0;
  if(DB.settings.blockExpired===undefined)DB.settings.blockExpired=true;
  if(!DB.settings.businessType)DB.settings.businessType='restaurant';
  if(typeof ensureAccounts==='function')ensureAccounts();
  if(typeof ensureEinv==='function')ensureEinv();
  DB.online=DB.online||[]; DB.itemMap=DB.itemMap||{}; DB.channels=DB.channels||{}; if(DB.settings.kotPrinters==null)DB.settings.kotPrinters=0;
  if(!DB.settings.businessHours)DB.settings.businessHours=[
    {day:'Monday',enabled:true,open:'08:00',close:'22:00'},{day:'Tuesday',enabled:true,open:'08:00',close:'22:00'},
    {day:'Wednesday',enabled:true,open:'08:00',close:'22:00'},{day:'Thursday',enabled:true,open:'08:00',close:'22:00'},
    {day:'Friday',enabled:true,open:'08:00',close:'23:00'},{day:'Saturday',enabled:true,open:'09:00',close:'23:00'},
    {day:'Sunday',enabled:true,open:'09:00',close:'22:00'}];
  if(DB.settings.autoCloseShift===undefined)DB.settings.autoCloseShift=false;
  if(DB.settings.notePresets===undefined)DB.settings.notePresets=null;
  if(Array.isArray(DB.settings.notePresets)&&DB.settings.notePresets.length&&typeof DB.settings.notePresets[0]==='string'){
    DB.settings.notePresets=DB.settings.notePresets.map(t=>({id:uid('np'),text:t,active:true}));
  }
  if(!DB.settings.features)DB.settings.features={businessHours:true,kotPrinting:true,tableManagement:true};
  if(DB.settings.features.businessHours===undefined)DB.settings.features.businessHours=true;
  if(DB.settings.features.kotPrinting===undefined)DB.settings.features.kotPrinting=true;
  if(DB.settings.features.tableManagement===undefined)DB.settings.features.tableManagement=true;
  if(DB.settings.features.restaurantModule===undefined)DB.settings.features.restaurantModule=false;
  if(DB.settings.features.aiImageGen===undefined)DB.settings.features.aiImageGen=true;
  if(DB.settings.features.aiDemandForecast===undefined)DB.settings.features.aiDemandForecast=true;
  if(DB.settings.features.barcodeGen===undefined)DB.settings.features.barcodeGen=true;
  if(DB.settings.features.eInvoicing===undefined)DB.settings.features.eInvoicing=true;
  if(DB.settings.features.shiftManagement===undefined)DB.settings.features.shiftManagement=true;
  DB.kitchens=DB.kitchens||[];
  DB.tables=DB.tables||[];
}
function audit(action,detail){
  DB.audit.unshift({id:uid('a'),ts:now(),user:ME?ME.id:null,action:action,detail:detail||''});
  if(DB.audit.length>1500)DB.audit.length=1500;
}

function seed(type){
  const t=now();
  const catAr=['برجر','ساندويتشات ولفائف','أطباق جانبية','مشروبات','حلويات'];
  const cats=['Burgers','Wraps & Sandwiches','Sides','Drinks','Desserts'].map((n,i)=>({id:'c'+(i+1),name:n,nameAr:catAr[i]}));
  const itemAr={'Classic Burger':'برجر كلاسيك','Cheese Burger':'برجر بالجبن','Chicken Burger':'برجر دجاج','Chicken Wrap':'لفافة دجاج','Falafel Wrap':'لفافة فلافل','Club Sandwich':'كلوب ساندويتش','French Fries':'بطاطس مقلية','Onion Rings':'حلقات البصل','Coleslaw':'سلطة كولسلو','Fresh Orange Juice':'عصير برتقال طازج','Mint Lemonade':'ليمون بالنعناع','Cola Can':'علبة كولا','Water 500ml':'مياه ٥٠٠ مل','Chocolate Brownie':'براوني الشوكولاتة','Ice Cream Cup':'كوب آيس كريم'};
  const raw=[
    ['Classic Burger','c1',24,9],['Cheese Burger','c1',27,10.5],['Chicken Burger','c1',25,9.5],
    ['Chicken Wrap','c2',18,6.5],['Falafel Wrap','c2',14,4.5],['Club Sandwich','c2',22,8],
    ['French Fries','c3',9,2.5],['Onion Rings','c3',11,3],['Coleslaw','c3',6,1.5],
    ['Fresh Orange Juice','c4',12,4],['Mint Lemonade','c4',10,2.5],['Cola Can','c4',5,2],['Water 500ml','c4',2,0.6],
    ['Chocolate Brownie','c5',13,4.5],['Ice Cream Cup','c5',9,3]
  ];
  const items=[],lots=[],movements=[];
  raw.forEach((r,i)=>{
    const it={id:'i'+(i+1),name:r[0],nameAr:itemAr[r[0]]||'',sku:'SKU'+String(i+1).padStart(3,'0'),barcode:'629000000'+String(i+1).padStart(4,'0'),categoryId:r[1],price:r[2],cost:r[3],tax:true,track:true,reorder:10,active:true};
    items.push(it);
    let qty=60+((i*13)%60), exp=daysFromNow(60+i*5);
    if(r[0]==='Coleslaw')qty=6;
    if(r[0]==='Ice Cream Cup'){qty=24;exp=daysFromNow(6)}
    if(r[0]==='Cola Can'||r[0]==='Water 500ml')qty=200;
    const lot={id:'l'+(i+1),itemId:it.id,lotNo:'OPEN-'+(i+1),expiry:exp,qty:qty,cost:r[3],receivedAt:t};
    lots.push(lot);
    movements.push({id:uid('m'),ts:t,itemId:it.id,lotId:lot.id,type:'receive',qty:qty,ref:'Opening stock',user:'u1',note:''});
  });
  const users=[
    {id:'u1',name:'Owner',username:'admin',role:'admin',pin:'1234',pass:hashPw('admin','admin123'),active:true},
    {id:'u2',name:'Manager',username:'manager',role:'manager',pin:'2345',pass:hashPw('manager','manager123'),active:true},
    {id:'u3',name:'Cashier',username:'cashier',role:'cashier',pin:'3456',pass:hashPw('cashier','cashier123'),active:true}
  ];
  const db={
    v:1,
    settings:{business:'Harbinger Demo Restaurant',trn:'100000000000003',address:'Dubai, UAE',phone:'',currency:'AED',vatPct:5,taxInclusive:true,country:'AE',taxLabel:'VAT',receiptLang:'both',charges:[],countryCode:'971',
      footer:'Thank you for dining with us!',pointsPerAed:0.1,pointValue:0.1,caps:{admin:100,manager:30,cashier:10},allowNegative:true,sellAlways:1,businessType:'restaurant',blockExpired:true,theme:'A',mode:'auto'},
    users:users,categories:cats,items:items,lots:lots,movements:movements,
    customers:[
      {id:'g1',name:'Walk-in Sample',phone:'0500000001',email:'',points:25,visits:0,spend:0,notes:'',created:t},
      {id:'g2',name:'Aisha Khan',phone:'0500000002',email:'aisha@example.com',points:0,visits:0,spend:0,notes:'',created:t},
      {id:'g3',name:'Omar Saleh',phone:'0500000003',email:'',points:0,visits:0,spend:0,notes:'VIP',created:t}
    ],
    offers:[{id:'o1',name:'Happy Hour Drinks 20%',type:'cat_pct',value:20,min:0,categoryId:'c4',startTime:'15:00',endTime:'17:00',startDate:'',endDate:'',active:true}],
    codes:[{id:'p1',code:'WELCOME10',type:'pct',value:10,min:30,limit:0,used:0,expiry:'',active:true}],
    counters:[{id:'k1',name:'Counter 1',code:'C1',active:true},{id:'k2',name:'Counter 2',code:'C2',active:true}],
    sessions:[],vouchers:[],orders:[],held:[],suppliers:[{id:'s1',name:'Fresh Foods Trading',phone:'',email:'',terms:'Net 30'}],pos:[],audit:[],
    seq:{order:0,po:0}
  };
  return typeof finishSeed==='function'?finishSeed(db,type||'restaurant',t):db;
}

/* ---------- auth & permissions ---------- */
const PERMS={
  admin:['dashboard','catalog','stock','guests','promos','team','outlets','orders','reports','settings','register','refund','discount_override','voucher','accounts','kitchen','online','controlled','jobs','drivers'],
  manager:['dashboard','catalog','stock','guests','promos','outlets','orders','reports','register','refund','discount_override','voucher','kitchen','online','controlled','jobs','drivers'],
  kitchen:['kitchen'],
  accountant:['dashboard','accounts','reports','orders'],
  cashier:['register','guests','orders','online','jobs'],
  technician:['jobs'],
  waiter:['register','orders'],
  stock_keeper:['stock'],
  pharmacist:['register','guests','orders','stock','online','controlled'],
  billing:['register','guests','orders']
};
const can=p=>!!(ME&&PERMS[ME.role]&&PERMS[ME.role].indexOf(p)>=0);
function login(username,pw){
  const u=DB.users.find(x=>x.active&&x.username.toLowerCase()===String(username).trim().toLowerCase());
  if(!u||u.pass!==hashPw(u.username,pw))return false;
  ME=u; try{sessionStorage.setItem('hb_user',u.id)}catch(e){}
  audit('login',u.username); save(); return true;
}
function restoreSession(){
  try{const id=sessionStorage.getItem('hb_user');if(id){const u=byId(DB.users,id);if(u&&u.active)ME=u}}catch(e){}
}
function logout(){ ME=null; try{sessionStorage.removeItem('hb_user')}catch(e){} }
function roleCap(){ return DB.settings.caps[ME?ME.role:'cashier']||0 }

/* ---------- stock ---------- */
const lotsOf=id=>DB.lots.filter(l=>l.itemId===id&&l.qty!==0).sort((a,b)=>(a.expiry||9e15)-(b.expiry||9e15)||a.receivedAt-b.receivedAt);
const rq=n=>Math.round((Number(n)+Number.EPSILON)*1000)/1000;
const isExpired=l=>!!(l.expiry&&l.expiry<now());
const stockOf=id=>rq(DB.lots.filter(l=>l.itemId===id).reduce((s,l)=>s+l.qty,0));
/* what can legally be sold: when "block expired" is on, expired lots do not count */
const sellableOf=id=>rq(stockOf(id)-(DB.settings.blockExpired?DB.lots.filter(l=>l.itemId===id&&l.qty>0&&isExpired(l)).reduce((s,l)=>s+l.qty,0):0));
function nearestExpiry(id){const l=DB.lots.filter(x=>x.itemId===id&&x.qty>0&&x.expiry).sort((a,b)=>a.expiry-b.expiry)[0];return l?l.expiry:null}
function logMove(itemId,lotId,type,qty,ref,note){
  DB.movements.unshift({id:uid('m'),ts:now(),itemId:itemId,lotId:lotId,type:type,qty:qty,ref:ref||'',user:ME?ME.id:null,note:note||''});
  if(DB.movements.length>5000)DB.movements.length=5000;
}
function receiveLot(itemId,lotNo,expiry,qty,cost,ref){
  const lot={id:uid('l'),itemId:itemId,lotNo:lotNo||('L'+Date.now().toString(36)),expiry:expiry||null,qty:qty,cost:cost,receivedAt:now()};
  DB.lots.push(lot); logMove(itemId,lot.id,'receive',qty,ref||'Receive',''); return lot;
}
/* FEFO deduction. Returns allocations [{lotId,qty}] */
function deductStock(itemId,qty,ref,mvType){
  let need=qty; const allocs=[];
  for(const l of lotsOf(itemId)){
    if(need<=0)break; if(l.qty<=0)continue;
    if(DB.settings.blockExpired&&isExpired(l))continue;
    const take=Math.min(l.qty,need); l.qty=rq(l.qty-take); need=rq(need-take);
    allocs.push({lotId:l.id,qty:take}); logMove(itemId,l.id,mvType||'sale',-take,ref,'');
  }
  if(need>0){
    let l=DB.lots.filter(x=>x.itemId===itemId).sort((a,b)=>b.receivedAt-a.receivedAt)[0];
    if(!l){const it=itemById(itemId);l={id:uid('l'),itemId:itemId,lotNo:'NEG',expiry:null,qty:0,cost:it?it.cost:0,receivedAt:now()};DB.lots.push(l)}
    l.qty=rq(l.qty-need); allocs.push({lotId:l.id,qty:need}); logMove(itemId,l.id,'sale',-need,ref,'oversold');
  }
  return allocs;
}
function returnStock(allocs,itemId,ref){
  (allocs||[]).forEach(a=>{
    let l=byId(DB.lots,a.lotId);
    if(!l){const it=itemById(itemId);l={id:uid('l'),itemId:itemId,lotNo:'RET',expiry:null,qty:0,cost:it?it.cost:0,receivedAt:now()};DB.lots.push(l)}
    l.qty=rq(l.qty+a.qty); logMove(itemId,l.id,'refund',a.qty,ref,'');
  });
}

/* ---------- promotions & totals ---------- */
function offerActive(o,at){
  if(!o.active)return false;
  const d=new Date(at||now()), key=dayKey(d.getTime()), hm=pad(d.getHours())+':'+pad(d.getMinutes());
  if(o.startDate&&key<o.startDate)return false;
  if(o.endDate&&key>o.endDate)return false;
  if(o.startTime&&o.endTime){
    if(o.startTime<=o.endTime){ if(hm<o.startTime||hm>=o.endTime)return false }
    else if(hm<o.startTime&&hm>=o.endTime)return false;
  }
  return true;
}
function codeCheck(c,base){
  if(!c||!c.active)return {ok:false,msg:'Code is not active'};
  if(c.expiry&&dayKey(now())>c.expiry)return {ok:false,msg:'Code has expired'};
  if(c.limit>0&&c.used>=c.limit)return {ok:false,msg:'Code usage limit reached'};
  if(base<c.min)return {ok:false,msg:'Minimum spend '+money(c.min)+' not met'};
  return {ok:true};
}
function computeTotals(S){
  const s=DB.settings, rate=s.vatPct/100;
  const lines=S.cart.map(l=>{const it=itemById(l.itemId),unit=l.price!=null?l.price:it.price;return Object.assign({},l,{it:it,unit:unit,total:r2(l.qty*unit)})});
  const subtotal=r2(lines.reduce((a,l)=>a+l.total,0));
  let rem=subtotal; const discounts=[];
  let best=null;
  DB.offers.forEach(o=>{
    if(!offerActive(o))return; let d=0;
    if(o.type==='order_pct'&&subtotal>=o.min)d=subtotal*o.value/100;
    else if(o.type==='order_amt'&&subtotal>=o.min)d=o.value;
    else if(o.type==='cat_pct')d=lines.filter(l=>l.it.categoryId===o.categoryId).reduce((a,l)=>a+l.total,0)*o.value/100;
    d=Math.min(r2(d),rem);
    if(d>0&&(!best||d>best.amount))best={kind:'offer',label:o.name,amount:d};
  });
  if(best){discounts.push(best);rem=r2(rem-best.amount)}
  let codeMsg='';
  if(S.code){
    const c=byId(DB.codes,S.code), chk=codeCheck(c,subtotal);
    if(chk.ok){const d=Math.min(r2(c.type==='pct'?rem*c.value/100:c.value),rem);if(d>0){discounts.push({kind:'code',label:'Code '+c.code,amount:d});rem=r2(rem-d)}}
    else codeMsg=chk.msg;
  }
  if(S.manual&&S.manual.value>0){
    const d=Math.min(r2(S.manual.kind==='pct'?rem*S.manual.value/100:S.manual.value),rem);
    if(d>0){discounts.push({kind:'manual',label:'Discount'+(S.manual.kind==='pct'?' '+S.manual.value+'%':''),amount:d});rem=r2(rem-d)}
  }
  let redeemed=0;
  if(S.redeem>0){
    const cu=byId(DB.customers,S.customerId);
    const pts=cu?Math.min(S.redeem,cu.points):0;
    const d=Math.min(r2(pts*s.pointValue),rem);
    if(d>0){redeemed=Math.min(pts,Math.ceil(d/s.pointValue-1e-9));discounts.push({kind:'points',label:'Points '+redeemed,amount:d});rem=r2(rem-d)}
  }
  const net=rem;
  const taxBase=subtotal>0?lines.filter(l=>l.it.tax).reduce((a,l)=>a+l.total,0)/subtotal:0;
  const vat=r2(s.taxInclusive?net*taxBase*rate/(1+rate):net*taxBase*rate);
  const total=r2(s.taxInclusive?net:net+vat);
  const discountTotal=r2(discounts.reduce((a,d)=>a+d.amount,0));
  /* service charge / municipality fee style add-ons, on ex-VAT sales, optionally taxable, optionally only for some order types */
  const charges=[], baseEx=s.taxInclusive?r2(net-vat):net;
  (s.charges||[]).forEach(c=>{
    if(!c||!(c.pct>0)||net<=0)return; if(c.types&&c.types.length&&c.types.indexOf(S.type||'takeaway')<0)return;
    const amt=r2(baseEx*c.pct/100); if(amt>0)charges.push({id:c.id,name:c.name,pct:c.pct,amount:amt,vat:c.taxable?r2(amt*rate):0,taxable:!!c.taxable,payable:!!c.payable});
  });
  const chargeTotal=r2(charges.reduce((a,c)=>a+c.amount,0)), chargeVat=r2(charges.reduce((a,c)=>a+c.vat,0));
  return {lines:lines,subtotal:subtotal,discounts:discounts,discountTotal:discountTotal,net:net,vat:r2(vat+chargeVat),itemVat:vat,total:r2(total+chargeTotal+chargeVat),charges:charges,chargeTotal:chargeTotal,redeemed:redeemed,codeMsg:codeMsg};
}

/* ---------- sessions / cash ---------- */
const openSession=counterId=>DB.sessions.find(x=>x.counterId===counterId&&!x.closedAt);
function sessionStats(sess){
  const ords=DB.orders.filter(o=>o.sessionId===sess.id);
  const done=ords.filter(o=>o.status==='completed');
  const tender={};
  ords.forEach(o=>o.payments.forEach(p=>{tender[p.method]=r2((tender[p.method]||0)+p.amount)}));
  const cashSales=tender.cash||0;
  const vs=DB.vouchers.filter(v=>v.sessionId===sess.id);
  const vin=r2(vs.filter(v=>v.type==='in').reduce((a,v)=>a+v.amount,0));
  const vout=r2(vs.filter(v=>v.type==='out').reduce((a,v)=>a+v.amount,0));
  const refunds=r2(vs.filter(v=>v.type==='refund').reduce((a,v)=>a+v.amount,0));
  const expected=r2(sess.float+cashSales+vin-vout-refunds);
  return {orders:done.length,gross:r2(done.reduce((a,o)=>a+o.subtotal,0)),discounts:r2(done.reduce((a,o)=>a+o.discountTotal,0)),
    vat:r2(done.reduce((a,o)=>a+o.vat,0)),net:r2(done.reduce((a,o)=>a+o.total,0)),tender:tender,cashSales:cashSales,vin:vin,vout:vout,refunds:refunds,expected:expected,
    refundedOrders:ords.filter(o=>o.status==='refunded').length};
}
