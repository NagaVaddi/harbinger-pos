'use strict';
/* Harbinger Dashboard — one dashboard engine, six layouts (restaurant, supermarket, retail, pharmacy, clinic, salon).
   Each business type picks its KPI tiles and its panels (BIZ[type].dash). Sales are shown ex-tax: that is what the business actually earns. */

const D_RANGES=[['today','Today'],['yesterday','Yesterday'],['7d','Last 7 days'],['30d','Last 30 days']];
const dayStart=ts=>{const d=new Date(ts);d.setHours(0,0,0,0);return d.getTime()};
function dRange(r){
  const t=now(), s0=dayStart(t), DAYMS=864e5;
  if(r==='yesterday')return {from:s0-DAYMS,to:s0-1,pf:s0-2*DAYMS,pt:s0-DAYMS-1,label:'vs the day before',days:1,hourly:true};
  if(r==='7d')return {from:s0-6*DAYMS,to:t,pf:s0-13*DAYMS,pt:s0-6*DAYMS-1,label:'vs the previous 7 days',days:7};
  if(r==='30d')return {from:s0-29*DAYMS,to:t,pf:s0-59*DAYMS,pt:s0-29*DAYMS-1,label:'vs the previous 30 days',days:30};
  return {from:s0,to:t,pf:s0-DAYMS,pt:s0-1,label:'vs yesterday',days:1,hourly:true};
}
const inR=(o,a,b)=>o.ts>=a&&o.ts<=b;
const netEx=o=>r2(o.total-o.vat);
const orderCogs=o=>r2(o.lines.reduce((a,l)=>a+(l.cogs!=null&&l.cogs>0?l.cogs:l.qty*(l.cost||0)),0));
const unitsOf=o=>rq(o.lines.reduce((a,l)=>a+l.qty,0));
const lineRevEx=(l)=>{const ex=DB.settings.taxInclusive&&l.tax!==false?l.price/(1+DB.settings.vatPct/100):l.price;return r2(l.qty*ex)};
function agg(orders){
  const done=orders.filter(o=>o.status==='completed'), ref=orders.filter(o=>o.status==='refunded');
  const sales=r2(done.reduce((a,o)=>a+netEx(o),0)), cogs=r2(done.reduce((a,o)=>a+orderCogs(o),0)), units=rq(done.reduce((a,o)=>a+unitsOf(o),0));
  return {n:done.length,sales:sales,gross:r2(sales-cogs),margin:sales>0?(sales-cogs)/sales*100:0,aov:done.length?sales/done.length:0,units:units,upb:done.length?units/done.length:0,
    disc:r2(done.reduce((a,o)=>a+o.discountTotal,0)),refunds:ref.length,refundValue:r2(ref.reduce((a,o)=>a+o.total,0)),returnRate:(done.length+ref.length)?ref.length/(done.length+ref.length)*100:0,done:done};
}
const pct=(a,b)=>b>0?Math.round((a-b)/b*100):(a>0?100:0);

/* ---------- small SVG charts ---------- */
function spark(vals){
  if(!vals.length||Math.max.apply(null,vals)<=0)return '<svg class="spark" viewBox="0 0 100 28" aria-hidden="true"></svg>';
  const max=Math.max.apply(null,vals),n=vals.length, pts=vals.map((v,i)=>[n>1?i/(n-1)*100:50,26-(v/max)*24]);
  return '<svg class="spark" viewBox="0 0 100 28" aria-hidden="true" preserveAspectRatio="none"><polyline points="'+pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')+'" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>';
}
function lineChart(labels,cur,prev,fmtV){
  const W=640,H=230,pl=48,pr=10,pt=12,pb=26, n=labels.length, max=Math.max.apply(null,cur.concat(prev,[1]));
  const step=Math.pow(10,Math.floor(Math.log10(max))), top=Math.ceil(max/step)*step||1;
  const X=i=>pl+(n>1?i/(n-1):0.5)*(W-pl-pr), Y=v=>pt+(H-pt-pb)*(1-v/top);
  let s='<svg viewBox="0 0 '+W+' '+H+'" class="chart" role="img" aria-label="Sales trend compared with the previous period">';
  for(let i=0;i<=4;i++){const y=pt+(H-pt-pb)*(1-i/4);s+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y+'" y2="'+y+'" class="grid"/><text x="'+(pl-6)+'" y="'+(y+4)+'" class="ax" text-anchor="end">'+fmtV(top*i/4)+'</text>'}
  const every=Math.max(1,Math.ceil(n/8)); labels.forEach((l,i)=>{if(i%every===0)s+='<text x="'+X(i)+'" y="'+(H-8)+'" class="ax" text-anchor="middle">'+esc(l)+'</text>'});
  const path=a=>a.map((v,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1)).join(' ');
  if(prev.some(v=>v>0))s+='<path d="'+path(prev)+'" class="prev" fill="none"/>';
  if(n>1)s+='<path d="'+path(cur)+' L'+X(n-1).toFixed(1)+' '+Y(0)+' L'+X(0).toFixed(1)+' '+Y(0)+'Z" class="area"/>';
  s+='<path d="'+path(cur)+'" class="line" fill="none"/>';
  cur.forEach((v,i)=>{s+='<circle cx="'+X(i).toFixed(1)+'" cy="'+Y(v).toFixed(1)+'" r="3.5" class="dot"><title>'+esc(labels[i])+': '+fmt(v)+(prev[i]!=null?' (before: '+fmt(prev[i])+')':'')+'</title></circle>'});
  return s+'</svg>';
}
function heatmap(orders){
  const grid=Array.from({length:7},()=>new Array(24).fill(0)); let max=0;
  orders.forEach(o=>{if(o.status!=='completed')return;const d=new Date(o.ts);grid[d.getDay()][d.getHours()]+=netEx(o);});
  grid.forEach(r=>r.forEach(v=>{if(v>max)max=v}));
  const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], hours=[];for(let h=8;h<=23;h++)hours.push(h);
  let h='<div class="heat" role="img" aria-label="Sales by weekday and hour"><div class="hrow hhead"><span></span>'+hours.map(x=>'<span>'+(x%3===0?x:'')+'</span>').join('')+'</div>';
  days.forEach((d,di)=>{h+='<div class="hrow"><span class="hl">'+d+'</span>'+hours.map(x=>{const v=grid[di][x],p=max?Math.round(v/max*100):0;return '<span class="hc" style="background:'+(p?'color-mix(in srgb,var(--brand) '+Math.max(8,p)+'%,transparent)':'var(--soft)')+'" title="'+d+' '+pad(x)+':00 — '+fmt(v)+'"></span>'}).join('')+'</div>'});
  return h+'</div>';
}
function mixBars(rows,unit){
  const tot=rows.reduce((a,r)=>a+r.v,0)||1; if(!rows.length)return '<div class="empty">No data in this period.</div>';
  return '<div class="mix">'+rows.sort((a,b)=>b.v-a.v).map(r=>'<div class="mrow"><span class="ml">'+esc(r.l)+'</span><span class="mb"><i style="width:'+Math.max(2,Math.round(r.v/tot*100))+'%"></i></span><span class="mv">'+Math.round(r.v/tot*100)+'% · '+(unit==='n'?rq(r.v):fmt(r.v))+'</span></div>').join('')+'</div>';
}
const card=(title,sub,body)=>'<section class="card"><h2>'+esc(title)+(sub?' <span class="muted sm">'+esc(sub)+'</span>':'')+'</h2>'+body+'</section>';

/* ---------- shared calculations ---------- */
const expiryBuckets=()=>{
  const b={expired:{l:'Expired on shelf',v:0,n:0},d7:{l:'Expires in 7 days',v:0,n:0},d30:{l:'In 8–30 days',v:0,n:0},d90:{l:'In 31–90 days',v:0,n:0}};
  DB.lots.forEach(l=>{if(l.qty<=0||!l.expiry)return;const d=(l.expiry-now())/864e5,v=r2(l.qty*l.cost),k=d<0?'expired':d<=7?'d7':d<=30?'d30':d<=90?'d90':null;if(k){b[k].v=r2(b[k].v+v);b[k].n=rq(b[k].n+l.qty)}});
  return b;
};
const shrinkValue=(a,b)=>r2(DB.movements.filter(m=>m.ts>=a&&m.ts<=b&&(m.type==='waste'||m.type==='adjust')&&m.qty<0).reduce((s,m)=>{const l=byId(DB.lots,m.lotId);return s+(-m.qty)*(l?l.cost:0)},0));
const claimsOutstanding=()=>{const m=balMap(null);return r2(DB.acc.ledgers.filter(l=>l.insurer).reduce((a,l)=>a+m[l.id].close,0))};
const insuranceBilled=orders=>r2(orders.reduce((a,o)=>a+o.payments.filter(p=>p.method==='insurance').reduce((x,p)=>x+p.amount,0),0));
const repeatRate=()=>{const m={};DB.orders.filter(o=>o.status==='completed'&&o.customerId&&o.ts>now()-60*864e5).forEach(o=>{m[o.customerId]=(m[o.customerId]||0)+1});const ids=Object.keys(m);return ids.length?ids.filter(k=>m[k]>=2).length/ids.length*100:0};

/* ---------- context built once per render ---------- */
function buildCtx(R_,cur,prev){
  const orders=DB.orders.filter(o=>inR(o,R_.from,R_.to));
  let labels=[],sc=[],sp=[];
  if(R_.hourly){for(let h=7;h<=23;h++){labels.push(pad(h));sc.push(r2(cur.done.filter(o=>new Date(o.ts).getHours()===h).reduce((a,o)=>a+netEx(o),0)));sp.push(r2(prev.done.filter(o=>new Date(o.ts).getHours()===h).reduce((a,o)=>a+netEx(o),0)))}}
  else{for(let i=0;i<R_.days;i++){const a=dayStart(R_.from)+i*864e5,b=a+864e5-1,pa=dayStart(R_.pf)+i*864e5,pb=pa+864e5-1;
    labels.push(new Date(a).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}));
    sc.push(r2(cur.done.filter(o=>inR(o,a,b)).reduce((x,o)=>x+netEx(o),0)));sp.push(r2(prev.done.filter(o=>inR(o,pa,pb)).reduce((x,o)=>x+netEx(o),0)))}}
  const ch={},pay={},cat={},catCost={},item={},staff={};
  cur.done.forEach(o=>{
    const k=o.onlineId?chName(o.channel):typeLabel(o.type);ch[k]=(ch[k]||0)+netEx(o);
    o.payments.forEach(p=>{const pk=({cash:'Cash',card:'Card',wallet:'Wallet / QR',cod:'Pay on delivery',aggregator:'Delivery-app payout',insurance:'Insurance',credit:'On account (credit)',advance:'Advance (job order)'}[p.method]||p.method);pay[pk]=(pay[pk]||0)+p.amount});
    o.lines.forEach(l=>{const it=itemById(l.itemId),ck=it?catName(it.categoryId):'Other',v=lineRevEx(l);
      cat[ck]=(cat[ck]||0)+v;catCost[ck]=(catCost[ck]||0)+l.qty*(l.cost||0);const a=item[l.name]||(item[l.name]={n:l.name,q:0,v:0,c:0,id:l.itemId});a.q=rq(a.q+l.qty);a.v+=v;a.c+=l.qty*(l.cost||0)});
    const s=staff[o.userId]||(staff[o.userId]={n:userName(o.userId),o:0,v:0,d:0,sub:0});s.o++;s.v+=netEx(o);s.d+=o.discountTotal;s.sub+=o.subtotal;
  });
  return {R_:R_,cur:cur,prev:prev,orders:orders,labels:labels,sc:sc,sp:sp,ch:ch,pay:pay,cat:cat,catCost:catCost,
    items:Object.keys(item).map(k=>item[k]).sort((a,b)=>b.v-a.v),staff:Object.keys(staff).map(k=>staff[k]).sort((a,b)=>b.v-a.v)};
}
const objRows=ob=>Object.keys(ob).map(k=>({l:k,v:r2(ob[k])}));

/* ---------- KPI tiles per business type ---------- */
function kpiTiles(c){
  const cur=c.cur,prev=c.prev,R_=c.R_, T=(label,val,d,spk,note,invert)=>'<div class="kpi dk"><span class="kl">'+esc(tr(label))+'</span><strong>'+val+'</strong>'+(d==null?'':'<span class="kd '+((invert?d<=0:d>=0)?'up':'dn')+'">'+(d>=0?'▲ ':'▼ ')+Math.abs(d)+'% '+esc(R_.label)+'</span>')+(note?'<span class="muted sm">'+esc(note)+'</span>':'')+(spk||'')+'</div>';
  const salesL=DB.settings.vatPct>0?'Net sales (ex-'+(DB.settings.taxLabel||'tax')+')':'Sales', sp=spark(c.sc), type=bizType();
  const gm=(label)=>T(label||'Gross margin',Math.round(cur.margin)+'%',Math.round(cur.margin-prev.margin),'',money(cur.gross)+' profit');
  if(type==='supermarket')return [T(salesL,money(cur.sales),pct(cur.sales,prev.sales),sp,cur.n+' baskets'),T('Baskets',cur.n,pct(cur.n,prev.n),'','avg '+money(cur.aov)),T('Avg basket',money(cur.aov),pct(cur.aov,prev.aov)),T('Items per basket',cur.upb.toFixed(1),null,'','units '+rq(cur.units)),gm(),T('Waste & shrink',money(shrinkValue(R_.from,R_.to)),null,'','written off at cost',true)];
  const owedT=T('Owed by customers',money(creditOwed()),null,'','credit accounts',true), unitsOf_=pred=>rq(cur.done.reduce((a,o)=>a+o.lines.filter(l=>pred(itemById(l.itemId)||{})).reduce((x,l)=>x+l.qty,0),0));
  if(type==='tailor'){const m_=balMap(null);return [T(salesL,money(cur.sales),pct(cur.sales,prev.sales),sp,cur.n+' deliveries'),T('Jobs in progress',DB.jobs.filter(jobOpen).length,null,'','not yet delivered'),T('Overdue jobs',DB.jobs.filter(isOverdue).length,null,'','past the promised date',true),T('Advances held',money(r2(-m_[LID('advances')].close)),null,'','for unfinished work'),T('Avg order',money(cur.aov),pct(cur.aov,prev.aov)),owedT]}
  if(type==='garage'){const veh=new Set(cur.done.filter(o=>o.vehicle&&o.vehicle.plate).map(o=>o.vehicle.plate)).size, lab=cur.done.reduce((a,o)=>a+o.lines.filter(l=>l.kind==='service').reduce((x,l)=>x+lineRevEx(l),0),0);return [T(salesL,money(cur.sales),pct(cur.sales,prev.sales),sp,cur.n+' invoices'),T('Vehicles serviced',veh,null,'','distinct plates'),T('Open job cards',DB.jobs.filter(jobOpen).length,null,'','in the workshop'),T('Avg repair order',money(cur.aov),pct(cur.aov,prev.aov)),T('Labour share',cur.sales>0?Math.round(lab/cur.sales*100)+'%':'0%',null,'','of revenue'),owedT]}
  if(type==='butcher'){const bs=DB.breakdowns.filter(b=>b.ts>=R_.from&&b.ts<=R_.to),tin=bs.reduce((a,b)=>a+b.qty,0),tout=bs.reduce((a,b)=>a+b.qty-b.wasteKg,0);return [T(salesL,money(cur.sales),pct(cur.sales,prev.sales),sp,cur.n+' sales'),T('Kilos sold',unitsOf_(i=>i.weighed),null,'','by weight'),gm(),T('Cutting yield',tin?Math.round(tout/tin*1000)/10+'%':'—',null,'',bs.length+' breakdowns'),T('Waste in cutting',money(r2(bs.reduce((a,b)=>a+b.wasteValue,0))),null,'','value at cost',true),owedT]}
  if(type==='grocery')return [T(salesL,money(cur.sales),pct(cur.sales,prev.sales),sp,cur.n+' baskets'),T('Avg basket',money(cur.aov),pct(cur.aov,prev.aov)),T('Items per basket',cur.upb.toFixed(1),null,'','units '+rq(cur.units)),gm(),T('Low or out of stock',DB.items.filter(i=>i.active&&i.track&&stockOf(i.id)<=i.reorder).length,null,'','reorder soon',true),owedT];
  if(type==='tyre')return [T(salesL,money(cur.sales),pct(cur.sales,prev.sales),sp,cur.n+' invoices'),T('Tyres sold',unitsOf_(i=>i.serial),null,'','units'),T('Avg ticket',money(cur.aov),pct(cur.aov,prev.aov)),gm(),T('Warranties active',DB.warranty.filter(w=>w.expires&&w.expires>now()).length,null,'','tyres under warranty'),owedT];
  if(type==='retail')return [T(salesL,money(cur.sales),pct(cur.sales,prev.sales),sp,cur.n+' transactions'),T('Transactions',cur.n,pct(cur.n,prev.n)),T('Avg transaction',money(cur.aov),pct(cur.aov,prev.aov)),T('Units per transaction',cur.upb.toFixed(1)),gm(),T('Return rate',cur.returnRate.toFixed(1)+'%',null,'',cur.refunds+' returned',true)];
  if(type==='pharmacy'){const rx=new Set();cur.done.forEach(o=>o.lines.forEach(l=>{if(l.rx)rx.add(l.rx.no)}));const b=expiryBuckets();
    return [T(salesL,money(cur.sales),pct(cur.sales,prev.sales),sp,cur.n+' sales'),T('Prescriptions dispensed',rx.size,null,'','distinct Rx numbers'),T('Avg ticket',money(cur.aov),pct(cur.aov,prev.aov)),gm(),T('Insurance billed',money(insuranceBilled(cur.done)),null,'','claims raised'),T('Stock at risk (≤90 days)',money(r2(b.expired.v+b.d7.v+b.d30.v+b.d90.v)),null,'',b.expired.n?b.expired.n+' units already expired':'none expired',true)]}
  if(type==='clinic'){const pts=new Set(cur.done.filter(o=>o.customerId).map(o=>o.customerId)).size+cur.done.filter(o=>!o.customerId).length;
    return [T('Revenue (ex-tax)',money(cur.sales),pct(cur.sales,prev.sales),sp,cur.n+' bills'),T('Patients seen',pts,null,'','incl. walk-ins'),T('Bills',cur.n,pct(cur.n,prev.n)),T('Avg bill',money(cur.aov),pct(cur.aov,prev.aov)),T('Insurance billed',money(insuranceBilled(cur.done)),null,'','to insurers'),T('Claims outstanding',money(claimsOutstanding()),null,'','awaiting insurers',true)]}
  if(type==='salon'){const svc=cur.done.reduce((a,o)=>a+o.lines.filter(l=>l.kind==='service').reduce((x,l)=>x+lineRevEx(l),0),0), comm=r2(providerRevenue(R_.from,R_.to).reduce((a,p)=>a+p.comm,0));
    return [T('Revenue (ex-tax)',money(cur.sales),pct(cur.sales,prev.sales),sp,cur.n+' clients'),T('Clients served',cur.n,pct(cur.n,prev.n)),T('Avg ticket',money(cur.aov),pct(cur.aov,prev.aov)),T('Repeat clients (60 days)',Math.round(repeatRate())+'%',null,'','visited 2+ times'),T('Services share',cur.sales>0?Math.round(svc/cur.sales*100)+'%':'0%',null,'','of revenue'),T('Commission payable',money(comm),null,'','to providers',true)]}
  return [T(salesL,money(cur.sales),pct(cur.sales,prev.sales),sp,cur.n+' orders'),T('Orders',cur.n,pct(cur.n,prev.n),'','avg '+money(cur.aov)+' each'),gm('Gross profit'),T('Discounts given',money(cur.disc),pct(cur.disc,prev.disc),'','',true),T('Refunds',cur.refunds+' · '+money(cur.refundValue),pct(cur.refunds,prev.refunds),'','',true),T('Guests',new Set(cur.done.filter(o=>o.customerId).map(o=>o.customerId)).size,null,'','identified at checkout')];
}

/* ---------- widgets ---------- */
const topTitle=()=>({supermarket:'Best-selling products',retail:'Best-selling products',pharmacy:'Top medicines & products',clinic:'Top services',salon:'Top services',restaurant:'Top items',tailor:'Top services',butcher:'Best-selling cuts',grocery:'Best-selling products',garage:'Top jobs & parts',tyre:'Top tyres & services'}[bizType()]);
const W={
  brief:()=>briefHtml(),
  trend:c=>card('Sales trend',(c.R_.hourly?'by hour':'by day')+' · dashed line = '+c.R_.label.replace('vs ',''),lineChart(c.labels,c.sc,c.sp,v=>fmt(v).replace(/\.0+$/,'').replace(/(\.\d)0$/,'$1'))),
  heat:()=>card('Busy hours','last 4 weeks',heatmap(DB.orders.filter(o=>o.ts>now()-28*864e5))),
  mixCh:c=>card('Where sales come from','',mixBars(objRows(c.ch))),
  mixPay:c=>card('How customers pay','',mixBars(objRows(c.pay))),
  mixCat:c=>card(bizType()==='clinic'?'Revenue by department':'Category mix','',mixBars(objRows(c.cat))),
  dept:c=>card('Revenue by department','this period',mixBars(objRows(c.cat))),
  top:c=>card(topTitle(),'',tbl([{h:'Item',r:r=>esc(r.n)},{h:'Sold',cls:'r',r:r=>r.q},{h:'Sales',cls:'r',r:r=>fmt(r.v)},{h:'Margin',cls:'r',r:r=>r.v>0?Math.round((r.v-r.c)/r.v*100)+'%':'—'}],c.items.slice(0,7),'No sales in this period.')),
  leaders:c=>card(bizType()==='clinic'?'Billing staff':'Team leaderboard','',tbl([{h:'Staff',r:r=>esc(r.n)},{h:'Sales',cls:'r',r:r=>r.o},{h:'Revenue',cls:'r',r:r=>fmt(r.v)},{h:'Avg',cls:'r',r:r=>fmt(r.o?r.v/r.o:0)},{h:'Disc.',cls:'r',r:r=>r.sub>0?Math.round(r.d/r.sub*100)+'%':'—'}],c.staff,'No sales in this period.')),
  recent:()=>card('Recent '+(bizType()==='clinic'?'bills':'orders'),'',recentOrders()),
  ops:()=>opsCard(),
  money:()=>moneyCard(),
  basket:c=>{const b={'1 item':0,'2–3 items':0,'4–6 items':0,'7–10 items':0,'11+ items':0};c.cur.done.forEach(o=>{const n=o.lines.length;b[n<=1?'1 item':n<=3?'2–3 items':n<=6?'4–6 items':n<=10?'7–10 items':'11+ items']++});
    return card('Basket size','lines per basket · avg '+c.cur.upb.toFixed(1)+' units',mixBars(objRows(b),'n'))},
  fastslow:()=>{const since=now()-30*864e5,sold={};DB.orders.filter(o=>o.status==='completed'&&o.ts>=since).forEach(o=>o.lines.forEach(l=>{sold[l.itemId]=rq((sold[l.itemId]||0)+l.qty)}));
    const tr_=DB.items.filter(i=>i.active&&i.track).map(i=>({i:i,q:sold[i.id]||0,s:stockOf(i.id)}));
    const fast=tr_.slice().sort((a,b)=>b.q-a.q).slice(0,5), dead=tr_.filter(x=>x.q===0&&x.s>0).sort((a,b)=>b.s*b.i.cost-a.s*a.i.cost).slice(0,5);
    return card('Fast movers & dead stock','last 30 days',tbl([{h:'Fast movers',r:r=>esc(r.i.name)},{h:'Sold',cls:'r',r:r=>r.q},{h:'In stock',cls:'r',r:r=>r.s}],fast,'No sales yet.')+'<div style="height:10px"></div>'+tbl([{h:'Not sold in 30 days',r:r=>esc(r.i.name)},{h:'In stock',cls:'r',r:r=>r.s},{h:'Tied up',cls:'r',r:r=>fmt(r.s*r.i.cost)}],dead,'No dead stock.'))},
  expiry:()=>{const b=expiryBuckets();return card('Expiry watch','value at cost',tbl([{h:'When',r:r=>r.l},{h:'Units',cls:'r',r:r=>r.n},{h:'Value',cls:'r',r:r=>'<span class="'+(r===b.expired&&r.v>0?'neg':'')+'">'+fmt(r.v)+'</span>'}],[b.expired,b.d7,b.d30,b.d90],'')+'<p class="muted sm">'+(b.expired.n?'Expired stock is blocked from sale. Remove it from the shelf and write it off under Stock Room → Adjust.':'Nothing expired on the shelf.')+' <a href="#/stock/lots">View lots</a></p>')},
  stockout:()=>{const rows=DB.items.filter(i=>i.active&&i.track&&stockOf(i.id)<=i.reorder).map(i=>({i:i,s:stockOf(i.id)})).sort((a,b)=>a.s-b.s).slice(0,8);
    return card('Out of stock & low','reorder soon',tbl([{h:'Item',r:r=>esc(r.i.name)},{h:'On hand',cls:'r',r:r=>'<span class="'+(r.s<=0?'neg':'')+'">'+r.s+'</span>'},{h:'Reorder at',cls:'r',r:r=>r.i.reorder}],rows,'Everything is above its reorder level.')+'<p class="sm"><a href="#/stock/reorder">Open reorder suggestions</a></p>')},
  catmargin:c=>card('Margin by category','',tbl([{h:'Category',r:r=>esc(r.k)},{h:'Sales',cls:'r',r:r=>fmt(r.v)},{h:'Margin',cls:'r',r:r=>r.v>0?Math.round((r.v-r.c)/r.v*100)+'%':'—'}],Object.keys(c.cat).map(k=>({k:k,v:r2(c.cat[k]),c:c.catCost[k]||0})).sort((a,b)=>b.v-a.v),'No sales in this period.')),
  sellthru:()=>{const since=now()-30*864e5,sold={};DB.orders.filter(o=>o.status==='completed'&&o.ts>=since).forEach(o=>o.lines.forEach(l=>{const it=itemById(l.itemId);const k=(it&&it.group)||l.name;sold[k]=rq((sold[k]||0)+l.qty)}));
    const on={};DB.items.filter(i=>i.track).forEach(i=>{const k=i.group||i.name;on[k]=rq((on[k]||0)+Math.max(0,stockOf(i.id)))});
    const rows=Object.keys(on).map(k=>{const q=sold[k]||0,s=on[k],t=q+s;return {k:k,q:q,s:s,p:t?Math.round(q/t*100):0}}).sort((a,b)=>b.p-a.p).slice(0,8);
    return card('Sell-through','sold ÷ (sold + on hand), 30 days',tbl([{h:'Product',r:r=>esc(r.k)},{h:'Sold',cls:'r',r:r=>r.q},{h:'On hand',cls:'r',r:r=>r.s},{h:'Sell-through',cls:'r',r:r=>r.p+'%'}],rows,'No stock data.'))},
  rxsplit:c=>{let rxv=0,otc=0,ctl=0,rxn=0;c.cur.done.forEach(o=>o.lines.forEach(l=>{const v=lineRevEx(l);if(l.rx){rxv+=v;rxn+=l.qty;if(l.rx.controlled)ctl+=l.qty}else otc+=v}));
    return card('Prescription vs over-the-counter','this period',mixBars([{l:'Prescription (Rx)',v:r2(rxv)},{l:'Over the counter',v:r2(otc)}])+'<p class="sm">Controlled medicine units dispensed: <b>'+rq(ctl)+'</b> · Rx units: <b>'+rq(rxn)+'</b> · <a href="#/reports/rx">Prescription register</a></p>')},
  providers:c=>card(({clinic:'Doctors & departments',tailor:'Tailors',garage:'Mechanics',tyre:'Fitters'}[bizType()])||'Stylists & therapists','revenue and commission, this period',tbl([{h:'Provider',r:r=>'<b>'+esc(r.name)+'</b><br><span class="muted sm">'+esc(r.dept)+'</span>'},{h:'Services',cls:'r',r:r=>r.n},{h:'Revenue',cls:'r',r:r=>fmt(r.rev)},{h:'Commission',cls:'r',r:r=>fmt(r.comm)}],providerRevenue(c.R_.from,c.R_.to).slice(0,8),'No services attributed to a provider in this period.')),
  payer:c=>{const insBilled=insuranceBilled(c.cur.done),total=r2(c.cur.done.reduce((a,o)=>a+o.total,0)),m=balMap(null),
      rows=DB.acc.ledgers.filter(l=>l.insurer).map(l=>({n:l.insurer,b:m[l.id].close})).filter(r=>Math.abs(r.b)>0.004).sort((a,b)=>b.b-a.b);
    return card('Payer mix & claims','',mixBars([{l:'Insurance',v:insBilled},{l:'Self-pay / copay',v:Math.max(0,r2(total-insBilled))}])+'<div style="height:8px"></div>'+tbl([{h:'Insurer',r:r=>esc(r.n)},{h:'Outstanding',cls:'r',r:r=>fmt(r.b)}],rows,'No claims outstanding.')+(rows.length?'<p class="sm"><a href="#/accounts/outstanding">Record settlements</a></p>':''))},
  svcmix:c=>{const svc={};c.cur.done.forEach(o=>o.lines.forEach(l=>{if(l.kind==='service')svc[l.name]=(svc[l.name]||0)+l.qty}));return card('Services booked','by count',mixBars(objRows(svc),'n'))},
  jobsBoard:()=>{const fl=jobFlow().filter(f=>f[0]!=='delivered'),rows=fl.map(f=>{const js=DB.jobs.filter(j=>j.status===f[0]);return {l:f[1],v:js.length,val:r2(js.reduce((a,j)=>a+jobTotals(j).total,0))}});
    return card(tr('Job orders'),'open work by stage',tbl([{h:'Stage',r:r=>esc(r.l)},{h:'Jobs',cls:'r',r:r=>r.v},{h:'Value',cls:'r',r:r=>fmt(r.val)}],rows,'')+'<p class="sm"><a href="#/jobs">Open the job board</a></p>')},
  overdue:()=>overdueJobsHtml(),
  serviceDue:()=>{const list=serviceDueList().slice(0,8);return card('Service reminders','next service due within 14 days',tbl([{h:'Vehicle',r:r=>'<b>'+esc((r.vehicle||{}).plate||'—')+'</b><br><span class="muted sm">'+esc(custName(r.customerId))+'</span>'},{h:'Due',r:r=>fmtDate(r.nextService.date)},{h:'',cls:'r',r:r=>btn('Open','job-open',r.id)}],list,'No services due soon.'))},
  labourParts:c=>{let lab=0,par=0;c.cur.done.forEach(o=>o.lines.forEach(l=>{const v=lineRevEx(l);if(l.kind==='service')lab+=v;else par+=v}));return card(bizType()==='tyre'?'Fitting vs tyres':'Labour vs parts','this period',mixBars([{l:'Labour / services',v:r2(lab)},{l:bizType()==='tyre'?'Tyres & products':'Parts & products',v:r2(par)}]))},
  credit:()=>{const ag=creditAging(),owed=creditOwed();return card('Customer credit','owed to you · '+money(owed),mixBars(objRows(ag.tot))+'<div style="height:8px"></div>'+tbl([{h:'Customer',r:r=>esc(r.name)},{h:'Owes',cls:'r',r:r=>fmt(r.bal)},{h:'60+ days',cls:'r',r:r=>r.old>0?'<span class="neg">'+fmt(r.old)+'</span>':'—'}],ag.rows.slice(0,5),'Nobody owes you anything.')+'<p class="sm"><a href="#/guests/credit">Credit accounts</a></p>')},
  yield:()=>{const bs=DB.breakdowns.filter(b=>b.ts>=now()-30*864e5),tin=rq(bs.reduce((a,b)=>a+b.qty,0)),tout=rq(bs.reduce((a,b)=>a+b.qty-b.wasteKg,0)),wv=r2(bs.reduce((a,b)=>a+b.wasteValue,0));
    return card('Cutting yield','carcass breakdowns, 30 days',(bs.length?'<p><b>'+(tin?Math.round(tout/tin*1000)/10:0)+'%</b> average yield · '+tin+' kg in, '+tout+' kg of cuts · waste worth <b>'+money(wv)+'</b></p>':'')+tbl([{h:'When',r:r=>fmtDate(r.ts)},{h:'Source',r:r=>esc(r.srcName)},{h:'Yield',cls:'r',r:r=>r.yieldPct+'%'},{h:'Waste',cls:'r',r:r=>r.wasteKg+' kg'}],bs.slice(-5).reverse(),'No breakdowns yet. Record one in Stock Room → Breakdown.'))},
  tyreSizes:c=>{const z={};c.cur.done.forEach(o=>o.lines.forEach(l=>{const it=itemById(l.itemId);if(it&&it.size)z[it.size]=(z[it.size]||0)+l.qty}));return card('Tyre sizes sold','units, this period',mixBars(objRows(z),'n'))},
  brandmix:c=>{const z={};c.cur.done.forEach(o=>o.lines.forEach(l=>{const it=itemById(l.itemId);if(it&&it.brand)z[it.brand]=(z[it.brand]||0)+lineRevEx(l)}));return card('Brand mix','revenue, this period',mixBars(objRows(z)))}
};
function recentOrders(){
  return tbl([{h:'#',r:r=>'<a href="#" data-act="order-view" data-id="'+r.id+'"><b>'+esc(r.no)+'</b></a>'},{h:'Time',r:r=>fmtDT(r.ts)},{h:'Type',r:r=>esc(typeLabel(r.type))},{h:'Total',cls:'r',r:r=>fmt(r.total)},{h:'Status',r:r=>badge(r.status,r.status==='completed'?'ok':'bad')}],DB.orders.slice(-8).reverse(),'No orders yet.');
}
function opsCard(){
  const open=DB.sessions.filter(s=>!s.closedAt), lowN=DB.items.filter(i=>i.active&&i.track&&stockOf(i.id)<=i.reorder).length, b=expiryBuckets(), lastB=DB.lastBackup?Math.floor((now()-DB.lastBackup)/864e5):null;
  const li=(a,v,sm,bad)=>'<li><span>'+esc(a)+'</span><b class="'+(bad?'neg':'')+'">'+v+'</b>'+(sm?'<small class="muted">'+sm+'</small>':'')+'</li>';
  let h=li(bizType()==='clinic'?'Billing desks open':'Registers open',open.length,'expected cash '+money(open.reduce((a,s)=>a+sessionStats(s).expected,0)));
  if(bm('kitchen')){const tix=kdsTickets();h+=li('Kitchen queue',tix.length,tix.length?'oldest '+Math.floor((now()-tix[0].ts)/60000)+' min':'clear')}
  if(bm('online'))h+=li('New online / app orders',newOnlineCount(),'<a href="#/online">open queue</a>',newOnlineCount()>0);
  if(bm('jobs')){const n=DB.jobs.filter(jobOpen).length,od=DB.jobs.filter(isOverdue).length;h+=li('Open '+(jobKind()==='tailor'?'job orders':'job cards'),n,'<a href="#/jobs">open board</a>')+li('Overdue jobs',od,'',od>0)}
  if(bizType()!=='salon')h+=li('Items low or out of stock',lowN,'<a href="#/stock/reorder">reorder list</a>',lowN>0);
  if(bm('expiry'))h+=li('Expired stock on shelf',rq(b.expired.n),b.expired.n?'blocked from sale — write off':'compliant',b.expired.n>0)+li('Lots expiring in 30 days',rq(b.d7.n+b.d30.n),'<a href="#/stock/lots">view lots</a>',b.d7.n>0);
  if(bm('insurance'))h+=li('Insurance claims outstanding',money(claimsOutstanding()),'<a href="#/accounts/outstanding">settle claims</a>');
  h+=li('Data backup',lastB==null?'never':lastB===0?'today':lastB+' d ago','<a href="#" data-act="backup">download now</a>',lastB==null||lastB>7);
  return '<section class="card"><h2>Operations right now</h2><ul class="opsl">'+h+'</ul></section>';
}
function moneyCard(){
  if(!(can('accounts')&&DB.acc))return '';
  const m=balMap(null), sum=(root,sign)=>r2(groupLedgers(root).reduce((a,l)=>a+sign*m[l.id].close,0)), mt=plData(new Date(new Date().getFullYear(),new Date().getMonth(),1).getTime(),now());
  const vat=r2(-m[LID('vat_out')].close-m[LID('vat_in')].close);
  return '<section class="card"><h2>Money</h2><ul class="opsl"><li><span>Cash & bank</span><b>'+money(sum('g_cash',1)+sum('g_bank',1))+'</b></li>'+
    '<li><span>Owed to suppliers</span><b>'+money(sum('g_cred',-1))+'</b><small><a href="#/accounts/outstanding">details</a></small></li>'+
    '<li><span>Owed by '+(bm('insurance')?'insurers':'delivery apps / COD')+'</span><b>'+money(bm('insurance')?claimsOutstanding():r2(m[LID('aggr')].close+m[LID('cod')].close))+'</b></li>'+(bm('credit')?'<li><span>Owed by customers (credit)</span><b>'+money(creditOwed())+'</b><small><a href="#/guests/credit">details</a></small></li>':'')+
    (DB.settings.vatPct>0?'<li><span>'+esc(DB.settings.taxLabel||'Tax')+' payable (output − input)</span><b>'+money(vat)+'</b></li>':'')+
    '<li><span>Net profit this month</span><b class="'+(mt.t.net<0?'neg':'pos')+'">'+money(mt.t.net)+'</b><small><a href="#/accounts/pl">P&amp;L</a></small></li></ul></section>';
}

/* ================= Dashboard ================= */
function vDashboard(){
  const rng=UIS.dr||'today', R_=dRange(rng);
  const cur=agg(DB.orders.filter(o=>inR(o,R_.from,R_.to))), prev=agg(DB.orders.filter(o=>inR(o,R_.pf,R_.pt))), c=buildCtx(R_,cur,prev);
  const empty=!DB.orders.length?'<section class="card emptycard"><h2>No sales yet</h2><p class="muted">Open the POS and make a sale, or load 2 weeks of realistic <b>'+esc(biz().name)+'</b> sample sales to see every chart and report working.</p><div class="bar">'+btn(tr('Open POS'),'go-register',null,'primary')+(can('settings')?btn('Load sample sales (14 days)','demo-data'):'')+'</div></section>':'';
  const rangeBar='<div class="segs rng" role="group" aria-label="Period">'+D_RANGES.map(r=>'<button type="button" class="seg'+(rng===r[0]?' on':'')+'" data-act="dash-range" data-id="'+r[0]+'">'+r[1]+'</button>').join('')+'</div>';
  const rows=biz().dash.map(row=>{
    const cells=row.map(id=>W[id]?W[id](c):'').filter(Boolean); if(!cells.length)return '';
    return cells.length===1?(row[0]==='brief'?cells[0]:'<div class="cols1">'+cells[0]+'</div>'):'<div class="'+(cells.length>=3?'cols3':'cols2')+'">'+cells.join('')+'</div>';
  }).join('');
  return head(tr('Dashboard'),DB.settings.business+' · '+biz().name+' · '+new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}),rangeBar+btn(tr('Open POS'),'go-register',null,'primary'))+
    empty+'<div class="kpis dks">'+kpiTiles(c).join('')+'</div>'+rows;
}
A['dash-range']=d=>{UIS.dr=d.id;render()};

/* ================= Sample data (type-aware) ================= */
const DEMO_GUESTS=[['Fatima Al Mansoori','0501100001'],['Mohammed Al Harbi','0501100002'],['Priya Nair','0501100003'],['Hassan Al Zaabi','0501100004'],['Layla Haddad','0501100005'],['Rahul Sharma','0501100006'],['Noura Al Qahtani','0501100007'],['Yusuf Khan','0501100008']];
const DEMO_CFG={
  restaurant:{perDay:26,lines:[1,3],hours:{8:1,9:2,10:2,11:4,12:9,13:10,14:6,15:3,16:3,17:4,18:6,19:9,20:10,21:8,22:4,23:1}},
  supermarket:{perDay:55,lines:[3,12],hours:{8:2,9:4,10:5,11:6,12:7,13:6,14:5,15:5,16:7,17:9,18:11,19:12,20:10,21:7,22:4,23:1}},
  retail:{perDay:22,lines:[1,3],hours:{10:3,11:4,12:5,13:5,14:5,15:6,16:8,17:10,18:12,19:12,20:10,21:7,22:3}},
  pharmacy:{perDay:40,lines:[1,4],hours:{8:3,9:6,10:7,11:7,12:6,13:5,14:5,15:6,16:7,17:8,18:9,19:9,20:8,21:6,22:4,23:2}},
  clinic:{perDay:28,lines:[1,3],hours:{8:6,9:10,10:11,11:10,12:7,13:4,14:6,15:8,16:9,17:8,18:6,19:3}},
  salon:{perDay:16,lines:[1,2],hours:{10:3,11:5,12:6,13:6,14:6,15:7,16:8,17:9,18:9,19:8,20:6,21:3}},
  tailor:{perDay:9,lines:[1,2],hours:{10:3,11:5,12:5,13:3,14:3,15:5,16:7,17:9,18:9,19:8,20:6,21:3}},
  butcher:{perDay:34,lines:[1,4],hours:{7:3,8:6,9:8,10:8,11:7,12:6,13:4,14:3,15:4,16:6,17:9,18:10,19:8,20:5}},
  grocery:{perDay:48,lines:[2,8],hours:{7:3,8:5,9:6,10:6,11:5,12:5,13:4,14:4,15:5,16:7,17:9,18:11,19:10,20:8,21:5,22:2}},
  garage:{perDay:9,lines:[1,3],hours:{8:4,9:8,10:8,11:7,12:5,13:3,14:5,15:7,16:7,17:5}},
  tyre:{perDay:11,lines:[1,3],hours:{8:3,9:6,10:7,11:7,12:6,13:4,14:5,15:7,16:8,17:8,18:6,19:3}}
};
function genDemoData(days){
  if(typeof finalizeOrder!=='function')return 0;
  const ME0=ME, type=bizType(), cfg=DEMO_CFG[type]||DEMO_CFG.restaurant;
  const users=DB.users.filter(u=>u.active&&PERMS[u.role]&&PERMS[u.role].indexOf('register')>=0), items=DB.items.filter(i=>i.active&&i.sku!=='DELIVERY'), ct=DB.counters.filter(c=>c.active)[0];
  if(!items.length||!ct||!users.length)return 0;
  DEMO_GUESTS.forEach(g=>{if(!DB.customers.some(c=>c.phone===g[1]))DB.customers.push({id:uid('g'),name:g[0],phone:g[1],email:'',points:0,visits:0,spend:0,notes:'Sample '+(type==='clinic'?'patient':'guest'),created:now()})});
  if(bm('credit'))DB.customers.forEach((c,i)=>{if(!c.creditLimit)c.creditLimit=[3000,5000,8000,2000][i%4]});
  if(bm('insurance'))DB.customers.forEach((c,i)=>{if(!c.insurer&&i%3!==0){c.insurer=i%2?'Gulf Health Insurance':'National Care Insurance';c.policy='POL-'+(1000+i*37);c.copay=i%2?20:10;c.mrn=c.mrn||'P-'+(100600+i)}});
  const target=q=>q.weighed?500:700;
  items.filter(i=>i.track).forEach(i=>{const q=Math.max(0,target(i)-stockOf(i.id));if(q>0){receiveLot(i.id,'DEMO-'+i.sku,(i.rx||bm('expiry'))?now()+120*864e5:null,q,i.cost,'Sample stock');postStockReceive(i,q,i.cost,'','Sample stock')}});
  const hours=Object.keys(cfg.hours), hw=hours.reduce((a,h)=>a+cfg.hours[h],0);
  const pickHour=()=>{let r=Math.random()*hw;for(const h of hours){r-=cfg.hours[h];if(r<=0)return +h}return +hours[hours.length-1]};
  const pick=a=>a[Math.floor(Math.random()*a.length)], rnd=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
  const providerFor=it=>{const ps=DB.providers.filter(p=>p.active);if(!ps.length)return '';const cn=catName(it.categoryId).toLowerCase();const m=ps.filter(p=>(p.dept||'').toLowerCase()===cn||cn.indexOf((p.dept||'~').toLowerCase())>=0);return pick(m.length?m:ps).id};
  const plates=Array.from({length:14},(_,i)=>({plate:'ABCDKRT'[i%7]+' '+rnd(10000,99999),make:pick(['Toyota','Nissan','Honda','Kia','Hyundai','Mitsubishi']),model:pick(['Camry','Patrol','Accord','Sportage','Tucson','Pajero'])})), doctors=['Dr. Khalid Nasser','Dr. Mona Youssef','Dr. Imran Qureshi','Dr. Reem Al Ali'], wasBlocked=DB.settings.allowNegative; DB.settings.allowNegative=true;
  let made=0; const today=dayStart(now());
  for(let d=days-1;d>=0;d--){
    const day=today-d*864e5, dow=new Date(day).getDay(), busy=(dow===5||dow===6?1.3:1)*(0.8+Math.random()*0.5), count=Math.round(cfg.perDay*busy)+(d===0?-8:0);
    const opener=pick(users), sess={id:uid('s'),counterId:ct.id,openedBy:opener.id,openedAt:day+8*36e5,float:200,closedAt:null};DB.sessions.push(sess);
    const times=[];for(let i=0;i<count;i++)times.push(day+pickHour()*36e5+Math.floor(Math.random()*36e5));times.sort((a,b)=>a-b);
    const dayOrders=[];
    times.forEach(ts=>{
      if(ts>now())return;
      const nl=rnd(cfg.lines[0],cfg.lines[1]), used={}, cart=[];
      let pool=items; if(bm('provider')&&type==='clinic')pool=Math.random()<0.88?items.filter(i=>i.kind==='service'):items.filter(i=>i.kind!=='service');
      for(let k=0;k<nl;k++){const it=pick(pool);if(used[it.id])continue;used[it.id]=1;
        const line={key:uid('l'),itemId:it.id,qty:it.weighed?rq(0.3+Math.random()*2.2):1+(Math.random()<0.22?1:0)+(Math.random()<0.07?1:0),note:''};
        if(it.serial&&bm('serial')){line.qty=pick([1,2,2,4]);line.serial=Array.from({length:line.qty},()=>String(rnd(1,52)).padStart(2,'0')+String(rnd(23,26)))}
        if(it.kind==='service'&&bm('provider'))line.provider=providerFor(it);
        if(it.rx&&bm('rx'))line.rx={no:'RX'+rnd(100000,999999),doctor:pick(doctors),patient:pick(DB.customers).name,idNo:it.controlled?'784-'+rnd(1000,9999)+'-'+rnd(1000000,9999999):'',controlled:!!it.controlled,approvedBy:it.controlled?users[0].id:null};
        cart.push(line)}
      if(!cart.length)return;
      const r=Math.random(), type_=biz().types.length===3?(r<0.35?'dine-in':r<0.78?'takeaway':'delivery'):(biz().types.indexOf('delivery')>=0&&r<0.12?'delivery':(type==='clinic'&&r<0.1?'dine-in':'takeaway'));
      const cu=Math.random()<(bm('insurance')?0.7:bm('credit')?0.5:0.3)?pick(DB.customers):null;
      const S={vehicle:bm('vehicle')&&Math.random()<0.85?pick(plates):null,cart:cart,customerId:cu?cu.id:null,code:null,manual:Math.random()<0.06?{kind:'pct',value:10}:null,redeem:0,type:type_,table:type_==='dine-in'&&bm('tables')?'T'+rnd(1,10):''};
      const T=computeTotals(S); let pays;
      if(bm('insurance')&&cu&&cu.insurer&&Math.random()<0.75){const copay=Math.min(100,+cu.copay||0), insAmt=r2(T.total*(100-copay)/100), rest=r2(T.total-insAmt), m2=Math.random()<0.5?'cash':'card';
        pays=[{method:'insurance',amount:insAmt,tendered:insAmt,insurer:cu.insurer}].concat(rest>0?[{method:m2,amount:rest,tendered:rest}]:[])}
      else if(bm('credit')&&cu&&Math.random()<0.25){pays=[{method:'credit',amount:T.total,tendered:T.total,customerId:cu.id}]}
      else{const pr=Math.random(), method=pr<0.4?'cash':pr<0.88?'card':'wallet';pays=[{method:method,amount:T.total,tendered:T.total}]}
      const cashier=pick(users); ME=cashier;
      const o=finalizeOrder(S,sess,pays,0,{ts:ts,userId:cashier.id,kds:bm('kitchen')?{status:'done',ts:ts,doneTs:ts+12*6e4}:undefined});
      if(o){made++;dayOrders.push(o)}
    });
    ME=opener;
    dayOrders.filter(()=>Math.random()<0.02).forEach(o=>{
      o.status='refunded';o.refund={ts:o.ts+10*6e4,by:opener.id,reason:'Sample: customer request',restock:true};
      o.lines.forEach(l=>returnStock(l.allocs,l.itemId,'Refund #'+o.no));postRefund(o,true);if(typeof einvStamp==='function'&&o.einv)einvStamp(o,'credit');
      const cash=r2(o.payments.filter(p=>p.method==='cash').reduce((a,p)=>a+p.amount,0));if(cash>0)DB.vouchers.push({id:uid('v'),sessionId:sess.id,ts:o.refund.ts,type:'refund',amount:cash,reason:'Refund #'+o.no,userId:opener.id});
    });
    if(bm('credit')){const bal=creditBalances();DB.customers.forEach(c2=>{const b=bal[c2.id]||0;if(b>20&&Math.random()<0.4){try{postCustomerPayment(c2,Math.random()<0.6?'cash':'card',r2(b*(0.4+Math.random()*0.6)),Math.min(day+864e5-1,now()),sess)}catch(e){}}})}
    if(d>0){const st=sessionStats(sess), v=Math.random()<0.12?r2((Math.random()-0.5)*8):0;sess.counted=r2(st.expected+v);sess.variance=v;sess.closedAt=day+23*36e5;sess.closedBy=opener.id;if(v)postCashVariance(sess)}
  }
  DB.settings.allowNegative=wasBlocked; ME=ME0;
  if(bm('jobs'))demoJobs(); if(bm('breakdown'))demoBreakdowns();
  audit('demo.data',made+' sample orders over '+days+' days ('+type+')'); save(); return made;
}
A['demo-data']=()=>{
  if(!can('settings')){toast('Only an admin can load sample data','err');return}
  confirmBox('Add about 14 days of realistic '+biz().name+' sample sales (orders, stock movements, accounting entries, e-invoices)? It is added on top of your current data. Use "Reset to demo data" in Settings to remove it.',()=>{
    const n=genDemoData(14);toast(n?n+' sample orders created':'Could not create sample data',n?undefined:'err');UIS.dr='7d';render();
  },'Load sample sales');
};
