'use strict';
/* Harbinger Intelligence — forecasting, risk alerts, menu engineering, guest segments, kitchen display, briefing, command palette.
   All rule/statistics based and computed locally from this browser's data. */

const DAY=864e5;
const orderDone=()=>DB.orders.filter(o=>o.status==='completed');
const firstOrderTs=()=>DB.orders.length?Math.min.apply(null,DB.orders.map(o=>o.ts)):now();
const effDays=days=>Math.max(1,Math.min(days,(now()-firstOrderTs())/DAY));
function qtyBetween(itemId,a,b){let q=0;orderDone().forEach(o=>{if(o.ts<a||o.ts>b)return;o.lines.forEach(l=>{if(l.itemId===itemId)q+=l.qty})});return q}
const velocity=(itemId,days)=>qtyBetween(itemId,now()-days*DAY,now())/effDays(days);
const priceEx=it=>DB.settings.taxInclusive&&it.tax?it.price/(1+DB.settings.vatPct/100):it.price;
const DEFAULT_LEAD=2;

/* ================= Reorder forecast ================= */
function reorderRows(cover){
  const out=[];
  DB.items.filter(i=>i.active&&i.track).forEach(i=>{
    const stock=stockOf(i.id), v14=velocity(i.id,14), v7=velocity(i.id,7), v=0.6*v7+0.4*v14, lead=i.leadDays!=null&&i.leadDays!==''?+i.leadDays:DEFAULT_LEAD;
    const cur7=qtyBetween(i.id,now()-7*DAY,now()), prev7=qtyBetween(i.id,now()-14*DAY,now()-7*DAY);
    const trend=prev7>0?Math.round((cur7-prev7)/prev7*100):null;
    let suggest=Math.max(0,Math.ceil(v*(cover+lead)*1.1-stock));
    if(v===0&&stock<=i.reorder)suggest=Math.max(0,i.reorder*2-stock);
    const days=v>0?stock/v:Infinity;
    const urgency=stock<=0?'out':(v>0&&days<lead)?'urgent':(v>0&&days<lead+cover/2)||stock<=i.reorder?'soon':'ok';
    if(suggest>0||urgency!=='ok')out.push({item:i,stock:stock,v:v,days:days,suggest:suggest,urgency:urgency,trend:trend,lead:lead,sup:byId(DB.suppliers,i.supplierId)||null});
  });
  const rank={out:0,urgent:1,soon:2,ok:3};
  return out.sort((a,b)=>rank[a.urgency]-rank[b.urgency]||a.days-b.days);
}
function expiryRisk(){
  const out=[];
  DB.items.filter(i=>i.track).forEach(i=>{
    const v=0.6*velocity(i.id,7)+0.4*velocity(i.id,14); let cum=0;
    lotsOf(i.id).filter(l=>l.qty>0&&l.expiry).forEach(l=>{
      cum+=l.qty; const d=Math.max(0,(l.expiry-now())/DAY), sellable=v*d, risk=Math.max(0,Math.min(l.qty,cum-sellable));
      if(risk>=1)out.push({item:i,lot:l,risk:Math.floor(risk),value:r2(Math.floor(risk)*l.cost),days:Math.round(d)});
    });
  });
  return out.sort((a,b)=>a.days-b.days);
}
function vReorder(){
  const cover=UIS.cover||7, rows=reorderRows(cover), risk=expiryRisk();
  const ub={out:badge('Out of stock','bad'),urgent:badge('Run-out before delivery','bad'),soon:badge('Order soon','warn'),ok:badge('OK','ok')};
  const body=rows.length?'<div class="tbl-wrap"><table><thead><tr><th></th><th>Item</th><th class="r">On hand</th><th class="r">Sold / day</th><th class="r">Days left</th><th class="r">Trend</th><th>Supplier</th><th class="r">Order qty</th><th>Status</th></tr></thead><tbody>'+
    rows.map(r=>'<tr><td><input type="checkbox" name="rsel" data-id="'+r.item.id+'"'+(r.suggest>0?' checked':'')+' aria-label="Select '+esc(r.item.name)+'"></td><td><b>'+esc(r.item.name)+'</b></td><td class="r">'+r.stock+'</td><td class="r">'+(r.v>0?r.v.toFixed(1):'—')+'</td>'+
      '<td class="r">'+(r.days===Infinity?'—':r.days.toFixed(1))+'</td><td class="r">'+(r.trend==null?'—':(r.trend>0?'▲ ':r.trend<0?'▼ ':'')+Math.abs(r.trend)+'%')+'</td><td>'+esc(r.sup?r.sup.name:'—')+'</td>'+
      '<td class="r"><input class="qin" type="number" min="0" step="1" name="rq" data-id="'+r.item.id+'" value="'+r.suggest+'" aria-label="Order quantity for '+esc(r.item.name)+'"></td><td>'+ub[r.urgency]+'</td></tr>').join('')+'</tbody></table></div>':'<div class="empty">Nothing needs ordering. Stock covers the next '+cover+' days.</div>';
  return '<div class="bar"><label class="inl">Cover days <select data-ch="cover">'+[3,5,7,10,14].map(n=>'<option'+(cover===n?' selected':'')+'>'+n+'</option>').join('')+'</select></label><span class="muted sm">Order quantity = expected sales over (cover + lead time) +10% safety − stock on hand. Uses the last 14 days, weighted to the last 7.</span><span class="sp"></span>'+btn('Create draft purchase orders','reorder-po',null,'primary')+'</div>'+body+
    '<section class="card mt"><h2>Expiry risk <span class="muted sm">stock unlikely to sell before it expires</span></h2>'+
    tbl([{h:'Item',r:r=>'<b>'+esc(r.item.name)+'</b>'},{h:'Lot',r:r=>esc(r.lot.lotNo)},{h:'Expires in',cls:'r',r:r=>r.days+' days'},{h:'At risk',cls:'r',r:r=>r.risk+' units'},{h:'Value at cost',cls:'r',r:r=>fmt(r.value)},{h:'Action',r:r=>r.days<=3?badge('Discount / staff meal now','bad'):badge('Promote this week','warn')}],risk,'No expiry risk detected.')+'</section>';
}
C.cover=el=>{UIS.cover=+el.value;render()};
A['reorder-po']=()=>{
  const sel=$$('input[name=rsel]:checked').map(c=>c.dataset.id);
  const lines=sel.map(id=>({itemId:id,qty:Math.floor(num(($$('input[name=rq]').find(q=>q.dataset.id===id)||{}).value))})).filter(l=>l.qty>0);
  if(!lines.length){toast('Select items with a quantity above zero','err');return}
  if(!DB.suppliers.length){toast('Add a supplier first (Stock Room → Suppliers)','err');return}
  const groups={};
  lines.forEach(l=>{const it=itemById(l.itemId),sid=it.supplierId&&byId(DB.suppliers,it.supplierId)?it.supplierId:DB.suppliers[0].id;(groups[sid]=groups[sid]||[]).push({itemId:l.itemId,qty:l.qty,cost:it.cost})});
  let n=0; Object.keys(groups).forEach(sid=>{DB.seq.po++;DB.pos.push({id:uid('po'),no:'PO-'+String(DB.seq.po).padStart(4,'0'),supplierId:sid,ts:now(),status:'draft',lines:groups[sid]});n++});
  audit('po.autocreate',n+' draft PO(s) from reorder suggestions');save();toast(n+' draft purchase order(s) created');location.hash='#/stock/pos';
};

/* ================= Risk & fraud alerts ================= */
function riskAlerts(days){
  const since=now()-days*DAY, O=DB.orders.filter(o=>o.ts>=since), out=[], dkey=dayKey(now());
  const U={}; O.forEach(o=>{const u=U[o.userId]||(U[o.userId]={n:0,ref:0,refv:0,sub:0,disc:0,man:0,night:0,fast:0});u.n++;u.sub+=o.subtotal;u.disc+=o.discountTotal;
    if(o.status==='refunded'){u.ref++;u.refv+=o.total;if(o.refund&&o.refund.ts-o.ts<5*60000)u.fast++}
    if(o.discounts.some(d=>d.kind==='manual'))u.man++;if(new Date(o.ts).getHours()<5)u.night++});
  const tot=Object.keys(U).reduce((a,k)=>({n:a.n+U[k].n,ref:a.ref+U[k].ref,man:a.man+U[k].man}),{n:0,ref:0,man:0});
  const avgRef=tot.n?tot.ref/tot.n:0, avgMan=tot.n?tot.man/tot.n:0;
  Object.keys(U).forEach(id=>{
    const u=U[id], who=userName(id), add=(sev,rule,detail)=>out.push({key:rule+'|'+id+'|'+dkey,sev:sev,who:who,rule:rule,detail:detail});
    const rr=u.n?u.ref/u.n:0, mr=u.n?u.man/u.n:0;
    if(u.n>=5&&u.ref>=2&&rr>Math.max(0.08,2*avgRef))add('high','High refund rate',u.ref+' of '+u.n+' orders refunded ('+Math.round(rr*100)+'%) vs outlet average '+Math.round(avgRef*100)+'%');
    if(u.fast>=2)add('high','Quick refunds',u.fast+' orders refunded within 5 minutes of the sale');
    if(u.refv>=300)add('med','Large refund value',money(u.refv)+' refunded in '+days+' days');
    if(u.n>=8&&mr>Math.max(0.25,2*avgMan))add('med','Frequent manual discounts',u.man+' of '+u.n+' orders ('+Math.round(mr*100)+'%) had a manual discount');
    if(u.night>=1)add('low','After-hours sales',u.night+' sale(s) between midnight and 5am');
  });
  const vs={}; DB.sessions.filter(s=>s.closedAt&&s.closedAt>=since&&Math.abs(s.variance||0)>5).forEach(s=>{const v=vs[s.closedBy]||(vs[s.closedBy]={n:0,sum:0});v.n++;v.sum=r2(v.sum+s.variance)});
  Object.keys(vs).forEach(id=>{const v=vs[id];out.push({key:'Cash variance|'+id+'|'+dkey,sev:v.n>=2||Math.abs(v.sum)>50?'high':'med',who:userName(id),rule:'Cash variance',detail:v.n+' register close(s) off by more than 5; net '+(v.sum>0?'+':'')+fmt(v.sum)})});
  const below=[]; O.forEach(o=>o.lines.forEach(l=>{if(l.price<l.cost&&below.indexOf(l.name)<0)below.push(l.name)}));
  if(below.length)out.push({key:'Below cost|'+dkey,sev:'low',who:'Catalog',rule:'Sold below cost',detail:below.slice(0,6).join(', ')+' — price is lower than cost'});
  const over=DB.movements.filter(m=>m.ts>=since&&m.note==='oversold'); if(over.length)out.push({key:'Oversold|'+dkey,sev:'med',who:'Stock',rule:'Sold beyond recorded stock',detail:over.length+' sale line(s) exceeded stock on hand; stock records may be wrong'});
  const rank={high:0,med:1,low:2}; return out.sort((a,b)=>rank[a.sev]-rank[b.sev]);
}
const riskOpen=()=>riskAlerts(30).filter(a=>!(DB.riskReviewed||{})[a.key]);
function vRisk(){
  const rows=riskAlerts(30), rev=DB.riskReviewed||{};
  return '<p class="muted sm">Rules compare each person with the outlet average over the last 30 days. Alerts are prompts to look closer, not proof of wrongdoing.</p>'+
    tbl([{h:'Severity',r:r=>badge(r.sev==='high'?'High':r.sev==='med'?'Medium':'Low',r.sev==='high'?'bad':r.sev==='med'?'warn':'')},{h:'Who',r:r=>esc(r.who)},{h:'Rule',r:r=>'<b>'+esc(r.rule)+'</b>'},{h:'Detail',r:r=>esc(r.detail)},
      {h:'',cls:'r',r:r=>rev[r.key]?badge('Reviewed '+fmtDate(rev[r.key]),'ok'):btn('Mark reviewed','risk-ok',r.key)}],rows,'No risk signals in the last 30 days.');
}
A['risk-ok']=d=>{DB.riskReviewed=DB.riskReviewed||{};DB.riskReviewed[d.id]=now();audit('risk.review',d.id);save();render()};

/* ================= Menu engineering ================= */
function menuEng(days){
  const since=now()-days*DAY, agg={};
  orderDone().filter(o=>o.ts>=since).forEach(o=>o.lines.forEach(l=>{const it=itemById(l.itemId);if(!it)return;const a=agg[l.itemId]||(agg[l.itemId]={item:it,qty:0,rev:0,contrib:0});
    const pex=DB.settings.taxInclusive&&l.tax!==false?l.price/(1+DB.settings.vatPct/100):l.price;a.qty+=l.qty;a.rev=r2(a.rev+l.qty*pex);a.contrib=r2(a.contrib+l.qty*(pex-l.cost))}));
  const rows=Object.keys(agg).map(k=>agg[k]); if(!rows.length)return {rows:[],popT:0,marT:0};
  const totQty=rows.reduce((s,r)=>s+r.qty,0), popT=0.7*(1/rows.length)*totQty, marT=rows.reduce((s,r)=>s+r.contrib,0)/totQty;
  rows.forEach(r=>{r.um=r.contrib/r.qty;const hp=r.qty>=popT,hm=r.um>=marT;r.cls=hp&&hm?'Star':hp?'Plowhorse':hm?'Puzzle':'Dog'});
  return {rows:rows.sort((a,b)=>b.contrib-a.contrib),popT:popT,marT:marT};
}
function vMenuEng(){
  const days=UIS.meDays||30, d=menuEng(days);
  const tips={Star:'Keep prominent and protect quality.',Plowhorse:'Popular but thin margin — raise price slightly or trim cost.',Puzzle:'Profitable but slow — reposition, rename, or promote.',Dog:'Weak on both — rework or remove.'};
  const cnt=k=>d.rows.filter(r=>r.cls===k).length, kind={Star:'ok',Plowhorse:'warn',Puzzle:'',Dog:'bad'};
  window._csv=[['item','class','qty','sales ex vat','contribution','margin per unit']].concat(d.rows.map(r=>[r.item.name,r.cls,r.qty,r.rev,r.contrib,r2(r.um)]));window._csvName='menu-engineering';
  return '<div class="bar"><label class="inl">Period <select data-ch="meDays">'+[7,14,30,60,90].map(n=>'<option value="'+n+'"'+(days===n?' selected':'')+'>Last '+n+' days</option>').join('')+'</select></label><span class="sp"></span>'+btn('Export CSV','rep-export')+'</div>'+
    '<div class="kpis">'+['Star','Plowhorse','Puzzle','Dog'].map(k=>'<div class="kpi"><span class="kl">'+k+'s</span><strong>'+cnt(k)+'</strong><span class="muted sm">'+esc(tips[k])+'</span></div>').join('')+'</div>'+
    tbl([{h:'Item',r:r=>'<b>'+esc(r.item.name)+'</b>'},{h:'Class',r:r=>badge(r.cls,kind[r.cls])},{h:'Sold',cls:'r',r:r=>r.qty},{h:'Sales (ex VAT)',cls:'r',r:r=>fmt(r.rev)},{h:'Margin / unit',cls:'r',r:r=>fmt(r.um)},{h:'Profit contribution',cls:'r',r:r=>fmt(r.contrib)},{h:'Suggested action',r:r=>'<span class="muted sm">'+esc(tips[r.cls])+'</span>'}],d.rows,'No sales in this period yet.')+
    '<p class="muted sm" style="margin-top:8px">Popular = sold at least 70% of an equal share. High margin = at or above the sales-weighted average margin per unit ('+fmt(d.marT)+').</p>';
}
C.meDays=el=>{UIS.meDays=+el.value;render()};

/* ================= Hourly pattern ================= */
function vHourly(){
  const days=14, since=now()-days*DAY, H=new Array(24).fill(0), N=new Array(24).fill(0);
  orderDone().filter(o=>o.ts>=since).forEach(o=>{const h=new Date(o.ts).getHours();H[h]=r2(H[h]+o.total);N[h]++});
  const data=[];for(let h=7;h<=23;h++)data.push({label:pad(h),value:H[h]});
  const peak=H.indexOf(Math.max.apply(null,H));
  return '<p class="muted sm">Sales by hour of day over the last '+days+' days.'+(H[peak]>0?' Peak hour: <b>'+pad(peak)+':00</b>.':'')+'</p><section class="card">'+barChart(data,{label:'Sales by hour'})+'</section>';
}

/* ================= Guest segments (RFM) ================= */
function guestStats(){
  const m={}; orderDone().forEach(o=>{if(!o.customerId)return;const s=m[o.customerId]||(m[o.customerId]={n:0,spend:0,last:0,first:Infinity});s.n++;s.spend=r2(s.spend+o.total);s.last=Math.max(s.last,o.ts);s.first=Math.min(s.first,o.ts)});
  return DB.customers.map(c=>{const s=m[c.id]||{n:0,spend:0,last:0,first:0},rec=s.n?Math.floor((now()-s.last)/DAY):null;
    let seg='Never visited';
    if(s.n){ if(rec>90)seg='Lost'; else if(rec>30&&s.n>=2)seg='At risk'; else if(s.n>=3&&rec<=14)seg='Champion'; else if(s.n>=3)seg='Loyal'; else if(s.n===1&&rec<=30)seg='New'; else seg='Occasional' }
    return {c:c,n:s.n,spend:s.spend,rec:rec,seg:seg};});
}
const SEG_KIND={Champion:'ok',Loyal:'ok',New:'',Occasional:'',"At risk":'warn',Lost:'bad','Never visited':''};
const waLink=(phone,text)=>{let p=String(phone||'').replace(/\D/g,'');if(!p)return '';if(p.charAt(0)==='0')p=(DB.settings.countryCode||'971')+p.slice(1);return 'https://wa.me/'+p+'?text='+encodeURIComponent(text)};
function winbackText(g){return 'Hi '+g.c.name.split(' ')[0]+', we miss you at '+DB.settings.business+'! Show this message for a treat on your next visit.'}
function vSegments(){
  const all=guestStats(), seg=UIS.seg||'all', rows=all.filter(g=>seg==='all'||g.seg===seg).sort((a,b)=>b.spend-a.spend);
  const names=['Champion','Loyal','New','Occasional','At risk','Lost','Never visited'];
  window._csv=[['name','phone','segment','visits','spend','days since last visit']].concat(rows.map(g=>[g.c.name,g.c.phone,g.seg,g.n,g.spend,g.rec==null?'':g.rec]));window._csvName='guest-segments';
  return '<div class="kpis">'+names.map(n=>'<button type="button" class="kpi seg-k'+(seg===n?' on':'')+'" data-act="seg-pick" data-id="'+n+'"><span class="kl">'+n+'</span><strong>'+all.filter(g=>g.seg===n).length+'</strong></button>').join('')+'</div>'+
    '<div class="bar"><button type="button" class="btn ghost sm" data-act="seg-pick" data-id="all">Show all</button><span class="muted sm">Based on completed orders linked to a guest. Champion: 3+ visits, last within 14 days · At risk: 2+ visits, none for 30–90 days · Lost: none for 90+ days.</span><span class="sp"></span>'+btn('Export CSV','rep-export')+'</div>'+
    tbl([{h:'Guest',r:r=>'<b>'+esc(r.c.name)+'</b>'},{h:'Segment',r:r=>badge(r.seg,SEG_KIND[r.seg])},{h:'Visits',cls:'r',r:r=>r.n},{h:'Spend',cls:'r',r:r=>fmt(r.spend)},{h:'Last visit',cls:'r',r:r=>r.rec==null?'—':r.rec+' days ago'},
      {h:'',cls:'r',r:r=>r.c.phone&&(r.seg==='At risk'||r.seg==='Lost'||r.seg==='New'||r.seg==='Never visited')?'<a class="btn ghost sm" href="'+esc(waLink(r.c.phone,winbackText(r)))+'" target="_blank" rel="noopener noreferrer">WhatsApp</a>':''}],rows,'No guests in this segment.');
}
A['seg-pick']=d=>{UIS.seg=d.id;render()};

/* ================= Briefing & dashboard helpers ================= */
function briefing(){
  const out=[], done=orderDone(), T=done.filter(o=>dayKey(o.ts)===dayKey(now())), W=done.filter(o=>o.ts>now()-7*DAY);
  const rev=a=>r2(a.reduce((s,o)=>s+o.total,0));
  const lw=done.filter(o=>dayKey(o.ts)===dayKey(now()-7*DAY));
  if(!done.length){out.push({k:'info',t:'No sales yet. Open the register and make a first sale to see insights here.'});}
  else{
    if(lw.length&&T.length){const d=Math.round((rev(T)-rev(lw))/rev(lw)*100);out.push({k:d>=0?'ok':'warn',t:'Today is '+(d>=0?'up ':'down ')+Math.abs(d)+'% on the same day last week ('+money(rev(T))+' vs '+money(rev(lw))+').'})}
    else if(T.length)out.push({k:'info',t:'Today so far: '+money(rev(T))+' from '+T.length+' orders.'});
    const H=new Array(24).fill(0);W.forEach(o=>{H[new Date(o.ts).getHours()]+=o.total});const pk=H.indexOf(Math.max.apply(null,H));
    if(H[pk]>0)out.push({k:'info',t:'Busiest hour this week is '+pad(pk)+':00. Make sure your strongest team is on then.'});
    const me=menuEng(30);const dogs=me.rows.filter(r=>r.cls==='Dog'),stars=me.rows.filter(r=>r.cls==='Star');
    if(stars.length)out.push({k:'ok',t:'Top profit driver (30 days): '+stars[0].item.name+' — '+money(stars[0].contrib)+' contribution.'});
    if(dogs.length)out.push({k:'warn',t:dogs.length+' menu item(s) are weak on both sales and margin (e.g. '+dogs[0].item.name+'). See Insights → Menu profit.'});
  }
  const onn=typeof newOnlineCount==='function'&&can('online')?newOnlineCount():0;if(onn)out.push({k:'bad',t:onn+' new online / delivery-app order(s) waiting. <a href="#/online">Open the queue</a>.',html:true});
  if(typeof bizBriefing==='function')bizBriefing().forEach(x=>out.push(x));
  const rr=reorderRows(7).filter(r=>r.urgency==='out'||r.urgency==='urgent');
  if(rr.length)out.push({k:'bad',t:rr.length+' item(s) will run out before a delivery can arrive (e.g. '+rr[0].item.name+'). <a href="#/stock/reorder">Review reorder list</a>.',html:true});
  const er=expiryRisk().filter(r=>r.days<=7);if(er.length)out.push({k:'warn',t:money(er.reduce((a,r)=>a+r.value,0))+' of stock is unlikely to sell before it expires within 7 days. <a href="#/stock/reorder">See expiry risk</a>.',html:true});
  const ro=can('reports')?riskOpen():[];if(ro.length)out.push({k:ro.some(a=>a.sev==='high')?'bad':'warn',t:ro.length+' unreviewed risk alert(s). <a href="#/reports/risk">Review</a>.',html:true});
  const lost=guestStats().filter(g=>g.seg==='At risk').length;if(lost)out.push({k:'info',t:lost+' regular guest(s) have not visited for 30+ days. <a href="#/guests/segments">Send a win-back message</a>.',html:true});
  if(can('accounts')&&DB.acc){const m=balMap(null),pay=r2(-groupLedgers('g_cred').reduce((a,l)=>a+m[l.id].close,0));if(pay>0)out.push({k:'info',t:'You owe suppliers '+money(pay)+'. <a href="#/accounts/outstanding">Outstanding payables</a>.',html:true})}
  return out;
}
function briefHtml(){
  return '<section class="card mt"><h2>Daily briefing</h2><ul class="brief">'+briefing().map(b=>'<li class="'+b.k+'">'+(b.html?b.t:esc(b.t))+'</li>').join('')+'</ul></section>';
}

/* ================= Kitchen display ================= */
const KDS_WARN=6, KDS_LATE=12; // minutes
function kdsTickets(){return DB.orders.filter(o=>o.status==='completed'&&o.kds&&o.kds.status!=='done').sort((a,b)=>a.ts-b.ts)}
function vKitchen(){
  const T=kdsTickets(), cols=[['new',tr('New')],['preparing',tr('Preparing')],['ready',tr('Ready')]];
  const card=o=>{
    const mins=(now()-o.ts)/60000, cls=o.kds.status==='ready'?'rdy':mins>=KDS_LATE?'late':mins>=KDS_WARN?'warn':'';
    const next=o.kds.status==='new'?['k-start',tr('Start')]:o.kds.status==='preparing'?['k-ready',tr('Ready')]:['k-done',tr('Served')];
    const kp=DB.settings.kotPrinters||0;
    let itemsHtml;
    if(kp>0){
      const groups={};
      o.lines.forEach(l=>{const k=l.kotPrinter||0;if(!groups[k])groups[k]=[];groups[k].push(l)});
      itemsHtml=Object.keys(groups).sort((a,b)=>Number(a)-Number(b)).map(k=>{
        const label=k!=='0'?'<li class="kt-printer muted sm">Printer '+k+'</li>':'';
        return label+groups[k].map(l=>'<li><b>'+l.qty+'×</b> '+esc(l.name)+(l.note?'<em>'+esc(l.note)+'</em>':'')+'</li>').join('');
      }).join('');
    }else{
      itemsHtml=o.lines.map(l=>'<li><b>'+l.qty+'×</b> '+esc(l.name)+(l.note?'<em>'+esc(l.note)+'</em>':'')+'</li>').join('');
    }
    return '<article class="kt '+cls+'"><header><b>#'+esc(o.no)+'</b><span>'+esc(o.type)+(o.table?' · '+esc(o.table):'')+'</span><time>'+Math.floor(mins)+':'+pad(Math.floor((mins%1)*60))+'</time></header><ul>'+itemsHtml+'</ul><button type="button" class="btn primary block" data-act="'+next[0]+'" data-id="'+o.id+'">'+next[1]+'</button></article>';
  };
  return '<div class="reg kds"><header class="rh"><div class="rb"><svg class="mk" viewBox="0 0 144 127" aria-hidden="true"><use href="#mark"/></svg><strong>Harbinger Kitchen</strong><span class="muted">'+T.length+' open ticket(s)</span></div>'+
    '<div class="ra"><button type="button" class="btn ghost sm" data-act="k-mute">'+(UIS.kmute?'🔇 Sound off':'🔔 Sound on')+'</button><button type="button" class="btn ghost sm" data-act="k-recall">Recall last served</button><button type="button" class="btn ghost sm" data-act="r-exit">'+(can('dashboard')?'Console':'Sign out')+'</button></div></header>'+
    '<div class="kcols">'+cols.map(c=>{const list=T.filter(o=>o.kds.status===c[0]);return '<section class="kcol"><h2>'+c[1]+' <span class="count">'+list.length+'</span></h2>'+(list.map(card).join('')||'<div class="empty">—</div>')+'</section>'}).join('')+'</div></div>';
}
function kdsAfter(){
  const n=kdsTickets().filter(o=>o.kds.status==='new').length;
  if(UIS.kPrev!=null&&n>UIS.kPrev&&!UIS.kmute)beep();
  UIS.kPrev=n;
}
function beep(){try{const c=new (window.AudioContext||window.webkitAudioContext)(),o=c.createOscillator(),g=c.createGain();o.frequency.value=880;g.gain.value=0.08;o.connect(g);g.connect(c.destination);o.start();setTimeout(()=>{o.stop();c.close()},220)}catch(e){}}
const setK=(id,st)=>{const o=byId(DB.orders,id);if(!o||!o.kds)return;o.kds.status=st;if(typeof onKdsChange==='function')onKdsChange(o,st);if(st==='ready')o.kds.readyTs=now();if(st==='done')o.kds.doneTs=now();save();render()};
A['k-start']=d=>setK(d.id,'preparing');A['k-ready']=d=>setK(d.id,'ready');A['k-done']=d=>setK(d.id,'done');
A['k-mute']=()=>{UIS.kmute=!UIS.kmute;render()};
A['k-recall']=()=>{const l=DB.orders.filter(o=>o.kds&&o.kds.status==='done').sort((a,b)=>(b.kds.doneTs||0)-(a.kds.doneTs||0))[0];if(!l){toast('Nothing to recall');return}l.kds.status='ready';save();render();toast('Recalled #'+l.no)};

/* ================= Command palette ================= */
let _pal={sel:0,list:[]};
function palItems(q){
  q=q.trim().toLowerCase(); const out=[], add=(l,h,run)=>out.push({label:l,hint:h,run:run});
  Object.keys(ROUTES).forEach(k=>{const r=ROUTES[k];if(can(r.perm)&&match(q,[r.label,k]))add('Go to '+r.label,'Page',()=>{location.hash='#/'+k})});
  const acts=[['New item','catalog',()=>A['item-edit']({})],['New guest','guests',()=>A['guest-edit']({})],['Receive stock','stock',()=>{location.hash='#/stock/receive'}],['Reorder suggestions','stock',()=>{location.hash='#/stock/reorder'}],
    ['Risk alerts','reports',()=>{location.hash='#/reports/risk'}],['Menu profit matrix','reports',()=>{location.hash='#/reports/menu'}],['Guest segments','guests',()=>{location.hash='#/guests/segments'}],
    ['New Payment voucher','accounts',()=>A['vch-new']({id:'Payment'})],['New Receipt voucher','accounts',()=>A['vch-new']({id:'Receipt'})],['New Journal voucher','accounts',()=>A['vch-new']({id:'Journal'})],['Trial balance','accounts',()=>{location.hash='#/accounts/tb'}],
    ['Profit & loss','accounts',()=>{location.hash='#/accounts/pl'}],['Balance sheet','accounts',()=>{location.hash='#/accounts/bs'}],['Toggle dark mode','',()=>A['mode-toggle']()],['Sign out','',()=>A.logout()]];
  acts.forEach(a=>{if((!a[1]||can(a[1]))&&match(q,[a[0]]))add(a[0],'Action',a[2])});
  if(q.length>=2){
    if(can('catalog'))DB.items.filter(i=>match(q,[i.name,i.sku,i.barcode])).slice(0,5).forEach(i=>add(i.name,'Item · '+fmt(i.price),()=>A['item-edit']({id:i.id})));
    DB.customers.filter(c=>match(q,[c.name,c.phone,c.email])).slice(0,5).forEach(c=>add(c.name,'Guest · '+(c.phone||''),()=>A['guest-view']({id:c.id})));
    DB.orders.filter(o=>match(q,[o.no])).slice(-5).reverse().forEach(o=>add('Order #'+o.no,'Order · '+fmt(o.total),()=>A['order-view']({id:o.id})));
    if(can('accounts')&&DB.acc){DB.acc.ledgers.filter(l=>match(q,[l.name])).slice(0,5).forEach(l=>add(l.name,'Ledger',()=>{location.hash='#/accounts/ledgers/'+l.id}));
      DB.acc.vouchers.filter(v=>match(q,[v.no])).slice(-3).forEach(v=>add('Voucher '+v.no,'Accounts · '+v.type,()=>A['vch-view']({id:v.id})))}
  }
  return out.slice(0,12);
}
function palDraw(el){
  $('#palList',el).innerHTML=_pal.list.map((r,i)=>'<button type="button" class="pal-i'+(i===_pal.sel?' on':'')+'" data-pi="'+i+'"><span>'+esc(r.label)+'</span><span class="muted sm">'+esc(r.hint)+'</span></button>').join('')||'<div class="empty">No matches.</div>';
  const on=$('.pal-i.on',el);if(on&&on.scrollIntoView)on.scrollIntoView({block:'nearest'});
}
function palRun(i){const r=_pal.list[i];if(!r)return;closeModal(true);setTimeout(r.run,0)}
A.palette=()=>{
  if(!ME)return;
  _pal={sel:0,list:palItems('')};
  modal({title:'Search & commands',body:'<input id="palQ" type="search" placeholder="Type a page, item, guest, order #, ledger or action…" autocomplete="off" aria-label="Search and commands"><div id="palList" class="pal"></div>',
    onOpen:el=>{
      const q=$('#palQ',el);palDraw(el);
      q.addEventListener('input',()=>{_pal.list=palItems(q.value);_pal.sel=0;palDraw(el)});
      q.addEventListener('keydown',e=>{
        if(e.key==='ArrowDown'){e.preventDefault();_pal.sel=Math.min(_pal.list.length-1,_pal.sel+1);palDraw(el)}
        else if(e.key==='ArrowUp'){e.preventDefault();_pal.sel=Math.max(0,_pal.sel-1);palDraw(el)}
        else if(e.key==='Enter'){e.preventDefault();palRun(_pal.sel)}
      });
      $('#palList',el).addEventListener('click',e=>{const b=e.target.closest('[data-pi]');if(b)palRun(+b.dataset.pi)});
    }});
};

/* ================= WhatsApp receipt ================= */
function receiptText(o){
  const s=DB.settings, L=o.lines.map(l=>l.qty+'x '+l.name+'  '+fmt(r2(l.qty*l.price))).join('\n');
  return s.business+'\nTax invoice #'+o.no+'\n'+fmtDT(o.ts)+'\n\n'+L+'\n\n'+(o.discountTotal?'Discount: -'+fmt(o.discountTotal)+'\n':'')+'VAT '+s.vatPct+'%: '+fmt(o.vat)+'\nTotal: '+s.currency+' '+fmt(o.total)+'\n\n'+s.footer;
}
function waReceipt(o){
  const cu=byId(DB.customers,o.customerId);
  const send=phone=>{const link=waLink(phone,receiptText(o));if(!link){toast('Enter a valid phone number','err');return false}window.open(link,'_blank','noopener,noreferrer')};
  if(cu&&cu.phone){send(cu.phone);return}
  modal({title:'Send receipt on WhatsApp',body:field('Guest phone number','phone','',{type:'tel',af:1,ph:'05xxxxxxxx'}),enter:el=>$('.btn.primary',el).click(),
    actions:[{label:'Cancel'},{label:'Open WhatsApp',cls:'primary',fn:el=>send(formData(el).phone)}]});
}
