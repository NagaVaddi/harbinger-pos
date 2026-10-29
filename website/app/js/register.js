'use strict';
/* Harbinger Register — the point-of-sale screen. */

const R={cat:'all',q:'',cart:[],type:'takeaway',table:'',customerId:null,code:null,manual:null,redeem:0,sessionId:null};
const VOUCHER_LIMIT=100; // cashiers need a manager PIN above this
function regReset(){R.provider='';R.cart=[];R.type='takeaway';R.table='';R.customerId=null;R.code=null;R.manual=null;R.redeem=0;R.marginOk=false;R.jobId=null;R.vehicle=null;R.driverId=null}
/* Profit guard: live margin on the ticket, ex-VAT, against item cost */
const minMargin=()=>DB.settings.minMarginPct!=null?DB.settings.minMarginPct:15;
function ticketMargin(T){
  const cost=r2(T.lines.reduce((a,l)=>a+l.qty*l.it.cost,0)), ex=r2(T.total-T.vat-(T.chargeTotal||0)), profit=r2(ex-cost);
  return {cost:cost,ex:ex,profit:profit,pct:ex>0?profit/ex*100:(T.lines.length&&T.total===0?-100:100)};
}
function marginLine(T){
  if(!T.lines.length)return '';
  const mg=ticketMargin(T), mm=minMargin(), low=mm>0&&mg.pct<mm, warn=mm>0&&!low&&mg.pct<mm+10, full=can('discount_override');
  if(!full&&!low)return '';
  return '<div class="tr mg '+(low?'low':warn?'near':'good')+'" title="Profit guard"><span>'+(full?'Profit '+esc(DB.settings.currency)+' '+fmt(mg.profit)+' · '+Math.round(mg.pct)+'%':'Low margin')+'</span><span>'+(low?'⚠ below '+mm+'% — approval needed':'')+'</span></div>';
}
function curSession(){
  let s=R.sessionId?byId(DB.sessions,R.sessionId):null;
  if(s&&s.closedAt)s=null;
  if(!s){s=DB.sessions.find(x=>!x.closedAt&&x.openedBy===ME.id)||null;R.sessionId=s?s.id:null}
  return s;
}
const stockLeft=it=>it.track?rq(sellableOf(it.id)-R.cart.filter(l=>l.itemId===it.id).reduce((a,l)=>a+l.qty,0)):Infinity;

/* ---------- screens ---------- */
function vRegister(){
  const sess=curSession();
  if(!sess)return vOpenRegister();
  const ct=byId(DB.counters,sess.counterId), T=computeTotals(R), cu=byId(DB.customers,R.customerId);
  const items=DB.items.filter(i=>i.active&&(R.cat==='all'||i.categoryId===R.cat)&&match(R.q,[i.name,i.nameAr,i.sku,i.barcode,i.size,i.brand]));
  const showTiles=!bm('scanFirst')||!!R.q||!!R.browse;
  const tiles=showTiles?tilesHtml(items):'<div class="scanbox"><div class="scanbig">'+tr('Scan items')+'</div><p class="muted">'+tr('Use the barcode scanner, or type a name, code or PLU.')+' <code>3*barcode</code> '+tr('adds 3.')+'</p><button type="button" class="btn ghost" data-act="r-browse">'+tr('Browse items')+'</button></div>';
  const chips=!showTiles?'':'<button type="button" class="chip'+(R.cat==='all'?' on':'')+'" data-act="r-cat" data-id="all">'+tr('All')+'</button>'+DB.categories.map(c=>'<button type="button" class="chip'+(R.cat===c.id?' on':'')+'" data-act="r-cat" data-id="'+c.id+'">'+esc(dn(c))+'</button>').join('');
  const lines=T.lines.map(l=>'<div class="ln"><div class="ln-t"><b>'+esc(dn(l.it))+'</b><span>'+fmt(l.total)+'</span></div>'+lineMeta(l)+'<div class="ln-c">'+lineQtyUi(l)+
    '<button type="button" class="lnk" data-act="r-note" data-id="'+l.key+'">'+(l.note?'✎ '+esc(l.note):tr('+ note'))+'</button><button type="button" class="lnk bad" data-act="r-del" data-id="'+l.key+'" aria-label="Remove">✕</button></div></div>').join('')||'<div class="empty">'+tr('Tap an item or scan a barcode to start.')+'</div>';
  const disc=T.discounts.map(d=>'<div class="tr disc"><span>'+esc(d.label)+'</span><span>−'+fmt(d.amount)+'</span></div>').join('');
  const tableEnabled=!(DB.settings.features&&DB.settings.features.tableManagement===false);
  if(!tableEnabled&&R.type==='dine-in')R.type='takeaway';
  const types=biz().types.filter(t=>tableEnabled||t!=='dine-in').map(t=>[t,typeLabel(t)]).map(t=>'<button type="button" class="seg'+(R.type===t[0]?' on':'')+'" data-act="r-type" data-id="'+t[0]+'">'+t[1]+'</button>').join('');
  const canPay=R.cart.length>0;
  return '<div class="reg">'+
  '<header class="rh"><div class="rb"><svg class="mk" viewBox="0 0 144 127" aria-hidden="true"><use href="#mark"/></svg><strong>'+tr('Harbinger Register')+'</strong><span class="muted">'+esc(ct.name)+' · '+esc(ME.name)+'</span></div>'+
  '<div class="ra">'+(bm('scanFirst')?'<button type="button" class="btn ghost sm" data-act="r-browse">'+(R.browse?tr('Scan items'):tr('Browse items'))+'</button>':'')+(bm('online')?'<button type="button" class="btn ghost sm" data-act="go-online">'+tr('Online')+' ('+newOnlineCount()+')</button>':'')+'<button type="button" class="btn ghost sm" data-act="r-held">'+tr('Held')+' ('+DB.held.length+')</button><button type="button" class="btn ghost sm" data-act="r-orders">'+tr('Orders')+'</button><button type="button" class="btn ghost sm" data-act="r-voucher">'+tr('Cash in/out')+'</button>'+
  '<button type="button" class="btn ghost sm" data-act="r-close">'+tr('Close register')+'</button><button type="button" class="btn ghost sm" data-act="lang-toggle" aria-label="Language">'+(LANG==='ar'?'EN':'ع')+'</button><button type="button" class="btn ghost sm" data-act="r-exit">'+(can('dashboard')?tr('Console'):tr('Sign out'))+'</button></div></header>'+
  '<div class="rbody"><section class="rl"><div class="rs"><input id="rq" type="search" placeholder="'+esc(tr('Search item or scan barcode  (F2)'))+'" value="'+esc(R.q)+'" data-in="rq" autocomplete="off" aria-label="Search items or scan barcode"></div>'+
  '<div class="chips" role="tablist" aria-label="Categories">'+chips+'</div><div class="tiles" role="list">'+tiles+'</div></section>'+
  '<aside class="rt" aria-label="Current ticket"><div class="segs">'+types+'</div>'+
  (tableEnabled&&bm('tables')&&R.type==='dine-in'?'<input class="tbl-in" id="rtable" placeholder="'+esc(tr('Table / seat'))+'" maxlength="12" value="'+esc(R.table)+'" data-in="rtable" aria-label="Table">':'')+
  '<div class="gl">'+(cu?'<span class="gchip"><b>'+esc(cu.name)+'</b> · '+(bm('insurance')&&cu.insurer?esc(cu.insurer)+' · co-pay '+(cu.copay||0)+'%':cu.points+' pts')+' <button type="button" data-act="r-guest-x" aria-label="Remove guest">✕</button></span>':'<button type="button" class="btn ghost sm" data-act="r-guest">'+tr('+ Guest')+'</button>')+'</div>'+
  (bm('vehicle')?'<div class="gl">'+(R.vehicle?'<span class="gchip">🚗 <b>'+esc(R.vehicle.plate)+'</b> '+esc((R.vehicle.make||'')+' '+(R.vehicle.model||''))+' <button type="button" data-act="r-vehicle-x" aria-label="Remove vehicle">✕</button></span>':'<button type="button" class="btn ghost sm" data-act="r-vehicle">+ Vehicle</button>')+'</div>':'')+(R.type==='delivery'&&DB.drivers.some(x=>x.active)?'<div class="gl">'+(R.driverId?'<span class="gchip">🛵 <b>'+esc((byId(DB.drivers,R.driverId)||{}).name||'')+'</b> <button type="button" data-act="r-driver-x" aria-label="Remove driver">✕</button></span>':'<button type="button" class="btn ghost sm" data-act="r-driver">+ Driver</button>')+'</div>':'')+(R.jobId?'<div class="gl"><span class="gchip">Job <b>'+esc((byId(DB.jobs,R.jobId)||{}).no||'')+'</b></span></div>':'')+'<div class="lines">'+lines+'</div>'+
  '<div class="sums"><div class="tr"><span>'+tr('Subtotal')+'</span><span>'+fmt(T.subtotal)+'</span></div>'+disc+
  (T.charges||[]).map(c=>'<div class="tr"><span>'+esc(c.name)+' '+c.pct+'%</span><span>'+fmt(c.amount)+'</span></div>').join('')+
  (DB.settings.vatPct>0?'<div class="tr mut"><span>'+esc(tr(taxWord()))+' '+DB.settings.vatPct+'%'+(DB.settings.taxInclusive?' incl.':'')+'</span><span>'+fmt(T.vat)+'</span></div>':'')+
  (T.codeMsg?'<div class="tr bad"><span>'+esc(T.codeMsg)+'</span><span></span></div>':'')+marginLine(T)+
  '<div class="tr tot"><span>'+tr('Total')+'</span><span>'+esc(DB.settings.currency)+' '+fmt(T.total)+'</span></div></div>'+
  '<div class="acts"><button type="button" class="btn ghost sm" data-act="'+(R.code?'r-code-x':'r-code')+'">'+(R.code?tr('Remove code'):tr('Promo code'))+'</button><button type="button" class="btn ghost sm" data-act="r-disc">'+tr('Discount')+'</button>'+
  (cu&&cu.points>0?'<button type="button" class="btn ghost sm" data-act="r-pts">'+tr('Points')+'</button>':'')+
  '<button type="button" class="btn ghost sm" data-act="r-hold"'+(canPay?'':' disabled')+'>'+tr('Hold')+'</button><button type="button" class="btn ghost sm" data-act="r-clear"'+(canPay?'':' disabled')+'>'+tr('Clear')+'</button></div>'+
  '<button type="button" class="pay" data-act="r-pay"'+(canPay?'':' disabled')+'>'+tr('Pay')+' '+esc(DB.settings.currency)+' '+fmt(T.total)+' <kbd>F9</kbd></button></aside></div></div>';
}
function vOpenRegister(){
  const cards=DB.counters.filter(c=>c.active).map(c=>{
    const s=openSession(c.id);
    if(s){const mine=s.openedBy===ME.id||can('voucher');return '<div class="card"><h3>'+esc(c.name)+'</h3><p>'+badge('Open','ok')+' since '+fmtDT(s.openedAt)+' by '+esc(userName(s.openedBy))+'</p>'+
      (mine?'<button class="btn primary" data-act="r-resume" data-id="'+s.id+'">Resume</button>':'<p class="muted sm">In use by another user.</p>')+'</div>'}
    return '<div class="card"><h3>'+esc(c.name)+'</h3><p>'+badge('Closed','')+'</p><label>Opening cash float<input id="float-'+c.id+'" type="number" min="0" step="0.01" value="200"></label><button class="btn primary mt" data-act="r-open" data-id="'+c.id+'">Open register</button></div>';
  }).join('')||'<div class="empty">No active registers. Ask a manager to add one.</div>';
  return '<div class="reg open"><header class="rh"><div class="rb"><svg class="mk" viewBox="0 0 144 127" aria-hidden="true"><use href="#mark"/></svg><strong>'+tr('Harbinger Register')+'</strong><span class="muted">'+esc(ME.name)+'</span></div><div class="ra"><button type="button" class="btn ghost sm" data-act="r-exit">'+(can('dashboard')?tr('Console'):tr('Sign out'))+'</button></div></header>'+
    '<div class="openbox"><h1>Open a register</h1><p class="muted">Count the cash in the drawer and enter the opening float.</p><div class="cols2">'+cards+'</div></div></div>';
}
A['r-open']=d=>{
  const f=num($('#float-'+d.id).value); if(f<0){toast('Float cannot be negative','err');return}
  if(openSession(d.id)){toast('Register already open','err');render();return}
  const s={id:uid('s'),counterId:d.id,openedBy:ME.id,openedAt:now(),float:r2(f),closedAt:null};
  DB.sessions.push(s);R.sessionId=s.id;audit('register.open',byId(DB.counters,d.id).name+' float '+f);save();render();
};
A['r-resume']=d=>{R.sessionId=d.id;render()};
A['r-exit']=()=>{if(can('dashboard'))location.hash='#/dashboard';else{logout();location.hash='#/';render()}};

/* ---------- cart ---------- */
A['r-add']=d=>addItemFlow(itemById(d.id));
A['r-browse']=()=>{R.browse=!R.browse;render()};
A['r-inc']=d=>{const l=byId2(d.id);if(!l)return;const it=itemById(l.itemId);if(stockLeft(it)<=0&&(!DB.settings.allowNegative||expiredOnly(it))){toast('No more stock for '+it.name,'err');return}l.qty++;render()};
A['r-dec']=d=>{const l=byId2(d.id);if(!l)return;l.qty--;if(l.qty<=0)R.cart=R.cart.filter(x=>x!==l);render()};
A['r-del']=d=>{R.cart=R.cart.filter(x=>x.key!==d.id);render()};
const byId2=k=>R.cart.find(x=>x.key===k);
const DEFAULT_NOTE_PRESETS=['No onion','No cheese','No sauce','Extra spicy','Well done','Medium','No ice','Extra portion','On the side','No salt','No sugar','Extra sauce'];
function notePresetsHtml(){
  const raw=DB.settings.notePresets&&DB.settings.notePresets.length?DB.settings.notePresets:null;
  let strs;
  if(raw){
    if(typeof raw[0]==='string')strs=raw;
    else strs=raw.filter(p=>p.active!==false).map(p=>p.text||p);
  }
  if(!strs||!strs.length)strs=DEFAULT_NOTE_PRESETS;
  return '<div style="margin-top:10px"><p class="muted sm" style="margin:0 0 6px">Quick modifiers:</p><div style="display:flex;flex-wrap:wrap;gap:6px">'+strs.map(p=>'<button type="button" class="btn ghost sm note-pr" data-p="'+esc(p)+'">'+esc(p)+'</button>').join('')+'</div></div>';
}
function bindNotePresets(el){
  el.querySelectorAll('.note-pr').forEach(b=>b.addEventListener('click',()=>{
    const inp=el.querySelector('[name="note"]');if(!inp)return;
    const cur=inp.value.trim();inp.value=cur?cur+', '+b.dataset.p:b.dataset.p;inp.focus();
  }));
}
A['r-note']=d=>{const l=byId2(d.id);modal({title:'Item note',body:field('Note','note',l.note,{af:1,max:100})+notePresetsHtml(),onOpen:bindNotePresets,enter:el=>$('.btn.primary',el).click(),actions:[{label:'Cancel'},{label:'Save',cls:'primary',fn:el=>{l.note=formData(el).note.trim();render()}}]})};
A['r-cat']=d=>{R.cat=d.id;render()};
A['r-type']=d=>{R.type=d.id;if(d.id!=='dine-in')R.table='';render()};
I.rq=el=>{R.q=el.value;render()};
I.rtable=el=>{R.table=el.value};
function regScan(){
  const raw=R.q.trim(); if(!raw)return;
  const p=parseScan(raw);
  if(p){addItemFlow(p.item,(p.weight||p.qty>1)?p.qty:undefined);R.q='';render();return}
  const list=DB.items.filter(i=>i.active&&(R.cat==='all'||i.categoryId===R.cat)&&match(R.q,[i.name,i.nameAr,i.sku,i.barcode]));
  if(list.length===1){addItemFlow(list[0]);R.q='';render()}else toast(list.length?'Several matches — tap the item':'No item found for "'+R.q+'"','err');
}
A['r-clear']=()=>confirmBox('Clear this ticket?',()=>{regReset();render()},'Clear');

/* ---------- guest / promo / discount / points ---------- */
A['r-guest']=()=>{
  const list=q=>DB.customers.filter(c=>match(q,[c.name,c.phone,c.email])).slice(0,30).map(c=>'<button type="button" class="pick" data-act="r-guest-set" data-id="'+c.id+'"><b>'+esc(c.name)+'</b><span class="muted">'+esc(c.phone||'')+' · '+c.points+' pts</span></button>').join('')||'<div class="empty">No guests found.</div>';
  modal({title:'Attach guest',body:'<input id="gq" type="search" placeholder="Search name or phone" autofocus aria-label="Search guests"><div id="glist" class="picks">'+list('')+'</div>',
    onOpen:el=>$('#gq',el).addEventListener('input',e=>{$('#glist',el).innerHTML=list(e.target.value)}),
    actions:[{label:'Cancel'},{label:'+ New guest',cls:'primary',fn:()=>{setTimeout(()=>modal({title:'New guest',body:guestForm(null),actions:[{label:'Cancel'},{label:'Save & attach',cls:'primary',fn:el=>saveGuest(null,formData(el),g=>{R.customerId=g.id;render()})}]}),0)}}]});
};
A['r-guest-set']=d=>{R.customerId=d.id;R.redeem=0;closeModal();render()};
A['r-guest-x']=()=>{R.customerId=null;R.redeem=0;render()};
A['r-code']=()=>{
  modal({title:'Promo code',body:field('Enter code','code','',{af:1})+'<p class="err" id="codeErr"></p>',enter:el=>$('.btn.primary',el).click(),actions:[{label:'Cancel'},{label:'Apply',cls:'primary',fn:el=>{
    const code=formData(el).code.trim().toUpperCase(), c=DB.codes.find(x=>x.code===code), sub=computeTotals(R).subtotal;
    const chk=c?codeCheck(c,sub):{ok:false,msg:'Code not found'};
    if(!chk.ok){$('#codeErr',el).textContent=chk.msg;return false}
    R.code=c.id;toast('Code applied');render();
  }}]});
};
A['r-code-x']=()=>{R.code=null;render()};
A['r-disc']=()=>{
  if(!R.cart.length){toast('Add items first','err');return}
  modal({title:'Discount',body:'<div class="form2">'+select('Type','kind',[['pct','Percent'],['amt','Amount']],R.manual?R.manual.kind:'pct')+field('Value','value',R.manual?R.manual.value:'',{type:'number',step:'0.01',min:0,af:1})+'</div><p class="muted sm">Your limit without approval: '+roleCap()+'%.</p>',
    enter:el=>$('.btn.primary',el).click(),
    actions:[{label:'Remove',fn:()=>{R.manual=null;render()}},{label:'Cancel'},{label:'Apply',cls:'primary',fn:el=>{
      const f=formData(el),v=num(f.value),sub=computeTotals(R).subtotal; if(v<=0){toast('Enter a value above zero','err');return false}
      const pct=f.kind==='pct'?v:(sub>0?v/sub*100:100); if(pct>100){toast('Discount cannot exceed 100%','err');return false}
      const apply=()=>{R.manual={kind:f.kind,value:v};render()};
      if(pct>roleCap())requireManager('Discount of '+Math.round(pct*10)/10+'% exceeds your limit of '+roleCap()+'%',apply);else apply();
    }}]});
};
A['r-pts']=()=>{
  const cu=byId(DB.customers,R.customerId), T=computeTotals(Object.assign({},R,{redeem:0})), s=DB.settings;
  const max=Math.min(cu.points,Math.ceil(T.net/s.pointValue-1e-9));
  modal({title:'Redeem points',body:'<p>Balance: <b>'+cu.points+'</b> pts · 1 pt = '+money(s.pointValue)+'</p>'+field('Points to redeem (max '+max+')','pts',R.redeem||'',{type:'number',min:0,step:1,af:1}),enter:el=>$('.btn.primary',el).click(),
    actions:[{label:'Clear',fn:()=>{R.redeem=0;render()}},{label:'Cancel'},{label:'Apply',cls:'primary',fn:el=>{const n=Math.floor(num(formData(el).pts));if(n<0||n>max){toast('Enter 0–'+max,'err');return false}R.redeem=n;render()}}]});
};

/* ---------- hold / recall ---------- */
A['r-hold']=()=>{
  modal({title:'Hold ticket',body:field('Label (e.g. table 5, name)','label','',{af:1,max:30}),enter:el=>$('.btn.primary',el).click(),actions:[{label:'Cancel'},{label:'Hold',cls:'primary',fn:el=>{
    const label=formData(el).label.trim()||('Ticket '+(DB.held.length+1));
    DB.held.push({id:uid('h'),ts:now(),label:label,user:ME.id,state:JSON.parse(JSON.stringify({cart:R.cart,type:R.type,table:R.table,customerId:R.customerId,code:R.code,manual:R.manual,redeem:R.redeem}))});
    regReset();audit('ticket.hold',label);save();toast('Held: '+label);render();
  }}]});
};
A['r-held']=()=>{
  const body=DB.held.length?tbl([{h:'Label',r:r=>'<b>'+esc(r.label)+'</b>'},{h:'Items',cls:'r',r:r=>r.state.cart.reduce((a,l)=>a+l.qty,0)},{h:'Held',r:r=>fmtDT(r.ts)+' · '+esc(userName(r.user))},{h:'',cls:'r',r:r=>'<button type="button" class="btn primary sm" data-act="r-recall" data-id="'+r.id+'">Recall</button> <button type="button" class="btn danger sm" data-act="r-held-del" data-id="'+r.id+'">Delete</button>'}],DB.held):'<div class="empty">No held tickets.</div>';
  modal({title:'Held tickets',wide:true,body:body,actions:[{label:'Close'}]});
};
A['r-recall']=d=>{
  if(R.cart.length){toast('Hold or clear the current ticket first','err');return}
  const h=byId(DB.held,d.id); if(!h)return;
  Object.assign(R,JSON.parse(JSON.stringify(h.state)));
  DB.held=DB.held.filter(x=>x.id!==h.id);save();closeModal();render();toast('Recalled '+h.label);
};
A['r-held-del']=d=>{DB.held=DB.held.filter(x=>x.id!==d.id);save();A['r-held']()};

/* ---------- payment ---------- */
let P=null;
function paidSum(){return r2(P.payments.reduce((a,p)=>a+p.amount,0))}
function payBody(){
  const due=P.total, paid=paidSum(), rem=r2(due-paid), chg=r2(P.payments.reduce((a,p)=>a+(p.tendered-p.amount),0));
  const qk=P.method==='cash'?[10,20,50,100,200,500].map(v=>'<button type="button" class="btn ghost sm" data-act="pay-q" data-id="'+v+'">'+v+'</button>').join('')+'<button type="button" class="btn ghost sm" data-act="pay-q" data-id="'+rem+'">'+tr('Exact')+'</button>':'';
  return '<div class="paysum"><div><span class="muted">'+tr('Due')+'</span><strong>'+fmt(due)+'</strong></div><div><span class="muted">'+tr('Paid')+'</span><strong>'+fmt(paid)+'</strong></div><div><span class="muted">'+(rem>0?tr('Remaining'):tr('Change'))+'</span><strong class="'+(rem>0?'neg':'pos')+'">'+fmt(rem>0?rem:chg)+'</strong></div></div>'+
    '<div class="segs">'+payMethods().map(m=>'<button type="button" class="seg'+(P.method===m[0]?' on':'')+'" data-act="pay-m" data-id="'+m[0]+'">'+m[1]+'</button>').join('')+'</div>'+
    (rem>0&&P.method==='insurance'?'<label>Insurer<input id="payIns" list="insList" value="'+esc(P.insurer||insuranceDefaults(rem).insurer)+'" maxlength="60" autocomplete="off"></label><datalist id="insList">'+insurers().map(n=>'<option value="'+esc(n)+'">').join('')+'</datalist>':'')+
    (rem>0?'<div class="payrow"><input id="payAmt" type="number" step="0.01" min="0" value="'+(P.method==='insurance'?insuranceDefaults(rem).amount:rem)+'" aria-label="Amount"><button type="button" class="btn primary" data-act="pay-add">'+tr('Add payment')+'</button></div><div class="qk">'+qk+'</div>':'')+
    (P.payments.length?'<ul class="plist">'+P.payments.map((p,i)=>'<li>'+esc(p.method.toUpperCase())+' · '+fmt(p.tendered)+(p.tendered>p.amount?' (change '+fmt(r2(p.tendered-p.amount))+')':'')+(p.locked?' <span class="muted sm">(advance already paid)</span>':' <button type="button" class="lnk bad" data-act="pay-rm" data-id="'+i+'" aria-label="Remove payment">✕</button>')+'</li>').join('')+'</ul>':'')+
    '<button type="button" class="pay done" data-act="pay-done"'+(rem>0?' disabled':'')+'>'+tr('Complete sale')+'</button>';
}
const payMethods=()=>[['cash',tr('Cash')],['card',tr('Card')],['wallet',tr('Wallet / QR')]].concat(bm('insurance')?[['insurance','Insurance']]:[],bm('credit')&&R.customerId?[['credit','On account']]:[]);
const redrawPay=()=>{const b=$('#paybody');if(b){b.innerHTML=payBody();const a=$('#payAmt');if(a){a.focus();a.select()}}};
A['r-pay']=()=>{
  if(!R.cart.length)return;
  const T=computeTotals(R);
  for(const l of T.lines){if(l.it.track&&(!DB.settings.allowNegative||expiredOnly(l.it))&&sellableOf(l.it.id)<l.qty){toast('Not enough sellable stock for '+l.it.name,'err');return}}
  const mg=ticketMargin(T), mm=minMargin();
  if(mm>0&&T.total>0&&mg.pct<mm){
    if(!can('discount_override')&&!R.marginOk){requireManager('Profit guard: margin on this ticket is '+Math.round(mg.pct)+'% (minimum '+mm+'%)',()=>{R.marginOk=true;A['r-pay']()});return}
    audit('profitguard','Sale below minimum margin: '+Math.round(mg.pct)+'% on '+money(T.total));
  }
  if(T.total<=0){completeSale([],0);return}
  P={total:T.total,payments:[],method:'cash'};
  const jb=R.jobId&&byId(DB.jobs,R.jobId); if(jb){const adv=Math.min(jobAdvance(jb),T.total); if(adv>0)P.payments.push({method:'advance',amount:adv,tendered:adv,locked:true})}
  modal({title:tr('Payment'),sticky:true,body:'<div id="paybody">'+payBody()+'</div>',enter:()=>A['pay-add'](),onOpen:()=>{const a=$('#payAmt');if(a){a.focus();a.select()}},actions:[{label:'Cancel'}]});
};
A['pay-m']=d=>{P.method=d.id;redrawPay()};
A['pay-q']=d=>{const a=$('#payAmt');if(a){a.value=d.id;A['pay-add']()}};
A['pay-add']=()=>{
  const a=$('#payAmt'); if(!a)return;
  const amt=r2(num(a.value)), rem=r2(P.total-paidSum());
  if(amt<=0){toast('Enter an amount','err');return}
  if(P.method!=='cash'&&amt>rem){toast('Card and wallet payments cannot exceed the amount due','err');return}
  if(P.method==='credit'){const cu=byId(DB.customers,R.customerId);if(!cu){toast('Attach the customer first','err');return}
    const room=creditRoom(cu);if(amt>room+0.005){if(!can('discount_override')){toast('Over the credit limit ('+money(Math.max(0,room))+' available). A manager must take this sale.','err');return}audit('credit.override',cu.name+' '+money(amt)+' over limit')}}
  let ins='';if(P.method==='insurance'){ins=(($('#payIns')||{}).value||'').trim();if(!ins){toast('Choose the insurer','err');return}P.insurer=ins}
  P.payments.push({method:P.method,amount:Math.min(amt,rem),tendered:amt,insurer:ins,customerId:P.method==='credit'?R.customerId:undefined});redrawPay();
};
A['pay-rm']=d=>{if(P.payments[+d.id]&&P.payments[+d.id].locked)return;P.payments.splice(+d.id,1);redrawPay()};
A['pay-done']=()=>{
  if(r2(P.total-paidSum())>0){toast('Amount still due','err');return}
  const pays=P.payments.map(p=>({method:p.method,amount:p.amount,tendered:p.tendered,insurer:p.insurer||'',customerId:p.customerId||undefined}));
  const change=r2(P.payments.reduce((a,p)=>a+(p.tendered-p.amount),0));
  closeModal(true);completeSale(pays,change);
};
/* Build, stock-deduct, account for and save an order from a ticket state S ({cart,customerId,code,manual,redeem,type,table}).
   Used by the register and by online / delivery-app orders. Returns the order, or null (with a toast) if it cannot be created. */
function finalizeOrder(S,sess,payments,change,extra){
  const T=computeTotals(S); if(!S.cart.length)return null;
  for(const l of T.lines){if(l.it.track&&(!DB.settings.allowNegative||expiredOnly(l.it))&&sellableOf(l.it.id)<l.qty){toast("Not enough sellable stock for "+l.it.name,"err");return null}}
  const ct=byId(DB.counters,sess.counterId); DB.seq.order++;
  const no=ct.code+"-"+String(DB.seq.order).padStart(5,"0");
  const lines=T.lines.map(l=>{
    const allocs=l.it.track?deductStock(l.it.id,l.qty,"Sale "+no):[];
    const cat=byId(DB.categories,l.it.categoryId);
    const kotEnabled=!(DB.settings.features&&DB.settings.features.kotPrinting===false);
    return {itemId:l.it.id,name:l.it.name,qty:l.qty,price:l.unit,cost:l.it.cost,tax:l.it.tax,note:l.note,unit:l.it.unit||'',kind:l.it.kind||'product',rx:l.rx||null,provider:l.provider||'',serial:l.serial||null,allocs:allocs,cogs:l.it.track?allocCost(allocs,l.it.id):0,kotPrinter:kotEnabled?(cat&&cat.kotPrinter)||null:null};
  });
  const cu=byId(DB.customers,S.customerId), earned=cu?Math.floor(T.total*DB.settings.pointsPerAed):0;
  const usedCode=T.discounts.some(d=>d.kind==="code")?S.code:null;
  const order=Object.assign({id:uid("o"),no:no,ts:now(),counterId:sess.counterId,sessionId:sess.id,userId:ME.id,type:S.type,table:S.type==="dine-in"?S.table:"",customerId:cu?cu.id:null,lines:lines,
    subtotal:T.subtotal,discounts:T.discounts,discountTotal:T.discountTotal,charges:T.charges,chargeTotal:T.chargeTotal,vat:T.vat,total:T.total,payments:payments,change:change,status:"completed",vehicle:S.vehicle||null,jobId:S.jobId||null,driverId:S.type==="delivery"?(S.driverId||null):null,pointsEarned:earned,pointsRedeemed:T.redeemed,code:usedCode,kds:(bm("kitchen")&&!(DB.settings.features&&DB.settings.features.kotPrinting===false))?{status:"new",ts:now()}:undefined,insurer:((payments.find(p=>p.method==="insurance"))||{}).insurer||"",marginPct:Math.round(ticketMargin(T).pct*10)/10},extra||{});
  if(cu){cu.points=Math.max(0,cu.points-T.redeemed+earned);cu.visits++;cu.spend=r2(cu.spend+T.total)}
  if(usedCode){const c=byId(DB.codes,usedCode);if(c)c.used++}
  DB.orders.push(order);if(typeof logRx==="function")logRx(order);postSale(order);if(typeof einvStamp==="function")einvStamp(order,"invoice");if(bm("serial"))recordWarranty(order);if(S.jobId)finishJob(order,S.jobId);if(S.vehicle&&cu)rememberVehicle(cu.id,S.vehicle);audit("sale",no+" "+money(T.total));save();
  return order;
}
function completeSale(payments,change){
  const sess=curSession(); if(!sess){toast("Register is not open","err");return}
  const order=finalizeOrder(R,sess,payments,change); if(!order)return;
  regReset();render();
  showReceipt(order,[{label:"New order",cls:"primary"}]);
}

/* ---------- business hours auto-close ---------- */
let _bhAlerted=false,_bhAlertDay=-1;
function checkBusinessHours(){
  if(!curSession())return;
  if(DB.settings.features&&DB.settings.features.businessHours===false)return;
  const bh=DB.settings.businessHours;if(!bh||!bh.length)return;
  const d=new Date(),jsDay=d.getDay(); // 0=Sun,1=Mon,...6=Sat
  const dayIdx=[6,0,1,2,3,4,5][jsDay]; // map to our array Mon=0...Sun=6
  const todayBH=bh[dayIdx];if(!todayBH||!todayBH.enabled)return;
  const hm=d.getHours()*60+d.getMinutes();
  const [ch,cm]=(todayBH.close||'22:00').split(':').map(Number);
  const closeMin=ch*60+cm;
  if(hm>=closeMin){
    if(!_bhAlerted||_bhAlertDay!==dayIdx){
      _bhAlerted=true;_bhAlertDay=dayIdx;
      if(DB.settings.autoCloseShift)A['r-close']();else showBHClose();
    }
  }else{_bhAlerted=false;}
}
function showBHClose(){
  const s=curSession();if(!s)return;
  const st=sessionStats(s);
  const rows=Object.keys(st.tender).map(k=>'<tr><td>'+esc(k.charAt(0).toUpperCase()+k.slice(1))+' sales</td><td style="text-align:right">'+money(st.tender[k])+'</td></tr>').join('');
  modal({title:'Business hours ended',body:
    '<p class="warn-t">Your closing time has been reached. Please close the register.</p>'+
    '<table style="width:100%;margin-top:12px;border-collapse:collapse">'+
    '<tr><td>Opening float</td><td style="text-align:right"><b>'+money(s.float)+'</b></td></tr>'+
    rows+
    '<tr><td>Cash in</td><td style="text-align:right">'+money(st.vin)+'</td></tr>'+
    '<tr><td>Cash out / expenses</td><td style="text-align:right">−'+money(st.vout)+'</td></tr>'+
    '<tr style="border-top:2px solid var(--border)"><td><b>Total sales</b></td><td style="text-align:right"><b>'+money(st.net)+'</b></td></tr>'+
    '<tr><td><b>Expected in drawer</b></td><td style="text-align:right"><b>'+money(st.expected)+'</b></td></tr>'+
    '</table>',
    actions:[{label:'Close later'},{label:'Close register now',cls:'danger',fn:()=>{setTimeout(()=>A['r-close'](),100)}}]});
}
setInterval(checkBusinessHours,60000);

/* ---------- orders today, vouchers, close ---------- */
A['r-orders']=()=>{
  const s=curSession(), rows=DB.orders.filter(o=>o.sessionId===s.id).reverse();
  modal({title:'This session\'s orders',wide:true,body:tbl([{h:'#',r:r=>'<b>'+esc(r.no)+'</b>'},{h:'Time',r:r=>fmtDT(r.ts)},{h:'Total',cls:'r',r:r=>fmt(r.total)},{h:'Status',r:r=>badge(r.status,r.status==='completed'?'ok':'bad')},{h:'',cls:'r',r:r=>'<button type="button" class="btn ghost sm" data-act="order-view" data-id="'+r.id+'">Open</button>'}],rows,'No orders yet this session.'),actions:[{label:'Close'}]});
};
A['r-voucher']=()=>{
  const s=curSession();
  modal({title:'Cash in / out',body:'<div class="form2">'+select('Type','type',[['in','Cash in (add to drawer)'],['out','Cash out (paid out)']],'out')+field('Amount','amount','',{type:'number',step:'0.01',min:0,af:1})+'</div>'+field('Reason (required)','reason',''),
    actions:[{label:'Cancel'},{label:'Record',cls:'primary',fn:el=>{
      const f=formData(el),amt=r2(num(f.amount)); if(amt<=0||!f.reason.trim()){toast('Amount and reason are required','err');return false}
      const rec=()=>{const cv={id:uid('v'),sessionId:s.id,ts:now(),type:f.type,amount:amt,reason:f.reason.trim(),userId:ME.id};DB.vouchers.push(cv);postCashVoucher(cv);audit('voucher',f.type+' '+amt+' '+f.reason.trim());save();toast('Recorded');render();setTimeout(()=>showTxSlip(voucherSlip(cv)),0)};
      if(amt>VOUCHER_LIMIT&&!can('voucher'))requireManager('Cash '+f.type+' of '+money(amt)+' exceeds '+money(VOUCHER_LIMIT),rec);else rec();
    }}]});
};
A['r-close']=()=>{
  const s=curSession();
  if(R.cart.length){toast('Finish, hold or clear the current ticket before closing','err');return}
  modal({title:'Close register — blind count',body:'<p class="muted">Count all cash in the drawer. The expected amount is shown after you submit.</p>'+field('Counted cash','counted','',{type:'number',step:'0.01',min:0,af:1})+(DB.held.length?'<p class="warn-t">'+DB.held.length+' held ticket(s) will stay saved.</p>':''),
    enter:el=>$('.btn.danger',el).click(),
    actions:[{label:'Cancel'},{label:'Close register',cls:'danger',fn:el=>{
      const f=formData(el); if(f.counted===''||num(f.counted)<0){toast('Enter the counted cash','err');return false}
      const counted=r2(num(f.counted)), st=sessionStats(s), variance=r2(counted-st.expected);
      const fin=()=>{s.counted=counted;s.variance=variance;s.closedAt=now();s.closedBy=ME.id;R.sessionId=null;postCashVariance(s);audit('register.close','variance '+variance);save();render();
        modal({title:'Z report',body:zReportHtml(s),actions:[{label:'Print',cls:'primary',keep:true,fn:()=>{printHtml(zReportHtml(s));return false}},{label:'Done'}]})};
      if(Math.abs(variance)>5&&!can('voucher'))requireManager('Cash variance of '+money(variance)+' needs manager approval',fin);else fin();
    }}]});
};
