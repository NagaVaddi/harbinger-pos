'use strict';
/* Harbinger Command Center — owner dashboard + sample-data generator.
   Sales are shown ex-tax (total − tax) because that is what the business actually earns. */

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
function agg(orders){
  const done=orders.filter(o=>o.status==='completed'), ref=orders.filter(o=>o.status==='refunded');
  const sales=r2(done.reduce((a,o)=>a+netEx(o),0)), cogs=r2(done.reduce((a,o)=>a+orderCogs(o),0));
  return {n:done.length,sales:sales,gross:r2(sales-cogs),margin:sales>0?(sales-cogs)/sales*100:0,aov:done.length?sales/done.length:0,
    disc:r2(done.reduce((a,o)=>a+o.discountTotal,0)),refunds:ref.length,refundValue:r2(ref.reduce((a,o)=>a+o.total,0)),done:done};
}
const pct=(a,b)=>b>0?Math.round((a-b)/b*100):(a>0?100:0);

/* ---------- small SVG charts ---------- */
function spark(vals){
  if(!vals.length||Math.max.apply(null,vals)<=0)return '<svg class="spark" viewBox="0 0 100 28" aria-hidden="true"></svg>';
  const max=Math.max.apply(null,vals),n=vals.length;
  const pts=vals.map((v,i)=>[n>1?i/(n-1)*100:50,26-(v/max)*24]);
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
function mixBars(rows){
  const tot=rows.reduce((a,r)=>a+r.v,0)||1; if(!rows.length)return '<div class="empty">No data in this period.</div>';
  return '<div class="mix">'+rows.sort((a,b)=>b.v-a.v).map(r=>'<div class="mrow"><span class="ml">'+esc(r.l)+'</span><span class="mb"><i style="width:'+Math.max(2,Math.round(r.v/tot*100))+'%"></i></span><span class="mv">'+Math.round(r.v/tot*100)+'% · '+fmt(r.v)+'</span></div>').join('')+'</div>';
}

/* ================= Dashboard ================= */
function vDashboard(){
  const rng=UIS.dr||'today', R_=dRange(rng);
  const cur=agg(DB.orders.filter(o=>inR(o,R_.from,R_.to))), prev=agg(DB.orders.filter(o=>inR(o,R_.pf,R_.pt)));
  const orders=DB.orders.filter(o=>inR(o,R_.from,R_.to));
  // series
  let labels=[],sc=[],sp=[];
  if(R_.hourly){for(let h=7;h<=23;h++){labels.push(pad(h));sc.push(r2(cur.done.filter(o=>new Date(o.ts).getHours()===h).reduce((a,o)=>a+netEx(o),0)));sp.push(r2(prev.done.filter(o=>new Date(o.ts).getHours()===h).reduce((a,o)=>a+netEx(o),0)))}}
  else{for(let i=0;i<R_.days;i++){const a=dayStart(R_.from)+i*864e5,b=a+864e5-1,pa=dayStart(R_.pf)+i*864e5,pb=pa+864e5-1;
    labels.push(new Date(a).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}));
    sc.push(r2(cur.done.filter(o=>inR(o,a,b)).reduce((x,o)=>x+netEx(o),0)));sp.push(r2(prev.done.filter(o=>inR(o,pa,pb)).reduce((x,o)=>x+netEx(o),0)))}}
  const tile=(label,val,d,spk,note,invert)=>'<div class="kpi dk"><span class="kl">'+esc(label)+'</span><strong>'+val+'</strong>'+(d==null?'':'<span class="kd '+((invert?d<=0:d>=0)?'up':'dn')+'">'+(d>=0?'▲ ':'▼ ')+Math.abs(d)+'% '+esc(R_.label)+'</span>')+(note?'<span class="muted sm">'+esc(note)+'</span>':'')+spk+'</div>';
  const cogsDay=sc.map((v,i)=>v); // sparkline uses sales
  const taxL=DB.settings.vatPct>0?'Net sales (ex-'+(DB.settings.taxLabel||'tax')+')':'Sales';
  const kpis='<div class="kpis dks">'+tile(taxL,money(cur.sales),pct(cur.sales,prev.sales),spark(sc),cur.n+' orders')+tile('Orders',cur.n,pct(cur.n,prev.n),spark(sc.map((v,i)=>v>0?1:0)),'avg '+money(cur.aov)+' each')+
    tile('Gross profit',money(cur.gross),pct(cur.gross,prev.gross),'',Math.round(cur.margin)+'% margin')+tile('Discounts given',money(cur.disc),pct(cur.disc,prev.disc),'','',true)+
    tile('Refunds',cur.refunds+' · '+money(cur.refundValue),pct(cur.refunds,prev.refunds),'','',true)+
    tile('Guests',new Set(cur.done.filter(o=>o.customerId).map(o=>o.customerId)).size,null,'','identified at checkout')+'</div>';
  // mixes
  const ch={},pay={},cat={},item={},staff={};
  cur.done.forEach(o=>{
    const k=o.onlineId?chName(o.channel):({'dine-in':'Dine-in','takeaway':'Takeaway','delivery':'Delivery'}[o.type]||o.type);ch[k]=(ch[k]||0)+netEx(o);
    o.payments.forEach(p=>{const pk=({cash:'Cash',card:'Card',wallet:'Wallet / QR',cod:'Pay on delivery',aggregator:'Delivery-app payout'}[p.method]||p.method);pay[pk]=(pay[pk]||0)+p.amount});
    o.lines.forEach(l=>{const it=itemById(l.itemId),ck=it?catName(it.categoryId):'Other',v=r2(l.qty*(DB.settings.taxInclusive&&l.tax!==false?l.price/(1+DB.settings.vatPct/100):l.price));
      cat[ck]=(cat[ck]||0)+v;const a=item[l.name]||(item[l.name]={n:l.name,q:0,v:0,c:0});a.q+=l.qty;a.v+=v;a.c+=l.qty*(l.cost||0)});
    const s=staff[o.userId]||(staff[o.userId]={n:userName(o.userId),o:0,v:0,d:0,sub:0});s.o++;s.v+=netEx(o);s.d+=o.discountTotal;s.sub+=o.subtotal;
  });
  const objRows=ob=>Object.keys(ob).map(k=>({l:k,v:r2(ob[k])}));
  const items=Object.keys(item).map(k=>item[k]).sort((a,b)=>b.v-a.v);
  const staffRows=Object.keys(staff).map(k=>staff[k]).sort((a,b)=>b.v-a.v);
  // operations
  const open=DB.sessions.filter(s=>!s.closedAt), tix=kdsTickets(), oldest=tix.length?Math.floor((now()-tix[0].ts)/60000):0;
  const low=DB.items.filter(i=>i.active&&i.track&&stockOf(i.id)<=i.reorder).length, expiring=DB.lots.filter(l=>l.qty>0&&l.expiry&&l.expiry<daysFromNow(14)).length;
  const lastB=DB.lastBackup?Math.floor((now()-DB.lastBackup)/864e5):null;
  const ops='<section class="card"><h2>Operations right now</h2><ul class="opsl">'+
    '<li><span>Registers open</span><b>'+open.length+'</b><small class="muted">expected cash '+money(open.reduce((a,s)=>a+sessionStats(s).expected,0))+'</small></li>'+
    '<li><span>Kitchen queue</span><b>'+tix.length+'</b><small class="muted">'+(tix.length?'oldest '+oldest+' min':'clear')+'</small></li>'+
    '<li><span>New online / app orders</span><b class="'+(newOnlineCount()?'neg':'')+'">'+newOnlineCount()+'</b><small><a href="#/online">open queue</a></small></li>'+
    '<li><span>Items low or out of stock</span><b class="'+(low?'neg':'')+'">'+low+'</b><small><a href="#/stock/reorder">reorder list</a></small></li>'+
    '<li><span>Lots expiring in 14 days</span><b class="'+(expiring?'neg':'')+'">'+expiring+'</b><small><a href="#/stock/lots">view lots</a></small></li>'+
    '<li><span>Data backup</span><b class="'+(lastB==null||lastB>7?'neg':'')+'">'+(lastB==null?'never':lastB===0?'today':lastB+' d ago')+'</b><small><a href="#" data-act="backup">download now</a></small></li></ul></section>';
  // money
  let money_='';
  if(can('accounts')&&DB.acc){
    const m=balMap(null), sum=(root,sign)=>r2(groupLedgers(root).reduce((a,l)=>a+sign*m[l.id].close,0)), mt=plData(new Date(new Date().getFullYear(),new Date().getMonth(),1).getTime(),now());
    const vat=r2(-m[LID('vat_out')].close-m[LID('vat_in')].close);
    money_='<section class="card"><h2>Money</h2><ul class="opsl"><li><span>Cash & bank</span><b>'+money(sum('g_cash',1)+sum('g_bank',1))+'</b></li>'+
      '<li><span>Owed to suppliers</span><b>'+money(sum('g_cred',-1))+'</b><small><a href="#/accounts/outstanding">details</a></small></li>'+
      '<li><span>Owed by delivery apps / COD</span><b>'+money(r2(m[LID('aggr')].close+m[LID('cod')].close))+'</b></li>'+
      '<li><span>'+esc(DB.settings.taxLabel||'Tax')+' payable (output − input)</span><b>'+money(vat)+'</b></li>'+
      '<li><span>Net profit this month</span><b class="'+(mt.t.net<0?'neg':'pos')+'">'+money(mt.t.net)+'</b><small><a href="#/accounts/pl">P&amp;L</a></small></li></ul></section>';
  }
  const empty=!DB.orders.length?'<section class="card emptycard"><h2>No sales yet</h2><p class="muted">Open the register and make a sale, or load 2 weeks of realistic sample sales to see every chart and report working.</p><div class="bar">'+btn(tr('Open POS'),'go-register',null,'primary')+(can('settings')?btn('Load sample sales (14 days)','demo-data'):'')+'</div></section>':'';
  const rangeBar='<div class="segs rng" role="group" aria-label="Period">'+D_RANGES.map(r=>'<button type="button" class="seg'+(rng===r[0]?' on':'')+'" data-act="dash-range" data-id="'+r[0]+'">'+r[1]+'</button>').join('')+'</div>';
  return head('Command Center',DB.settings.business+' · '+new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}),rangeBar+btn(tr('Open POS'),'go-register',null,'primary'))+
    empty+kpis+briefHtml()+
    '<div class="cols2 mt"><section class="card"><h2>Sales trend <span class="muted sm">'+(R_.hourly?'by hour':'by day')+' · dashed line = '+esc(R_.label.replace('vs ',''))+'</span></h2>'+lineChart(labels,sc,sp,v=>fmt(v).replace(/\.0+$/,'').replace(/(\.\d)0$/,'$1'))+'</section>'+
    '<section class="card"><h2>Busy hours <span class="muted sm">last 4 weeks</span></h2>'+heatmap(DB.orders.filter(o=>o.ts>now()-28*864e5))+'</section></div>'+
    '<div class="cols3"><section class="card"><h2>Where sales come from</h2>'+mixBars(objRows(ch))+'</section><section class="card"><h2>How guests pay</h2>'+mixBars(objRows(pay))+'</section><section class="card"><h2>Category mix</h2>'+mixBars(objRows(cat))+'</section></div>'+
    '<div class="cols2"><section class="card"><h2>Top items</h2>'+tbl([{h:'Item',r:r=>esc(r.n)},{h:'Sold',cls:'r',r:r=>r.q},{h:'Sales',cls:'r',r:r=>fmt(r.v)},{h:'Margin',cls:'r',r:r=>r.v>0?Math.round((r.v-r.c)/r.v*100)+'%':'—'}],items.slice(0,7),'No sales in this period.')+'</section>'+
    '<section class="card"><h2>Team leaderboard</h2>'+tbl([{h:'Cashier',r:r=>esc(r.n)},{h:'Orders',cls:'r',r:r=>r.o},{h:'Sales',cls:'r',r:r=>fmt(r.v)},{h:'Avg',cls:'r',r:r=>fmt(r.o?r.v/r.o:0)},{h:'Disc.',cls:'r',r:r=>r.sub>0?Math.round(r.d/r.sub*100)+'%':'—'}],staffRows,'No sales in this period.')+'</section></div>'+
    '<div class="cols2">'+ops+(money_||'<section class="card"><h2>Recent orders</h2>'+recentOrders()+'</section>')+'</div>'+(money_?'<section class="card"><h2>Recent orders</h2>'+recentOrders()+'</section>':'');
}
function recentOrders(){
  return tbl([{h:'#',r:r=>'<a href="#" data-act="order-view" data-id="'+r.id+'"><b>'+esc(r.no)+'</b></a>'},{h:'Time',r:r=>fmtDT(r.ts)},{h:'Type',r:r=>esc(r.type)},{h:'Total',cls:'r',r:r=>fmt(r.total)},{h:'Status',r:r=>badge(r.status,r.status==='completed'?'ok':'bad')}],DB.orders.slice(-8).reverse(),'No orders yet.');
}
A['dash-range']=d=>{UIS.dr=d.id;render()};

/* ================= Sample data ================= */
const DEMO_GUESTS=[['Fatima Al Mansoori','0501100001'],['Mohammed Al Harbi','0501100002'],['Priya Nair','0501100003'],['Hassan Al Zaabi','0501100004'],['Layla Haddad','0501100005'],['Rahul Sharma','0501100006'],['Noura Al Qahtani','0501100007'],['Yusuf Khan','0501100008']];
function genDemoData(days){
  if(typeof finalizeOrder!=='function')return 0;
  const ME0=ME, users=DB.users.filter(u=>u.active&&PERMS[u.role]&&PERMS[u.role].indexOf('register')>=0), items=DB.items.filter(i=>i.active&&i.sku!=='DELIVERY'), ct=DB.counters.filter(c=>c.active)[0];
  if(!items.length||!ct||!users.length)return 0;
  // guests
  DEMO_GUESTS.forEach(g=>{if(!DB.customers.some(c=>c.phone===g[1]))DB.customers.push({id:uid('g'),name:g[0],phone:g[1],email:'',points:0,visits:0,spend:0,notes:'Sample guest',created:now()})});
  // stock top-up, accounted for
  items.filter(i=>i.track).forEach(i=>{const q=Math.max(0,300-stockOf(i.id));if(q>0){receiveLot(i.id,'DEMO-'+i.sku,now()+90*864e5,q,i.cost,'Sample stock');postStockReceive(i,q,i.cost,'','Sample stock')}});
  const hourW={8:1,9:2,10:2,11:4,12:9,13:10,14:6,15:3,16:3,17:4,18:6,19:9,20:10,21:8,22:4,23:1}, hours=Object.keys(hourW), hw=hours.reduce((a,h)=>a+hourW[h],0);
  const pickHour=()=>{let r=Math.random()*hw;for(const h of hours){r-=hourW[h];if(r<=0)return +h}return 20};
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  const wasBlocked=DB.settings.allowNegative; DB.settings.allowNegative=true;
  let made=0, today=dayStart(now());
  for(let d=days-1;d>=0;d--){
    const day=today-d*864e5, dow=new Date(day).getDay(), busy=(dow===5||dow===6?1.35:1)*(0.8+Math.random()*0.5), count=Math.round(26*busy)+(d===0?-8:0);
    const opener=pick(users), sess={id:uid('s'),counterId:ct.id,openedBy:opener.id,openedAt:day+8*36e5,float:200,closedAt:null};DB.sessions.push(sess);
    const times=[];for(let i=0;i<count;i++)times.push(day+pickHour()*36e5+Math.floor(Math.random()*36e5));times.sort((a,b)=>a-b);
    const dayOrders=[];
    times.forEach(ts=>{
      if(ts>now())return;
      const basket=[],nl=1+Math.floor(Math.random()*3), used={};
      for(let k=0;k<nl;k++){const it=pick(items);if(used[it.id])continue;used[it.id]=1;basket.push({key:uid('l'),itemId:it.id,qty:1+(Math.random()<0.25?1:0)+(Math.random()<0.08?1:0),note:''})}
      const r=Math.random(), type=r<0.35?'dine-in':r<0.78?'takeaway':'delivery';
      const S={cart:basket,customerId:Math.random()<0.3?pick(DB.customers).id:null,code:null,manual:Math.random()<0.07?{kind:'pct',value:10}:null,redeem:0,type:type,table:type==='dine-in'?'T'+(1+Math.floor(Math.random()*10)):''};
      const T=computeTotals(S), pr=Math.random(), method=pr<0.4?'cash':pr<0.88?'card':'wallet';
      const cashier=pick(users); ME=cashier;
      const o=finalizeOrder(S,sess,[{method:method,amount:T.total,tendered:T.total}],0,{ts:ts,userId:cashier.id,kds:{status:'done',ts:ts,doneTs:ts+12*6e4}});
      if(o){made++;dayOrders.push(o)}
    });
    ME=opener;
    // a few refunds, accounted exactly like the real refund flow
    dayOrders.filter(()=>Math.random()<0.02).forEach(o=>{
      o.status='refunded';o.refund={ts:o.ts+10*6e4,by:opener.id,reason:'Sample: guest unhappy',restock:true};
      o.lines.forEach(l=>returnStock(l.allocs,l.itemId,'Refund #'+o.no));postRefund(o,true);if(typeof einvStamp==='function'&&o.einv)einvStamp(o,'credit');
      const cash=r2(o.payments.filter(p=>p.method==='cash').reduce((a,p)=>a+p.amount,0));if(cash>0)DB.vouchers.push({id:uid('v'),sessionId:sess.id,ts:o.refund.ts,type:'refund',amount:cash,reason:'Refund #'+o.no,userId:opener.id});
    });
    if(d>0){ // close past days with counted cash close to expected
      const st=sessionStats(sess), v=Math.random()<0.12?r2((Math.random()-0.5)*8):0;
      sess.counted=r2(st.expected+v);sess.variance=v;sess.closedAt=day+23*36e5;sess.closedBy=opener.id;if(v)postCashVariance(sess);
    }
  }
  DB.settings.allowNegative=wasBlocked; ME=ME0;
  audit('demo.data',made+' sample orders over '+days+' days'); save(); return made;
}
A['demo-data']=()=>{
  if(!can('settings')){toast('Only an admin can load sample data','err');return}
  confirmBox('Add about 14 days of realistic sample sales (orders, stock movements, accounting entries, e-invoices)? It is added on top of your current data. Use "Reset to demo data" in Settings to remove it.',()=>{
    const n=genDemoData(14);toast(n?n+' sample orders created':'Could not create sample data',n?undefined:'err');UIS.dr='7d';render();
  },'Load sample sales');
};
